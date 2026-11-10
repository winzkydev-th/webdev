import '../globals.css';
import {notFound} from 'next/navigation';
import {copy,isLocale} from '../../lib/i18n';
export default async function Layout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}) {
 const {locale}=await params; if(!isLocale(locale)) notFound();
 return <html lang={copy[locale].lang}><body>{children}</body></html>;
}
