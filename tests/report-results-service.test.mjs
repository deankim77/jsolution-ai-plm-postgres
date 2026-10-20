import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import * as reportTypes from "../lib/report-results.ts";
const require=createRequire(import.meta.url),ts=require("typescript");
function compile(path,imports){const mod={exports:{}};new Function("require","module","exports",ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>{if(id in imports)return imports[id];throw Error(id)},mod,mod.exports);return mod.exports}
class RequestContextError extends Error{constructor(message,status){super(message);this.status=status}}
test("보고서 조회는 회사·사용자로 범위를 제한하고 본문은 상세 조회에만 포함한다",async()=>{
  const calls=[],{PgDialect}=require("drizzle-orm/pg-core"),dialect=new PgDialect();
  const repository=compile("db/repositories/report-results-repository.ts",{"drizzle-orm":require("drizzle-orm"),"../index":{getDb:()=>({execute:async query=>{calls.push(dialect.sqlToQuery(query));return {rows:[]}}})},"../schema":{}});
  await repository.readReportResults("company-a","dean");await repository.readReportResults("company-a","dean",{id:"answer-1"});
  for(const call of calls){assert.match(call.sql,/c\.company_id=\$\d+ AND c\.user_id=\$\d+/);assert.ok(call.params.includes("company-a"));assert.ok(call.params.includes("dean"));assert.match(call.sql,/m\.role='assistant'/)}
  assert.doesNotMatch(calls[0].sql,/,m\.content\s+FROM/);assert.match(calls[1].sql,/,m\.content\s+FROM/);assert.ok(calls[1].params.includes("answer-1"));
});
test("없는 보고서와 잘못된 기간은 오류로 응답하고 목록 서비스는 생성 API를 호출하지 않는다",async()=>{
  const calls=[];
  const service=compile("services/report-results-service.ts",{"../db/repositories/report-results-repository":{readReportProjects:async company=>{calls.push(company);return[]},readReportResults:async(company,user)=>{calls.push([company,user]);return[]},readPeriodActuals:async()=>({count:0,hours:0,details:[]})},"../lib/report-results":reportTypes,"../db/request-context":{RequestContextError}});
  const context={companyId:"company-a",userId:"dean"};assert.deepEqual((await service.loadReportResults(context,{})).reports,[]);assert.deepEqual(calls[1],["company-a","dean"]);
  await assert.rejects(()=>service.loadReportResults(context,{id:"foreign-answer"}),error=>error.status===404);
  for(const [from,to]of [["2026-02-30","2026-03-02"],["2026-10-08","2026-10-01"],["invalid","2026-10-01"]])await assert.rejects(()=>service.loadReportActuals("p",from,to),error=>error.status===400);
  assert.equal((await service.loadReportActuals("p","2026-10-01","2026-10-07")).count,0);
});
