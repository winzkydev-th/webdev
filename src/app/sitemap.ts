import type {MetadataRoute} from 'next';import {publicSeoSite} from '../lib/public-seo';import {languageAlternates,pageUrl} from '../lib/seo';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const site=await publicSeoSite();if(!site)return [];return site.pages.map(p=>({url:pageUrl(site.origin,p.locale,p.slug),alternates:{languages:languageAlternates(site,p.slug)}}));}
