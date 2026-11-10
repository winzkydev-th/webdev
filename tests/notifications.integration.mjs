import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import EmbeddedPostgres from 'embedded-postgres';import {Pool} from 'pg';
import {submitQuote} from '../src/lib/intake.ts';import {claimNotification,finishNotification,processOneNotification,DeliveryError} from '../src/lib/notifications.ts';
test('real PostgreSQL notification recovery', {timeout:120000},async t=>{
 const password=randomBytes(32).toString('hex');const port=55441;await fs.mkdir('.local',{recursive:true});const directory=await fs.mkdtemp(path.resolve('.local/pg-notification-'));
 const cluster=new EmbeddedPostgres({databaseDir:directory,port,user:'notification_owner',password,persistent:true,authMethod:'scram-sha-256',autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
 let owner;let db;
 const options={from:'sender@example.invalid',staffEmail:'staff@example.invalid',random:()=>0,maxAttempts:3};
 const input={service:'sea',container:'LCL',locale:'th',name:'Synthetic',email:'customer@example.invalid',phone:'000',origin:'A',destination:'B',cargo:'Synthetic only',privacyAcknowledged:true,marketingConsent:false};
 const submitOptions={privacyVersion:'test',rateSecret:randomBytes(32).toString('hex'),contactLimit:1000,globalLimit:1000};
 const counts=async()=>Number((await owner.query('SELECT count(*)::int AS n FROM quote_requests')).rows[0].n);
 async function emptyQueue(){await owner.query("UPDATE notifications SET state='sent',lease_token=NULL,lease_until=NULL WHERE state<>'sent'");}
 try{
 await cluster.initialise();await cluster.start();const connectionString='postgresql://notification_owner:'+password+'@127.0.0.1:'+port+'/postgres';owner=new Pool({connectionString});
 await promisify(execFile)(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:connectionString}});
 const pass=randomBytes(32).toString('hex');await owner.query("CREATE ROLE notification_runtime LOGIN PASSWORD '"+pass+"'");
 await owner.query('GRANT USAGE ON SCHEMA public TO notification_runtime');
 await owner.query('GRANT SELECT ON quote_requests,contacts TO notification_runtime');
 await owner.query('GRANT SELECT,UPDATE ON notifications TO notification_runtime');
 await owner.query('GRANT SELECT,INSERT,UPDATE ON notification_attempts TO notification_runtime');
 await owner.query('GRANT INSERT ON audit_logs TO notification_runtime');
 db=new Pool({host:'127.0.0.1',port,user:'notification_runtime',password:pass,database:'postgres',max:10});
 await t.test('new request creates independent staff and customer notification jobs',async()=>{
 await submitQuote(owner,input,randomUUID(),submitOptions);
 const events=(await owner.query('SELECT event_type FROM notifications ORDER BY event_type')).rows.map(r=>r.event_type);assert.deepEqual(events,['quote.created.customer','quote.created.staff']);
 });
 await t.test('parallel workers claim each job only once',async()=>{
 const jobs=(await Promise.all(Array.from({length:10},()=>claimNotification(db,options)))).filter(Boolean);assert.equal(jobs.length,2);assert.equal(new Set(jobs.map(j=>j.id)).size,2);
 for(const job of jobs)await finishNotification(db,job,{messageId:'synthetic-'+job.id},options);
 });
 await t.test('provider failure retains request, delays retry, then recovers with frozen message and key',async()=>{
 await submitQuote(owner,input,randomUUID(),submitOptions);const count=await counts();let first;
 await processOneNotification(db,{send:async(message,key)=>{first={message,key};throw new DeliveryError('PROVIDER_UNAVAILABLE');}},options);
 const failed=(await owner.query("SELECT * FROM notifications WHERE state='failed'")).rows[0];assert.equal(failed.attempts,1);assert.equal((await counts()),count);assert.ok(new Date(failed.next_attempt_at)>new Date());
 // The other recipient succeeds independently, rather than replaying a partially-sent fanout.
 await processOneNotification(db,{send:async()=>({messageId:'other-recipient'})},options);
 assert.equal((await processOneNotification(db,{send:async()=>{throw new Error('not due');}},options)).outcome,'idle');
 await owner.query("UPDATE notifications SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[failed.id]);
 const result=await processOneNotification(db,{send:async(message,key)=>{assert.deepEqual(message,first.message);assert.equal(key,first.key);return {messageId:'recovered'};}},{...options,staffEmail:'changed@example.invalid',from:'changed-sender@example.invalid'});
 assert.equal(result.outcome,'sent');const row=(await owner.query('SELECT * FROM notifications WHERE id=$1',[failed.id])).rows[0];assert.equal(row.attempts,2);assert.equal(row.provider_message_id,'recovered');
 });
 await t.test('expired lease is reclaimed and old worker cannot overwrite the new result',async()=>{
 await emptyQueue();await submitQuote(owner,input,randomUUID(),submitOptions);const old=await claimNotification(db,options);
 await owner.query("UPDATE notifications SET lease_until=now()-interval '1 second' WHERE id=$1",[old.id]);
 const replacement=await claimNotification(db,options);assert.equal(replacement.id,old.id);assert.notEqual(replacement.token,old.token);
 assert.equal(await finishNotification(db,old,{messageId:'late-old'},options),false);
 assert.equal(await finishNotification(db,replacement,{messageId:'new-worker'},options),true);
 assert.equal((await owner.query('SELECT outcome FROM notification_attempts WHERE lease_token=$1',[old.token])).rows[0].outcome,'expired');
 });
 await t.test('a timed-out provider releases work for retry without losing requests',async()=>{
 await emptyQueue();await submitQuote(owner,input,randomUUID(),submitOptions);const before=await counts();
 const result=await processOneNotification(db,{send:async()=>new Promise(()=>{})},{...options,timeoutMs:20,leaseSeconds:2});assert.equal(result.outcome,'failed');assert.equal(await counts(),before);
 assert.equal((await owner.query("SELECT last_error_code FROM notifications WHERE state='failed' ORDER BY created_at DESC LIMIT 1")).rows[0].last_error_code,'PROVIDER_TIMEOUT');
 });
 await t.test('permanent errors and exhausted attempts enter durable dead-letter state',async()=>{
 await emptyQueue();await submitQuote(owner,input,randomUUID(),submitOptions);
 const provider={send:async()=>{throw new DeliveryError('INVALID_RECIPIENT',false);}};
 assert.equal((await processOneNotification(db,provider,options)).outcome,'failed');
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM notifications WHERE dead_at IS NOT NULL')).rows[0].n,1);
 await processOneNotification(db,{send:async()=>{throw new Error('arbitrary secret message');}},{...options,maxAttempts:1});
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM notifications WHERE dead_at IS NOT NULL')).rows[0].n,2);
 assert.equal((await owner.query("SELECT count(*)::int AS n FROM notifications WHERE last_error_code LIKE '%secret%'")).rows[0].n,0);
 });
 await t.test('jobs older than provider dedupe window are held for reconciliation instead of resent',async()=>{
 await emptyQueue();await submitQuote(owner,input,randomUUID(),submitOptions);
 await owner.query("UPDATE notifications SET first_attempt_at=now()-interval '24 hours' WHERE state='pending'");
 let called=false;await processOneNotification(db,{send:async()=>{called=true;return {messageId:'must-not-send'};}},options);assert.equal(called,false);
 assert.equal((await owner.query("SELECT count(*)::int AS n FROM notifications WHERE last_error_code='DEDUPE_WINDOW_EXPIRED'")).rows[0].n,1);
 });
 await t.test('provider acceptance followed by lost response retries without a second physical delivery',async()=>{
 await emptyQueue();await submitQuote(owner,input,randomUUID(),submitOptions);let physicalDeliveries=0;let first=true;const accepted=new Map();
 const provider={send:async(message,key)=>{if(accepted.has(key))return accepted.get(key);physicalDeliveries++;const result={messageId:'accepted-'+key};accepted.set(key,result);if(first){first=false;throw new DeliveryError('PROVIDER_TIMEOUT');}return result;}};
 assert.equal((await processOneNotification(db,provider,options)).outcome,'failed');
 const failed=(await owner.query("SELECT id FROM notifications WHERE state='failed' AND dead_at IS NULL")).rows[0].id;
 // Finish the separate recipient before retrying the ambiguous delivery.
 await processOneNotification(db,{send:async()=>({messageId:'other-channel'})},options);
 await owner.query('UPDATE notifications SET next_attempt_at=now() WHERE id=$1',[failed]);
 assert.equal((await processOneNotification(db,provider,options)).outcome,'sent');assert.equal(physicalDeliveries,1);
 });
 await t.test('worker has no ability to delete customer requests or audit history',async()=>{
 await assert.rejects(db.query('DELETE FROM quote_requests'),/permission denied/i);await assert.rejects(db.query('DELETE FROM audit_logs'),/permission denied/i);
 });
 }finally{if(db)await db.end();if(owner)await owner.end();await cluster.stop();}
});
