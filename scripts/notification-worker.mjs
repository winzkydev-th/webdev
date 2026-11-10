import {Pool} from 'pg';
import {processOneNotification,DeliveryError} from '../src/lib/notifications.ts';
import {ResendProvider} from '../src/lib/notification-provider.ts';
const test=process.env.NOTIFICATION_MODE==='simulate'&&process.env.APP_ENV==='development';
const live=process.env.NOTIFICATION_MODE==='resend'&&process.env.NOTIFICATION_TEMPLATES_APPROVED==='true'&&process.env.COMPANY_COMMUNICATIONS_APPROVED==='true';
if(!test&&!live)throw new Error('NOTIFICATION_DELIVERY_DISABLED');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_NOT_CONFIGURED');
const options={from:process.env.NOTIFICATION_FROM??'',staffEmail:process.env.NOTIFICATION_STAFF_EMAIL??''};
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:3000});pool.on('error',()=>console.error('WORKER_DATABASE_ERROR'));
const provider=test?{send:async(_message,key)=>{if(process.env.SIMULATE_NOTIFICATION_FAILURE==='true')throw new DeliveryError('SIMULATED_PROVIDER_DOWN');return {messageId:'synthetic-'+key};}}:new ResendProvider(process.env.RESEND_API_KEY??'');
let stopped=false;process.on('SIGINT',()=>{stopped=true;});process.on('SIGTERM',()=>{stopped=true;});
try{do{
 try{const result=await processOneNotification(pool,provider,options);console.log(JSON.stringify({notificationWorker:result.outcome,mode:test?'simulate':'resend'}));}
 catch{console.error('NOTIFICATION_WORKER_FAILURE');}
 if(process.argv.includes('--once'))break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}while(!stopped);}finally{await pool.end();}
