"use client";

import {useEffect,useMemo,useState} from "react";
import {ChevronDown,ChevronRight,History} from "lucide-react";
import "./wbs-change-history-panel.css";

type Project={id:string};
type Task={id:string;wbsCode:string;name:string};
type Deliverable={id?:string|null;name?:string;type?:string|null;required?:boolean;documentKind?:string};
type ChangeItem={id:string;changeSetId:string;taskId?:string|null;wbsCode?:string;taskName?:string;changeType:string;beforeValue:any;afterValue:any;sortOrder:number};
type ChangeSet={id:string;checkedInAt:number;checkedInBy?:string;changedBy?:string;changeCount:number;taskCount:number;counts:Record<string,number>;items:ChangeItem[]};

const formatTime=(value:number)=>new Date(Number(value)*1000).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
const valueText=(value:unknown)=>value===null||value===undefined||value===""?"—":String(value);
const same=(a:unknown,b:unknown)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const kindLabel=(type:string)=>type==="GROUP_SCHEDULE_CHANGE"?"전체 일정 영향":type==="SCHEDULE_CHANGE"?"일정 변경":type==="ASSIGNEE_CHANGE"?"담당자 변경":type==="TASK_ADDED"?"Task 추가":type==="TASK_DELETED"?"Task 삭제":type==="TASK_NAME_CHANGE"?"Task명 변경":type==="DELIVERABLE_CHANGE"?"산출물 변경":"변경";

function diffDeliverables(before:Deliverable[]|null,after:Deliverable[]|null){
  const oldList=before??[],newList=after??[];
  const key=(item:Deliverable)=>String(item.id||item.name||"");
  const oldMap=new Map(oldList.map(item=>[key(item),item])),newMap=new Map(newList.map(item=>[key(item),item]));
  const rows:Array<{kind:"add"|"remove"|"change";text:string}>=[];
  for(const [id,item] of newMap){
    const old=oldMap.get(id);
    if(!old){rows.push({kind:"add",text:`+ ${item.name||"산출물"} · ${item.required===false?"선택":"필수"}`});continue}
    const details:string[]=[];
    if(old.name!==item.name)details.push(`명칭 ${old.name||"—"} → ${item.name||"—"}`);
    if(Boolean(old.required)!==Boolean(item.required))details.push(`${old.required===false?"선택":"필수"} → ${item.required===false?"선택":"필수"}`);
    if((old.type||null)!==(item.type||null))details.push(`분류 ${old.type||"—"} → ${item.type||"—"}`);
    if((old.documentKind||"document")!==(item.documentKind||"document"))details.push(`${old.documentKind||"document"} → ${item.documentKind||"document"}`);
    if(details.length)rows.push({kind:"change",text:`${item.name||old.name||"산출물"} · ${details.join(" · ")}`});
  }
  for(const [id,item] of oldMap)if(!newMap.has(id))rows.push({kind:"remove",text:`- ${item.name||"산출물"}`});
  return rows;
}

function ChangeDetails({item}:{item:ChangeItem}){
  const before=item.beforeValue,after=item.afterValue;
  if(item.changeType==="SCHEDULE_CHANGE"||item.changeType==="GROUP_SCHEDULE_CHANGE"){
    const fields=[
      ["계획 시작",before?.plannedStart,after?.plannedStart],
      ["계획 종료",before?.plannedEnd,after?.plannedEnd],
      ["소요일",before?.durationDays,after?.durationDays],
    ].filter(([,a,b])=>!same(a,b));
    return <div className="wv2-change-fields">{fields.map(([label,a,b])=><p key={String(label)}><span>{label}</span><b>{valueText(a)}{label==="소요일"&&a!==null&&a!==undefined?"일":""}</b><i>→</i><strong>{valueText(b)}{label==="소요일"&&b!==null&&b!==undefined?"일":""}</strong></p>)}{item.changeType==="GROUP_SCHEDULE_CHANGE"&&<small>하위 Task 변경 결과가 그룹 일정에 자동 반영되었습니다.</small>}</div>;
  }
  if(item.changeType==="ASSIGNEE_CHANGE")return <div className="wv2-change-fields"><p><span>담당자</span><b>{before?.name||"미배정"}</b><i>→</i><strong>{after?.name||"미배정"}</strong></p></div>;
  if(item.changeType==="TASK_NAME_CHANGE")return <div className="wv2-change-fields"><p><span>Task명</span><b>{valueText(before)}</b><i>→</i><strong>{valueText(after)}</strong></p></div>;
  if(item.changeType==="TASK_ADDED")return <div className="wv2-change-fields"><p><span>신규 Task</span><strong>{after?.name||item.taskName||"Task"}</strong></p>{after?.plannedStart&&<p><span>계획</span><strong>{after.plannedStart} ~ {after.plannedEnd||after.plannedStart} · {after.durationDays||1}일</strong></p>}</div>;
  if(item.changeType==="TASK_DELETED")return <div className="wv2-change-fields"><p><span>삭제 Task</span><b>{before?.name||item.taskName||"Task"}</b></p></div>;
  if(item.changeType==="DELIVERABLE_CHANGE"){
    const rows=diffDeliverables(Array.isArray(before)?before:[],Array.isArray(after)?after:[]);
    return <div className="wv2-change-output-diff">{rows.map((row,index)=><p key={`${row.kind}-${index}`} className={row.kind}>{row.text}</p>)}</div>;
  }
  return <div className="wv2-change-fields"><p><b>{valueText(before)}</b><i>→</i><strong>{valueText(after)}</strong></p></div>;
}

