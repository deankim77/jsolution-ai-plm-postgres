type Task={id:string;wbsCode:string;name:string;kind:string;parentId?:string|null;parentCode?:string|null;status:string;progress:number;durationDays?:number;plannedStart?:string;plannedEnd?:string};
function day(value?:string){if(!value||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return null;const time=Date.parse(value+"T00:00:00Z");return Number.isFinite(time)?time/86400000:null}
export function productionStages(tasks:Task[]){
  const byId=new Map(tasks.map(task=>[task.id,task])),byCode=new Map(tasks.map(task=>[task.wbsCode,task]));
  const parentOf=(task:Task)=>task.parentId?byId.get(task.parentId):task.parentCode?byCode.get(task.parentCode):undefined;
  const roots=tasks.filter(task=>task.kind==="summary"&&!task.parentId&&!task.parentCode);
  return Array.from({length:6},(_,index)=>{
    const code="P"+(index+1),group=roots.find(task=>new RegExp("^"+code+"(?:\\\\s|$)").test(task.name)||task.wbsCode===code)
      ??roots.find(task=>task.wbsCode===String(index+1)&&!/^P\\d+\\b/.test(task.name));
    const children=group?tasks.filter(task=>{if(task.kind!=="task")return false;let parent=parentOf(task);const seen=new Set<string>([task.id]);while(parent&&!seen.has(parent.id)){if(parent.id===group.id)return true;seen.add(parent.id);parent=parentOf(parent)}return false}):[];
    const completed=children.filter(task=>task.status==="completed").length;
    const active=children.some(task=>task.status==="active"||task.status==="review"||task.progress>0);
    return {code,name:group?.name.replace(new RegExp("^"+code+"\\\\s*"),"")||"",status:!group?"missing":children.length>0&&completed===children.length?"completed":active?"active":"planned",completed,total:children.length};
  });
}
export function productionProgress(tasks:Task[]){
  const leaves=tasks.filter(task=>task.kind==="task"),weight=leaves.reduce((sum,task)=>sum+Math.max(1,Number(task.durationDays)||1),0);
  const progress=weight?Math.round(leaves.reduce((sum,task)=>sum+Math.max(1,Number(task.durationDays)||1)*Math.max(0,Math.min(100,Number(task.progress)||0)),0)/weight):0;
  const today=Date.now()/86400000,plans=leaves.map(task=>{const start=day(task.plannedStart),end=day(task.plannedEnd);return start===null||end===null||end<start?null:Math.max(0,Math.min(1,(today-start+1)/(end-start+1)))*100});
  const plannedProgress=weight&&plans.every(value=>value!==null)?Math.round(plans.reduce<number>((sum,value,index)=>sum+(value??0)*Math.max(1,Number(leaves[index].durationDays)||1),0)/weight):null;
  return {progress,plannedProgress,delay:plannedProgress===null?null:Math.max(0,plannedProgress-progress)};
}
