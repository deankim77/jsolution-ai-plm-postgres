"use client";

import {WorkPanel as BaseWorkPanel} from "./work-panel";

export function WorkPanel(props:any){
  const items=props.aiDraft?.source==="V2 선택 업무"?(props.aiDraft?.contextItems??[]):[];
  const firstWbs=items.find((item:any)=>item?.kind==="WBS"&&item?.id);
  const contextTask=!props.task&&firstWbs?(props.tasks??[]).find((task:any)=>task.id===firstWbs.id):undefined;
  return <BaseWorkPanel {...props} task={props.task??contextTask}/>;
}
