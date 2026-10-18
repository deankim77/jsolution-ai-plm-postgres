"use client";

import {useEffect,useId,useRef,useState,type ReactNode} from "react";
import {ChevronDown} from "lucide-react";
import "./v2-column-filter.css";

export type V2ColumnOption={value:string;label:string};

function ColumnPopover({label,summary,active,onOpen,children}:{label:string;summary:string;active:boolean;onOpen:()=>void;children:(close:()=>void)=>ReactNode}){
  const id=useId(),panel=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0,width:288,maxHeight:360});
  const close=()=>panel.current?.hidePopover();
  useEffect(()=>{
    if(!open)return;
    const dismiss=()=>panel.current?.hidePopover();
    const scroll=(event:Event)=>{if(!panel.current?.contains(event.target as Node))dismiss()};
    window.addEventListener("resize",dismiss);window.addEventListener("scroll",scroll,true);
    return()=>{window.removeEventListener("resize",dismiss);window.removeEventListener("scroll",scroll,true)};
  },[open]);
  return <>
    <button type="button" className={`v2-column-select${active?" active":""}`} popoverTarget={id} aria-label={label+" 필터"} aria-expanded={open} title={summary} onClick={event=>{
      const rect=event.currentTarget.getBoundingClientRect(),width=Math.min(288,window.innerWidth-16);
      const below=window.innerHeight-rect.bottom-12,above=below<160&&rect.top>below;
      const height=Math.max(80,Math.min(360,above?rect.top-12:below));
      setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:above?rect.top-height-4:rect.bottom+4,width,maxHeight:height});
    }}><span>{summary}</span><ChevronDown size={18}/></button>
    <div ref={panel} id={id} popover="auto" className="v2-column-popover" role="dialog" aria-label={label+" 필터 선택"} style={position} onBeforeToggle={event=>{if(event.newState==="open")onOpen()}} onToggle={event=>setOpen(event.newState==="open")}>
      {children(close)}
    </div>
  </>;
}

export function V2ColumnMultiFilter({label,options,selected,onApply}:{label:string;options:V2ColumnOption[];selected:string[];onApply:(values:string[])=>void}){
  const available=Array.from(new Map([...options,...selected.filter(value=>!options.some(option=>option.value===value)).map(value=>({value,label:value}))].map(option=>[option.value,option])).values());
  const all=available.map(option=>option.value);
  const [draft,setDraft]=useState<string[]>([]),[query,setQuery]=useState("");
  const summary=!selected.length?"전체":selected.length===1?available.find(option=>option.value===selected[0])?.label||selected[0]:`${selected.length}개 선택`;
  const allChecked=available.length>0&&available.every(option=>draft.includes(option.value));
  return <ColumnPopover label={label} summary={summary} active={selected.length>0} onOpen={()=>{setDraft(selected.length?[...selected]:all);setQuery("")}}>{close=><>
    <header>{label}</header>
    <input className="v2-column-search" aria-label={label+" 항목 검색"} value={query} placeholder="항목 검색" onChange={event=>setQuery(event.target.value)}/>
    <label className="v2-column-option"><input type="checkbox" checked={allChecked} onChange={()=>setDraft(allChecked?[]:all)}/><span>전체 선택</span></label>
    <div className="v2-column-options">{available.filter(option=>!query.trim()||option.label.toLowerCase().includes(query.trim().toLowerCase())).map(option=><label className="v2-column-option" key={option.value}><input type="checkbox" checked={draft.includes(option.value)} onChange={()=>setDraft(current=>current.includes(option.value)?current.filter(value=>value!==option.value):[...current,option.value])}/><span>{option.label}</span></label>)}{!available.length&&<p>선택할 항목이 없습니다.</p>}</div>
    <footer><button type="button" onClick={close}>취소</button><button type="button" className="primary" disabled={available.length>0&&!draft.length} onClick={()=>{onApply(draft.length===all.length?[]:draft);close()}}>적용</button></footer>
  </>}</ColumnPopover>;
}

export function V2ColumnDateFilter({label,from,to,onApply}:{label:string;from:string;to:string;onApply:(from:string,to:string)=>void}){
  const [start,setStart]=useState(""),[end,setEnd]=useState("");
  return <ColumnPopover label={label} summary={from||to?`${from||"시작"} ~ ${to||"종료"}`:"전체"} active={Boolean(from||to)} onOpen={()=>{setStart(from);setEnd(to)}}>{close=><>
    <header>{label}</header><div className="v2-column-dates"><label>시작<input type="date" aria-label={label+" 시작"} value={start} onChange={event=>setStart(event.target.value)}/></label><label>종료<input type="date" aria-label={label+" 종료"} value={end} onChange={event=>setEnd(event.target.value)}/></label></div>
    <footer><button type="button" onClick={()=>{setStart("");setEnd("")}}>전체</button><button type="button" onClick={close}>취소</button><button type="button" className="primary" disabled={Boolean(start&&end&&start>end)} onClick={()=>{onApply(start,end);close()}}>적용</button></footer>
  </>}</ColumnPopover>;
}
