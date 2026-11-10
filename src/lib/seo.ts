import type {Metadata} from 'next';
import {copy,locales,slugs} from './i18n.ts';import type {Locale} from './i18n.ts';import type {PublishedContent} from './content.ts';
export type SeoSite={origin:string;pages:{slug:string;locale:Locale}[]};
export function approvedOrigin(value:unknown):string|null{
 if(typeof value!=='string'||!value.trim())return null;
 try{const u=new URL(value);const host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!host.includes('.')||!/[a-z]/i.test(host)||/^(\d+\.){3}\d+$/.test(host)||host.includes(':')||/\.(localhost|local|internal|invalid|test|example)$/.test(host)||['localhost','example.com','example.org','example.net'].some(x=>host===x||host.endsWith('.'+x)))return null;return u.origin;}catch{return null;}
}
export function seoEnvironment(env:Record<string,string|undefined>=process.env){const origin=approvedOrigin(env.PUBLIC_SITE_URL);return {origin,enabled:!!origin&&env.APP_ENV==='production'&&env.SEO_INDEXING_ENABLED==='true'&&env.PUBLIC_SITE_DOMAIN_APPROVED==='true'&&env.COMPANY_PUBLICATION_APPROVED==='true'&&env.CMS_MODE==='live'};}
export function pageUrl(origin:string,locale:Locale,slug:string){return origin+'/'+locale+(slug?'/'+slug:'');}
export function languageAlternates(site:SeoSite,slug:string){const available=locales.filter(locale=>site.pages.some(p=>p.slug===slug&&p.locale===locale));const languages:Record<string,string>={};for(const locale of available)languages[copy[locale].lang]=pageUrl(site.origin,locale,slug);if(available.includes('th'))languages['x-default']=pageUrl(site.origin,'th',slug);return languages;}
const ogLocales={th:'th_TH',en:'en_US',zh:'zh_CN'};
export function pageMetadata(locale:Locale,slug:string,content:PublishedContent|null,site:SeoSite|null):Metadata{
 const index=slugs.indexOf(slug as typeof slugs[number]);const t=copy[locale];
 const title=(content?.title??t.nav[index]??'KPN WAGON')+' | KPN WAGON LOGISTICS';
 const description=content?.description??((t.nav[index]??'KPN WAGON')+' — '+(index>=3&&index<=6?t.desc[index-3]:t.intro));
 const ready=!!site&&!!content&&!content.testOnly&&site.pages.some(p=>p.slug===slug&&p.locale===locale);
 return {title,description,robots:{index:ready,follow:ready},...(site?{alternates:{canonical:pageUrl(site.origin,locale,slug),...(ready?{languages:languageAlternates(site,slug)}:{})},openGraph:{title,description,url:pageUrl(site.origin,locale,slug),siteName:'KPN WAGON LOGISTICS COMPANY LIMITED',type:'website',locale:ogLocales[locale],alternateLocale:locales.filter(l=>l!==locale&&site.pages.some(p=>p.slug===slug&&p.locale===l)).map(l=>ogLocales[l])}}:{})};
}
export function structuredPage(locale:Locale,slug:string,content:PublishedContent|null,site:SeoSite|null){if(!site||!content||content.testOnly||!site.pages.some(p=>p.slug===slug&&p.locale===locale))return null;const url=pageUrl(site.origin,locale,slug);return {'@context':'https://schema.org','@type':'WebPage','@id':url+'#webpage',url,name:content.title,description:content.description,inLanguage:copy[locale].lang,isPartOf:{'@type':'WebSite','@id':site.origin+'/#website',url:site.origin,name:'KPN WAGON LOGISTICS COMPANY LIMITED'}};}
export function safeJsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
