import test from "node:test";
import assert from "node:assert/strict";
import {installInsuranceTemplates} from "../services/insurance-template-seed-service.mjs";
const templates=[{code:"A",name:"상품"},{code:"B",name:"업무"}];
function fake({companies=[{id:"c",name:"회사"}],admins=[{id:"u"}],existing=[],failCode}={}) {
  const saved=new Set(existing),calls=[];
  const repo={companies:async()=>companies,administrators:async()=>admins,lock:async id=>calls.push(["lock",id]),find:async(c,code)=>saved.has(code)?{id:code}:null,create:async(c,u,t)=>{if(t.code===failCode)throw Error("write failed");saved.add(t.code);calls.push([c,u,t.code]);},transaction:async work=>{const before=new Set(saved);try{return await work(repo)}catch(e){saved.clear();for(const code of before)saved.add(code);throw e;}}};
  return {repo,saved,calls};
}
test("로그인 없이 회사 관리자 명의로 등록하고 재실행 시 기존 자료를 보존한다",async()=>{
  const f=fake();
  const first=await installInsuranceTemplates(f.repo,templates);
  assert.deepEqual(first.results.map(r=>r.status),["created","created"]);
  assert.deepEqual(f.calls[1],["c","u","A"]);
  const second=await installInsuranceTemplates(f.repo,templates);
  assert.deepEqual(second.results.map(r=>r.status),["skipped","skipped"]);
});
test("복수 회사는 대상을 명시해야 한다",async()=>{
  const f=fake({companies:[{id:"a"},{id:"b"}]});
  await assert.rejects(installInsuranceTemplates(f.repo,templates),/PMS_COMPANY_ID/);
  assert.equal(f.saved.size,0);
  const result=await installInsuranceTemplates(f.repo,templates,{companyId:"b"});
  assert.equal(result.company.id,"b");
});
test("다른 회사·비활성·비관리자 계정을 선택하지 않는다",async()=>{
  const f=fake({admins:[]});
  await assert.rejects(installInsuranceTemplates(f.repo,templates),/관리자/);
  assert.equal(f.saved.size,0);
});
test("두 번째 등록 실패 시 전체 트랜잭션을 취소한다",async()=>{
  const f=fake({failCode:"B"});
  await assert.rejects(installInsuranceTemplates(f.repo,templates),/write failed/);
  assert.equal(f.saved.size,0);
});
