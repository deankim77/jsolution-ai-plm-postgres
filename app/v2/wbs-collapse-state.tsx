"use client";

import {useCallback,useEffect,useMemo,useState,type CSSProperties} from "react";
import {ChevronDown,ChevronRight,ChevronsDown,ChevronsUp} from "lucide-react";

export type WbsHierarchyItem={id:string;kind:"summary"|"task";level:number;wbsCode:string;parentId?:string|null};

const STORAGE_KEY="v2-wbs-shared-collapse";
const EVENT_NAME="v2-wbs-shared-collapse-change";

const readStored=()=>{
  if(typeof window==="undefined")return new Set<string>();
  try{const raw=window.localStorage.getItem(STORAGE_KEY);const parsed=raw?JSON.parse(raw):[];return new Set<string>(Array.isArray(parsed)?parsed.filter(value=>typeof value==="string"):[])}catch{return new Set<string>()}
};

export function useSharedWbsCollapse(tasks:WbsHierarchyItem[]){
  const summaryIds=useMemo(()=>new Set(tasks.filter(task=>task.kind==="summary").map(task=>task.id)),[tasks]);
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>readStored());
  useEffect(()=>{const sync=()=>setCollapsed(readStored());window.addEventListener(EVENT_NAME,sync);return()=>window.removeEventListener(EVENT_NAME,sync)},[]);
  useEffect(()=>{setCollapsed(current=>{const next=new Set([...current].filter(id=>summaryIds.has(id)));if(next.size===current.size&&[...next].every(id=>current.has(id)))return current;try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...next]))}catch{}return next})},[summaryIds]);
  const commit=useCallback((next:Set<string>)=>{setCollapsed(next);try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...next]));window.dispatchEvent(new Event(EVENT_NAME))}catch{}},[]);
  const toggle=useCallback((id:string)=>{setCollapsed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify([...next]));window.dispatchEvent(new Event(EVENT_NAME))}catch{}return next})},[]);
  const collapseAll=useCallback(()=>commit(new Set(summaryIds)),[commit,summaryIds]);
  const expandAll=useCallback(()=>commit(new Set()),[commit]);
  return {collapsed,toggle,collapseAll,expandAll};
}

export function filterCollapsedWbs<T extends WbsHierarchyItem>(tasks:T[],collapsed:Set<string>){
  const output:T[]=[];const ancestors:T[]=[];
  for(const task of tasks){while(ancestors.length&&ancestors[ancestors.length-1].level>=task.level)ancestors.pop();const hidden=ancestors.some(parent=>collapsed.has(parent.id));if(!hidden)output.push(task);if(task.kind==="summary")ancestors.push(task)}
  return output;
}

const actionStyle:CSSProperties={display:"inline-flex",height:26,alignItems:"center",gap:4,border:"1px solid #d6dee3",borderRadius:5,background:"#fff",padding:"0 7px",color:"#52626d",fontSize:11,fontWeight:700,whiteSpace:"nowrap"};

export function WbsHierarchyControls({collapseAll,expandAll}:{collapseAll:()=>void;expandAll:()=>void}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:4}}><button type="button" title="모든 WBS 그룹 접기" style={actionStyle} onClick={event=>{event.stopPropagation();collapseAll()}}><ChevronsUp size={14}/>모두 접기</button><button type="button" title="모든 WBS 그룹 펼치기" style={actionStyle} onClick={event=>{event.stopPropagation();expandAll()}}><ChevronsDown size={14}/>모두 펼치기</button></span>;
}

export function WbsCollapseChevron({collapsed,size=16}:{collapsed:boolean;size?:number}){return collapsed?<ChevronRight size={size}/>:<ChevronDown size={size}/>}
