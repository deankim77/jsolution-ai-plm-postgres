import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const modules=new Map();
function load(path){if(modules.has(path))return modules.get(path);const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(id=>id==='./business-calendar'?load('app/v2/business-calendar.ts'):require(id),mod,mod.exports);modules.set(path,mod.exports);return mod.exports;}
const {buildScheduleReplan}=load('app/v2/schedule-replanning.ts'),{setActiveBusinessCalendar}=load('app/v2/business-calendar.ts');
const task=(id,patch={})=>({id,wbsCode:id,name:id,kind:'task',level:1,durationDays:2,plannedStart:'2026-10-15',plannedEnd:'2026-10-16',progress:0,status:'planned',...patch});
const today='2026-10-20';
test('past dates move to today; successor uses proposed predecessor end regardless of input ordering',()=>{
  setActiveBusinessCalendar();const source=[task('b',{predecessorCode:'a'}),task('a')],before=structuredClone(source),result=buildScheduleReplan(source,today),a=result.updates.find(x=>x.id==='a'),b=result.updates.find(x=>x.id==='b');
  assert.deepEqual([a.plannedStart,a.plannedEnd],['2026-10-20','2026-10-21']);assert.deepEqual([b.plannedStart,b.plannedEnd],['2026-10-22','2026-10-23']);assert.deepEqual(source,before);assert.equal(result.expectedEnd,'2026-10-23');
});
test('in-progress work keeps its original start and estimates remaining work from progress',()=>{
  const result=buildScheduleReplan([task('a',{durationDays:4,plannedStart:'2026-10-12',progress:50,status:'active'})],today).updates[0];
  assert.equal(result.plannedStart,'2026-10-12');assert.equal(result.plannedEnd,'2026-10-21');assert.equal(result.durationDays,8);assert.match(result.reason,/잔여 2근무일 추정/);
});
test('completed and 100 percent work stay unchanged; future plans are not pulled forward',()=>{
  const result=buildScheduleReplan([task('done',{status:'completed'}),task('review',{progress:100,status:'review'}),task('future',{plannedStart:'2026-11-02',plannedEnd:'2026-11-03'})],today);assert.deepEqual(result.updates,[]);
});
test('company holidays and weekends apply to new start and dependency transitions',()=>{
  setActiveBusinessCalendar({holidays:[{date:'2026-10-26',name:'휴무'}]});try{const result=buildScheduleReplan([task('a'),task('b',{predecessorCode:'a'})],'2026-10-23');assert.equal(result.updates[0].plannedEnd,'2026-10-27');assert.equal(result.updates[1].plannedStart,'2026-10-28');}finally{setActiveBusinessCalendar();}
});
test('all downstream changes are included beyond eight tasks and summary predecessors use proposed child dates',()=>{
  const chain=Array.from({length:12},(_,i)=>task(String(i),{durationDays:1,predecessorCode:i?String(i-1):undefined}));assert.equal(buildScheduleReplan(chain,today).updates.length,12);
  const result=buildScheduleReplan([{...task('G1'),kind:'summary'},task('a',{level:2}),task('b',{predecessorCode:'G1'})],today);assert.equal(result.updates.find(x=>x.id==='b').plannedStart,'2026-10-22');assert.equal(result.updates.some(x=>x.id==='G1'),false);
});
test('missing dates, unknown references, cycles and already-started dependency conflicts block approval',()=>{
  assert.throws(()=>buildScheduleReplan([task('a',{plannedEnd:'2026-02-30'})],today),/계획 시작일/);
  assert.throws(()=>buildScheduleReplan([task('a',{predecessorCode:'missing'})],today),/찾을 수 없습니다/);
  assert.throws(()=>buildScheduleReplan([task('a',{predecessorCode:'b'}),task('b',{predecessorCode:'a'})],today),/순환/);
  assert.throws(()=>buildScheduleReplan([task('a'),task('b',{predecessorCode:'a',status:'active',progress:50})],today),/충돌/);
  assert.throws(()=>buildScheduleReplan([task('a'),task('b',{predecessorCode:'a',status:'completed',progress:100})],today),/완료된 후속 업무/);
});
