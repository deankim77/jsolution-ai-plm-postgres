"use client";
import {ChevronRight} from "lucide-react";
import {masterCodeLabel,useMasterData} from "./master-data-store";
import {useAiContextSelection} from "./ai-context-selection";
import "./source-stage-list.css";

type SourceRow={
  id:string;workflowId?:string;projectCode:string;projectName:string;title:string;
  workflowStatus?:string;status:string;currentStepOrder?:number;currentStepName?:string;currentAssigneeName?:string;
  stepCount?:number;stepFlow?:string;dueDate?:string;
  ecrNumber?:string;qualityNumber?:string;changeType?:string;changeTarget?:string;priority?:string;
  issueType?:string;severity?:string;drawingCode?:string;drawingName?:string;
};

const statusLabels:Record<string,string>={draft:"임시저장",in_progress:"결재 진행 중",supplement:"보완",approved:"승인 완료",rejected:"반려",recalled:"회수"};
const severityLabels:Record<string,string>={low:"낮음",medium:"보통",high:"높음",critical:"심각"};
const priorityLabels:Record<string,string>={normal:"보통",high:"높음",urgent:"긴급"};
const checkboxStyle={width:15,height:15,margin:0,accentColor:"var(--teal)",cursor:"pointer",flex:"0 0 auto"} as const;

export function SourceStageList({kind,rows,onOpen}:{kind:"ECR"|"QUALITY";rows:SourceRow[];onOpen:(workflowId:string)=>void}){
  const ecr=kind==="ECR";
  const selection=useAiContextSelection(ecr?"설계변경":"품질관리");
  const {data,loading}=useMasterData();
  const codeLabel=(groupCode:string,code?:string)=>masterCodeLabel(data,groupCode,code);
  const contextFor=(row:SourceRow)=>{const status=row.workflowStatus||row.status,number=ecr?row.ecrNumber:row.qualityNumber,type=ecr?(codeLabel("DESIGN_CHANGE_TYPE",row.changeType)||row.changeType||"유형 미지정"):(codeLabel("QUALITY_ISSUE_TYPE",row.issueType)||row.issueType||"유형 미지정"),severity=ecr?(row.priority?`우선순위 ${priorityLabels[row.priority]||row.priority}`:"우선순위 미지정"):(severityLabels[row.severity||""]||"심각도 미지정");return {id:row.id,kind:ecr?"설계변경":"품질관리",title:`${number?`[${number}] `:""}${row.title}`,meta:`${row.projectName} · 현재 단계 ${row.currentStepName||"작성"} · 처리자 ${row.currentAssigneeName||"미배정"} · ${type} · ${severity} · 기한 ${row.dueDate||"미정"} · ${statusLabels[status]||status}`}};
  const selectable=rows.filter(row=>Boolean(row.workflowId));
  const allSelected=Boolean(selectable.length)&&selectable.every(row=>selection.has(contextFor(row)));
  const toggleAll=()=>selectable.forEach(row=>{const item=contextFor(row);if(allSelected?selection.has(item):!selection.has(item))selection.toggle(item)});
  return <div className="wv2-workflow-table stage-table source-stage-table">
    <header><span style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" aria-label={`${ecr?"설계변경":"품질문제"} 전체 선택`} checked={allSelected} onChange={toggleAll} style={checkboxStyle}/>{ecr?"설계변경":"품질문제"}</span><span>대상 프로젝트</span><span>전체 단계</span><span>현재 단계·처리자</span><span>{ecr?"변경 유형·대상":"유형·심각도"}</span><span>기한</span><span>상태</span><span/></header>
    {rows.map(row=>{const flow=String(row.stepFlow||"").split("~").filter(Boolean).map(value=>{const [name,status]=value.split("|");return {name,status}});const status=row.workflowStatus||row.status,item=contextFor(row),checked=selection.has(item);return <button key={row.id} disabled={!row.workflowId} onClick={()=>row.workflowId&&onOpen(row.workflowId)}>
      <span className="workflow-primary" style={{display:"flex",alignItems:"flex-start",gap:8}}><input type="checkbox" aria-label={`${ecr?"설계변경":"품질문제"} AI 선택`} checked={checked} disabled={!row.workflowId} onClick={event=>event.stopPropagation()} onChange={event=>{event.stopPropagation();selection.toggle(item)}} style={{...checkboxStyle,marginTop:2}}/><span style={{display:"grid",minWidth:0}}><b>{ecr?row.ecrNumber:row.qualityNumber}</b><small>{row.title}</small></span></span>
      <span><b>{row.projectName}</b><small>{row.projectCode}</small></span>
      <span className="wv2-stage-flow">{flow.length?flow.map((step,index)=><i key={`${index}-${step.name}`} className={step.status} title={`${index+1}. ${step.name}`}><b>{index+1}</b><small>{step.name}</small></i>):<small>{Number(row.currentStepOrder||0)+1}/{Number(row.stepCount||0)}단계</small>}</span>
      <span><b>{row.currentStepName||"작성"}</b><small>{row.currentAssigneeName||"미배정"}</small></span>
      <span>{ecr?<><b>{codeLabel("DESIGN_CHANGE_TYPE",row.changeType)||(loading?"유형 확인 중":"유형 미지정")}</b><small>{row.drawingCode||row.changeTarget||row.drawingName||"대상 미지정"}{row.priority?` · 우선순위 ${priorityLabels[row.priority]||row.priority}`:""}</small></>:<><b>{codeLabel("QUALITY_ISSUE_TYPE",row.issueType)||(loading?"유형 확인 중":"유형 미지정")}</b><small>{severityLabels[row.severity||""]||"심각도 미지정"}</small></>}</span>
      <span><b>{row.dueDate||"미정"}</b><small>{row.dueDate&&row.dueDate<new Date().toISOString().slice(0,10)&&status==="in_progress"?"지연":""}</small></span>
      <em className={`status ${status}`}>{statusLabels[status]||status}</em><ChevronRight size={18}/>
    </button>})}
  </div>;
}
