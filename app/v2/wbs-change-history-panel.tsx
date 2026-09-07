"use client";

import {useEffect,useMemo,useState} from "react";
import {CalendarClock,GitCommitHorizontal,UserRound,Plus,Trash2,Link2} from "lucide-react";
import "./wbs-change-history-panel.css";

type Project={id:string};
type Task={id:string;wbsCode:string;name:string};
type HistoryItem={id:string;changeSetId:string;taskId?:string;wbsCode?:string;taskName?:string;changeType:string;beforeValue:any;afterValue:any;checkedInAt:number;changedBy?:string};

const formatTime=(value:number)=>new Date(Number(value)*1000).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const dateText=(value:any)=>value||"미정";
const assigneeText=(value:any)=>value?.name||"미배정";

function ChangeLine({item}:{item:HistoryItem}){
  if(item.changeType==="SCHEDULE_CHANGE")return <article><CalendarClock size={18}/><div><b>일정 변경</b><p><span>{dateText(item.beforeValue?.plannedStart)} ~ {dateText(item.beforeValue?.plannedEnd)}</span><strong>→</strong><span>{dateText(item.afterValue?.plannedStart)} ~ {dateText(item.afterValue?.plannedEnd)}</span></p>{Number(item.beforeValue?.durationDays||0)!==Number(item.afterValue?.durationDays||0)&&<small>소요일 {item.beforeValue?.durationDays||0}일 → {item.afterValue?.durationDays||0}일</small>}</div></article>;
  if(item.changeType==="ASSIGNEE_CHANGE")return <article><UserRound size={18}/><div><b>담당자 변경</b><p><span>{assigneeText(item.beforeValue)}</span><strong>→</strong><span>{assigneeText(item.afterValue)}</span></p></div></article>;
  if(item.changeType==="TASK_ADDED")return <article><Plus size={18}/><div><b>Task 추가</b><p><span>{item.afterValue?.wbsCode||item.wbsCode} {item.afterValue?.name||item.taskName}</span></p></div></article>;
  if(item.changeType==="TASK_DELETED")return <article><Trash2 size={18}/><div><b>Task 삭제</b><p><span>{item.beforeValue?.wbsCode||item.wbsCode} {item.beforeValue?.name||item.taskName}</span></p></div></article>;
  if(item.changeType==="PREDECESSOR_CHANGE")return <article><Link2 size={18}/><div><b>선행 Task 변경</b><p><span>{item.beforeValue||"없음"}</span><strong>→</strong><span>{item.afterValue||"없음"}</span></p></div></article>;
  return null;
}

export function WbsChangeHistoryPanel({project,task}:{project:Project|null;task:Task}){
  const [items,setItems]=useState<HistoryItem[]>([]),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
  useEffect(()=>{if(!project){setItems([]);setLoading(false);return}const controller=new AbortController();setLoading(true);setNotice("");fetch(`/api/projects/${project.id}/wbs-change-history?taskId=${encodeURIComponent(task.id)}&limit=30`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"변경 이력을 불러오지 못했습니다.");setItems(data.items??[])}).catch(reason=>{if((reason as Error)?.name!=="AbortError")setNotice(reason instanceof Error?reason.message:"변경 이력을 불러오지 못했습니다.")}).finally(()=>setLoading(false));return()=>controller.abort()},[project?.id,task.id]);
  const groups=useMemo(()=>{const map=new Map<string,HistoryItem[]>();for(const item of items){const list=map.get(item.changeSetId)||[];list.push(item);map.set(item.changeSetId,list)}return [...map.entries()]},[items]);
  return <div className="wv2-wbs-change-history"><header><div><h3>WBS 변경 이력</h3><p>준비 전환 후 WBS를 편집하고 프로젝트를 다시 시작한 시점의 확정 변경만 표시합니다.</p></div></header>{loading&&<div className="wv2-wbs-change-empty">변경 이력을 불러오는 중입니다.</div>}{!loading&&!items.length&&!notice&&<div className="wv2-wbs-change-empty"><GitCommitHorizontal size={24}/><b>확정된 WBS 변경 이력이 없습니다.</b><span>일반 실적 등록은 이력에 포함하지 않습니다.</span></div>}{groups.map(([changeSetId,group])=><section key={changeSetId} className="wv2-wbs-change-set"><header><div><b>{formatTime(group[0].checkedInAt)}</b><span>{group[0].changedBy||"사용자"} · 프로젝트 시작 시 확정</span></div><em>{group.length}건</em></header><div>{group.map(item=><ChangeLine key={item.id} item={item}/>)}</div></section>)}{notice&&<p className="wv2-panel-notice">{notice}</p>}</div>;
}
