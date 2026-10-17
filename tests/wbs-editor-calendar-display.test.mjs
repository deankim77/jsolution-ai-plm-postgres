import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {localCalendarDate} from "../lib/local-calendar-date.ts";
const require=createRequire(import.meta.url),React=require("react"),SSR=require("react-dom/server"),ts=require("typescript");
const read=path=>readFileSync(path,"utf8");
function compile(path,imports){
  const mod={exports:{}},result=ts.transpileModule(read(path),{fileName:path,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  new Function("require","module","exports",result.outputText)(id=>imports[id]||((id==="react"||id==="react/jsx-runtime")?require(id):{}),mod,mod.exports);
  return mod.exports;
}
test("WBS 편집 표는 15개 열을 한 colgroup으로 관리하고 긴 Gate 코드를 별도 한 줄 영역에 표시한다",()=>{
  const collapse={useSharedWbsCollapse:()=>({collapsed:new Set(),toggle:()=>{},collapseAll:()=>{},expandAll:()=>{}}),filterCollapsedWbs:tasks=>tasks,WbsHierarchyControls:()=>null,WbsCollapseChevron:()=>null};
  const icons=new Proxy({},{get:()=>()=>null});
  const Editor=compile("app/v2/advanced-wbs-editor.tsx",{"./wbs-collapse-state":collapse,"lucide-react":icons}).AdvancedWbsEditor;
  const props={tasks:[{id:"g",wbsCode:"G1",level:1,kind:"summary",name:"착수",taskType:"normal",durationDays:0,deliverables:[]},{id:"r",wbsCode:"G1-REVIEW",level:2,kind:"task",name:"긴 단계 승인 업무",taskType:"gate",durationDays:1,deliverables:[]}],roles:[],members:[],patchTask:()=>{},onAdd:()=>{},onAddRelated:()=>{},onMove:()=>{},onIndent:()=>{},onDuplicate:()=>{},onRemove:()=>{},onSave:()=>{},saving:false,notice:""};
  const html=SSR.renderToStaticMarkup(React.createElement(Editor,props));
  const cols=html.match(/<colgroup>(.*?)<\/colgroup>/)[1];
  assert.equal((cols.match(/<col /g)||[]).length,15);
  assert(!cols.includes('class="actions"'));
  assert.equal((cols.match(/class="wv2-wbs-col-/g)||[]).length,15);
  assert(html.includes('class="wv2-wbs-code-value" title="G1-REVIEW">G1-REVIEW</span>'));
  const css=read("app/v2/work-view-v2.css");
  assert(css.includes("col.wv2-wbs-col-wbs-code{width:136px}"));
  assert(!/\.wv2-advanced-wbs-editor th:nth-child/.test(css));
  assert(css.includes(".wv2-wbs-code-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"));
});
test("한국 새벽의 오늘은 UTC 전날이 아닌 현지 날짜이며 원형 배경 없이 표시한다",()=>{
  const previousTZ=process.env.TZ,RealDate=globalThis.Date;
  try{
    process.env.TZ="Asia/Seoul";
    const now=Date.parse("2026-10-17T19:53:00Z");
    globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
    assert.equal(localCalendarDate(),"2026-10-18");
    assert.equal(new Date().toISOString().slice(0,10),"2026-10-17");
    const Calendar=compile("app/v2/wbs-inline-views.tsx",{"../../lib/local-calendar-date":{localCalendarDate},"lucide-react":new Proxy({},{get:()=>()=>null})}).CalendarView;
    const html=SSR.renderToStaticMarkup(React.createElement(Calendar,{tasks:[],onSelect:()=>{},onAdd:()=>{},canAdd:false}));
    assert.match(html,/<section[^>]*class=" today"[^>]*><span aria-current="date">18<\/span>/);
    const css=read("app/v2/work-view-v2.css"),today=css.match(/\.wv2-calendar section.today>span\{([^}]*)\}/)[1];
    assert(!/background|width|height|border-radius/.test(today));
    assert(today.includes("font-weight:800"));
    assert(today.includes("var(--v2-color-primary)"));
  }finally{globalThis.Date=RealDate;if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ;}
});
