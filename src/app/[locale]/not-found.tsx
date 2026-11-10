'use client';
import Link from 'next/link';import {useParams} from 'next/navigation';import {isLocale,interfaceCopy} from '../../lib/i18n';
export default function NotFound(){const params=useParams();const locale=isLocale(String(params.locale))?String(params.locale) as 'th'|'en'|'zh':'th';const t=interfaceCopy[locale];return <main id="content" className="detail"><p>404</p><h1>{t.notFound}</h1><p>{t.notFoundText}</p><Link className="button" href={'/'+locale}>{t.home}</Link></main>;}
