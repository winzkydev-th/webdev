import {createHash,createHmac} from 'node:crypto';
import {validateQuote} from './domain.ts';
import type {QuoteInput} from './domain.ts';
export interface Sql {query(text:string,values?:unknown[]):Promise<{rows:Record<string,unknown>[]}>}
export interface Connection extends Sql {release():void}
export interface Database {connect():Promise<Connection>}
export class IntakeError extends Error {status:number;code:string;fields:string[];constructor(status:number,code:string,fields:string[]=[]){super(code);this.status=status;this.code=code;this.fields=fields;}}
export type Submission=QuoteInput&{locale:'th'|'en'|'zh'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function normalize(value:unknown):Submission {
 const errors=validateQuote(value);if(errors.length)throw new IntakeError(422,'INVALID_INPUT',errors);
 const v=value as Record<string,unknown>;
 const allowed=['service','name','email','phone','origin','destination','cargo','weightKg','container','customsDirection','privacyAcknowledged','marketingConsent','website','locale'];
 if(Object.keys(v).some(k=>!allowed.includes(k)))throw new IntakeError(422,'INVALID_INPUT',['unexpected_field']);
 if(!['th','en','zh'].includes(v.locale as string))throw new IntakeError(422,'INVALID_INPUT',['locale']);
 const text=(k:string)=>(v[k] as string).trim().normalize('NFC');
 const q:Submission={service:v.service as Submission['service'],name:text('name'),email:text('email').toLowerCase(),phone:text('phone'),origin:text('origin'),destination:text('destination'),cargo:text('cargo'),locale:v.locale as Submission['locale'],privacyAcknowledged:true,marketingConsent:v.marketingConsent as boolean};
 for(const k of ['name','email','phone','origin','destination','cargo'] as const)if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(q[k]))throw new IntakeError(422,'INVALID_INPUT',[k]);
 if(q.service==='sea')q.container=v.container as string;
 if(q.service==='air'||q.service==='land')q.weightKg=v.weightKg as number;
 if(q.service==='customs')q.customsDirection=v.customsDirection as 'import'|'export';
 return q;
}
async function consume(db:Sql,bucket:string,limit:number){
 const result=await db.query(`INSERT INTO intake_rate_limits(bucket,window_start,hits) VALUES($1,now(),1)
 ON CONFLICT(bucket) DO UPDATE SET
 hits=CASE WHEN intake_rate_limits.window_start<=now()-interval '15 minutes' THEN 1 ELSE intake_rate_limits.hits+1 END,
 window_start=CASE WHEN intake_rate_limits.window_start<=now()-interval '15 minutes' THEN now() ELSE intake_rate_limits.window_start END
 RETURNING hits`,[bucket]);
 if(Number(result.rows[0].hits)>limit)throw new IntakeError(429,'RATE_LIMITED');
}
export async function submitQuote(database:Database,value:unknown,key:string,options:{privacyVersion:string;rateSecret:string;contactLimit?:number;globalLimit?:number}) {
 if(!uuid.test(key))throw new IntakeError(400,'INVALID_IDEMPOTENCY_KEY');
 const q=normalize(value);
 if(!options.privacyVersion||options.rateSecret.length<32)throw new IntakeError(503,'INTAKE_NOT_READY');
 const hash=createHash('sha256').update(JSON.stringify({notice:options.privacyVersion,...q})).digest('hex');
 const client=await database.connect();
 try{
 await client.query('BEGIN');
 await client.query("SET LOCAL statement_timeout = '10s'");
 await client.query("SET LOCAL lock_timeout = '5s'");
 // Serialize requests with the same unguessable key, across processes and servers.
 await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key.toLowerCase()]);
 const existing=await client.query('SELECT reference,payload_hash FROM quote_requests WHERE idempotency_key=$1',[key]);
 if(existing.rows.length){
 if(existing.rows[0].payload_hash!==hash)throw new IntakeError(409,'IDEMPOTENCY_CONFLICT');
 await client.query('COMMIT');return {reference:String(existing.rows[0].reference),replayed:true};
 }
 // Global first gives stable lock ordering. Buckets contain no raw email/IP.
 await consume(client,'global',options.globalLimit??200);
 const bucket=createHmac('sha256',options.rateSecret).update(q.email).digest('hex');
 await consume(client,'contact:'+bucket,options.contactLimit??5);
 const contact=await client.query('INSERT INTO contacts(name,email,phone) VALUES($1,$2,$3) RETURNING id',[q.name,q.email,q.phone]);
 const request=await client.query(`INSERT INTO quote_requests(idempotency_key,payload_hash,contact_id,locale,service,privacy_notice_version,privacy_acknowledged_at,marketing_consent)
 VALUES($1,$2,$3,$4,$5,$6,now(),$7) RETURNING id,reference`,[key,hash,contact.rows[0].id,q.locale,q.service,options.privacyVersion,q.marketingConsent]);
 const row=request.rows[0];
 await client.query(`INSERT INTO quote_cargo_details(request_id,origin,destination,description,weight_kg,container_mode,customs_direction)
 VALUES($1,$2,$3,$4,$5,$6,$7)`,[row.id,q.origin,q.destination,q.cargo,q.weightKg??null,q.container??null,q.customsDirection??null]);
 await client.query("INSERT INTO audit_logs(action,entity_type,entity_id,metadata) VALUES('quote.submitted','quote_request',$1,$2::jsonb)",[row.id,JSON.stringify({service:q.service,locale:q.locale})]);
 await client.query('COMMIT');
 return {reference:String(row.reference),replayed:false};
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
