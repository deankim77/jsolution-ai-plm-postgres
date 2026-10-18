import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),ts=require("typescript");
function compile(path,imports){
  const mod={exports:{}},result=ts.transpileModule(readFileSync(path,"utf8"),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  new Function("require","module","exports",result.outputText)(id=>{if(!(id in imports))throw Error("Unexpected import "+id);return imports[id]},mod,mod.exports);return mod.exports;
}
const service=compile("services/my-work-filter-service.ts",{"../db/repositories/my-work-filter-repository":{readMyWorkRoleChoices:async()=>[{role:"PM",assignee:"Dean"},{role:"PM",assignee:"Ellie"}]}});
test("복수 프로젝트와 Role 선택은 중복을 제거하고 역할 후보는 전체 허용 범위에서 반환한다",async()=>{
  assert.deepEqual(service.parseMyWorkMultiFilters(new URLSearchParams("projectIds=a,b,a&roles=PM,Dean")),{projectIds:["a","b"],roles:["pm","dean"]});
  assert.deepEqual((await service.getMyWorkRoleOptions("company","dean")).map(option=>option.value),["Dean","Ellie","PM"]);
});
for(const [path,prefix] of [["app/api/my-work/route.ts","../../../"],["app/api/my-work/summary/route.ts","../../../../"]]){
  test(path+"는 복수 선택을 페이지와 집계의 SQL 조건에 함께 적용한다",async()=>{
    const calls=[];
    const db={prepare:sql=>{const row={sql,params:[]};calls.push(row);return {bind(...params){row.params=params;return this},async all(){return {results:[]}},async first(){return {total:0}}}}};
    const route=compile(path,{
      [prefix+"services/my-work-filter-service"]:service,
      [prefix+"db/postgres-d1-compat"]:{getLegacyDbCompat:()=>db},
      [prefix+"db/request-context"]:{resolveRequestContext:async()=>({userId:"dean",companyId:"company"}),contextErrorResponse:()=>null},
      [path.includes("summary")?"../../../chatgpt-auth":"../../chatgpt-auth"]:{getChatGPTUser:async()=>null},
    });
    const response=await route.GET(new Request("https://demo.test/api/my-work?projectIds=a,b&roles=PM,Dean&statuses=active,review&offset=50&includeSummary=0"));
    assert.equal(response.status,200);
    for(const row of calls.filter(row=>row.sql.includes("COUNT(*)")||row.sql.includes("LIMIT ?"))){
      assert(row.sql.includes("wt.project_id IN (?,?)"));
      assert(row.sql.includes("LOWER(COALESCE(wt.role_code,'')) IN (?,?)"));
      assert(row.params.includes("a")&&row.params.includes("b")&&row.params.includes("pm")&&row.params.includes("dean"));
      assert.equal((row.sql.match(/\?/g)||[]).length,row.params.length,"placeholder binding count");
    }
  });
}
