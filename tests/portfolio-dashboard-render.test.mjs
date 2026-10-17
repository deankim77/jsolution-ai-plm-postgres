import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),React=require("react"),SSR=require("react-dom/server"),ts=require("typescript");
function compiled(path,imports){
  const mod={exports:{}},source=readFileSync(path,"utf8"),result=ts.transpileModule(source,{fileName:path,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  new Function("require","module","exports",result.outputText)(id=>imports[id]||((id==="react"||id==="react/jsx-runtime")?require(id):{}),mod,mod.exports);
  return mod.exports;
}
test("전사 대시보드 유형 선택이 집계와 Gate 현황표에 함께 반영된다",()=>{
  const helper=compiled("lib/portfolio-project-filter.ts",{});
  const projects=[{id:"a",code:"A",name:"간병인 보험상품 개발",customerName:"보험사",projectTypeId:"product",projectTypeName:"신규 보험상품 개발",startDate:"2026-10-08",endDate:"2026-12-01",status:"active"},{id:"b",code:"B",name:"제조",customerName:"제조사",projectTypeId:"mfg",projectTypeName:"제조",startDate:"2026-09-01",endDate:"2026-12-01",status:"active"}];
  let selection="",state=0;
  const component=compiled("app/v2/gate-dashboards.tsx",{
    react:{...React,useState:value=>React.useState(state++===1?selection:value)},
    "../../lib/portfolio-project-filter":helper,
    "./dashboard-data-store":{useSharedDashboard:()=>({projects:projects.map(p=>({id:p.id,delayedCount:p.id==="a"?2:5,gateSummary:{currentGate:"G4"},gates:[]}))})},
  }).GatePortfolioDashboard;
  const render=()=>{state=0;return SSR.renderToStaticMarkup(React.createElement(component,{projects,onOpenProject:()=>{},onOpenProjectList:()=>{}}));};
  const all=render();assert(all.includes("전체 프로젝트 유형"));assert(all.includes("제조사"));
  selection="product";
  const filtered=render();assert(filtered.includes('value="product" selected=""'));
  const matrix=filtered.slice(filtered.indexOf('class="wv2-gate-customer-matrix"'));
  assert(matrix.includes("보험사"));assert(!matrix.includes("제조사"));
  const summary=filtered.slice(filtered.indexOf('class="summary"'),filtered.indexOf('class="wv2-gate-portfolio"'));
  assert(summary.includes("<b>1</b>"));assert(summary.includes("<b>1</b>"));// one active and one delayed project
});
