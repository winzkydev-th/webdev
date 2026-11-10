import {Pool} from 'pg';import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const pool=new Pool({connectionString:process.env.DATABASE_URL});const db=await pool.connect();
try{
 await db.query("SELECT pg_advisory_lock(81753002)");
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const name of (await fs.readdir(new URL('../database/',import.meta.url))).filter(x=>/^\d+.*\.sql$/.test(x)).sort()){
 const sql=await fs.readFile(new URL('../database/'+name,import.meta.url),'utf8');const checksum=createHash('sha256').update(sql).digest('hex');
 const existing=(await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name])).rows[0];
 if(existing){if(existing.checksum!==checksum)throw new Error('Migration checksum mismatch: '+name);continue;}
 await db.query('BEGIN');try{
 await db.query(sql.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,''));
 await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);await db.query('COMMIT');console.log('Applied '+name);
 }catch(e){await db.query('ROLLBACK');throw e;}
 }
}finally{await db.query('SELECT pg_advisory_unlock(81753002)').catch(()=>{});db.release();await pool.end();}
