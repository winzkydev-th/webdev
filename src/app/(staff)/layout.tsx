import {headers} from 'next/headers';
export const dynamic='force-dynamic';
import '../globals.css';import './staff.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'KPN WAGON | พื้นที่เจ้าหน้าที่',robots:{index:false,follow:false}};
export default async function StaffRoot({children}:{children:React.ReactNode}){await headers();return <html lang="th"><body>{children}</body></html>;}
