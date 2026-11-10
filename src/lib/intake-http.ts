import {IntakeError,submitQuote} from './intake.ts';
import type {Database} from './intake.ts';
export type IntakeConfig={mode?:string;appEnv?:string;origin?:string;privacyVersion?:string;rateSecret?:string};
export function testIntakeEnabled(config:IntakeConfig){
 return config.mode==='test'&&config.appEnv==='development'&&!!config.origin&&['http://127.0.0.1:3000','http://localhost:3000'].includes(config.origin)&&!!config.privacyVersion&&!!config.rateSecret&&config.rateSecret.length>=32;
}
function json(body:unknown,status:number){return Response.json(body,{status,headers:{'Cache-Control':'no-store',...(status===429?{'Retry-After':'900'}:{})}});}
async function readBody(request:Request){
 if(!request.body)throw new IntakeError(400,'INVALID_JSON');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new IntakeError(413,'BODY_TOO_LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new IntakeError(400,'INVALID_JSON');}
}
export function createIntakeHandler(database:()=>Database,config:IntakeConfig){return async function POST(request:Request){
 // Live intake remains disabled until privacy, abuse and upload release checks pass.
 if(!testIntakeEnabled(config))return json({code:'INTAKE_NOT_READY'},503);
 try{
 if(request.headers.get('origin')!==config.origin)throw new IntakeError(403,'ORIGIN_NOT_ALLOWED');
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new IntakeError(403,'ORIGIN_NOT_ALLOWED');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new IntakeError(415,'JSON_REQUIRED');
 const length=request.headers.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>16384))throw new IntakeError(413,'BODY_TOO_LARGE');
 const value=await readBody(request);
 const result=await submitQuote(database(),value,request.headers.get('idempotency-key')??'',{privacyVersion:config.privacyVersion!,rateSecret:config.rateSecret!});
 return json(result,result.replayed?200:201);
 }catch(error){if(error instanceof IntakeError)return json({code:error.code,...(error.fields.length?{fields:error.fields}:{})},error.status);
 // Never include contact details, SQL errors, credentials or server stack traces.
 return json({code:'TEMPORARILY_UNAVAILABLE'},503);}
};}
