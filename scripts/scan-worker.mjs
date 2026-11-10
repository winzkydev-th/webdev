import {Pool} from 'pg';import {ClamAvScanner} from '../src/lib/clamav.ts';import {LocalPrivateFileStore} from '../src/lib/private-files.ts';import {scanStoredAttachment} from '../src/lib/attachments.ts';import path from 'node:path';
if(process.env.APP_ENV!=='development'||process.env.ATTACHMENT_SCANNER_MODE!=='clamav-local')throw new Error('SCAN_WORKER_DISABLED');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:3000});pool.on('error',()=>console.error('SCAN_DATABASE_ERROR'));
const store=new LocalPrivateFileStore(path.resolve('.local/private-uploads'));const scanner=new ClamAvScanner();
let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
try{do{
 try{const rows=await pool.query("SELECT id FROM attachments WHERE scan_status='quarantined' AND object_state='stored' AND next_scan_at<=now() AND scan_attempts<8 AND (scan_lease_until IS NULL OR scan_lease_until<=now()) ORDER BY next_scan_at LIMIT 3");
 for(const row of rows.rows){if(stopped)break;const state=await scanStoredAttachment(pool,store,scanner,row.id);console.log(JSON.stringify({scanWorker:state}));}
 }catch{console.error('SCAN_WORKER_FAILURE');}
 if(process.argv.includes('--once'))break;await new Promise(resolve=>setTimeout(resolve,1000));
}while(!stopped);}finally{await pool.end();}
