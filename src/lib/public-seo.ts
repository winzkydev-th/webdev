import {cache} from 'react';import {getPublicDatabase} from './public-content';import {approvedOrigin,seoEnvironment} from './seo';import type {SeoSite} from './seo';import {isLocale,slugs} from './i18n';
export const publicSeoSite=cache(async():Promise<SeoSite|null>=>{
 const config=seoEnvironment();if(!config.enabled||!config.origin)return null;
 const db=getPublicDatabase();if(!db)return null;
 try{const row=(await db.query("SELECT value,approved_at FROM system_settings WHERE key='company'")).rows[0];const value=row?.value as Record<string,unknown>|undefined;
 if(!row?.approved_at||value?.publicationApproved!==true||approvedOrigin(value.domain)!==config.origin)return null;
 const rows=(await db.query('SELECT slug,locale FROM cms_published_content WHERE NOT test_only')).rows;
 const pages:SeoSite['pages']=[];for(const r of rows){if(isLocale(String(r.locale))&&(slugs as readonly string[]).includes(String(r.slug)))pages.push({slug:String(r.slug),locale:String(r.locale) as 'th'|'en'|'zh'});}
 return {origin:config.origin,pages};
 }catch{console.error('PUBLIC_SEO_UNAVAILABLE');return null;}
});
