import test from "node:test";
import assert from "node:assert/strict";
import {insuranceDemoProfiles,buildInsuranceDemo,defaultInsuranceDefinitions,planIdentityChanges,selectDean} from "../scripts/demo-data/insurance-projects.mjs";
import {insuranceDocumentSpecs} from "../services/insurance-demo-document-service.mjs";
import {seedInsuranceDemos} from "../services/insurance-demo-seed-service.mjs";

const asOf="2026-10-18";
test("10일 전 시작·지연 2개/1개·완료 Gate·미래 실적 없음",()=>{
  for(const profile of insuranceDemoProfiles){
    const demo=buildInsuranceDemo(profile,defaultInsuranceDefinitions[profile.templateCode],asOf);
    assert.equal(demo.startDate,"2026-10-08");
    const delayed=demo.tasks.filter(task=>task.kind==="task"&&task.status!=="completed"&&task.plannedEnd<asOf);
    assert.deepEqual(delayed.map(task=>task.id),profile.delayedCodes);
    // Wednesday demo should retain the same delayed tasks.
    assert.deepEqual(demo.tasks.filter(task=>task.kind==="task"&&task.status!=="completed"&&task.plannedEnd<"2026-10-21").map(task=>task.id),profile.delayedCodes);
    for(const task of demo.tasks){
      assert(task.plannedStart>=demo.startDate,task.id+" start");
      assert(task.plannedStart<=task.plannedEnd,task.id+" dates");
      if(task.predecessor){const previous=demo.tasks.find(item=>item.id===task.predecessor);assert(previous.plannedEnd<task.plannedStart,task.id+" dependency");}
      if(task.complete)assert(task.plannedEnd<=asOf);
    }
    for(let n=1;n<profile.currentGate;n++)assert.equal(demo.tasks.find(task=>task.id==="G"+n+"-REVIEW").status,"completed");
  }
});
test("각 프로젝트 문서 3종은 본문이 누적 추가된 Rev.01~03이다",()=>{
  for(const profile of insuranceDemoProfiles){
    const demo=buildInsuranceDemo(profile,defaultInsuranceDefinitions[profile.templateCode],asOf),specs=insuranceDocumentSpecs(demo);
    for(const code of Object.keys(profile.revisions)){
      const versions=specs.filter(item=>item.taskCode===code);
      assert.deepEqual(versions.map(item=>item.revision),[1,2,3]);
      assert(versions[1].text.length>versions[0].text.length);
      assert(versions[2].text.length>versions[1].text.length);
      assert(versions[2].text.includes(profile.revisions[code][0]));
      assert(versions[2].text.includes(profile.revisions[code][1]));
    }
    for(const doc of specs){
      assert(doc.date>=demo.startDate&&doc.date<=asOf);
      assert(doc.text.includes("가상"));
      assert(!/제조|자동차|BOM/.test(doc.text));
      assert(doc.text.length>400);
    }
  }
});
test("사용자 ID·사람 이름 보존, 이메일·도메인 포함 표시명 변경, 충돌 차단",()=>{
  const people=[{id:"u",companyId:"c",email:"dean@jjjsolution.com",name:"Dean",status:"active"},{id:"v",companyId:"c",email:"demo@jjjsolution.com",name:"demo@jjjsolution.com",status:"active"}];
  const changes=planIdentityChanges(people,"c");
  assert.equal(changes[0].id,"u");assert.equal(changes[0].name,"Dean");assert.equal(changes[0].email,"dean@jsolution.io");
  assert.equal(changes[1].name,"demo@jsolution.io");
  assert.equal(selectDean(people,"c").id,"u");
  assert.throws(()=>planIdentityChanges([...people,{id:"other",companyId:"x",email:"dean@jsolution.io",name:"other"}],"c"),/중복/);
});
function fake({failOnInsert}={}){
  const calls=[],projects=new Map(),files=new Map(),userRows=[{id:"dean",companyId:"c",email:"dean@jjjsolution.com",name:"Dean",status:"active"},{id:"staff",companyId:"c",email:"demo@jjjsolution.com",name:"김민수",status:"active"}];
  const repo={
    transaction:async work=>{const saved=new Map(projects),users=userRows.map(u=>({...u}));try{return await work(repo)}catch(e){projects.clear();for(const entry of saved)projects.set(...entry);userRows.splice(0,userRows.length,...users);throw e;}},
    companies:async()=>[{id:"c",name:"JSOLUTION"}],lock:async()=>{},users:async()=>userRows,
    project:async(c,code)=>projects.get(code),template:async(c,code)=>({versionId:code,definition:JSON.stringify(defaultInsuranceDefinitions[code])}),
    lookup:async()=>null,updateUser:async(c,user)=>Object.assign(userRows.find(u=>u.id===user.id),user),setDeliverableFile:async()=>{},
    insert:async(name,rows)=>{if(name===failOnInsert)throw Error("simulated insert failure");calls.push({name,rows});if(name==="projectsDb")for(const row of rows)projects.set(row.code,row);},
  };
  return {repo,files,calls,userRows,storage:{put:async(key,data)=>files.set(key,data),delete:async key=>files.delete(key)}};
}
test("전체 등록은 Dean PM·리비전 파일·실적·Baseline을 연결하며 재실행은 중복 생성하지 않는다",async()=>{
  const f=fake();
  const result=await seedInsuranceDemos(f.repo,f.storage,async()=>Buffer.from("DOCX"),{asOf});
  assert.equal(result.results.length,2);assert.equal(result.deanEmail,"dean@jsolution.io");
  assert.deepEqual(result.results.map(item=>item.delayed),[2,1]);
  const members=f.calls.filter(item=>item.name==="projectMembers").flatMap(item=>item.rows);
  assert.equal(members.filter(item=>item.projectRole==="PM").length,2);
  assert(members.filter(item=>item.projectRole==="PM").every(item=>item.userId==="dean"));
  assert.equal(f.calls.filter(item=>item.name==="deliverableVersions").length,44);
  assert.equal(f.files.size,88);
  assert.equal(f.calls.filter(item=>item.name==="projectBaselines").length,2);
  const actuals=f.calls.filter(item=>item.name==="taskActuals").flatMap(item=>item.rows);
  assert(actuals.every(item=>item.actualDate>="2026-10-08"&&item.actualDate<=asOf));
  const count=f.calls.length;
  const second=await seedInsuranceDemos(f.repo,f.storage,async()=>{throw Error("must not render");},{asOf});
  assert(second.results.every(item=>item.status==="skipped"));assert.equal(f.calls.length,count);
});
test("등록 실패 시 생성한 파일을 정리하고 사용자 변경·프로젝트를 취소한다",async()=>{
  const f=fake({failOnInsert:"taskActuals"});
  await assert.rejects(seedInsuranceDemos(f.repo,f.storage,async()=>Buffer.from("DOCX"),{asOf}),/simulated/);
  assert.equal(f.files.size,0);assert.equal(f.userRows[0].email,"dean@jjjsolution.com");
  assert.equal(await f.repo.project("c","INS-CARE-DEMO"),undefined);
});
