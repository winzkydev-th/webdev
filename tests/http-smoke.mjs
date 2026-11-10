import assert from 'node:assert/strict';
const base='http://127.0.0.1:3000';
const slugs=['','about','services','sea-freight','air-freight','land-freight','customs-clearance','request-a-quote','news','contact','privacy','terms'];
let count=0;
for(const lang of ['th','en','zh']) for(const slug of slugs){
 const res=await fetch(`${base}/${lang}/${slug}`);assert.equal(res.status,200);
 const html=await res.text();assert.ok(html.includes(`lang="${lang==='zh'?'zh-Hans':lang}"`));
 assert.match(res.headers.get('x-robots-tag'),/noindex/);
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 for(const target of ['th','en','zh'])assert.ok(html.includes(`/${target}${slug?'/'+slug:''}`));
 count++;
}
for(const route of ['/xx','/th/not-a-page'])assert.equal((await fetch(base+route)).status,404);
const redirect=await fetch(base,{redirect:'manual'});assert.ok([307,308].includes(redirect.status));assert.equal(redirect.headers.get('location'),'/th');
const disabled=await fetch(base+'/api/quotes',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(disabled.status,503);assert.equal((await disabled.json()).code,'INTAKE_NOT_READY');
assert.equal((await (await fetch(base+'/api/health')).json()).quoteIntake,'disabled');
assert.match(await (await fetch(base+'/robots.txt')).text(),/Disallow: \//);
console.log(JSON.stringify({pages:count,unknownRoutes:2,defaultThaiRedirect:'pass',failClosedQuoteIntake:'pass',health:'pass',draftIndexingProtection:'pass',languageAttributesAndLinks:'pass'},null,2));
