import {getDatabase} from '../../../lib/database';
import {createIntakeHandler} from '../../../lib/intake-http';
export const runtime='nodejs';
export async function POST(request:Request){return createIntakeHandler(getDatabase,{
 mode:process.env.QUOTE_INTAKE_MODE,appEnv:process.env.APP_ENV,origin:process.env.APP_ORIGIN,
 privacyVersion:process.env.PRIVACY_NOTICE_VERSION,rateSecret:process.env.RATE_LIMIT_SECRET
})(request);}
