import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';import {isIP} from 'node:net';import type {Database} from './intake.ts';
export type LoginClient={client:string;network:string;source:'local'|'edge'};
type Config={key:string;edgeKey?:string};
const mac=(key:string,value:string)=>createHmac('sha256',Buffer.from(key,'base64')).update(value).digest('base64url');
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function networkPrefix(ip:string){const version=isIP(ip);if(version===4)return ip.split('.').slice(0,3).join('.')+'.0/24';if(version!==6)throw new Error('INVALID_CLIENT_NETWORK');let canonical=new URL('http://['+ip+']/').hostname.slice(1,-1);const parts=canonical.split('::');const a=parts[0]?parts[0].split(':'):[],b=parts[1]?parts[1].split(':'):[];const full=parts.length===2?[...a,...Array(8-a.length-b.length).fill('0'),...b]:a;if(full.length!==8)throw new Error('INVALID_CLIENT_NETWORK');if(full.slice(0,5).every(p=>parseInt(p,16)===0)&&parseInt(full[5],16)===65535){const hi=parseInt(full[6],16),lo=parseInt(full[7],16);return networkPrefix([hi>>8,hi&255,lo>>8,lo&255].join('.'));}return full.slice(0,4).map(p=>parseInt(p,16).toString(16)).join(':')+'::/64';}
export function loginClient(request:Request,config:Config,local:boolean){
 const name=local?'kpn_client_dev':'__Host-kpn_client';const cookie=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??'';
 const [provided,signature]=cookie.split('.');const valid=/^[A-Za-z0-9_-]{32}$/.test(provided??'')&&equal(signature??'',mac(config.key,'client:'+provided));const client=valid?provided:randomBytes(24).toString('base64url');
 let network='loopback';if(!local){if(!config.edgeKey||Buffer.from(config.edgeKey,'base64').length!==32)throw new Error('TRUSTED_EDGE_REQUIRED');const ip=request.headers.get('x-kpn-client-ip')??'';const timestamp=request.headers.get('x-kpn-client-time')??'';const sig=request.headers.get('x-kpn-client-signature')??'';if(!/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>30000||!equal(sig,mac(config.edgeKey,[timestamp,request.method,new URL(request.url).pathname,ip].join('\n'))))throw new Error('TRUSTED_EDGE_REQUIRED');network=networkPrefix(ip);}
 return {context:{client,network,source:local?'local':'edge'} as LoginClient,cookie:{name,value:client+'.'+mac(config.key,'client:'+client)}};
}
export async function consumeLoginBudget(database:Database,key:string,client:LoginClient,{clientLimit=6,networkLimit=120,windowSeconds=60}={}){
 const bucket=(kind:string,value:string)=>createHmac('sha256',Buffer.from(key,'base64')).update('login:'+kind+':'+value).digest('hex');const db=await database.connect();try{await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='3s'");
 const consume=async(name:string,limit:number)=>{const r=(await db.query(`INSERT INTO security_rate_buckets(bucket,window_start,hits) VALUES($1,now(),1) ON CONFLICT(bucket) DO UPDATE SET
 hits=CASE WHEN security_rate_buckets.window_start<=now()-make_interval(secs=>$2::int) THEN 1 ELSE LEAST(security_rate_buckets.hits+1,$3+1) END,
 window_start=CASE WHEN security_rate_buckets.window_start<=now()-make_interval(secs=>$2::int) THEN now() ELSE security_rate_buckets.window_start END
 RETURNING hits,GREATEST(1,ceil(extract(epoch FROM window_start+make_interval(secs=>$2::int)-now())))::int AS retry`,[name,windowSeconds,limit])).rows[0];return {allowed:Number(r.hits)<=limit,retryAfter:Number(r.retry)};};
 // A blocked browser cannot consume the whole network budget. No account name is accepted or locked.
 let result=await consume(bucket('browser',client.client),clientLimit);if(result.allowed)result=await consume(bucket('network',client.network),networkLimit);await db.query('COMMIT');return result;
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