function ChangeSetDetail({set}:{set:ChangeSet}){
  const grouped=useMemo(()=>{
    const map=new Map<string,{key:string;wbsCode:string;taskName:string;items:ChangeItem[]}>();
    for(const item of set.items){const key=String(item.taskId||`${item.wbsCode}-${item.taskName}`);const existing=map.get(key)??{key,wbsCode:item.wbsCode||"",taskName:item.taskName||"",items:[]};existing.items.push(item);map.set(key,existing)}
    return [...map.values()];
  },[set.items]);
  return <div className="wv2-change-set-detail">{grouped.map(group=><article key={group.key} className="wv2-change-task-card"><header><div><b>{group.wbsCode}</b><span>{group.taskName}</span></div></header>{group.items.map(item=><section key={item.id}><em>{kindLabel(item.changeType)}</em><ChangeDetails item={item}/></section>)}</article>)}</div>;
}

export function WbsChangeHistoryPanel({project}:{project:Project|null;task:Task}){
  const [tab,setTab]=useState<"latest"|"history">("latest"),[sets,setSets]=useState<ChangeSet[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[expanded,setExpanded]=useState<Set<string>>(new Set());
  useEffect(()=>{if(!project){setSets([]);return}const controller=new AbortController();setLoading(true);setNotice("");fetch(`/api/projects/${project.id}/wbs-change-history?limit=20`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"변경 이력을 불러오지 못했습니다.");setSets(data.sets??[])}).catch(reason=>{if((reason as Error)?.name!=="AbortError"){setSets([]);setNotice(reason instanceof Error?reason.message:"변경 이력을 불러오지 못했습니다.")}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[project?.id]);
  const latest=sets[0];
  const toggle=(id:string)=>setExpanded(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
  return <div className="wv2-wbs-change-history"><div className="wv2-history-subtabs"><button className={tab==="latest"?"active":""} onClick={()=>setTab("latest")}>최신 변경사항</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>변경 이력</button></div>{loading&&<div className="wv2-wbs-change-empty">변경 이력을 불러오는 중입니다.</div>}{!loading&&tab==="latest"&&(!latest?<div className="wv2-wbs-change-empty"><History size={26}/><b>확정된 WBS 변경사항이 없습니다.</b><span>체크아웃 후 변경된 계획만 프로젝트 시작 시 확정됩니다.</span></div>:<><section className="wv2-change-summary"><b>{formatTime(latest.checkedInAt)}</b><span>{latest.changedBy||"사용자"} · 프로젝트 시작 시 확정</span><em>변경 {latest.changeCount}건 · Task {latest.taskCount}개</em></section><ChangeSetDetail set={latest}/></>)}{!loading&&tab==="history"&&<div className="wv2-change-history-list">{sets.map(set=>{const open=expanded.has(set.id);return <article key={set.id} className={open?"open":""}><button onClick={()=>toggle(set.id)}><span>{open?<ChevronDown size={18}/>:<ChevronRight size={18}/>}<b>{formatTime(set.checkedInAt)}</b></span><small>{set.changedBy||"사용자"} · 변경 {set.changeCount}건 · Task {set.taskCount}개</small></button>{open&&<ChangeSetDetail set={set}/>}</article>})}{!sets.length&&<div className="wv2-wbs-change-empty"><History size={26}/><b>저장된 변경 이력이 없습니다.</b></div>}</div>}{notice&&<p className="wv2-panel-notice">{notice}</p>}</div>;
}
