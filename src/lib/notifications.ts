import {randomUUID} from 'node:crypto';
import type {Database,Sql} from './intake.ts';

export type Message={from:string;to:string;subject:string;text:string};
export type Job={id:string;requestId:string;eventKey:string;eventType:string;token:string;attempt:number;firstAttemptAt:Date;message:Message|null};
export class DeliveryError extends Error {
 code:string;retryable:boolean;
 constructor(code:string,retryable=true){super(code);this.code=code;this.retryable=retryable;}
}
export interface DeliveryProvider {send(message:Message,key:string,signal:AbortSignal):Promise<{messageId:string}>}
export type WorkerOptions={from:string;staffEmail:string;leaseSeconds?:number;timeoutMs?:number;maxAttempts?:number;dedupeWindowSeconds?:number;random?:()=>number};

function email(value:string){return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)&&value.length<=254;}
export function retrySeconds(attempt:number,random:()=>number=Math.random){return Math.min(3600,30*2**Math.min(10,Math.max(0,attempt-1)))+Math.floor(Math.max(0,Math.min(.999,random()))*15);}
function validateOptions(options:WorkerOptions){
 if(!email(options.from)||!email(options.staffEmail))throw new Error('NOTIFICATION_ADDRESSES_NOT_CONFIGURED');
 const lease=options.leaseSeconds??60;const timeout=options.timeoutMs??10000;
 if(!Number.isInteger(lease)||lease<2||lease>600||timeout<1||timeout>30000||lease*1000<timeout+1000)throw new Error('INVALID_NOTIFICATION_LEASE');
 if(!Number.isInteger(options.maxAttempts??8)||(options.maxAttempts??8)<1||(options.maxAttempts??8)>20)throw new Error('INVALID_NOTIFICATION_ATTEMPTS');
 if((options.dedupeWindowSeconds??82800)<1||(options.dedupeWindowSeconds??82800)>82800)throw new Error('INVALID_DEDUPE_WINDOW');
}
export async function claimNotification(database:Database,options:WorkerOptions):Promise<Job|null>{
 validateOptions(options);const db=await database.connect();
 try{
 await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='10s'");
 const candidates=await db.query(`SELECT id,request_id,event_key,event_type,attempts,first_attempt_at,message,lease_token
 FROM notifications WHERE dead_at IS NULL AND
 ((state IN ('pending','failed') AND next_attempt_at<=now()) OR (state='processing' AND lease_until<=now()))
 ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`);
 const row=candidates.rows[0];if(!row){await db.query('COMMIT');return null;}
 if(row.lease_token)await db.query("UPDATE notification_attempts SET outcome='expired',finished_at=now(),error_code='LEASE_EXPIRED' WHERE lease_token=$1 AND outcome='processing'",[row.lease_token]);
 const age=await db.query('SELECT $1::timestamptz IS NOT NULL AND $1::timestamptz<=now()-make_interval(secs=>$2::int) AS expired',[row.first_attempt_at,options.dedupeWindowSeconds??82800]);
 if(Number(row.attempts)>=(options.maxAttempts??8)||age.rows[0].expired){
 await db.query("UPDATE notifications SET state='failed',dead_at=now(),lease_token=NULL,lease_until=NULL,last_error_code=$2 WHERE id=$1",[row.id,age.rows[0].expired?'DEDUPE_WINDOW_EXPIRED':'ATTEMPTS_EXHAUSTED']);
 await db.query("INSERT INTO audit_logs(action,entity_type,entity_id,metadata) VALUES('notification.dead','notification',$1,'{}')",[row.id]);
 await db.query('COMMIT');return null;
 }
 const token=randomUUID();const attempt=Number(row.attempts)+1;
 const updated=await db.query(`UPDATE notifications SET state='processing',lease_token=$2,lease_until=now()+make_interval(secs=>$3::int),attempts=$4,first_attempt_at=COALESCE(first_attempt_at,now()) WHERE id=$1 RETURNING first_attempt_at`,[row.id,token,options.leaseSeconds??60,attempt]);
 await db.query('INSERT INTO notification_attempts(notification_id,attempt,lease_token) VALUES($1,$2,$3)',[row.id,attempt,token]);
 await db.query('COMMIT');
 return {id:String(row.id),requestId:String(row.request_id),eventKey:String(row.event_key),eventType:String(row.event_type),token,attempt,firstAttemptAt:new Date(updated.rows[0].first_attempt_at as string),message:row.message as Message|null};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
async function frozenMessage(database:Database,job:Job,options:WorkerOptions):Promise<Message|null>{
 const db=await database.connect();try{
 if(!job.message){
 const rows=await db.query('SELECT q.reference,q.locale,c.email FROM quote_requests q JOIN contacts c ON c.id=q.contact_id WHERE q.id=$1',[job.requestId]);
 const row=rows.rows[0];if(!row)throw new DeliveryError('REQUEST_MISSING',false);
 const ref=String(row.reference);const locale=String(row.locale);
 const customer=job.eventType==='quote.created.customer';
 if(!customer&&job.eventType!=='quote.created.staff')throw new DeliveryError('UNSUPPORTED_EVENT',false);
 const text=customer?(locale==='th'?'ได้รับคำขอใบเสนอราคาของคุณแล้ว เลขอ้างอิง: ':locale==='zh'?'已收到您的询价，编号：':'Your quote request has been received. Reference: ')+ref:'A new quote request is available for staff review. Reference: '+ref;
 const to=customer?String(row.email):options.staffEmail;if(!email(to))throw new DeliveryError('INVALID_RECIPIENT',false);
 const message:Message={from:options.from,to,subject:(customer?'KPN WAGON — Request received ':'KPN WAGON — New request ')+ref,text};
 const result=await db.query(`UPDATE notifications SET message=COALESCE(message,$3::jsonb) WHERE id=$1 AND lease_token=$2 AND state='processing' AND lease_until>now() RETURNING message`,[job.id,job.token,JSON.stringify(message)]);
 return result.rows.length?result.rows[0].message as Message:null;
 }
 // A fresh configuration must never alter a retry's provider-idempotency payload.
 const valid=await db.query("SELECT id FROM notifications WHERE id=$1 AND lease_token=$2 AND state='processing' AND lease_until>now()",[job.id,job.token]);
 return valid.rows.length?job.message:null;
 }finally{db.release();}
}
export async function finishNotification(database:Database,job:Job,result:{messageId?:string;errorCode?:string;retryable?:boolean},options:WorkerOptions):Promise<boolean>{
 const db=await database.connect();try{
 await db.query('BEGIN');
 const active=await db.query("SELECT id FROM notifications WHERE id=$1 AND lease_token=$2 AND state='processing' AND lease_until>now() FOR UPDATE",[job.id,job.token]);
 if(!active.rows.length){await db.query('ROLLBACK');return false;}
 const success=!!result.messageId;const terminal=!success&&(result.retryable===false||job.attempt>=(options.maxAttempts??8));
 const code=success?null:(result.errorCode??'PROVIDER_FAILURE');
 await db.query(`UPDATE notifications SET state=$3,provider_message_id=CASE WHEN $3='sent' THEN $4 ELSE provider_message_id END,
 sent_at=CASE WHEN $3='sent' THEN now() ELSE sent_at END,last_error_code=$5,lease_token=NULL,lease_until=NULL,
 next_attempt_at=now()+make_interval(secs=>$6::int),dead_at=CASE WHEN $7::boolean THEN now() ELSE NULL END WHERE id=$1 AND lease_token=$2`,
 [job.id,job.token,success?'sent':'failed',result.messageId??null,code,retrySeconds(job.attempt,options.random),terminal]);
 await db.query('UPDATE notification_attempts SET outcome=$2,finished_at=now(),error_code=$3 WHERE lease_token=$1',[job.token,success?'sent':terminal?'dead':'failed',code]);
 await db.query("INSERT INTO audit_logs(action,entity_type,entity_id,metadata) VALUES($1,'notification',$2,$3::jsonb)",[success?'notification.sent':terminal?'notification.dead':'notification.retry',job.id,JSON.stringify({attempt:job.attempt,errorCode:code})]);
 await db.query('COMMIT');return true;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
export async function processOneNotification(database:Database,provider:DeliveryProvider,options:WorkerOptions){
 const job=await claimNotification(database,options);if(!job)return {outcome:'idle'} as const;
 try{
 const message=await frozenMessage(database,job,options);if(!message)return {outcome:'lease-lost'} as const;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let delivered:{messageId:string};
 try{delivered=await Promise.race([provider.send(message,job.eventKey,controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new DeliveryError('PROVIDER_TIMEOUT'));},options.timeoutMs??10000);})]);}
 finally{if(timer)clearTimeout(timer);}
 if(!delivered.messageId||delivered.messageId.length>254)throw new DeliveryError('INVALID_PROVIDER_RESPONSE');
 const updated=await finishNotification(database,job,{messageId:delivered.messageId},options);
 return {outcome:updated?'sent':'lease-lost'} as const;
 }catch(error){
 // Never persist provider response bodies, contacts or arbitrary exception messages.
 const known=error instanceof DeliveryError?error:new DeliveryError('PROVIDER_FAILURE');
 const code=/^[A-Z0-9_]{1,64}$/.test(known.code)?known.code:'PROVIDER_FAILURE';
 const updated=await finishNotification(database,job,{errorCode:code,retryable:known.retryable},options);
 return {outcome:updated?'failed':'lease-lost'} as const;
 }
}
