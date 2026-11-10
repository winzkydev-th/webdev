import {Pool} from 'pg';
const {DATABASE_URL,OIDC_ISSUER,BOOTSTRAP_STAFF_SUBJECT,BOOTSTRAP_STAFF_NAME}=process.env;
if(!DATABASE_URL||!OIDC_ISSUER||!BOOTSTRAP_STAFF_SUBJECT||!BOOTSTRAP_STAFF_NAME)throw new Error('EXPLICIT_OWNER_IDENTITY_REQUIRED');
if(new URL(OIDC_ISSUER).protocol!=='https:')throw new Error('HTTPS_ISSUER_REQUIRED');
const pool=new Pool({connectionString:DATABASE_URL});const db=await pool.connect();
try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(81753005)');const count=await db.query("SELECT count(*)::int AS n FROM staff_users WHERE role='owner' AND active=true");if(count.rows[0].n!==0)throw new Error('OWNER_ALREADY_EXISTS');await db.query("INSERT INTO staff_users(identity_subject,oidc_issuer,display_name,role) VALUES($1,$2,$3,'owner')",[BOOTSTRAP_STAFF_SUBJECT,OIDC_ISSUER,BOOTSTRAP_STAFF_NAME]);await db.query("INSERT INTO audit_logs(action,entity_type,metadata) VALUES('staff.owner_bootstrapped','staff_user','{}')");await db.query('COMMIT');console.log('Owner identity registered. MFA is required at first sign-in.');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();await pool.end();}
