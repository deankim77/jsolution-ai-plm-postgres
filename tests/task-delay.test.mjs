import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync('lib/task-delay.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(id=>id==='./local-calendar-date'?{localCalendarDate:()=> '2026-10-20'}:require(id),mod,mod.exports);
const {isTaskDelayed,wbsDisplayStatus}=mod.exports;
const task={kind:'task',status:'active',progress:50,plannedEnd:'2026-10-19'};
test('지난 종료일의 미완료 업무를 자동 지연으로 표시하고 원래 업무 상태는 보존한다',()=>{
  assert.equal(isTaskDelayed(task),true);assert.equal(wbsDisplayStatus(task),'delayed');assert.equal(task.status,'active');
  for(const status of ['planned','preparing','active','hold','stopped'])assert.equal(wbsDisplayStatus({...task,status}),'delayed');
  assert.equal(wbsDisplayStatus({...task,plannedEnd:'2026-10-20'}),'active');
  assert.equal(wbsDisplayStatus({...task,plannedEnd:'2026-10-21'}),'active');
  assert.equal(wbsDisplayStatus(task,'2026-10-19'),'active');
});
test('완료·100% 검토 업무·상위 그룹·미정 및 잘못된 종료일을 지연에서 제외한다',()=>{
  for(const patch of [{status:'completed'},{status:'review',progress:100},{progress:100},{kind:'summary'},{plannedEnd:null},{plannedEnd:''},{plannedEnd:'2026-02-30'},{plannedEnd:'invalid'}])assert.equal(isTaskDelayed({...task,...patch}),false,JSON.stringify(patch));
  assert.equal(wbsDisplayStatus({...task,status:'completed'}),'completed');
});
