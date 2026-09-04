"use client";

import {WorkPanel as BaseWorkPanel} from "./work-panel";

export function WorkPanel(props:any){
  const items=props.aiDraft?.contextItems??[];
  const wbsOnly=Boolean(items.length)&&items.every((item:any)=>String(item?.kind||"")==="WBS");
  const contextTask=!props.task&&wbsOnly?(props.tasks??[]).find((task:any)=>task.id===items[0]?.id):undefined;
  return <BaseWorkPanel {...props} task={props.task??contextTask}/>;
}
