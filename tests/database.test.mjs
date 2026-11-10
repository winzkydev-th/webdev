import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('PostgreSQL schema: atomic outbox, duplicate prevention, status audit and CMS publication guard',async()=>{
 const db=new PGlite();try{
 await db.exec(await fs.readFile(new URL('../database/001_foundation.sql',import.meta.url),'utf8'));
 const staff=(await db.query("INSERT INTO staff_users(identity_subject,role) VALUES('test-owner','owner') RETURNING id")).rows[0].id;
 const contact=(await db.query("INSERT INTO contacts(name,email,phone) VALUES('Synthetic','test@example.invalid','000') RETURNING id")).rows[0].id;
 const key='00000000-0000-4000-8000-000000000001';
 const insert=()=>db.query("INSERT INTO quote_requests(idempotency_key,payload_hash,contact_id,locale,service,privacy_notice_version,privacy_acknowledged_at) VALUES($1,$2,$3,'th','sea','draft-v1',now()) RETURNING id,reference",[key,'a'.repeat(64),contact]);
 const q=(await insert()).rows[0];assert.match(q.reference,/^KPN-\d{10}$/);
 await assert.rejects(insert(),/unique/i);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM quote_requests')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n,1);
 await db.exec("UPDATE notifications SET state='failed',attempts=1,last_error_code='PROVIDER_TIMEOUT'");
 assert.equal((await db.query('SELECT count(*)::int AS n FROM quote_requests')).rows[0].n,1);
 await assert.rejects(db.query("UPDATE quote_requests SET status='Assigned' WHERE id=$1",[q.id]),/actor/i);
 await db.query("SELECT set_config('app.actor_id',$1,false)",[staff]);
 await assert.rejects(db.query("UPDATE quote_requests SET status='Assigned' WHERE id=$1",[q.id]),/Assignee/i);
 await db.query("UPDATE quote_requests SET status='Assigned',assigned_to=$1 WHERE id=$2",[staff,q.id]);
 await db.query("UPDATE quote_requests SET status='Reviewing' WHERE id=$1",[q.id]);
 await db.query("UPDATE quote_requests SET status='Preparing Quote' WHERE id=$1",[q.id]);
 await assert.rejects(db.query("UPDATE quote_requests SET status='Quoted' WHERE id=$1",[q.id]),/evidence/i);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM quote_status_history')).rows[0].n,4);
 await assert.rejects(db.exec("UPDATE quote_status_history SET reason='tampered'"),/append-only/);
 const page=(await db.query("INSERT INTO pages(slug) VALUES('home') RETURNING id")).rows[0].id;
 await assert.rejects(db.query("INSERT INTO translations(page_id,locale,title,description,state) VALUES($1,'th','Test','Test','published')",[page]),/check/i);
 await db.exec('BEGIN');
 await db.query("INSERT INTO quote_requests(idempotency_key,payload_hash,contact_id,locale,service,privacy_notice_version,privacy_acknowledged_at) VALUES(gen_random_uuid(),$1,$2,'th','air','draft-v1',now())",['b'.repeat(64),contact]);
 await db.exec('ROLLBACK');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM notifications')).rows[0].n,1);
 }finally{await db.close();}
});
