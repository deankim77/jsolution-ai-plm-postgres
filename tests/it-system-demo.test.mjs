import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {buildItSystemDemo,itSystemTemplate,createDemoCalendar} from "../scripts/demo-data/it-system-project.mjs";
import {itSystemDocumentSpecs} from "../services/it-system-demo-document-service.mjs";
import {seedItSystemDemo} from "../services/it-system-demo-seed-service.mjs";

const asOf="2026-10-20";
test("IT 템플릿은 2레벨 30행이며 Gate는 G1부터 G6까지 직접 연결된다",()=>{
  const rows=itSystemTemplate.definition.wbs;assert.equal(rows.length,30);assert(rows.every(row=>row.level<=2));
  for(let n=1;n<=6;n++){const gate=rows.find(row=>row.id===`G${n}-REVIEW`);assert.equal(gate.predecessor,n===1?"":`G${n-1}-REVIEW`);assert.equal(rows.filter(row=>row.parentId===`G${n}`).length,4);if(n>1)assert.equal(rows.find(row=>row.id===`G${n}-A01`).predecessor,`G${n-1}-REVIEW`);}
});
test("일주일 전 착수·G1 통과·G2 진행 중, 선후행과 실적 날짜가 정합하다",()=>{
  const demo=buildItSystemDemo(asOf);assert.equal(demo.startDate,"2026-10-13");assert.equal(demo.profile.name,"보험업무 통합관리 시스템 구축");assert(!/데모|샘플/.test(demo.profile.name));assert.equal(demo.tasks.find(row=>row.id==="G1-REVIEW").status,"completed");assert.equal(demo.tasks.find(row=>row.id==="G2-A02").status,"active");
  for(const task of demo.tasks.filter(row=>row.kind==="task")){if(task.predecessor)assert(demo.tasks.find(row=>row.id===task.predecessor).plannedEnd<task.plannedStart);if(task.complete)assert(task.plannedEnd<asOf);if(task.upload)assert(task.plannedStart<=asOf);}
  for(let n=1;n<=6;n++)assert(demo.tasks.find(row=>row.id===`G${n}-A03`).plannedEnd<demo.tasks.find(row=>row.id===`G${n}-REVIEW`).plannedStart);
  assert.throws(()=>buildItSystemDemo("2026-02-30"),/형식/);
});
test("회사 휴일을 반영하며 실제 간트 CPM에서 G1~G6 Gate의 여유 일정은 모두 0이다",()=>{
  const require=createRequire(import.meta.url),ts=require('typescript'),source=readFileSync('app/v2/advanced-gantt-view.tsx','utf8'),body=source.slice(source.indexOf('const DAY='),source.indexOf('export function AdvancedGanttView'))+'\nmodule.exports={analyzeNetwork};';
  const calendar=createDemoCalendar(),mod={exports:{}};
  new Function('module','isBusinessDay','nextBusinessDate',ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(mod,date=>calendar.isWorking(date.toISOString().slice(0,10)),date=>calendar.next(date));
  const demo=buildItSystemDemo(asOf),analysis=mod.exports.analyzeNetwork(demo.tasks.map(task=>({...task,predecessorCode:task.predecessor})));
  for(let n=1;n<=6;n++){assert.equal(analysis.get(`G${n}-REVIEW`).slack,0,`G${n}`);assert.equal(analysis.get(`G${n}-REVIEW`).critical,true);}
  const holiday=buildItSystemDemo(asOf,{holidays:[{date:'2026-10-14'}]});assert(holiday.tasks.filter(row=>row.kind==='task').every(row=>row.plannedStart!=='2026-10-14'&&row.plannedEnd!=='2026-10-14'));
});
test("산출물 6종 12개 리비전, 세 문서는 Rev01~03 본문이 누적되며 미래 등록은 없다",()=>{
  const demo=buildItSystemDemo(asOf),specs=itSystemDocumentSpecs(demo);assert.equal(new Set(specs.map(row=>row.taskCode)).size,6);assert.equal(specs.length,12);
  for(const code of ['G1-A01','G1-A02','G2-A01']){const revisions=specs.filter(row=>row.taskCode===code);assert.deepEqual(revisions.map(row=>row.revision),[1,2,3]);assert(revisions[2].text.includes(revisions[1].note));assert(revisions[2].text.length>revisions[1].text.length);assert(revisions[1].text.length>revisions[0].text.length);}
  for(const row of specs){assert(row.date>=demo.startDate&&row.date<=asOf);assert(row.document.metadata.projectName===demo.profile.name);assert(row.document.metadata.documentNumber);assert(!JSON.stringify(row.document).includes('undefined'));}
  // Seven-day calendars may reach the security review within the first week.
  assert(itSystemDocumentSpecs(buildItSystemDemo(asOf,{workingDays:[0,1,2,3,4,5,6]})).length>0);
});
function fixture({failOnInsert,companies,users}={}){
  const tables=new Map(),files=new Map();let template;
  const repo={transaction:async work=>{const saved=structuredClone(tables),old=template;try{return await work(repo)}catch(error){tables.clear();for(const entry of saved)tables.set(...entry);template=old;throw error}},companies:async()=>companies||[{id:'c',name:'JSOLUTION'}],lock:async()=>{},users:async()=>users||[{id:'dean',companyId:'c',email:'dean@jsolution.io',name:'Dean',status:'active'},{id:'staff',companyId:'c',email:'staff@jsolution.io',name:'담당자',status:'active'}],calendar:async()=>undefined,project:async(companyId,code)=>(tables.get('projectsDb')||[]).find(row=>row.companyId===companyId&&row.code===code),template:async()=>template,createTemplate:async(companyId,userId,value)=>{template={id:'template',versionId:'tv',definition:JSON.stringify(value.definition)};return template},partnerByName:async()=>[{id:'nh',name:'농협손해보험',status:'active'}],lookup:async(name,c,code)=>(tables.get(name)||[]).find(row=>row.code===code),insert:async(name,rows)=>{if(name===failOnInsert)throw Error('injected failure');tables.set(name,[...(tables.get(name)||[]),...rows])},setDeliverableFile:async(id,key)=>{const row=tables.get('deliverables').find(row=>row.id===id);row.fileKey=key}};
  return {repo,tables,files,storage:{put:async(key,data)=>files.set(key,data),delete:async key=>files.delete(key)}};
}
test("등록은 Dean PM·기존 거래처·유형·Baseline·실적·문서 파일을 연결하며 재실행은 보존한다",async()=>{
  const f=fixture(),result=await seedItSystemDemo(f.repo,f.storage,async()=>Buffer.from('docx'),{asOf});assert.equal(result.status,'created');assert.equal(result.completed,5);assert.equal(result.inProgress,1);assert.equal(f.tables.get('projectsDb')[0].partnerId,'nh');assert.equal(f.tables.get('projectMembers').find(row=>row.projectRole==='PM').userId,'dean');assert.equal(f.tables.get('projectBaselines').length,1);assert.equal(f.tables.get('deliverables').length,24);assert.equal(f.tables.get('deliverableVersions').length,12);assert.equal(f.files.size,24);
  const ids=new Map(f.tables.get('wbsTasks').map(row=>[row.wbsCode,row.id]));for(let n=2;n<=6;n++)assert.equal(f.tables.get('wbsTasks').find(row=>row.wbsCode===`G${n}-REVIEW`).predecessorId,ids.get(`G${n-1}-REVIEW`));
  assert(f.tables.get('taskActuals').every(row=>row.actualDate>=result.startDate&&row.actualDate<=asOf));assert.equal(f.tables.get('projectGateDecisions').length,1);assert.equal(f.tables.get('projectIssues').length,1);
  const before=structuredClone(f.tables);const second=await seedItSystemDemo(f.repo,f.storage,()=>{throw Error('must not render')},{asOf:'2026-10-21'});assert.equal(second.status,'skipped');assert.deepEqual(f.tables,before);
});
test("저장 실패 시 DB와 새 파일을 취소하고, 회사나 Dean이 모호하면 쓰지 않는다",async()=>{
  const f=fixture({failOnInsert:'taskActuals'});await assert.rejects(seedItSystemDemo(f.repo,f.storage,async()=>Buffer.from('docx'),{asOf}),/injected/);assert.equal(f.files.size,0);assert.equal(f.tables.size,0);
  for(const options of [{companies:[{id:'c'},{id:'other'}]},{users:[]}]){const f=fixture(options);await assert.rejects(seedItSystemDemo(f.repo,f.storage,async()=>Buffer.from('docx'),{asOf}));assert.equal(f.files.size,0);assert.equal(f.tables.size,0);}
});
