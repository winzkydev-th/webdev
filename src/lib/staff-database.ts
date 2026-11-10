import {Pool} from 'pg';import type {Database} from './intake.ts';
let pool:Pool|undefined;
export function getStaffDatabase():Database{if(!process.env.STAFF_DATABASE_URL)throw new Error('STAFF_DATABASE_NOT_CONFIGURED');if(!pool){pool=new Pool({connectionString:process.env.STAFF_DATABASE_URL,max:10,connectionTimeoutMillis:3000,idleTimeoutMillis:10000});pool.on('error',()=>console.error('STAFF_DATABASE_ERROR'));}return pool;}
