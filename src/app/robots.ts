import type {MetadataRoute} from 'next';import {publicSeoSite} from '../lib/public-seo';
export const dynamic='force-dynamic';
export default async function robots():Promise<MetadataRoute.Robots>{const site=await publicSeoSite();if(!site||!site.pages.length)return {rules:{userAgent:'*',disallow:'/'}};return {rules:{userAgent:'*',allow:'/',disallow:['/staff','/api/']},sitemap:site.origin+'/sitemap.xml'};}
