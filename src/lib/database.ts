import {Pool} from 'pg';
import type {Database} from './intake.ts';
let pool:Pool|undefined;
export function getDatabase():Database {
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');
 if(!pool){pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:3000,idleTimeoutMillis:10000});pool.on('error',()=>console.error('DATABASE_POOL_ERROR'));}
 return pool;
}
