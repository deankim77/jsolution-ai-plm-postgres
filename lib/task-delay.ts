import {localCalendarDate} from "./local-calendar-date";

type ScheduleTask={kind?:string;status:string;progress:number;plannedEnd?:string|null};

/** A derived schedule status; the stored execution/approval status stays intact. */
export function isTaskDelayed(task:ScheduleTask,today=localCalendarDate()){
  if(task.kind==="summary"||task.status==="completed"||Number(task.progress)>=100||!task.plannedEnd)return false;
  const end=task.plannedEnd;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
  const parsed=Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(parsed)&&new Date(parsed).toISOString().slice(0,10)===end&&end<today;
}

export const wbsDisplayStatus=(task:ScheduleTask,today=localCalendarDate())=>isTaskDelayed(task,today)?"delayed":task.status;
