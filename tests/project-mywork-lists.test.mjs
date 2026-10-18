import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const require=createRequire(import.meta.url),React=require("react"),SSR=require("react-dom/server"),ts=require("typescript");
const selection={has:()=>false,toggle:()=>{},clear:()=>{}};
function compiled(path,imports={}){
  const mod={exports:{}},result=ts.transpileModule(readFileSync(path,"utf8"),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.equal(result.diagnostics.length,0);
  new Function("require","module","exports",result.outputText)(id=>imports[id]??(id.endsWith(".css")?{}:require(id)),mod,mod.exports);
  return mod.exports;
}
const shared=compiled("app/v2/v2-list-table.tsx");
const filters=compiled("app/v2/workspace-filter-panel.tsx");
function checkColumns(html,count){
  assert.equal((html.match(/<th scope="col"/g)||[]).length,count);
  assert.equal((html.match(/<col(?: |\/)/g)||[]).length,count);
  const body=html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  for(const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g))assert.equal((row[1].match(/<td>/g)||[]).length,count);
}
const projects=[{id:"a",code:"INS-CARE",name:"간병인 보험상품 개발",projectTypeName:"신규 보험상품 개발",partnerName:"보험사",pmNames:["Dean"],startDate:"2026-10-08",endDate:"2026-12-01",status:"active"}];
test("프로젝트는 공통 표의 11개 헤더와 본문 열이 일치하고 긴 이름은 원문을 유지한다",()=>{
  const {ProjectListWorkspace}=compiled("app/v2/project-workspaces.tsx",{
    "./v2-list-table":shared,"./workspace-filter-panel":filters,"./template-output-editor":{},
    "./ai-context-selection":{useAiContextSelection:()=>selection},
    "./dashboard-data-store":{useSharedDashboard:()=>({projects:[{id:"a",progress:56,taskCount:30,completedCount:13,delayedCount:2,openIssues:1,gateSummary:{currentGate:"G4"}}]})},
  });
  const html=SSR.renderToStaticMarkup(React.createElement(ProjectListWorkspace,{projects,loading:false,onCreate:()=>{},onOpen:()=>{},onOpenFilter:()=>{}}));
  checkColumns(html,11);assert.match(html,/간병인 보험상품 개발/);assert.match(html,/신규 보험상품 개발/);assert.match(html,/Dean/);assert.match(html,/진척률 56%/);assert.match(html,/G4/);assert.match(html,/프로젝트 유형 필터/);
  const loading=SSR.renderToStaticMarkup(React.createElement(ProjectListWorkspace,{projects:[],loading:true,onCreate:()=>{},onOpen:()=>{},onOpenFilter:()=>{}}));
  assert.equal((loading.match(/<th scope="col"/g)||[]).length,11);assert.match(loading,/colSpan="11"|colspan="11"/);assert.match(loading,/프로젝트를 불러오는 중/);
});

test("내 업무는 공통 표의 10개 헤더·본문을 유지하고 완료 검토와 산출물 상태를 구분한다",()=>{
  const tasks=[{id:"t",projectId:"a",projectCode:"INS-CARE",projectName:projects[0].name,wbsCode:"G3-A01",name:"상품 보장 검토",status:"review",progress:100,completionActor:"PM",plannedEnd:"2026-10-18",deliverableCount:2,unregisteredDeliverableCount:1,issueCount:1}];
  let index=0;
  const {FilteredMyWorkWorkspace}=compiled("app/v2/my-workspace.tsx",{
    react:{...React,useState:value=>React.useState(index++===0?tasks:index===2?projects:index===3?false:value)},
    "./v2-list-table":shared,"./workspace-filter-panel":filters,
    "./ai-context-selection":{useAiContextSelection:()=>selection},"./my-work-data-store":{},
  });
  const html=SSR.renderToStaticMarkup(React.createElement(FilteredMyWorkWorkspace,{scope:"review",onScopeChange:()=>{},onOpenTask:()=>{},onOpenFilter:()=>{}}));
  checkColumns(html,10);assert.match(html,/G3-A01/);assert.match(html,/PM 완료 검토/);assert.match(html,/등록 예정/);assert.match(html,/승인 대기/);assert.match(html,/산출물 상태 필터/);
});

test("빈 결과에서도 공통 헤더와 열 필터가 남아 조건을 해제할 수 있다",()=>{
  const html=SSR.renderToStaticMarkup(React.createElement(shared.V2ListTable,{label:"빈 목록",columns:[{key:"name",label:"이름",width:200,grow:true},{key:"status",label:"상태",width:100,onFilter:()=>{},activeCount:2}],empty:"일치하는 항목 없음"}));
  assert.match(html,/상태 필터 · 2개 적용/);assert.match(html,/colSpan="2"|colspan="2"/);assert.match(html,/일치하는 항목 없음/);
});
