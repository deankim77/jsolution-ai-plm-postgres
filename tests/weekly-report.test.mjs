import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),ts=require("typescript");
function compile(path,imports={}){const mod={exports:{}};new Function("require","module","exports",ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{if(id in imports)return imports[id];throw Error(id)},mod,mod.exports);return mod.exports}
const plan=compile("lib/project-plan-progress.ts"),slides=compile("lib/report-slides.ts");
const {buildWeeklyReport}=compile("services/weekly-report-builder.ts",{"../lib/project-plan-progress":plan});
const epoch=date=>Date.parse(date+"T00:00:00+09:00")/1000;
const task=(id,end,status="active",progress=50)=>({id,code:id,name:`업무 ${id}`,kind:"task",taskType:"normal",status,progress,plannedStart:"2026-10-12",plannedEnd:end,owner:"Dean"});
const data=()=>({project:{id:"p",code:"P",name:"간병인 보험상품 개발",pm:"Dean",startDate:"2026-10-01",endDate:"2026-11-30"},tasks:[task("old","2026-10-14"),task("due","2026-10-22"),task("done","2026-10-20","completed",100),task("next","2026-10-28","planned",0)],actuals:[{taskId:"done",date:"2026-10-20",progress:100,hours:4,note:"약관 검토 완료",completed:1},{taskId:"old",date:"2026-10-10",progress:30,hours:2,note:"과거 실적",completed:0}],issues:[{id:"i",taskId:"old",type:"issue",title:"검토 승인 대기",description:"담당 부서 확인 필요",severity:"high",status:"open",owner:"Dean",dueDate:"2026-10-19",createdAt:epoch("2026-10-10")}],actions:[{issueId:"i",action:"REPLIED",note:"승인 부서 회신 대기",createdAt:epoch("2026-10-19")}],outputs:[{id:"o",taskId:"old",name:"요구사항 정의서",required:1,status:"planned"},{id:"v",taskId:"done",name:"상품 약관",required:1,status:"submitted",version:"2"}],revisions:[{deliverableId:"v",revision:2,createdAt:epoch("2026-10-20"),fileName:"약관-R2.docx"}],baseline:[{taskId:"old",plannedEnd:"2026-10-12"}]});
test("주간보고서 7개 항목은 실제 업무·실적·누적 지연·이슈 경과·산출물 Rev·차주 계획을 포함한다",()=>{
 const content=buildWeeklyReport(data(),"2026-10-19","2026-10-25","2026-10-20");
 for(let section=1;section<=7;section++)assert.ok(slides.reportSlides(content).some(slide=>slide.title.startsWith(`${section}.`)));
 assert.match(content,/6일 지연/);assert.match(content,/이전 주부터 누적/);assert.match(content,/미해결 10일/);assert.match(content,/승인 부서 회신 대기/);assert.match(content,/리스크: 없음/);assert.match(content,/협조 요청: 없음/);assert.match(content,/금주 실적 1건, 4시간/);assert.match(content,/약관-R2.docx/);assert.match(content,/2026-10-26 ~ 2026-11-01/);assert.match(content,/Baseline 변경/);assert.match(content,/AI 미사용/);
});
test("보고서가 커져도 마지막 업무·이슈·긴 회신을 누락하지 않고 후속 슬라이드로 나눈다",()=>{
 const input=data();input.tasks=Array.from({length:40},(_,index)=>task(`T${index}`,"2026-10-20"));input.issues[0].description="긴 내용 ".repeat(500)+"끝까지 보존";
 const content=buildWeeklyReport(input,"2026-10-19","2026-10-25","2026-10-20"),pages=slides.reportSlides(content);
 assert.match(content,/T39/);assert.match(content.replace(/\n/g,""),/끝까지 보존/);assert.ok(pages.length>7);assert.ok(pages.every(page=>page.body.split("\n").length<=13));
});
test("누락 일정은 계획 진척을 추정하지 않고 빈 구분을 명시한다",()=>{
 const input=data();input.tasks[0].plannedEnd=null;input.issues=[];input.outputs=[];input.revisions=[];input.actions=[];
 const content=buildWeeklyReport(input,"2026-10-19","2026-10-25","2026-10-20");assert.match(content,/산정 불가/);assert.match(content,/이슈: 없음/);assert.match(content,/리스크: 없음/);assert.match(content,/협조 요청: 없음/);
});
test("PPT ZIP의 슬라이드·관계·장수는 미리보기와 동일하고 마지막 상세까지 보존한다",()=>{
 const {buildPptx}=compile("app/ai-pptx-download.ts",{"../lib/report-slides":slides});const content=buildWeeklyReport(data(),"2026-10-19","2026-10-25","2026-10-20"),pages=slides.reportSlides(content),bytes=buildPptx(content),buffer=Buffer.from(bytes);let offset=0;const entries=new Map();
 while(buffer.readUInt32LE(offset)===0x04034b50){const size=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extra=buffer.readUInt16LE(offset+28),start=offset+30+nameLength+extra;entries.set(buffer.subarray(offset+30,offset+30+nameLength).toString(),buffer.subarray(start,start+size).toString());offset=start+size;}
 assert.equal([...entries.keys()].filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).length,pages.length);
 assert.match(entries.get("docProps/app.xml"),new RegExp(`<Slides>${pages.length}</Slides>`));assert.match(entries.get(`ppt/slides/slide${pages.length}.xml`),/의사결정·지원 요청 내용은 저장된 근거/);assert.equal((entries.get("ppt/presentation.xml").match(/<p:sldId /g)||[]).length,pages.length);
 for(let index=1;index<=pages.length;index++){assert.ok(entries.has(`ppt/slides/_rels/slide${index}.xml.rels`));assert.match(entries.get("[Content_Types].xml"),new RegExp(`/ppt/slides/slide${index}.xml`));}
});
test("주간보고 서비스는 잘못된 기간을 저장하지 않고 생성 결과를 기존 목록 저장소에서 읽는다",async()=>{
 class RequestContextError extends Error{constructor(message,status){super(message);this.status=status}}
 const calls=[],{createWeeklyReport}=compile("services/weekly-report-service.ts",{"../db/request-context":{RequestContextError},"../db/repositories/weekly-report-repository":{readWeeklyReportData:async(company,id)=>{calls.push([company,id]);return data()},saveWeeklyReport:async(context,project,from,to,content)=>{calls.push(content);return"result"}},"./weekly-report-builder":{buildWeeklyReport,koreaDate:()=>"2026-10-20"},"./report-results-service":{loadReportResults:async(context,{id})=>({reports:[{id,content:"saved"}]})}});
 for(const input of [{from:"2026-02-30",to:"2026-03-01"},{from:"2026-10-01",to:"2026-10-20"},{from:"2026-10-21",to:"2026-10-25"}])await assert.rejects(()=>createWeeklyReport({companyId:"c",userId:"u"},{projectId:"p",...input}),error=>error.status===400);
 assert.equal(calls.length,0);const report=await createWeeklyReport({companyId:"c",userId:"u"},{projectId:"p",from:"2026-10-19",to:"2026-10-25"});assert.equal(report.id,"result");assert.deepEqual(calls[0],["c","p"]);assert.match(calls[1],/슬라이드 1/);
});
test("생성 API는 프로젝트 접근 거부 시 조회·저장 서비스에 진입하지 않는다",async()=>{
 let generated=0;const route=compile("app/api/reports/weekly/route.ts",{"../../../../db/postgres-d1-compat":{getLegacyDbCompat:()=>({})},"../../../../db/request-context":{resolveRequestContext:async()=>({companyId:"c",userId:"u"}),requireProjectAccess:async()=>{throw new Error("denied")},contextErrorResponse:()=>Response.json({error:"접근 불가"},{status:403})},"../../../../services/weekly-report-service":{createWeeklyReport:async()=>{generated++;return{}}}});
 const response=await route.POST(new Request("http://localhost/api/reports/weekly",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId:"foreign",from:"2026-10-19",to:"2026-10-25"})}));assert.equal(response.status,403);assert.equal(generated,0);
});
test("주간보고 저장은 같은 트랜잭션에 회사·사용자 문맥과 전체 본문을 기록한다",async()=>{
 const writes=[],schema={aiConversations:"conversations",aiMessages:"messages"};let transactions=0;
 const repository=compile("db/repositories/weekly-report-repository.ts",{"drizzle-orm":require("drizzle-orm"),"../index":{getDb:()=>({transaction:async callback=>{transactions++;return callback({insert:table=>({values:async values=>{writes.push([table,values])}})})}})},"../schema":schema});
 const id=await repository.saveWeeklyReport({companyId:"company-a",userId:"dean"},{id:"p",name:"보험"},"2026-10-19","2026-10-25","슬라이드 1: 전체 본문");assert.equal(transactions,1);assert.equal(writes[0][1].companyId,"company-a");assert.equal(writes[0][1].userId,"dean");assert.match(writes[0][1].source,/AI 미사용/);assert.equal(writes[1][1][1].id,id);assert.equal(writes[1][1][1].content,"슬라이드 1: 전체 본문");assert.equal(writes[1][1][1].conversationId,writes[0][1].id);
});
