import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import net from 'node:net';import {randomBytes,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import EmbeddedPostgres from 'embedded-postgres';import {Pool} from 'pg';
import {submitQuote} from '../src/lib/intake.ts';import {issueUploadPermit,uploadPrivateAttachment,scanStoredAttachment,downloadPrivateAttachment} from '../src/lib/attachments.ts';import {LocalPrivateFileStore} from '../src/lib/private-files.ts';import {ClamAvScanner} from '../src/lib/clamav.ts';
test('private attachments on real PostgreSQL and private disk',{timeout:120000},async t=>{
 const password=randomBytes(32).toString('hex');const port=55442;await fs.mkdir('.local',{recursive:true});const directory=await fs.mkdtemp(path.resolve('.local/pg-attachments-'));const objectRoot=await fs.mkdtemp(path.resolve('.local/private-objects-'));
 const cluster=new EmbeddedPostgres({databaseDir:directory,port,user:'attachment_owner',password,persistent:true,authMethod:'scram-sha-256',autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
 let owner;let db;const store=new LocalPrivateFileStore(objectRoot);const clean={scan:async()=> 'clean'};const pdf=Buffer.from('%PDF-1.4\nSYNTHETIC TEST ONLY\n%%EOF');
 const input={service:'sea',container:'LCL',locale:'th',name:'Synthetic',email:'files@example.invalid',phone:'000',origin:'A',destination:'B',cargo:'Synthetic only',privacyAcknowledged:true,marketingConsent:false};
 const submitOptions={privacyVersion:'test',rateSecret:randomBytes(32).toString('hex'),contactLimit:1000,globalLimit:1000};
 async function newRequest(){const q=await submitQuote(owner,input,randomUUID(),submitOptions);return (await owner.query('SELECT id FROM quote_requests WHERE reference=$1',[q.reference])).rows[0].id;}
 const upload=(token,extra={},scanner=clean)=>uploadPrivateAttachment(db,store,scanner,{token,uploadKey:randomUUID(),name:'synthetic.pdf',mediaType:'application/pdf',data:pdf,...extra});
 try{
 await cluster.initialise();await cluster.start();const connectionString='postgresql://attachment_owner:'+password+'@127.0.0.1:'+port+'/postgres';owner=new Pool({connectionString});await promisify(execFile)(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:connectionString}});
 const pass=randomBytes(32).toString('hex');await owner.query("CREATE ROLE attachment_runtime LOGIN PASSWORD '"+pass+"'");await owner.query('GRANT USAGE ON SCHEMA public TO attachment_runtime');await owner.query('GRANT SELECT ON quote_requests TO attachment_runtime');await owner.query('GRANT SELECT,INSERT,UPDATE ON attachments,attachment_upload_permits TO attachment_runtime');await owner.query('GRANT INSERT ON audit_logs TO attachment_runtime');
 db=new Pool({host:'127.0.0.1',port,user:'attachment_runtime',password:pass,database:'postgres',max:10});
 const staff=(await owner.query("INSERT INTO staff_users(identity_subject,role) VALUES('synthetic-owner','owner') RETURNING id")).rows[0].id;
 const principal={id:staff,role:'owner',mfaVerified:true,active:true};
 await t.test('private upload is stored under a generated key and only clean files download',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const result=await upload(token);assert.equal(result.state,'clean');const metadata=(await owner.query('SELECT * FROM attachments WHERE id=$1',[result.id])).rows[0];assert.notEqual(metadata.object_key,'synthetic.pdf');assert.equal(metadata.object_state,'stored');
 const downloaded=await downloadPrivateAttachment(db,store,principal,result.id);assert.deepEqual(Buffer.from(downloaded.data),pdf);assert.match(downloaded.headers['Content-Disposition'],/^attachment;/);assert.equal(downloaded.headers['Cache-Control'],'private, no-store');
 });
 await t.test('absent/expired/revoked capabilities cannot create attachments',async()=>{
 await assert.rejects(upload('0'.repeat(64)),e=>e.status===403);
 const token=await issueUploadPermit(db,await newRequest());await owner.query("UPDATE attachment_upload_permits SET expires_at=now()-interval '1 second'");await assert.rejects(upload(token),e=>e.status===403);
 const revoked=await issueUploadPermit(db,await newRequest());await owner.query('UPDATE attachment_upload_permits SET revoked_at=now() WHERE revoked_at IS NULL');await assert.rejects(upload(revoked),e=>e.status===403);
 });
 await t.test('same upload key replays once, changed file conflicts',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const key=randomUUID();const original=await upload(token,{uploadKey:key});const duplicate=await upload(token,{uploadKey:key});assert.equal(duplicate.id,original.id);assert.equal(duplicate.replayed,true);
 await assert.rejects(upload(token,{uploadKey:key,name:'different.pdf'}),e=>e.status===409);
 });
 await t.test('unavailable scanner quarantines, blocks download, and can be retried after recovery',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const result=await upload(token,{}, {scan:async()=>{throw new Error('scanner offline secret');}});assert.equal(result.state,'quarantined');await assert.rejects(downloadPrivateAttachment(db,store,principal,result.id),e=>e.status===409);
 await owner.query('UPDATE attachments SET next_scan_at=now() WHERE id=$1',[result.id]);assert.equal(await scanStoredAttachment(db,store,clean,result.id),'clean');
 });
 await t.test('infected verdict stays rejected; unexpected and timed-out scanner verdicts stay quarantined',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const infected=await upload(token,{}, {scan:async()=> 'infected'});assert.equal(infected.state,'rejected');await assert.rejects(downloadPrivateAttachment(db,store,principal,infected.id),e=>e.status===409);assert.equal(await scanStoredAttachment(db,store,clean,infected.id),'unclaimed');
 const bad=await upload(token,{}, {scan:async()=> 'unknown'});assert.equal(bad.state,'quarantined');
 const slow=await uploadPrivateAttachment(db,store,{scan:async()=>new Promise(()=>{})},{token,uploadKey:randomUUID(),name:'slow.pdf',mediaType:'application/pdf',data:pdf},{scanTimeoutMs:20});assert.equal(slow.state,'quarantined');
 });
 await t.test('expired scan leases recover and stale clean verdict cannot override a newer rejection',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const file=await upload(token,{}, {scan:async()=>{throw new Error('offline');}});await owner.query('UPDATE attachments SET next_scan_at=now() WHERE id=$1',[file.id]);
 let entered;let release;const started=new Promise(resolve=>{entered=resolve;});const verdict=new Promise(resolve=>{release=resolve;});
 const old=scanStoredAttachment(db,store,{scan:async()=>{entered();return verdict;}},file.id);await started;
 await owner.query("UPDATE attachments SET scan_lease_until=now()-interval '1 second' WHERE id=$1",[file.id]);
 assert.equal(await scanStoredAttachment(db,store,{scan:async()=> 'infected'},file.id),'rejected');release('clean');assert.equal(await old,'lease-lost');
 assert.equal((await owner.query('SELECT scan_status FROM attachments WHERE id=$1',[file.id])).rows[0].scan_status,'rejected');
 });
 await t.test('concurrent uploads across distinct permits cannot exceed five per request',async()=>{
 const request=await newRequest();const tokens=await Promise.all(Array.from({length:7},()=>issueUploadPermit(db,request)));const results=await Promise.allSettled(tokens.map(token=>upload(token)));assert.equal(results.filter(r=>r.status==='fulfilled').length,5);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===429).length,2);
 assert.equal((await owner.query('SELECT count(*)::int AS n FROM attachments WHERE request_id=$1',[request])).rows[0].n,5);
 });
 await t.test('authorization denies other assignments, content editor, missing MFA and anonymous reads',async()=>{
 const request=await newRequest();const file=await upload(await issueUploadPermit(db,request));
 for(const user of [null,{...principal,mfaVerified:false},{...principal,role:'editor'},{...principal,role:'sales'},{...principal,role:'viewer'}])await assert.rejects(downloadPrivateAttachment(db,store,user,file.id),e=>e.status===403);
 await owner.query('UPDATE quote_requests SET assigned_to=$1 WHERE id=$2',[staff,request]);assert.equal((await downloadPrivateAttachment(db,store,{...principal,role:'sales'},file.id)).data.length,pdf.length);
 });
 await t.test('corrupt objects, write failures and unsafe storage paths never release files',async()=>{
 const token=await issueUploadPermit(db,await newRequest());const file=await upload(token);const key=(await owner.query('SELECT object_key FROM attachments WHERE id=$1',[file.id])).rows[0].object_key;await fs.writeFile(path.join(objectRoot,key),'tampered');await assert.rejects(downloadPrivateAttachment(db,store,principal,file.id),e=>e.message==='FILE_INTEGRITY_FAILURE');
 await assert.rejects(store.get('../outside'),/INVALID_OBJECT_KEY/);
 const broken={put:async()=>{throw new Error('private disk error');},get:async()=>pdf};await assert.rejects(uploadPrivateAttachment(db,broken,clean,{token,uploadKey:randomUUID(),name:'error.pdf',mediaType:'application/pdf',data:pdf}),e=>e.status===503);
 assert.equal((await owner.query("SELECT count(*)::int AS n FROM attachments WHERE object_state='failed'")).rows[0].n,1);
 });
 }finally{if(db)await db.end();if(owner)await owner.end();await cluster.stop();}
});
test('ClamAV INSTREAM adapter validates framing and fails closed on scanner errors',{timeout:10000},async()=>{
 const payload=Buffer.from('SYNTHETIC SCANNER PROTOCOL TEST');let response='stream: OK\0';let received;const sockets=new Set();
 const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let input=Buffer.alloc(0);socket.on('data',chunk=>{input=Buffer.concat([input,chunk]);if(input.length<10)return;assert.equal(input.subarray(0,10).toString(),'zINSTREAM\0');let offset=10;let data=[];while(offset+4<=input.length){const n=input.readUInt32BE(offset);if(offset+4+n>input.length)return;offset+=4;if(n===0){received=Buffer.concat(data);socket.end(response);return;}data.push(input.subarray(offset,offset+n));offset+=n;}});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;const scanner=new ClamAvScanner('127.0.0.1',port);
 try{assert.equal(await scanner.scan(payload,new AbortController().signal),'clean');assert.deepEqual(received,payload);response='stream: SyntheticSignature FOUND\0';assert.equal(await scanner.scan(payload,new AbortController().signal),'infected');response='stream: INSTREAM size limit exceeded. ERROR\0';await assert.rejects(scanner.scan(payload,new AbortController().signal));}
 finally{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
 await assert.rejects(scanner.scan(payload,new AbortController().signal),/SCANNER_UNAVAILABLE/);
});
