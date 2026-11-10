'use client';
import {useParams} from 'next/navigation';import {isLocale,interfaceCopy} from '../../lib/i18n';
export default function ErrorPage({reset}:{reset:()=>void}){const params=useParams();const locale=isLocale(String(params.locale))?String(params.locale) as 'th'|'en'|'zh':'th';const t=interfaceCopy[locale];return <main id="content" className="detail"><h1>{t.error}</h1><p>{t.errorText}</p><button className="button" onClick={reset}>{t.retry}</button></main>;}
