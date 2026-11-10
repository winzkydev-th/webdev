import test from 'node:test';import assert from 'node:assert/strict';
import {retrySeconds,DeliveryError} from '../src/lib/notifications.ts';
import {ResendProvider} from '../src/lib/notification-provider.ts';
test('retry backoff grows, caps and uses bounded jitter',()=>{
 assert.equal(retrySeconds(1,()=>0),30);assert.equal(retrySeconds(2,()=>0),60);assert.equal(retrySeconds(20,()=>0),3600);assert.ok(retrySeconds(2,()=>.9)<75);
});
test('provider uses fixed endpoint, immutable message and stable idempotency key',async()=>{
 const message={from:'from@example.invalid',to:'to@example.invalid',subject:'Test',text:'Synthetic'};let calls=0;
 const provider=new ResendProvider('synthetic-secret',async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'event-key');assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),message);return Response.json({id:'synthetic-message-id'});});
 const result=await provider.send(message,'event-key',new AbortController().signal);assert.equal(calls,1);assert.equal(result.messageId,'synthetic-message-id');
});
test('provider classifies permanent and transient errors without exposing response bodies',async()=>{
 for(const [status,retry] of [[400,false],[401,false],[409,true],[422,false],[429,true],[500,true]]){
 const provider=new ResendProvider('synthetic',async()=>new Response('SECRET EMAIL AND TOKEN',{status}));
 await assert.rejects(provider.send({},'key',new AbortController().signal),e=>e instanceof DeliveryError&&e.retryable===retry&&!e.message.includes('SECRET'));
 }
});
