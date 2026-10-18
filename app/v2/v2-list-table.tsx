"use client";

import {useEffect,useRef,type ReactNode} from "react";
import {Filter} from "lucide-react";
import "./v2-list-table.css";

export type V2ListColumn={key:string;label:string;header?:ReactNode;width:number;grow?:boolean;onFilter?:()=>void;activeCount?:number};

export function V2ListTable({label,columns,children,empty,footer}:{label:string;columns:V2ListColumn[];children:ReactNode;empty?:ReactNode;footer?:ReactNode}){
  return <div className="v2-list-table-region" role="region" aria-label={label} tabIndex={0}>
    <table className="v2-list-table" style={{minWidth:columns.reduce((sum,column)=>sum+column.width,0)}}>
      <caption className="v2-list-sr-only">{label}</caption>
      <colgroup>{columns.map(column=><col key={column.key} style={column.grow?undefined:{width:column.width}}/>)}</colgroup>
      <thead><tr>{columns.map(column=><th key={column.key} scope="col">{column.header??(column.onFilter?<button type="button" className={`v2-list-header-filter${column.activeCount?" active":""}`} aria-label={`${column.label} 필터${column.activeCount?` · ${column.activeCount}개 적용`:""}`} onClick={column.onFilter}><span>{column.label}</span><Filter size={18}/>{Boolean(column.activeCount)&&<em>{column.activeCount}</em>}</button>:column.label)}</th>)}</tr></thead>
      <tbody>{empty?<tr><td className="v2-list-empty" colSpan={columns.length}>{empty}</td></tr>:children}</tbody>
    </table>
    {footer}
  </div>;
}

export function V2ListSelectAll({label,checked,mixed,onChange,disabled=false}:{label:string;checked:boolean;mixed:boolean;onChange:()=>void;disabled?:boolean}){
  const ref=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(ref.current)ref.current.indeterminate=mixed},[mixed]);
  return <input ref={ref} type="checkbox" aria-label={label} aria-checked={mixed?"mixed":checked} checked={checked} disabled={disabled} onChange={onChange}/>;
}

export function V2ListProgress({value}:{value:number}){
  const progress=Math.min(100,Math.max(0,Number(value)||0));
  return <span className="v2-list-progress" aria-label={`진척률 ${progress}%`}><i aria-hidden="true"><span style={{width:`${progress}%`}}/></i><span>{progress}%</span></span>;
}
