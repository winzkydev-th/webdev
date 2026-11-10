import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';import {Pool} from 'pg';
import {submitQuote,IntakeError} from '../src/lib/intake.ts';
import {createIntakeHandler} from '../src/lib/intake-http.ts';
const run=promisify(execFile);
const base={service:'sea',container:'FCL',name:'Synthetic Test',email:'synthetic@example.invalid',phone:'000',origin:'Test Origin',destination:'Test Destination',cargo:'SYNTHETIC ONLY',privacyAcknowledged:true,marketingConsent:false,locale:'th'};
test('real PostgreSQL intake integration', {timeout:120000},async t=>{
 const password=randomBytes(32).toString('hex');const port=55439;
 await fs.mkdir('.local',{recursive:true});
 const directory=await fs.mkdtemp(path.resolve('.local/pg-intake-'));
 const cluster=new EmbeddedPostgres({databaseDir:directory,port,user:'kpn_test_owner',password,authMethod:'scram-sha-256',persistent:true,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
 let owner;let pool;
 const options={privacyVersion:'synthetic-test-v1',rateSecret:randomBytes(32).toString('hex'),contactLimit:1000,globalLimit:1000};
 try{
 await cluster.initialise();await cluster.start();
 const connectionString='postgresql://kpn_test_owner:'+password+'@127.0.0.1:'+port+'/postgres';
 owner=new Pool({connectionString});
 const version=(await owner.query('SHOW server_version')).rows[0].server_version;console.log('PostgreSQL server '+version);
 await t.test('migrations apply and rerun without changing existing data',async()=>{
 const env={...process.env,DATABASE_URL:connectionString};
 await run(process.execPath,['scripts/migrate.mjs'],{env});
 await run(process.execPath,['scripts/migrate.mjs'],{env});
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,(await fs.readdir('database')).filter(x=>x.endsWith('.sql')).length);
 });
 const runtimePassword=randomBytes(32).toString('hex');
 await owner.query("CREATE ROLE kpn_intake_runtime LOGIN PASSWORD '"+runtimePassword+"'");
 await owner.query('GRANT USAGE ON SCHEMA public TO kpn_intake_runtime');
 await owner.query('GRANT SELECT,INSERT ON contacts,quote_requests,quote_cargo_details,quote_status_history,notifications,audit_logs TO kpn_intake_runtime');
 await owner.query('GRANT SELECT,INSERT,UPDATE ON intake_rate_limits TO kpn_intake_runtime');
 await owner.query('GRANT USAGE ON SEQUENCE quote_reference_seq TO kpn_intake_runtime');
 pool=new Pool({host:'127.0.0.1',port,user:'kpn_intake_runtime',password:runtimePassword,database:'postgres',max:10});
 await t.test('all four services commit contact, cargo, history, audit and outbox',async()=>{
 for(const details of [{service:'sea',container:'LCL'},{service:'air',weightKg:12},{service:'land',weightKg:45},{service:'customs',customsDirection:'import'}]){
 const q={...base,...details};const result=await submitQuote(pool,q,randomUUID(),options);assert.equal(result.replayed,false);assert.match(result.reference,/^KPN-\d+$/);
 const row=(await owner.query('SELECT q.service,c.description,n.state,h.to_status FROM quote_requests q JOIN quote_cargo_details c ON c.request_id=q.id JOIN notifications n ON n.request_id=q.id JOIN quote_status_history h ON h.request_id=q.id WHERE q.reference=$1',[result.reference])).rows[0];
 assert.equal(row.service,details.service);assert.equal(row.state,'pending');assert.equal(row.to_status,'New');
 }
 });
 await t.test('20 concurrent identical submissions produce one reference and one record',async()=>{
 const key=randomUUID();const results=await Promise.all(Array.from({length:20},()=>submitQuote(pool,base,key,options)));
 assert.equal(new Set(results.map(x=>x.reference)).size,1);assert.equal(results.filter(x=>!x.replayed).length,1);
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM quote_requests WHERE idempotency_key=$1',[key])).rows[0].n,1);
 });
 await t.test('same key with changed data returns conflict; whitespace normalization replays',async()=>{
 const key=randomUUID();const original=await submitQuote(pool,base,key,options);
 assert.equal((await submitQuote(pool,{...base,name:'  Synthetic Test  '},key,options)).reference,original.reference);
 await assert.rejects(submitQuote(pool,{...base,cargo:'CHANGED'},key,options),e=>e instanceof IntakeError&&e.status===409);
 });
 await t.test('failure after request insertion rolls back contact, cargo, audit and outbox',async()=>{
 const before=(await owner.query('SELECT (SELECT count(*) FROM contacts)::int AS contacts,(SELECT count(*) FROM quote_requests)::int AS requests,(SELECT count(*) FROM notifications)::int AS notifications')).rows[0];
 const failing={connect:async()=>{const c=await pool.connect();return {release:()=>c.release(),query:async(sql,args)=>{if(sql.includes('INSERT INTO quote_cargo_details'))throw new Error('INJECTED_STORAGE_FAILURE');return c.query(sql,args);}};}};
 await assert.rejects(submitQuote(failing,base,randomUUID(),options),/INJECTED/);
 const after=(await owner.query('SELECT (SELECT count(*) FROM contacts)::int AS contacts,(SELECT count(*) FROM quote_requests)::int AS requests,(SELECT count(*) FROM notifications)::int AS notifications')).rows[0];assert.deepEqual(after,before);
 });
 await t.test('durable contact rate limit survives new connections and permits safe replay',async()=>{
 const q={...base,email:'limited@example.invalid'};const key=randomUUID();const limits={...options,contactLimit:1};
 const result=await submitQuote(pool,q,key,limits);
 await assert.rejects(submitQuote(pool,q,randomUUID(),limits),e=>e.status===429);
 assert.equal((await submitQuote(pool,q,key,limits)).reference,result.reference);
 assert.equal((await owner.query("SELECT count(*)::int AS n FROM intake_rate_limits WHERE bucket LIKE '%@%' ")).rows[0].n,0);
 });
 await t.test('notification provider failure leaves requests durable',async()=>{
 await owner.query("UPDATE notifications SET state='failed',attempts=attempts+1,last_error_code='TEST_PROVIDER_DOWN'");
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM quote_requests q LEFT JOIN notifications n ON n.request_id=q.id WHERE n.id IS NULL')).rows[0].n,0);
 });
 await t.test('runtime role cannot mutate or truncate audit evidence',async()=>{
 await assert.rejects(pool.query('DELETE FROM audit_logs'),/permission denied/i);
 await assert.rejects(pool.query('TRUNCATE quote_status_history'),/permission denied/i);
 });
 await t.test('HTTP rejects unsafe requests and acknowledges only committed data',async()=>{
 const config={mode:'test',appEnv:'development',origin:'http://127.0.0.1:3000',privacyVersion:options.privacyVersion,rateSecret:options.rateSecret};
 const handler=createIntakeHandler(()=>pool,config);const key=randomUUID();
 const httpBase={...base,email:'http-only@example.invalid'};
 const req=(body=httpBase,extra={})=>new Request('http://127.0.0.1:3000/api/quotes',{method:'POST',headers:{origin:config.origin,'content-type':'application/json','idempotency-key':key,...extra},body:JSON.stringify(body)});
 const response=await handler(req());assert.equal(response.status,201);const data=await response.json();assert.match(data.reference,/^KPN-/);
 assert.equal((await handler(req())).status,200);
 assert.equal((await handler(req({...httpBase,cargo:'Different'}))).status,409);
 assert.equal((await handler(req(base,{origin:'https://untrusted.invalid'}))).status,403);
 assert.equal((await handler(req(base,{'content-type':'text/plain'}))).status,415);
 assert.equal((await handler(req({...base,website:'bot'}))).status,422);
 assert.equal((await handler(req({...base,cargo:'x'.repeat(20000)}))).status,413);
 assert.equal((await handler(req(base,{'idempotency-key':'bad-key'}))).status,400);
 const disabled=createIntakeHandler(()=>{throw new Error('must not connect');},{...config,mode:'live'});
 assert.equal((await disabled(req())).status,503);
 const down=createIntakeHandler(()=>{throw new Error('secret password');},config);const error=await down(req());assert.equal(error.status,503);assert.equal((await error.text()).includes('secret'),false);
 });
 await t.test('committed reference remains after PostgreSQL stop and restart',async()=>{
 const key=randomUUID();const saved=await submitQuote(pool,base,key,options);
 await pool.end();pool=undefined;await owner.end();owner=undefined;
 await cluster.stop();await cluster.start();
 owner=new Pool({connectionString});
 const row=(await owner.query('SELECT reference FROM quote_requests WHERE idempotency_key=$1',[key])).rows[0];assert.equal(row.reference,saved.reference);
 });
 }finally{if(pool)await pool.end();if(owner)await owner.end();await cluster.stop();}
});
