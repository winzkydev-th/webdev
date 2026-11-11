import type {Database} from './intake.ts';
const rules={login_success:20,login_rate:3,login_failure:3,access_denied:5,csrf_denied:3,invalid_request:10,csp_violation:3} as const;
export type SecurityKind=keyof typeof rules;
const routes=['auth','staff-api','content-api','quotation-api','csp'] as const;
export type SecurityRoute=typeof routes[number];
// Deliberately accepts no free text, URL, headers, body, user name, token, password or secret.
// At most one immutable event and one alert per kind/route/minute; repeated attempts only increment a bounded window.
export async function recordSecurityEvent(database:Database,kind:SecurityKind,route:SecurityRoute){
 if(!Object.hasOwn(rules,kind)||!routes.includes(route))throw new Error('INVALID_SECURITY_EVENT');
 const db=await database.connect();try{await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='3s'");
 const w=(await db.query(`INSERT INTO security_event_windows(kind,route_group) VALUES($1,$2)
 ON CONFLICT(kind,route_group,window_start) DO UPDATE SET hits=LEAST(security_event_windows.hits+1,1000000),last_seen_at=now() RETURNING id,hits`,[kind,route])).rows[0];
 await db.query('INSERT INTO security_events(window_id,kind,route_group) VALUES($1,$2,$3) ON CONFLICT(window_id) DO NOTHING',[w.id,kind,route]);
 if(Number(w.hits)>=rules[kind])await db.query('INSERT INTO security_alerts(window_id,kind,route_group,threshold) VALUES($1,$2,$3,$4) ON CONFLICT(window_id) DO NOTHING',[w.id,kind,route,rules[kind]]);
 await db.query('COMMIT');return {windowId:String(w.id),hits:Number(w.hits),alerted:Number(w.hits)>=rules[kind]};
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
}
export async function safeSecurityEvent(database:()=>Database,kind:SecurityKind,route:SecurityRoute){try{await recordSecurityEvent(database(),kind,route);}catch{console.error('SECURITY_EVENT_STORAGE_UNAVAILABLE',kind,route);}}
export function deniedKind(status:number,code:string):SecurityKind|null{if(code==='CSRF_REJECTED')return 'csrf_denied';if(status===401||status===403||status===404)return 'access_denied';if([400,413,415,422,429].includes(status))return 'invalid_request';return null;}
