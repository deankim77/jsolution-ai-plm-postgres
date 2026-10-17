import test from "node:test";
import assert from "node:assert/strict";
import {filterPortfolioProjects,portfolioTypeOptions,portfolioGateRows,unassignedProjectType} from "../lib/portfolio-project-filter.ts";
const projects=[
  {id:"a",customerName:"보험사",projectTypeId:"product",projectTypeName:"신규 보험상품 개발"},
  {id:"b",customerName:"보험사",projectTypeId:"improve",projectTypeName:"손해보험 업무 개선"},
  {id:"c",customerName:"제조사",projectTypeId:"production",projectTypeName:"제조"},
  {id:"d",customerName:"보험사"},
];
test("프로젝트 유형과 거래처를 함께 적용하고 유형 미지정도 조회한다",()=>{
  assert.deepEqual(filterPortfolioProjects(projects,"보험사","product").map(p=>p.id),["a"]);
  assert.equal(filterPortfolioProjects(projects,"제조사","product").length,0);
  assert.deepEqual(filterPortfolioProjects(projects,"",unassignedProjectType).map(p=>p.id),["d"]);
  assert.equal(portfolioTypeOptions(projects).length,4);
});
test("Gate 표도 필터 결과에서 집계하여 다른 유형의 승인 건수가 섞이지 않는다",()=>{
  const visible=filterPortfolioProjects(projects,"","product");
  const rows=portfolioGateRows(visible,id=>id==="a"?"COMPLETE":"G1");
  assert.equal(rows.length,1);
  assert.equal(rows[0].stages.find(s=>s.gateCode==="COMPLETE").count,1);
  assert.equal(rows[0].stages.find(s=>s.gateCode==="G1").count,0);
});
