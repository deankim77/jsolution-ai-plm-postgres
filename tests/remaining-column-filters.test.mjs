import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url),React=require("react"),SSR=require("react-dom/server"),ts=require("typescript");
function compile(path,imports={}){
  const mod={exports:{}},result=ts.transpileModule(readFileSync(path,"utf8"),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal(result.diagnostics.length,0);
  new Function("require","module","exports",result.outputText)(id=>imports[id]??(id.endsWith(".css")?{}:require(id)),mod,mod.exports);
  return mod.exports;
}
const popovers=compile("app/v2/v2-column-filter.tsx");
const shared=compile("app/v2/use-column-filters.tsx",{"./v2-column-filter":popovers});
const issues=compile("services/issue-column-filter-service.ts");

test("열 내부 OR · 열 사이 AND, 날짜 범위, 미지정과 전체 해제를 함께 처리한다",()=>{
  const rules=[{key:"status",value:row=>row.status},{key:"owner",value:row=>row.owners},{key:"date",value:row=>row.date,date:true}];
  const selected={status:["active","hold"],owner:["Dean"]},dates={date:{from:"2026-10-08",to:"2026-10-18"}};
  const rows=[{status:"active",owners:["Dean","Ellie"],date:"2026-10-08"},{status:"hold",owners:["Dean"],date:"2026-10-18"},{status:"completed",owners:["Dean"],date:"2026-10-18"},{status:"active",owners:["Ellie"],date:"2026-10-18"},{status:"hold",owners:["Dean"],date:"2026-10-19"}];
  assert.deepEqual(rows.filter(row=>shared.matchesColumnFilters(row,rules,selected,dates)),rows.slice(0,2));
  assert.equal(rows.filter(row=>shared.matchesColumnFilters(row,rules,{},{})).length,5);
  assert(shared.matchesColumnFilters({status:null},[{key:"status",value:row=>row.status}],{status:["미지정"]}));
});

const selection={has:()=>false,toggle:()=>{},clear:()=>{}};
test("실제 Workflow·설계변경·품질 렌더러는 빈 결과에도 열 바로 아래 선택 버튼을 유지한다",()=>{
  const {WorkflowStageList}=compile("app/v2/workflow-detail-panel.tsx",{"./use-column-filters":shared,"./ai-context-selection":{useAiContextSelection:()=>selection},"./connected-ai-panel":{}});
  const {SourceStageList}=compile("app/v2/source-stage-list.tsx",{"./use-column-filters":shared,"./ai-context-selection":{useAiContextSelection:()=>selection},"./master-data-store":{useMasterData:()=>({data:{},loading:false}),masterCodeLabel:(_data,_group,value)=>value}});
  for(const [Component,props,count]of [[WorkflowStageList,{rows:[],onOpen:()=>{}},6],[SourceStageList,{kind:"ECR",rows:[],onOpen:()=>{}},5],[SourceStageList,{kind:"QUALITY",rows:[],onOpen:()=>{}},5]]){
    const html=SSR.renderToStaticMarkup(React.createElement(Component,props));
    assert.equal((html.match(/class="v2-column-select/g)||[]).length,count);
    assert.match(html,/조건에 맞는/);assert.match(html,/popover="auto"/);assert.match(html,/height:auto/);
  }
});

test("이슈 복수 선택은 쉼표가 있는 담당자명을 보존하고 최대 100개로 제한한다",()=>{
  const params=new URLSearchParams({projectIds:'["a","b","a"]',types:"issue,risk",owners:JSON.stringify(["Kim, Dean","Ellie"])});
  assert.deepEqual(issues.parseIssueColumnFilters(params),{projectIds:["a","b"],types:["issue","risk"],statuses:[],owners:["Kim, Dean","Ellie"]});
  assert.equal(issues.parseIssueColumnFilters(new URLSearchParams({projectIds:JSON.stringify(Array.from({length:150},(_,i)=>String(i)))})).projectIds.length,100);
});

test("실제 WBS 목록 계산은 일치하는 업무의 상위 Gate를 보존하고 다른 보기에는 열 필터를 적용하지 않는다",()=>{
  const path="app/v2/NewWorkViewApp.tsx",text=readFileSync(path,"utf8"),source=ts.createSourceFile(path,text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
  let calculation;
  const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="visible")calculation=node.initializer.arguments[0].getText(source);ts.forEachChild(node,visit)};visit(source);assert(calculation);
  const body=ts.transpileModule(`module.exports=function(tasks,wbsColumns,view){const query="",collapsed=new Set(),filters={statuses:[],assignee:"",levels:[],flags:[]},sortKey="order",sortDirection="asc";return (${calculation})()}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:null};new Function("module",body)(mod);
  const tasks=[{id:"g1",wbsCode:"G1",kind:"summary",level:1,status:"planned"},{id:"a",wbsCode:"G1.1",parentId:"g1",kind:"task",level:2,status:"active"},{id:"b",wbsCode:"G1.2",parentId:"g1",kind:"task",level:2,status:"completed"},{id:"g2",wbsCode:"G2",kind:"summary",level:1,status:"planned"}];
  const columns={matches:row=>row.status==="active"};
  assert.deepEqual(mod.exports(tasks,columns,"list").map(row=>row.id),["g1","a"]);
  assert.equal(mod.exports(tasks,columns,"kanban").length,4);
});

test("이슈는 전체 접근 범위에서 복수 조건을 적용한 뒤 페이지와 총 건수를 계산한다",async()=>{
  const calls=[],db={prepare:sql=>{const call={sql,params:[]};calls.push(call);return {bind(...params){call.params=params;return this},async run(){},async all(){return {results:[]}},async first(){return {total:0}}}}};
  const route=compile("app/api/issues/route.ts",{"../../../services/issue-column-filter-service":issues,"../../../db/postgres-d1-compat":{getLegacyDbCompat:()=>db},"../../../db/request-context":{resolveRequestContext:async()=>({userId:"dean",companyId:"company",systemRoles:[]}),contextErrorResponse:()=>null}});
  const params=new URLSearchParams({projectIds:JSON.stringify(["a","b"]),types:JSON.stringify(["issue","risk"]),statuses:JSON.stringify(["open","in_progress"]),owners:JSON.stringify(["Kim, Dean","미지정"]),limit:"50",offset:"50"});
  const response=await route.GET(new Request("https://demo.test/api/issues?"+params));assert.equal(response.status,200);
  const filtered=calls.filter(call=>call.sql.includes("FROM project_issues i JOIN projects"));assert.equal(filtered.length,2);
  for(const call of filtered){
    assert.match(call.sql,/p.company_id=\?/);assert.match(call.sql,/pm.user_id=\?/);
    for(const column of ["i.project_id","i.issue_type","i.status","COALESCE(owner.name,'미지정')"])assert(call.sql.includes(column+" IN (?,?)"));
    assert(call.params.includes("Kim, Dean"));assert.equal((call.sql.match(/\?/g)||[]).length,call.params.length);
  }
  const page=filtered.find(call=>call.sql.includes("LIMIT ? OFFSET ?"));assert.deepEqual(page.params.slice(-2),[50,50]);
});
