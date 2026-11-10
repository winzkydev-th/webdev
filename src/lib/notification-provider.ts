import {DeliveryError} from './notifications.ts';
import type {DeliveryProvider,Message} from './notifications.ts';

// Fixed vendor endpoint. User input cannot choose a webhook destination.
export class ResendProvider implements DeliveryProvider {
 private apiKey:string;private request:typeof fetch;
 constructor(apiKey:string,request:typeof fetch=fetch){if(!apiKey)throw new Error('PROVIDER_NOT_CONFIGURED');this.apiKey=apiKey;this.request=request;}
 async send(message:Message,key:string,signal:AbortSignal){
 let response:Response;
 try{response=await this.request('https://api.resend.com/emails',{method:'POST',redirect:'error',signal,headers:{Authorization:'Bearer '+this.apiKey,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(message)});}
 catch{throw new DeliveryError(signal.aborted?'PROVIDER_TIMEOUT':'PROVIDER_UNREACHABLE');}
 if(!response.ok){await response.body?.cancel();throw new DeliveryError('PROVIDER_HTTP_'+response.status,response.status===409||response.status===429||response.status>=500);}
 const body=await response.json().catch(()=>null);
 if(typeof body?.id!=='string'||!body.id||body.id.length>254)throw new DeliveryError('INVALID_PROVIDER_RESPONSE');
 return {messageId:body.id};
 }
}
