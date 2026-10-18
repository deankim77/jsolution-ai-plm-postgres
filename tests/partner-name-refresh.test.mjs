import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),ts=require("typescript");
function compile(path,imports){
  const mod={exports:{}};
  const output=ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports",output)(id=>{for(const [suffix,value]of Object.entries(imports))if(id.endsWith(suffix))return value;throw new Error("Unexpected import: "+id)},mod,mod.exports);
  return mod.exports;
}
test("partner rename invalidates project and dashboard caches without changing historical customer text",async()=>{
  const revisions=compile("lib/project-master-cache.ts",{});
  const originalName="농협손해보험 (가상 데모)";
  let currentName=originalName,companyId="company-a",failWrite=false;
  const queries=[];
  const db={prepare(sql){let values=[];const statement={bind(...args){values=args;return statement},async all(){
    if(sql.includes("PRAGMA"))return {results:[{name:"avatar_key"}]};
    if(sql.includes("AS customerName")){
      assert.match(sql,/COALESCE\(partner\.name,p\.customer_name\) AS customerName/);
      assert.match(sql,/partner\.id=p\.partner_id AND partner\.company_id=p\.company_id/);
      queries.push(sql);
      if(sql.includes("AS taskId"))return {results:[]};
      return {results:[{id:"linked",code:"NH",name:"보험 프로젝트",customerName:currentName,partnerName:currentName,partnerId:"nh",status:"active"},{id:"legacy",code:"OLD",name:"이전 프로젝트",customerName:"직접 입력 고객",status:"active"}]};
    }
    return {results:[]};
  },async first(){return null},async run(){if(sql.startsWith("UPDATE partners")){if(failWrite)throw new Error("write failed");currentName=values[1]}return {}}};return statement},async batch(statements){return Promise.all(statements.map(statement=>statement.run()))}};
  const imports={"project-master-cache":revisions,"postgres-d1-compat":{getLegacyDbCompat:()=>db},"project-data-foundation":{ensureProjectDataFoundation:async()=>{}},"request-context":{resolveRequestContext:async()=>({companyId,userId:"dean",systemRoles:["SYSTEM_ADMIN"]}),contextErrorResponse:()=>null},"chatgpt-auth":{getChatGPTUser:async()=>null},"notification-service":{listUnreadNotifications:async()=>({items:[],unreadCount:0})}};
  const projects=compile("app/api/projects/route.ts",imports),dashboard=compile("app/api/dashboard-detail/route.ts",imports),master=compile("app/api/system/master-data/route.ts",imports);
  const request=path=>new Request("https://pms.jsolution.io"+path);
  let projectResponse=await projects.GET(request("/api/projects"));assert.equal((await projectResponse.json()).projects[0].customerName,originalName);
  let dashResponse=await dashboard.GET(request("/api/dashboard-detail"));assert.equal((await dashResponse.json()).gatePortfolio.customers[0].customerName,originalName);
  assert.equal((await projects.GET(request("/api/projects"))).headers.get("x-project-list-cache"),"hit");
  assert.equal((await dashboard.GET(request("/api/dashboard-detail"))).headers.get("x-dashboard-cache"),"hit");
  const rename=()=>master.PATCH(new Request("https://pms.jsolution.io/api/system/master-data",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({entity:"partner",id:"nh",code:"NH",name:"농협손해보험",category:"CUSTOMER"})}));
  assert.equal((await rename()).status,200);assert.equal(revisions.projectMasterRevision("company-a"),1);assert.equal(revisions.projectMasterRevision("company-b"),0);
  projectResponse=await projects.GET(request("/api/projects"));assert.equal(projectResponse.headers.get("x-project-list-cache"),"miss");const rows=(await projectResponse.json()).projects;assert.equal(rows[0].customerName,"농협손해보험");assert.equal(rows[1].customerName,"직접 입력 고객");
  dashResponse=await dashboard.GET(request("/api/dashboard-detail"));assert.equal(dashResponse.headers.get("x-dashboard-cache"),"miss");assert.equal((await dashResponse.json()).projects[0].customerName,"농협손해보험");
  failWrite=true;assert.equal((await rename()).status,409);assert.equal(revisions.projectMasterRevision("company-a"),1,"failed write does not invalidate");
  assert.ok(queries.length>=6);assert.ok(queries.every(sql=>!sql.includes("UPDATE projects")),"stored project customer text is not rewritten");
});
