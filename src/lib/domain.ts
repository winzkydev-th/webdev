export const services = ['sea','air','land','customs'] as const;
export type Service = typeof services[number];
export const statuses = ['New','Assigned','Reviewing','Need Information','Preparing Quote','Quoted','Accepted','Declined','Closed'] as const;
export type Status = typeof statuses[number];
export type Role = 'owner'|'manager'|'sales'|'editor'|'viewer';
export type Action = 'read'|'assign'|'work'|'approve'|'publish'|'staff';
export type Principal = {id:string; role:Role; mfaVerified:boolean; active:boolean};
// Call only with a principal obtained from a server-verified session, never request JSON.
export function authorize(user:Principal|null, action:Action, assignee?:string):boolean {
  if (!user?.active) return false;
  if ((user.role === 'owner' || user.role === 'manager') && !user.mfaVerified) return false;
  if (user.role === 'owner') return true;
  if (user.role === 'manager') return ['read','assign','work','approve'].includes(action);
  if (user.role === 'sales') return ['read','work'].includes(action) && assignee === user.id;
  if (user.role === 'editor') return action === 'publish';
  return user.role === 'viewer' && action === 'read' && assignee === user.id;
}
const edges:Record<Status,readonly Status[]> = {
  New:['Assigned','Closed'], Assigned:['Reviewing','Closed'],
  Reviewing:['Need Information','Preparing Quote','Closed'],
  'Need Information':['Reviewing','Closed'], 'Preparing Quote':['Need Information','Quoted','Closed'],
  Quoted:['Preparing Quote','Accepted','Declined','Closed'],Accepted:['Closed'],Declined:['Closed'],Closed:[]
};
export function canTransition(from:Status,to:Status,context:{reason?:string; assignee?:string; approvedOffer?:boolean; deliveryEvidence?:string}):boolean {
  if (!edges[from]?.includes(to)) return false;
  if (to === 'Assigned' && !context.assignee) return false;
  if (to === 'Quoted' && (!context.approvedOffer || !context.deliveryEvidence?.trim())) return false;
  if (to === 'Closed' && !context.reason?.trim()) return false;
  return true;
}
export type QuoteInput = {service:Service; name:string; email:string; phone:string; origin:string; destination:string; cargo:string; weightKg?:number; container?:string; customsDirection?:'import'|'export'; privacyAcknowledged:boolean; marketingConsent:boolean; website?:string};
export function validateQuote(value:unknown):string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['invalid_body'];
  const q = value as Record<string,unknown>; const errors:string[]=[];
  if (!services.includes(q.service as Service)) errors.push('service');
  for (const key of ['name','email','phone','origin','destination','cargo']) {
    if (typeof q[key] !== 'string' || !(q[key] as string).trim() || (q[key] as string).length > (key === 'cargo' ? 4000 : 254)) errors.push(key);
  }
  if (typeof q.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email)) errors.push('email_format');
  if (q.privacyAcknowledged !== true) errors.push('privacy');
  if (typeof q.marketingConsent !== 'boolean') errors.push('marketing_consent');
  if (q.website !== undefined && q.website !== '') errors.push('spam');
  if (['air','land'].includes(q.service as string) && (typeof q.weightKg !== 'number' || !Number.isFinite(q.weightKg) || q.weightKg <= 0)) errors.push('weight');
  if (q.service === 'sea' && !['FCL','LCL'].includes(q.container as string)) errors.push('container');
  if (q.service === 'customs' && !['import','export'].includes(q.customsDirection as string)) errors.push('customs_direction');
  return errors;
}

export function allowedStatusTargets(from:Status):readonly Status[]{return [...(edges[from]??[])];}
