import {headers} from 'next/headers';
import {publicSeoSite} from '../../../lib/public-seo';
import {pageMetadata,structuredPage,safeJsonLd} from '../../../lib/seo';
import {publicContent} from '../../../lib/public-content';
export const dynamic='force-dynamic';
import QuoteForm from '../../../components/quote-form';
import {testIntakeEnabled} from '../../../lib/intake-http';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {copy,interfaceCopy,isLocale,locales,slugs} from '../../../lib/i18n';
type Props={params:Promise<{locale:string;slug?:string[]}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,slug=[]}=await params; if(!isLocale(locale)) return {};
 const index=slugs.indexOf(slug.join('/') as typeof slugs[number]);
 if(index<0)notFound();
 const [content,site]=await Promise.all([publicContent(slug.join('/'),locale),publicSeoSite()]);
 return pageMetadata(locale,slug.join('/'),content,site);
}
export default async function Page({params}:Props){
 const {locale,slug=[]}=await params; if(!isLocale(locale)) notFound();
 const route=slug.join('/'); const index=slugs.indexOf(route as typeof slugs[number]);if(index<0)notFound();
 const t=copy[locale];const ui=interfaceCopy[locale];const content=await publicContent(route,locale);const body=content&&<div>{content.testOnly&&<p className="test-notice">{ui.testContent}</p>}<p className="text-preserve">{content.body.lead}</p>{content.body.sections.map((s,i)=><section key={i}><h2>{s.heading}</h2><p className="text-preserve">{s.text}</p></section>)}</div>;
 const nonce=(await headers()).get('x-nonce')??undefined;const schema=structuredPage(locale,route,content,await publicSeoSite());
 const testMode=testIntakeEnabled({mode:process.env.QUOTE_INTAKE_MODE,appEnv:process.env.APP_ENV,origin:process.env.APP_ORIGIN,privacyVersion:process.env.PRIVACY_NOTICE_VERSION,rateSecret:process.env.RATE_LIMIT_SECRET});
 return <><a className="skip" href="#content">{t.skip}</a><div className="draft">{t.draft}</div>
 {schema&&<script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(schema)}}/>}
 <header><Link aria-label="KPN WAGON LOGISTICS COMPANY LIMITED" className="brand" href={'/'+locale}><span className="monogram" aria-hidden="true">KPN<span>↗</span></span><span>WAGON<small>LOGISTICS</small></span></Link>
 <nav aria-label={ui.mainNav}>{[0,1,2,8,9].map(i=><Link key={i} href={'/'+locale+'/'+slugs[i]} aria-current={i===index?'page':undefined}>{t.nav[i]}</Link>)}</nav>
 <nav className="languages" aria-label={ui.languageNav}>{locales.map((l,n)=><Link lang={copy[l].lang} aria-label={ui.languageNames[n]} key={l} href={'/'+l+(route?'/'+route:'')} hrefLang={copy[l].lang} aria-current={l===locale?'page':undefined}>{l==='zh'?'中文':l.toUpperCase()}</Link>)}</nav></header>
 <main id="content" tabIndex={-1}>{index===0?<><section className="hero"><div><p className="eyebrow">{t.eyebrow}</p><h1>{content?.title??t.hero}</h1>{content?body:<p>{t.intro}</p>}<Link className="button" href={'/'+locale+'/request-a-quote'}>{t.cta} <span aria-hidden="true">↗</span></Link></div><div className="route-art" aria-hidden="true"><span className="compass">N</span><svg viewBox="0 0 500 400"><path className="grid" d="M0 100H500M0 200H500M0 300H500M100 0V400M200 0V400M300 0V400M400 0V400"/><path className="route" d="M70 315 170 215 280 245 420 80"/><circle cx="70" cy="315" r="9"/><circle cx="170" cy="215" r="7"/><circle cx="280" cy="245" r="7"/><circle cx="420" cy="80" r="10"/></svg><span className="route-label">{ui.routeArt}</span></div></section><section className="services"><p className="eyebrow">01 / KPN WAGON</p><h2>{t.services}</h2><div className="cards">{[3,4,5,6].map((i,n)=><Link className="card" href={'/'+locale+'/'+slugs[i]} key={i}><span className="number">0{n+1} ↗</span><h3>{t.nav[i]}</h3><p>{t.desc[n]}</p></Link>)}</div></section></>:<section className="detail"><p className="eyebrow">KPN WAGON / {String(index).padStart(2,'0')}</p><h1>{content?.title??t.nav[index]}</h1>{body}{index===7&&testMode?<QuoteForm locale={locale}/>:(index===7||!content)&&<p>{index===7?t.quote:t.pending}</p>}{index===2&&<div className="cards">{[3,4,5,6].map(i=><Link className="card" key={i} href={'/'+locale+'/'+slugs[i]}>{t.nav[i]} ↗</Link>)}</div>}{index>=3&&index<=6&&<><p>{t.desc[index-3]}</p><Link className="button" href={'/'+locale+'/request-a-quote'}>{t.cta} ↗</Link></>}</section>}</main>
 <footer><strong>KPN WAGON LOGISTICS COMPANY LIMITED</strong><p>{t.footer}</p><div>{[10,11].map(i=><Link key={i} href={'/'+locale+'/'+slugs[i]}>{t.nav[i]}</Link>)}</div></footer></>;
}
