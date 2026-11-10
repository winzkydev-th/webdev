import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {authorize} from './domain.ts';import type {Principal} from './domain.ts';import type {Database} from './intake.ts';
import type {PrivateFileStore} from './private-files.ts';import type {FileScanner} from './clamav.ts';
export class AttachmentError extends Error {status:number;constructor(status:number,code:string){super(code);this.status=status;}}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const maxFileBytes=10485760;
const sha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');
export function inspectFile(name:string,declaredType:string,data:Uint8Array){
 if(!name||name.length>180||/[\\/:<>"|?*\u0000-\u001f\u007f]/.test(name)||name.startsWith('.')||name.trim()!==name)throw new AttachmentError(422,'INVALID_FILENAME');
 if(data.length<8||data.length>maxFileBytes)throw new AttachmentError(413,'INVALID_FILE_SIZE');
 const b=Buffer.from(data);let media:string;let suffix:string[];
 if(b.subarray(0,5).toString('ascii')==='%PDF-'&&b.subarray(Math.max(0,b.length-1024)).toString('latin1').includes('%%EOF')){media='application/pdf';suffix=['pdf'];}
 else if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.subarray(-8,-4).toString('ascii')==='IEND'){media='image/png';suffix=['png'];}
 else if(b[0]===255&&b[1]===216&&b[2]===255&&b[b.length-2]===255&&b[b.length-1]===217){media='image/jpeg';suffix=['jpg','jpeg'];}
 else throw new AttachmentError(415,'UNSUPPORTED_FILE_SIGNATURE');
 if(media!==declaredType||!suffix.includes(name.split('.').pop()!.toLowerCase()))throw new AttachmentError(415,'FILE_TYPE_MISMATCH');
 return {mediaType:media,hash:sha(data)};
}
// Capability issuance is server-internal: invoke only immediately after authorized request creation.
// No unauthenticated HTTP endpoint exposes this function.
export async function issueUploadPermit(database:Database,requestId:string){
 if(!uuid.test(requestId))throw new AttachmentError(400,'INVALID_REQUEST');
 const token=randomBytes(32).toString('hex');const db=await database.connect();try{
 await db.query("INSERT INTO attachment_upload_permits(token_hash,request_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",[sha(token),requestId]);return token;
 }finally{db.release();}
}
export async function uploadPrivateAttachment(database:Database,store:PrivateFileStore,scanner:FileScanner,input:{token:string;uploadKey:string;name:string;mediaType:string;data:Uint8Array},options:{scanTimeoutMs?:number}={}){
 if(!/^[a-f0-9]{64}$/.test(input.token)||!uuid.test(input.uploadKey))throw new AttachmentError(403,'INVALID_UPLOAD_PERMIT');
 const inspected=inspectFile(input.name,input.mediaType,input.data);const db=await database.connect();let id:string|undefined;
 try{
 await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
 const permit=await db.query('SELECT request_id FROM attachment_upload_permits WHERE token_hash=$1 AND expires_at>now() AND revoked_at IS NULL FOR UPDATE',[sha(input.token)]);
 if(!permit.rows.length)throw new AttachmentError(403,'INVALID_UPLOAD_PERMIT');const requestId=permit.rows[0].request_id;
 // Different permits on the same request must share the quota/idempotency lock.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,9173))',[requestId]);
 const existing=await db.query('SELECT id,sha256,original_name,media_type,scan_status,object_state FROM attachments WHERE request_id=$1 AND upload_key=$2',[requestId,input.uploadKey]);
 if(existing.rows.length){const row=existing.rows[0];if(row.sha256!==inspected.hash||row.original_name!==input.name||row.media_type!==input.mediaType)throw new AttachmentError(409,'UPLOAD_KEY_CONFLICT');await db.query('COMMIT');return {id:String(row.id),state:row.object_state==='failed'?'upload-failed':row.object_state==='pending'?'upload-pending':String(row.scan_status),replayed:true};}
 const count=await db.query('SELECT count(*)::int AS n FROM attachments WHERE request_id=$1',[requestId]);if(Number(count.rows[0].n)>=5)throw new AttachmentError(429,'ATTACHMENT_LIMIT');
 const created=await db.query(`INSERT INTO attachments(request_id,object_key,original_name,media_type,size_bytes,sha256,upload_key) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[requestId,randomUUID(),input.name,inspected.mediaType,input.data.length,inspected.hash,input.uploadKey]);id=String(created.rows[0].id);
 await db.query("INSERT INTO audit_logs(action,entity_type,entity_id,metadata) VALUES('attachment.quarantined','attachment',$1,'{}')",[id]);await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
 const connection=await database.connect();
 try{
 const row=(await connection.query('SELECT object_key FROM attachments WHERE id=$1',[id])).rows[0];
 try{await store.put(String(row.object_key),input.data);}catch{
 await connection.query("UPDATE attachments SET object_state='failed',last_error_code='OBJECT_WRITE_FAILED' WHERE id=$1",[id]);throw new AttachmentError(503,'OBJECT_WRITE_FAILED');}
 await connection.query("UPDATE attachments SET object_state='stored' WHERE id=$1",[id]);
 }finally{connection.release();}
 return {id:id!,state:await scanStoredAttachment(database,store,scanner,id!,options),replayed:false};
}
export async function scanStoredAttachment(database:Database,store:PrivateFileStore,scanner:FileScanner,id:string,options:{scanTimeoutMs?:number}={}){
 const timeout=options.scanTimeoutMs??15000;if(timeout<1||timeout>30000)throw new AttachmentError(500,'INVALID_SCAN_TIMEOUT');
 const token=randomUUID();const db=await database.connect();try{
 const claimed=await db.query(`UPDATE attachments SET scan_lease_token=$2,scan_lease_until=now()+interval '60 seconds',scan_attempts=scan_attempts+1
 WHERE id=$1 AND object_state='stored' AND scan_status='quarantined' AND next_scan_at<=now() AND (scan_lease_until IS NULL OR scan_lease_until<=now()) RETURNING *`,[id,token]);
 if(!claimed.rows.length)return 'unclaimed';const row=claimed.rows[0];let state:'clean'|'rejected'|'quarantined'='quarantined';let errorCode:string|null=null;
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
 const data=await store.get(String(row.object_key));if(data.length!==Number(row.size_bytes)||sha(data)!==row.sha256){state='rejected';errorCode='FILE_INTEGRITY_FAILURE';}
 else{
 const verdict=await Promise.race([scanner.scan(data,controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('SCAN_TIMEOUT'));},timeout);})]);
 if(verdict==='clean')state='clean';else if(verdict==='infected'){state='rejected';errorCode='MALWARE_DETECTED';}else errorCode='INVALID_SCANNER_RESPONSE';
 }
 }catch{errorCode='SCAN_UNAVAILABLE';}finally{if(timer)clearTimeout(timer);}
 await db.query('BEGIN');try{
 const result=await db.query(`UPDATE attachments SET scan_status=$3,last_error_code=$4,scan_lease_token=NULL,scan_lease_until=NULL,next_scan_at=now()+interval '1 minute'
 WHERE id=$1 AND scan_lease_token=$2 AND scan_lease_until>now() RETURNING id`,[id,token,state,errorCode]);
 if(!result.rows.length){await db.query('ROLLBACK');return 'lease-lost';}
 await db.query("INSERT INTO audit_logs(action,entity_type,entity_id,metadata) VALUES($1,'attachment',$2,$3::jsonb)",[state==='clean'?'attachment.clean':state==='rejected'?'attachment.rejected':'attachment.scan_retry',id,JSON.stringify({errorCode})]);
 await db.query('COMMIT');return state;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}
 }finally{db.release();}
}
export async function downloadPrivateAttachment(database:Database,store:PrivateFileStore,principal:Principal|null,id:string){
 if(!principal||!uuid.test(id))throw new AttachmentError(403,'FORBIDDEN');const db=await database.connect();try{
 const row=(await db.query('SELECT a.*,q.assigned_to FROM attachments a JOIN quote_requests q ON q.id=a.request_id WHERE a.id=$1',[id])).rows[0];
 if(!row||!authorize(principal,'read',row.assigned_to as string))throw new AttachmentError(403,'FORBIDDEN');
 if(row.scan_status!=='clean'||row.object_state!=='stored')throw new AttachmentError(409,'FILE_NOT_AVAILABLE');
 let data:Uint8Array;try{data=await store.get(String(row.object_key));}catch{throw new AttachmentError(503,'FILE_NOT_AVAILABLE');}
 if(data.length!==Number(row.size_bytes)||sha(data)!==row.sha256)throw new AttachmentError(503,'FILE_INTEGRITY_FAILURE');
 await db.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'attachment.downloaded','attachment',$2,'{}')",[principal.id,id]);
 return {data,headers:{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(String(row.original_name)),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'"}};
 }finally{db.release();}
}
