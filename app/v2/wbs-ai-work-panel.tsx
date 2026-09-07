"use client";

import {PanelRightClose,PanelRightOpen,X} from "lucide-react";
import {WorkPanel as BaseWorkPanel} from "./work-panel";
import {WbsChangeHistoryPanel} from "./wbs-change-history-panel";

const panelTabs=[["detail","상세"],["actual","실적"],["deliverable","산출물"],["issue","이슈·협업"],["gate","Gate"],["history","이력"],["ai","AI 대화"]] as const;
const statusLabel=(status:string)=>status==="completed"?"완료":status==="review"?"완료 검토":status==="active"?"진행 중":status==="hold"?"보류":status==="stopped"?"중단":status==="preparing"?"준비 중":"예정";

function HistoryWorkPanel(props:any){
  const task=props.task;
  return <aside className={`wv2-panel ${props.wide?"wide":""}`}><div className="wv2-resize"/><header><div><small>{`WBS · ${task.wbsCode}`}</small><h2>{task.name}</h2><span>{statusLabel(task.status)} · 담당 {task.assigneeName||task.roleCode||"미배정"}</span></div><div><button onClick={props.onWide} title="패널 너비 전환">{props.wide?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button><button onClick={props.onClose}><X size={19}/></button></div></header><nav>{panelTabs.map(([key,label])=><button className={props.tab===key?"active":""} key={key} onClick={()=>props.onTab(key)}>{label}</button>)}</nav><section className="wv2-panel-body"><WbsChangeHistoryPanel project={props.project} task={task}/></section></aside>;
}

export function WorkPanel(props:any){
  const items=props.aiDraft?.contextItems??[];
  const wbsOnly=Boolean(items.length)&&items.every((item:any)=>String(item?.kind||"")==="WBS");
  const contextTask=!props.task&&wbsOnly?(props.tasks??[]).find((task:any)=>task.id===items[0]?.id):undefined;
  const task=props.task??contextTask;
  if(props.tab==="history"&&task)return <HistoryWorkPanel {...props} task={task}/>;
  const gateActual=props.tab==="actual"&&task?.taskType==="gate";
  return <>{gateActual&&<style>{`
    .wv2-panel .wv2-form>.wv2-review-card,
    .wv2-panel .wv2-form>.wv2-check,
    .wv2-panel .wv2-form>.wv2-completion-check{display:none!important}
    .wv2-panel .wv2-quick-progress>button:last-child{display:none!important}
    .wv2-panel .wv2-form>p:first-of-type::after{content:" · Gate 완료는 Gate 탭에서 PASS 또는 조건부 승인으로 처리합니다.";font-weight:600;color:#52626d}
  `}</style>}<style>{`.wv2-panel>.wv2-panel-footer{display:none}`}</style><BaseWorkPanel {...props} task={task}/></>;
}
