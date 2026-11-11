import {headers} from 'next/headers';
import '../globals.css';
export default async function Layout({children}:{children:React.ReactNode}){await headers();return <html lang="th"><body>{children}</body></html>;}
