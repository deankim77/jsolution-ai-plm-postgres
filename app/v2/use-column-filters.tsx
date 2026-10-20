"use client";

import {useEffect,useState,type ReactNode} from "react";
import {V2ColumnDateFilter,V2ColumnMultiFilter,type V2ColumnOption} from "./v2-column-filter";

export type ColumnRule<T>={key:string;label:string;value:(row:T)=>string|string[]|null|undefined;options?:V2ColumnOption[];date?:boolean};
export type ColumnSelection=Record<string,string[]>;
export type ColumnDates=Record<string,{from:string;to:string}>;
export function V2FilterHeader({children}:{children:ReactNode}){
  return <header style={{height:"auto",minHeight:"var(--v2-wbs-row-height)",alignItems:"start"}}>{children}</header>;
}
const valuesFor=<T,>(row:T,rule:ColumnRule<T>)=>{const value=rule.value(row);return (Array.isArray(value)?value:[value]).map(value=>value||"미지정")};

export function matchesColumnFilters<T>(row:T,rules:ColumnRule<T>[],selected:ColumnSelection,dates:ColumnDates={}){
  return rules.every(rule=>{
    const values=valuesFor(row,rule),choices=selected[rule.key]||[],range=dates[rule.key];
    return (!choices.length||values.some(value=>choices.includes(value)))&&(!range||values.some(value=>value!=="미지정"&&(!range.from||value>=range.from)&&(!range.to||value<=range.to)));
  });
}

/** Options come from the complete, unpaginated input, never the filtered result. */
export function useColumnFilters<T>(rows:T[],rules:ColumnRule<T>[],onCountChange?:(count:number)=>void,initialSelected:ColumnSelection={}){
  const [selected,setSelected]=useState<ColumnSelection>(initialSelected),[dates,setDates]=useState<ColumnDates>({});
  const matches=(row:T)=>matchesColumnFilters(row,rules,selected,dates);
  const filtered=rows.filter(matches);
  useEffect(()=>onCountChange?.(filtered.length),[filtered.length,onCountChange]);
  const heading=(key:string,title?:ReactNode)=>{
    const rule=rules.find(rule=>rule.key===key);
    if(!rule)return title;
    const options=rule.options||Array.from(new Set(rows.flatMap(row=>valuesFor(row,rule)))).sort((a,b)=>a.localeCompare(b,"ko")).map(value=>({value,label:value}));
    return <div className="v2-column-heading"><span>{title??rule.label}</span>{rule.date?<V2ColumnDateFilter label={rule.label} from={dates[key]?.from||""} to={dates[key]?.to||""} onApply={(from,to)=>setDates(current=>({...current,[key]:{from,to}}))}/>:<V2ColumnMultiFilter label={rule.label} options={options} selected={selected[key]||[]} onApply={values=>setSelected(current=>({...current,[key]:values}))}/>}</div>;
  };
  return {rows:filtered,matches,heading,selected,setSelection:setSelected,reset:()=>{setSelected({});setDates({})}};
}
