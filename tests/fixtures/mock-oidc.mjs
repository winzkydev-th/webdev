import http from 'node:http';import {randomUUID,createHash} from 'node:crypto';import {generateKeyPair,exportJWK,SignJWT} from 'jose';
// Synthetic identity provider for tests/local preview only. Never use as a real IdP.
export async function mockOidc({clientId='kpn-test',clientSecret='synthetic-client-secret',port=0,origin='http://127.0.0.1:3000'}={}){
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid=randomUUID();jwk.use='sig';jwk.alg='RS256';const requests=new Map();const codes=new Map();let issuer='';
 function issue(url,subject='synthetic-owner',overrides={}){const query=new URL(url).searchParams;const code=randomUUID();codes.set(code,{subject,overrides,nonce:query.get('nonce'),challenge:query.get('code_challenge'),redirect:query.get('redirect_uri')});const callback=new URL(query.get('redirect_uri'));callback.searchParams.set('code',code);callback.searchParams.set('state',query.get('state'));return callback;}
 const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,issuer);res.setHeader('Cache-Control','no-store');
 if(url.pathname==='/.well-known/openid-configuration'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({issuer,authorization_endpoint:issuer+'/authorize',token_endpoint:issuer+'/token',jwks_uri:issuer+'/jwks',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],code_challenge_methods_supported:['S256']}));return;}
 if(url.pathname==='/jwks'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({keys:[jwk]}));return;}
 if(url.pathname==='/authorize'){
 if(url.searchParams.get('client_id')!==clientId||url.searchParams.get('redirect_uri')!==origin+'/staff/auth/callback'){res.writeHead(400);res.end();return;}
 const id=randomUUID();requests.set(id,url.href);res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="th"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KPN ผู้ให้บริการยืนยันตัวตนจำลอง</title><body style="font-family:Tahoma,Arial;padding:40px;background:#f5f7fa;color:#0b1f45"><h1>ผู้ให้บริการยืนยันตัวตนจำลอง</h1><p>สำหรับข้อมูลสังเคราะห์ในเครื่องเท่านั้น ไม่มีบัญชีบริษัทจริง</p><p>ปุ่มเหล่านี้จำลองผลยืนยัน MFA จากผู้ให้บริการ เพื่อทดสอบเว็บไซต์</p><form action="/select"><input type="hidden" name="request" value="'+id+'"><label>บัญชีทดสอบ <select name="subject"><option value="synthetic-owner">Owner ทดสอบ</option><option value="synthetic-manager">Manager ทดสอบ</option><option value="synthetic-sales">Sales ทดสอบ</option><option value="synthetic-editor">Content Editor ทดสอบ</option><option value="synthetic-viewer">Viewer ทดสอบ</option></select></label><p><button style="padding:14px 25px" type="submit">ยืนยันตัวตนและ MFA จำลอง</button></p></form></body></html>');return;
 }
 if(url.pathname==='/select'){const original=requests.get(url.searchParams.get('request'));requests.delete(url.searchParams.get('request'));const sub=url.searchParams.get('subject');if(!original||!['synthetic-owner','synthetic-manager','synthetic-sales','synthetic-editor','synthetic-viewer'].includes(sub)){res.writeHead(400);res.end();return;}res.writeHead(302,{Location:issue(original,sub).href});res.end();return;}
 if(url.pathname==='/token'&&req.method==='POST'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);res.end();return;}}
 const body=new URLSearchParams(raw);const item=codes.get(body.get('code'));codes.delete(body.get('code'));
 const challenge=createHash('sha256').update(body.get('code_verifier')??'').digest('base64url');
 if(!item||body.get('client_secret')!==clientSecret||body.get('client_id')!==clientId||challenge!==item.challenge||body.get('redirect_uri')!==item.redirect){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'invalid_grant'}));return;}
 const {__badSignature,...claimsOverride}=item.overrides;const now=Math.floor(Date.now()/1000);const payload={iss:issuer,aud:clientId,sub:item.subject,iat:now,exp:now+300,auth_time:now,nonce:item.nonce,acr:'urn:kpn:test:mfa',amr:['pwd','otp'],role:'owner',...claimsOverride};
 const id_token=await new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:jwk.kid}).sign(__badSignature?(await generateKeyPair('RS256')).privateKey:privateKey);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({access_token:randomUUID(),token_type:'Bearer',expires_in:300,id_token}));return;
 }
 res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end('MOCK_PROVIDER_ERROR');}});
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));issuer='http://127.0.0.1:'+server.address().port;
 return {issuer,issue,close:()=>new Promise(resolve=>server.close(resolve))};
}
