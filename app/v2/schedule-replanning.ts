import {durationFromRange,endFromDuration,nextBusinessDate,toBusinessDate} from "./business-calendar";

export type ReplanTask={id:string;wbsCode:string;name:string;kind:"summary"|"task";level:number;durationDays:number;plannedStart?:string;plannedEnd?:string;predecessorCode?:string;progress:number;status:string};
export type ReplanUpdate={id:string;wbsCode:string;name:string;currentStart:string;currentEnd:string;plannedStart:string;plannedEnd:string;durationDays:number;reason:string};
const validDate=(value?:string):value is string=>Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value);
const finished=(task:ReplanTask)=>task.status==="completed"||Number(task.progress)>=100;

// Tentative, resource-unconstrained FS schedule. No stored tasks are mutated.
export function buildScheduleReplan(tasks:ReplanTask[],today:string){
  if(!validDate(today))throw new Error("재조정 기준일을 확인해 주세요.");
  const todayStart=toBusinessDate(today),byReference=new Map<string,ReplanTask>();
  tasks.forEach(task=>{byReference.set(task.id,task);byReference.set(task.wbsCode,task)});
  const resolved=new Map<string,{start:string;end:string}>(),visiting=new Set<string>(),updates=new Map<string,ReplanUpdate>();
  const resolve=(task:ReplanTask):{start:string;end:string}=>{
    const cached=resolved.get(task.id);if(cached)return cached;
    if(visiting.has(task.id))throw new Error(`${task.wbsCode}: 선후행 관계가 순환합니다. 관계를 먼저 확인해 주세요.`);
    visiting.add(task.id);
    if(task.kind==="summary"){
      const index=tasks.indexOf(task),children:ReplanTask[]=[];
      for(let cursor=index+1;cursor<tasks.length&&tasks[cursor].level>task.level;cursor++)if(tasks[cursor].kind==="task")children.push(tasks[cursor]);
      if(children.length){const dates=children.map(resolve),result={start:dates.map(item=>item.start).sort()[0],end:dates.map(item=>item.end).sort().at(-1)!};resolved.set(task.id,result);visiting.delete(task.id);return result;}
    }
    if(!validDate(task.plannedStart)||!validDate(task.plannedEnd)||task.plannedStart>task.plannedEnd)throw new Error(`${task.wbsCode}: 계획 시작일과 종료일을 확인해 주세요.`);
    let start=task.plannedStart,end=task.plannedEnd;
    if(task.kind==="task"&&!finished(task)){
      let dependencyStart="";
      if(task.predecessorCode){const predecessor=byReference.get(task.predecessorCode);if(!predecessor)throw new Error(`${task.wbsCode}: 선행 업무 ${task.predecessorCode}를 찾을 수 없습니다.`);dependencyStart=nextBusinessDate(resolve(predecessor).end);}
      const overdue=end<today,started=Number(task.progress)>0||task.status==="active";
      if(overdue||dependencyStart>start){
        if(!Number.isFinite(Number(task.durationDays))||Number(task.durationDays)<1)throw new Error(`${task.wbsCode}: 업무 소요일을 확인해 주세요.`);
        const remaining=Math.max(1,Math.ceil(Number(task.durationDays)*(1-Math.max(0,Math.min(100,Number(task.progress)||0))/100)));
        const reasons:string[]=[];
        if(started){
          if(dependencyStart>start)throw new Error(`${task.wbsCode}: 이미 진행 중인 업무의 시작일과 선행 업무 일정이 충돌합니다. PM이 선후행 관계를 확인해 주세요.`);
          const resume=todayStart>start?todayStart:start;end=endFromDuration(resume,remaining);
          reasons.push(`시작일 유지 · 기준일 이후 잔여 ${remaining}근무일 추정(진척률 ${task.progress}%)`);
        }else{
          start=toBusinessDate([start,todayStart,dependencyStart].sort().at(-1)!);end=endFromDuration(start,Number(task.durationDays));
          reasons.push(overdue?"미완료 지연 업무 재배치":"선행 업무 변경에 따른 후속 일정 조정");
          if(dependencyStart)reasons.push(`선행 종료 후 ${dependencyStart}부터 가능`);
        }
        if(task.status==="hold"||task.status==="stopped")reasons.push("보류·중단 해제 확인 필요");
        if(start!==task.plannedStart||end!==task.plannedEnd)updates.set(task.id,{id:task.id,wbsCode:task.wbsCode,name:task.name,currentStart:task.plannedStart,currentEnd:task.plannedEnd,plannedStart:start,plannedEnd:end,durationDays:started?durationFromRange(start,end):Number(task.durationDays),reason:reasons.join(" · ")});
      }
    }
    const result={start,end};resolved.set(task.id,result);visiting.delete(task.id);return result;
  };
  // Resolve the full project so filtered-out successors cannot be omitted on approval.
  tasks.filter(task=>task.kind==="task").forEach(resolve);
  for(const task of tasks.filter(task=>task.kind==="task"&&finished(task)&&task.predecessorCode)){
    const predecessor=byReference.get(task.predecessorCode!);if(!predecessor)continue;
    const proposedEnd=resolve(predecessor).end;
    if(predecessor.plannedEnd&&proposedEnd>predecessor.plannedEnd&&nextBusinessDate(proposedEnd)>task.plannedStart!)throw new Error(`${task.wbsCode}: 이미 완료된 후속 업무와 재조정 일정이 충돌합니다. PM이 선후행 관계를 확인해 주세요.`);
  }
  const ends=tasks.filter(task=>task.kind==="task").map(task=>resolved.get(task.id)!.end).sort();
  return {asOf:today,updates:tasks.flatMap(task=>updates.has(task.id)?[updates.get(task.id)!]:[]),expectedEnd:ends.at(-1)||""};
}
