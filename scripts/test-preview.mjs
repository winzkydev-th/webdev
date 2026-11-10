// Starts a fresh synthetic-only database and the local test UI; no credentials are printed or saved.
import EmbeddedPostgres from 'embedded-postgres';import {Pool} from 'pg';import {randomBytes} from 'node:crypto';import fs from 'node:fs/promises';import path from 'node:path';import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';
const password=randomBytes(32).toString('hex');const port=55440;
await fs.mkdir('.local',{recursive:true});const directory=await fs.mkdtemp(path.resolve('.local/pg-preview-'));
const cluster=new EmbeddedPostgres({databaseDir:directory,port,user:'kpn_preview_owner',password,authMethod:'scram-sha-256',persistent:true,autoRehydrateSymlinks:true,postgresFlags:['-h','127.0.0.1'],initdbFlags:['--encoding=UTF8','--locale=C'],onLog:()=>{},onError:()=>{}});
let child;let pool;let stopping=false;
async function stop(){if(stopping)return;stopping=true;if(child&&!child.killed)child.kill();if(pool)await pool.end();await cluster.stop();}
process.on('SIGINT',()=>stop().then(()=>process.exit(0)));process.on('SIGTERM',()=>stop().then(()=>process.exit(0)));
try{
 await cluster.initialise();await cluster.start();
 const ownerUrl='postgresql://kpn_preview_owner:'+password+'@127.0.0.1:'+port+'/postgres';
 await promisify(execFile)(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:ownerUrl}});
 pool=new Pool({connectionString:ownerUrl});const runtimePassword=randomBytes(32).toString('hex');
 await pool.query("CREATE ROLE kpn_preview_runtime LOGIN PASSWORD '"+runtimePassword+"'");
 await pool.query('GRANT USAGE ON SCHEMA public TO kpn_preview_runtime');
 await pool.query('GRANT SELECT,INSERT ON contacts,quote_requests,quote_cargo_details,quote_status_history,notifications,audit_logs TO kpn_preview_runtime');
 await pool.query('GRANT SELECT,INSERT,UPDATE ON intake_rate_limits TO kpn_preview_runtime');
 await pool.query('GRANT USAGE ON SEQUENCE quote_reference_seq TO kpn_preview_runtime');
 const env={...process.env,DATABASE_URL:'postgresql://kpn_preview_runtime:'+runtimePassword+'@127.0.0.1:'+port+'/postgres',QUOTE_INTAKE_MODE:'test',APP_ENV:'development',APP_ORIGIN:'http://127.0.0.1:3000',PRIVACY_NOTICE_VERSION:'synthetic-test-v1',RATE_LIMIT_SECRET:randomBytes(32).toString('hex')};
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1'],{env,stdio:'inherit',windowsHide:true});
 child.on('exit',()=>stop().then(()=>process.exit(0)));console.log('Synthetic-only preview: http://127.0.0.1:3000/th/request-a-quote');
}catch(error){console.error('Preview startup failed:',error instanceof Error?error.message:'unknown');await stop();process.exitCode=1;}
