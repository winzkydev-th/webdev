import type {Database} from './intake.ts';import {StaffError,validateStaffConfig,readStaffCookie,sessionCsrf,verifyStaffMutation} from './staff-auth.ts';import type {StaffConfig} from './staff-auth.ts';
import {staffMe,staffDashboard,staffInbox,staffRequest,staffAssignees,listStaffAccounts,assignStaffRequest,addStaffActivity,changeStaffStatus,manageStaffAccount} from './staff-workspace.ts';
function json(body:unknown,status=200){return Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});}
export function staffHandlers(database:()=>Database,config:StaffConfig){
 async function run(request:Request,mutation:boolean){try{
 const settings=validateStaffConfig(config);const token=readStaffCookie(request,settings.sessionCookie);if(!token)throw new StaffError(401,'SIGN_IN_REQUIRED');
 if(!mutation){const params=new URL(request.url).searchParams;switch(params.get('view')??'dashboard'){
 case 'me':return json({...await staffMe(database(),token),csrf:sessionCsrf(token,config)});
 case 'dashboard':return json(await staffDashboard(database(),token));
 case 'inbox':return json(await staffInbox(database(),token,{service:params.get('service')??undefined,status:params.get('status')??undefined,search:params.get('search')??undefined,page:Number(params.get('page')??0)}));
 case 'request':return json(await staffRequest(database(),token,params.get('id')??''));
 case 'assignees':return json(await staffAssignees(database(),token));
 case 'accounts':return json(await listStaffAccounts(database(),token));default:throw new StaffError(400,'INVALID_VIEW');}}
 verifyStaffMutation(request,token,config);if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new StaffError(415,'JSON_REQUIRED');
 if(!request.body)throw new StaffError(400,'INVALID_INPUT');const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16384){await reader.cancel();throw new StaffError(413,'BODY_TOO_LARGE');}chunks.push(part.value);}}finally{reader.releaseLock();}
 let body:Record<string,unknown>;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error();}catch{throw new StaffError(400,'INVALID_JSON');}
 const actions:Record<string,string[]>={assign:['action','requestId','assigneeId','version'],activity:['action','requestId','channel','note'],status:['action','requestId','status','reason','version'],'staff-create':['action','displayName','subject','role','active'],'staff-update':['action','id','displayName','role','active']};
 const action=String(body.action);if(!Object.hasOwn(actions,action)||Object.keys(body).some(key=>!actions[action].includes(key)))throw new StaffError(400,'INVALID_INPUT');
 switch(action){case 'assign':return json(await assignStaffRequest(database(),token,body as Parameters<typeof assignStaffRequest>[2]));case 'activity':return json(await addStaffActivity(database(),token,body as Parameters<typeof addStaffActivity>[2]));case 'status':return json(await changeStaffStatus(database(),token,body as Parameters<typeof changeStaffStatus>[2]));case 'staff-create':case 'staff-update':return json(await manageStaffAccount(database(),token,body as Parameters<typeof manageStaffAccount>[2],config.issuer));default:throw new StaffError(400,'INVALID_ACTION');}
 }catch(error){if(error instanceof StaffError)return json({code:error.message},error.status);return json({code:'TEMPORARILY_UNAVAILABLE'},503);}}
 return {GET:(request:Request)=>run(request,false),POST:(request:Request)=>run(request,true)};
}
