import test from 'node:test';import assert from 'node:assert/strict';
import {normalize} from '../src/lib/intake.ts';import {createIntakeHandler,testIntakeEnabled} from '../src/lib/intake-http.ts';
const base={service:'sea',container:'LCL',name:' Test ',email:'TEST@example.invalid',phone:'000',origin:'A',destination:'B',cargo:'Test',privacyAcknowledged:true,marketingConsent:false,locale:'th'};
test('normalization has stable ordering, removes unrelated service fields and rejects unknown fields',()=>{
 assert.equal(normalize(base).name,'Test');assert.equal(normalize(base).email,'test@example.invalid');
 assert.equal(normalize({...base,weightKg:100}).weightKg,undefined);
 for(const value of [{...base,locale:'xx'},{...base,role:'owner'},{...base,cargo:'null\u0000byte'},{...base,privacyAcknowledged:false},{...base,marketingConsent:'true'}])assert.throws(()=>normalize(value));
});
test('local test gate cannot enable live intake, non-development or external origins',()=>{
 const config={mode:'test',appEnv:'development',origin:'http://127.0.0.1:3000',privacyVersion:'test',rateSecret:'x'.repeat(32)};
 assert.equal(testIntakeEnabled(config),true);
 for(const patch of [{mode:'live'},{appEnv:'production'},{origin:'https://company.invalid'},{privacyVersion:''},{rateSecret:'short'}])assert.equal(testIntakeEnabled({...config,...patch}),false);
});
test('HTTP edge rejects missing origin, malformed JSON, oversized streaming payload and cross-site requests before database access',async()=>{
 const handler=createIntakeHandler(()=>{throw new Error('DATABASE_MUST_NOT_BE_REACHED');},{mode:'test',appEnv:'development',origin:'http://127.0.0.1:3000',privacyVersion:'test',rateSecret:'x'.repeat(32)});
 const request=(body,headers={})=>new Request('http://127.0.0.1:3000/api/quotes',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:3000',...headers},body});
 assert.equal((await handler(request('{'))).status,400);
 assert.equal((await handler(request('{}',{origin:''}))).status,403);
 assert.equal((await handler(request('{}',{'sec-fetch-site':'cross-site'}))).status,403);
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(17000)));c.close();}});
 const oversized=new Request('http://127.0.0.1:3000/api/quotes',{method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:3000'},body:stream,duplex:'half'});
 assert.equal((await handler(oversized)).status,413);
});
