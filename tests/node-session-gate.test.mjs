import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Readable} from 'node:stream';
import {createNodeSessionGate} from '../tools/node-session-gate.mjs';
import {createAppSession} from '../lib/app-auth.ts';
const secret='isolated-session-test-secret';
async function call(url,method='GET',headers={},getSecret=()=>secret){
 const req=Object.assign(Readable.from(['{"key":"retained"}']),{url,method,headers:{...headers},rawHeaders:Object.entries(headers).flat()});
 const output={headers:{},next:false};
 const res={setHeader(k,v){output.headers[k]=v},end(body){output.body=body},set statusCode(code){output.status=code}};
 await createNodeSessionGate({getSecret})(req,res,e=>{if(e)throw e;output.next=true});
 return {req,...output};
}
test('anonymous pages redirect; APIs, files and actions are blocked before handling',async()=>{
 for(const url of ['/','/?phpinfo=1','/projects','/storage/private.pdf']){const r=await call(url);assert.equal(r.status,302);assert.equal(r.headers.Location,'/login');assert.equal(r.next,false);}
 for(const [url,method] of [['/api/projects','GET'],['/api/files/report.pdf','GET'],['/api/state','PUT'],['/','POST']])assert.equal((await call(url,method)).status,401);
});
test('login form and development assets remain accessible',async()=>{
 for(const [url,method] of [['/login','GET'],['/api/auth/login','POST'],['/api/auth/logout','POST'],['/@vite/client','GET'],['/node_modules/.vite/deps/react.js','GET'],['/app/login/page.tsx','GET'],['/favicon.svg','GET']])assert.equal((await call(url,method)).next,true);
});
test('expired, tampered, malformed cookies, missing secret and spoofed identity fail closed',async()=>{
 const valid=await createAppSession('demo@example.com',secret);
 const expired=await createAppSession('demo@example.com',secret,-1);
 for(const token of [expired,valid+'x','%ZZ',''])assert.equal((await call('/api/state','GET',{cookie:`jsolution_session=${token}`,'x-user-id':'admin','oai-authenticated-user-email':'admin@example.com'})).status,401);
 assert.equal((await call('/api/state','GET',{cookie:`jsolution_session=${valid}`},()=>'' )).status,401);
});
test('valid signed session forwards exact untouched body and replaces spoofed identity',async()=>{
 const token=await createAppSession('demo@example.com',secret);
 const r=await call('/api/state','PUT',{cookie:`jsolution_session=${token}`,'x-user-id':'admin','cf-access-authenticated-user-email':'admin@example.com'});
 assert.equal(r.next,true);assert.equal(r.req.headers['x-user-id'],undefined);assert.equal(r.req.headers['cf-access-authenticated-user-email'],undefined);assert.equal(r.req.headers['oai-authenticated-user-email'],'demo@example.com');assert.equal(Readable.isDisturbed(r.req),false);assert.equal(r.req.rawHeaders.includes('admin'),false);assert.equal(r.req.rawHeaders.includes('demo@example.com'),true);
 let data='';for await(const chunk of r.req)data+=chunk;assert.equal(data,'{"key":"retained"}');
});
test('sensitive file probes are denied even under asset paths',async()=>{
 for(const url of ['/.env','/%2f%2eenv','/.git/config','/@fs/C:/project/.env','/.dev.vars'])assert.equal((await call(url)).status,404);
});
