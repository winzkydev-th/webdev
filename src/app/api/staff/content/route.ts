import {contentHandlers} from '../../../../lib/content-http';import {getStaffDatabase} from '../../../../lib/staff-database';import {staffConfig} from '../../../../lib/staff-auth';import {contentConfig} from '../../../../lib/content';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(r:Request){return contentHandlers(getStaffDatabase,staffConfig(),contentConfig()).GET(r);}
export async function POST(r:Request){return contentHandlers(getStaffDatabase,staffConfig(),contentConfig()).POST(r);}
