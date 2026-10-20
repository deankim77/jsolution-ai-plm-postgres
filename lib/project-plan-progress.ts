export function projectPlanProgress(tasks:{plannedStart?:string|null;plannedEnd?:string|null}[],today=new Date().toLocaleDateString("sv-SE")){
  const dateDay=(value?:string|null)=>{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const time=Date.parse(value+"T00:00:00Z");return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time/86400000:null;};
  const day=dateDay(today);if(day===null||!tasks.length)return null;
  const planned=tasks.map(task=>{const start=dateDay(task.plannedStart),end=dateDay(task.plannedEnd);if(start===null||end===null||end<start)return null;return Math.max(0,Math.min(1,(day-start+1)/(end-start+1)))*100;});
  return planned.every(value=>value!==null)?Math.round(planned.reduce<number>((sum,value)=>sum+(value??0),0)/planned.length):null;
}
