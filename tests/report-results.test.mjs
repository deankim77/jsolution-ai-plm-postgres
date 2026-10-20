import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import * as results from "../lib/report-results.ts";
const require=createRequire(import.meta.url),ts=require("typescript"),mod={exports:{}};
new Function("require","module","exports",ts.transpileModule(readFileSync("lib/report-draft.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>results,mod,mod.exports);
const {savedReport}=results,{buildReportDraft,reportContextLimit}=mod.exports;
const projects=[{id:"care",code:"CARE",name:"간병인 보험상품 개발"},{id:"cancer",code:"CANCER",name:"암보험 개선"}];
const row={id:"answer",conversationId:"chat",title:"초안",source:"V2 우측 AI",contextTitle:"간병인 보험상품 개발 · 선택 문맥 4건",contextItems:JSON.stringify([{id:"care",kind:"프로젝트 보고",title:"간병인 보험상품 개발 실행 현황"}]),prompt:"간병인 보험상품 개발의 주간 프로젝트 보고서를 작성해줘",createdAt:1792324800,author:"Dean",excerpt:"전체 요약: 진행 중입니다.",hasSlides:false};
test("기존 주간·회의·Baseline 결과를 프로젝트와 연결하고 실패·일반 대화는 제외한다",()=>{
  assert.equal(savedReport(row,projects).kind,"weekly");
  assert.equal(savedReport({...row,prompt:"간병인 보험상품 개발 회의 안건을 준비해줘"},projects).kind,"meeting");
  assert.equal(savedReport({...row,prompt:"프로젝트 시작 Baseline과 현재 계획일정을 실제로 비교해줘"},projects).kind,"schedule");
  assert.equal(savedReport({...row,prompt:"안녕"},projects),null);
  for(const excerpt of ["OpenAI 인증 설정을 확인해 주세요. 질문은 MY AI 대화에 저장되었습니다.","AI 서비스 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.",""])assert.equal(savedReport({...row,excerpt},projects),null);
  assert.equal(savedReport({...row,contextTitle:"다른 프로젝트",contextItems:"[]"},projects),null);
});
test("새 보고서는 이름이 변경되어도 프로젝트 ID·보고 기간·형식을 유지한다",()=>{
  const result=savedReport({...row,prompt:"새 요청",contextItems:JSON.stringify([{id:"cancer",kind:"보고서:meeting",title:"옛 프로젝트명",meta:"보고 기간: 2026-10-01 ~ 2026-10-07"}]),hasSlides:true},projects);
  assert.equal(result.projectId,"cancer");assert.equal(result.projectName,"암보험 개선");assert.equal(result.period,"2026-10-01 ~ 2026-10-07");assert.equal(result.format,"pptx");assert.equal(result.kind,"meeting");
});
test("작성 자료는 선택한 항목만 요약하고 문서 원문·첨부 없이 길이를 제한한다",()=>{
  const result=buildReportDraft({project:projects[0],kind:"weekly",from:"2026-10-01",to:"2026-10-07",actuals:{count:2,hours:7,details:[{note:"기간 내 실적"}]}});
  assert.equal(result.contextItems.length,1);assert.equal(result.contextItems[0].kind,"보고서:weekly");assert.match(result.contextItems[0].meta,/기간 내 실적 2건, 7시간/);assert.doesNotMatch(result.contextItems[0].meta,/현재 열린 이슈|산출물 등록/);assert.equal(result.contextItems[0].fileAttached,undefined);
  const long=buildReportDraft({project:projects[0],kind:"schedule",from:"2026-10-01",to:"2026-10-07",actuals:{count:100,hours:999,details:Array(100).fill({note:"X".repeat(10000)})}});assert.ok(long.contextItems[0].meta.length<=reportContextLimit);assert.match(long.prompt,/미포함·미확인/);
});
