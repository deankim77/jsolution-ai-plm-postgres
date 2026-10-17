import test from "node:test";
import assert from "node:assert/strict";
import {insuranceTemplates} from "../scripts/demo-data/insurance-g6-templates.mjs";

test("보험 템플릿은 각각 G1~G6의 2레벨 WBS와 순차 승인 흐름을 가진다",()=>{
  assert.equal(insuranceTemplates.length,2);
  assert.equal(new Set(insuranceTemplates.map(item=>item.code)).size,2);
  for (const {definition} of insuranceTemplates) {
    assert.equal(definition.wbs.length,30);
    const prior = new Set();
    for (const task of definition.wbs) {
      assert(!prior.has(task.id));
      assert([1,2].includes(task.level));
      if (task.predecessor) assert(prior.has(task.predecessor),"선행 업무는 먼저 정의되어야 한다");
      if (task.level===2) {
        assert(prior.has(task.parentId));
        assert(definition.roles.includes(task.role));
        assert(task.durationDays>0);
        assert(task.deliverables.every(output=>output.required&&output.documentKind==="document"));
      }
      prior.add(task.id);
    }
    for (let n=1;n<=6;n++) {
      const gate="G"+n;
      assert.equal(definition.wbs.find(task=>task.id===gate).kind,"summary");
      const children=definition.wbs.filter(task=>task.parentId===gate);
      assert.equal(children.length,4);
      assert.equal(children.filter(task=>task.taskType==="gate").length,1);
      assert(children.at(-1).completionCriteria.includes("GATE_APPROVAL"));
      if(n>1) assert.equal(children[0].predecessor,"G"+(n-1)+"-REVIEW");
    }
  }
});
