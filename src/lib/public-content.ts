import {Pool} from 'pg';import {contentConfig,publishedContent} from './content';
let pool:Pool|undefined;
export async function publicContent(slug:string,locale:string){if(!process.env.CMS_DATABASE_URL)return null;try{if(!pool){pool=new Pool({connectionString:process.env.CMS_DATABASE_URL,max:5,connectionTimeoutMillis:2000,idleTimeoutMillis:10000});pool.on('error',()=>console.error('PUBLIC_CONTENT_DATABASE_ERROR'));}return await publishedContent(pool,contentConfig(),slug,locale);}catch{console.error('PUBLIC_CONTENT_UNAVAILABLE');return null;}}
