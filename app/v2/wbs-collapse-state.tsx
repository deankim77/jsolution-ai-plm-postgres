"use client";

import {useCallback,useEffect,useMemo,useState,type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {ChevronDown,ChevronRight,ChevronsDown,ChevronsUp} from "lucide-react";

export type WbsHierarchyItem={id:string;kind:"summary"|"task";level:number;wbsCode:string;parentId?:string|null};

const STORAGE_KEY="v2-wbs-shared-collapse";
const EVENT_NAME="v2-wbs-shared-collapse-change";
const TOOLBAR_SLOT_ID="wv2-wbs-hierarchy-toolbar-slot";

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

const actionStyle:CSSProperties={display:"inline-flex",height:30,alignItems:"center",gap:6,border:"1px solid var(--line)",borderRadius:5,background:"#fff",padding:"0 10px",color:"#50616a",fontSize:"var(--v2-font-size-control)",fontWeight:700,whiteSpace:"nowrap"};

export function WbsHierarchyControls({collapseAll,expandAll}:{collapseAll:()=>void;expandAll:()=>void}){
  const [slot,setSlot]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    const toolbar=document.querySelector<HTMLElement>(".wv2-toolbar");
    if(!toolbar){setSlot(null);return}
    let mount=document.getElementById(TOOLBAR_SLOT_ID) as HTMLElement|null;
    if(!mount){
      mount=document.createElement("span");
      mount.id=TOOLBAR_SLOT_ID;
      mount.style.display="inline-flex";
      mount.style.alignItems="center";
      mount.style.gap="4px";
      const menus=toolbar.querySelectorAll(":scope > .wv2-toolbar-menu");
      const anchor=menus.length?menus[menus.length-1]:null;
      if(anchor?.nextSibling)toolbar.insertBefore(mount,anchor.nextSibling);else toolbar.appendChild(mount);
    }
    setSlot(mount);
    return()=>{if(mount?.isConnected&&mount.childElementCount===0)mount.remove()};
  },[]);
  if(!slot)return null;
  return createPortal(<><button type="button" title="모든 WBS 그룹 접기" style={actionStyle} onClick={event=>{event.stopPropagation();collapseAll()}}><ChevronsUp size={18}/>모두 접기</button><button type="button" title="모든 WBS 그룹 펼치기" style={actionStyle} onClick={event=>{event.stopPropagation();expandAll()}}><ChevronsDown size={18}/>모두 펼치기</button></>,slot);
}

export function WbsCollapseChevron({collapsed,size=16}:{collapsed:boolean;size?:number}){return collapsed?<ChevronRight size={size}/>:<ChevronDown size={size}/>}
