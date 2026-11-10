import {cache} from 'react';import {Pool} from 'pg';import {contentConfig,publishedContent} from './content';
let pool:Pool|undefined;
export function getPublicDatabase(){if(!process.env.CMS_DATABASE_URL)return null;if(!pool){pool=new Pool({connectionString:process.env.CMS_DATABASE_URL,max:5,connectionTimeoutMillis:2000,idleTimeoutMillis:10000});pool.on('error',()=>console.error('PUBLIC_CONTENT_DATABASE_ERROR'));}return pool;}
export const publicContent=cache(async(slug:string,locale:string)=>{try{const db=getPublicDatabase();if(!db)return null;return await publishedContent(db,contentConfig(),slug,locale);}catch{console.error('PUBLIC_CONTENT_UNAVAILABLE');return null;}});
