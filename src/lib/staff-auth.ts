import {createHash,createHmac,randomBytes,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import * as oidc from 'openid-client';
import type {Database,Sql} from './intake.ts';import type {Principal} from './domain.ts';
export class StaffError extends Error {status:number;constructor(status:number,code:string){super(code);this.status=status;}}
export type StaffConfig={enabled:boolean;issuer:string;clientId:string;clientSecret:string;origin:string;key:string;mfaAcrValues:string[];appEnv:string;allowLoopback:boolean};
export function staffConfig():StaffConfig{return {enabled:process.env.STAFF_AUTH_ENABLED==='true',issuer:process.env.OIDC_ISSUER??'',clientId:process.env.OIDC_CLIENT_ID??'',clientSecret:process.env.OIDC_CLIENT_SECRET??'',origin:process.env.STAFF_ORIGIN??'',key:process.env.STAFF_SESSION_KEY??'',mfaAcrValues:(process.env.OIDC_MFA_ACR_VALUES??'').split(' ').filter(Boolean),appEnv:process.env.APP_ENV??'',allowLoopback:process.env.OIDC_ALLOW_LOOPBACK_TEST==='true'};}
export function validateStaffConfig(config:StaffConfig){
 if(!config.enabled||!config.clientId||!config.clientSecret||!config.mfaAcrValues.length)throw new StaffError(503,'STAFF_NOT_CONFIGURED');
 let issuer:URL;let origin:URL;try{issuer=new URL(config.issuer);origin=new URL(config.origin);}catch{throw new StaffError(503,'STAFF_NOT_CONFIGURED');}
 const loopback=(url:URL)=>url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);
 const local=config.appEnv==='development'&&config.allowLoopback&&loopback(issuer)&&loopback(origin);
 if((!local&&(issuer.protocol!=='https:'||origin.protocol!=='https:'))||issuer.username||issuer.password||issuer.search||issuer.hash||origin.origin!==config.origin||!/^[A-Za-z0-9+/]{43}=$/.test(config.key)||Buffer.from(config.key,'base64').length!==32)throw new StaffError(503,'STAFF_NOT_CONFIGURED');
 return {local,origin:origin.origin,callback:origin.origin+'/staff/auth/callback',sessionCookie:local?'kpn_staff_dev':'__Host-kpn_staff',loginCookie:local?'kpn_login_dev':'__Host-kpn_login'};
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function seal(value:object,key:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');}
function unseal(value:string,key:string){try{if(value.length>4096)throw new Error();const b=Buffer.from(value,'base64url');const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),b.subarray(0,12));decipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(b.subarray(28)),decipher.final()]).toString('utf8'));}catch{throw new StaffError(401,'LOGIN_FAILED');}}
export function sessionCsrf(token:string,config:StaffConfig){return createHmac('sha256',Buffer.from(config.key,'base64')).update('staff-csrf:'+token).digest('base64url');}
export function verifyStaffMutation(request:Request,token:string,config:StaffConfig){const {origin}=validateStaffConfig(config);const expected=sessionCsrf(token,config);const actual=request.headers.get('x-csrf-token')??'';if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw new StaffError(403,'FORBIDDEN');}
export function readStaffCookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??'';}
export function staffCookie(name:string,value:string,config:StaffConfig,maxAge:number){const {local}=validateStaffConfig(config);return name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(local?'':'; Secure');}
async function provider(config:StaffConfig){const {local}=validateStaffConfig(config);return oidc.discovery(new URL(config.issuer),config.clientId,{client_secret:config.clientSecret,id_token_signed_response_alg:'RS256'},undefined,{execute:local?[oidc.allowInsecureRequests,oidc.enableNonRepudiationChecks]:[oidc.enableNonRepudiationChecks],timeout:5});}
export async function startStaffLogin(database:Database,config:StaffConfig){
 const settings=validateStaffConfig(config);const client=await provider(config);const verifier=oidc.randomPKCECodeVerifier();const state=oidc.randomState();const nonce=oidc.randomNonce();
 const db=await database.connect();try{
 await db.query('BEGIN');const limit=await db.query(`INSERT INTO intake_rate_limits(bucket,window_start,hits) VALUES('staff-login',now(),1) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN intake_rate_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE intake_rate_limits.hits+1 END,window_start=CASE WHEN intake_rate_limits.window_start<now()-interval '15 minutes' THEN now() ELSE intake_rate_limits.window_start END RETURNING hits`);
 if(Number(limit.rows[0].hits)>100)throw new StaffError(429,'TOO_MANY_LOGIN_ATTEMPTS');
 await db.query("INSERT INTO staff_login_transactions(state_hash,expires_at) VALUES($1,now()+interval '5 minutes')",[hash(state)]);await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
 const url=oidc.buildAuthorizationUrl(client,{redirect_uri:settings.callback,scope:'openid',code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state,nonce,max_age:'900',acr_values:config.mfaAcrValues.join(' ')});
 return {url:url.href,cookie:seal({state,nonce,verifier,expires:Date.now()+300000},config.key)};
}
export async function completeStaffLogin(database:Database,config:StaffConfig,url:URL,loginCookie:string){
 const settings=validateStaffConfig(config);if(url.origin!==settings.origin||url.pathname!=='/staff/auth/callback')throw new StaffError(401,'LOGIN_CALLBACK_MISMATCH');
 const attempt=unseal(loginCookie,config.key);if(typeof attempt.state!=='string'||typeof attempt.nonce!=='string'||typeof attempt.verifier!=='string'||!Number.isFinite(attempt.expires)||attempt.expires<Date.now()||url.searchParams.get('state')!==attempt.state)throw new StaffError(401,'LOGIN_STATE_REJECTED');
 const db=await database.connect();try{const used=await db.query('UPDATE staff_login_transactions SET used_at=now() WHERE state_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING state_hash',[hash(attempt.state)]);if(!used.rows.length)throw new StaffError(401,'LOGIN_TRANSACTION_USED');}finally{db.release();}
 let claims:ReturnType<Awaited<ReturnType<typeof oidc.authorizationCodeGrant>>['claims']>;
 try{const client=await provider(config);const result=await oidc.authorizationCodeGrant(client,url,{expectedState:attempt.state,expectedNonce:attempt.nonce,pkceCodeVerifier:attempt.verifier,maxAge:900,idTokenExpected:true});claims=result.claims();}catch{throw new StaffError(401,'LOGIN_TOKEN_INVALID');}
 if(!claims||typeof claims.sub!=='string'||claims.iss!==config.issuer||typeof claims.auth_time!=='number'||claims.auth_time>Date.now()/1000+60)throw new StaffError(401,'LOGIN_FAILED');
 const token=randomBytes(32).toString('base64url');const session=await database.connect();
 try{await session.query('BEGIN');const user=(await session.query('SELECT id,role,active,auth_version FROM staff_users WHERE identity_subject=$1 AND oidc_issuer=$2 FOR SHARE',[claims.sub,config.issuer])).rows[0];
 const mfa=typeof claims.acr==='string'&&config.mfaAcrValues.includes(claims.acr);
 if(!user?.active||(['owner','manager'].includes(String(user.role))&&!mfa))throw new StaffError(403,'STAFF_ACCESS_DENIED');
 await session.query("INSERT INTO staff_sessions(token_hash,user_id,auth_version,auth_time,mfa_verified,expires_at) VALUES($1,$2,$3,to_timestamp($4),$5,now()+interval '8 hours')",[hash(token),user.id,user.auth_version,claims.auth_time,mfa]);
 await session.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'staff.login','staff_user',$1,$2::jsonb)",[user.id,JSON.stringify({mfa})]);await session.query('COMMIT');return token;
 }catch(e){await session.query('ROLLBACK').catch(()=>{});throw e;}finally{session.release();}
}
export type StaffContext={principal:Principal;displayName:string;authTime:Date};
export async function resolveStaff(db:Sql,token:string):Promise<StaffContext>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new StaffError(401,'SIGN_IN_REQUIRED');
 const result=await db.query(`SELECT u.id,u.role,u.active,u.display_name,s.mfa_verified,s.auth_time FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id
 WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND s.last_seen_at>now()-interval '30 minutes' AND u.active=true AND u.auth_version=s.auth_version FOR UPDATE OF s FOR SHARE OF u`,[hash(token)]);
 const row=result.rows[0];if(!row)throw new StaffError(401,'SIGN_IN_REQUIRED');
 await db.query('UPDATE staff_sessions SET last_seen_at=now() WHERE token_hash=$1',[hash(token)]);
 return {principal:{id:String(row.id),role:row.role as Principal['role'],active:true,mfaVerified:row.mfa_verified===true},displayName:String(row.display_name),authTime:new Date(row.auth_time as string)};
}
export async function endStaffSession(database:Database,token:string){const db=await database.connect();try{await db.query('BEGIN');const context=await resolveStaff(db,token);await db.query('UPDATE staff_sessions SET revoked_at=now() WHERE token_hash=$1',[hash(token)]);await db.query("INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES($1,'staff.logout','staff_user',$1,'{}')",[context.principal.id]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}}

// Next.js may expose an internal server origin in Request.url. The public callback
// is pinned to configuration; accept only the configured Host and ignore forwarded headers.
export function publicStaffCallbackUrl(request:Request,config:StaffConfig){const settings=validateStaffConfig(config);const incoming=new URL(request.url);if(request.headers.get('host')!==new URL(settings.origin).host||incoming.pathname!=='/staff/auth/callback')throw new StaffError(401,'LOGIN_CALLBACK_MISMATCH');const result=new URL(settings.callback);result.search=incoming.search;return result;}
