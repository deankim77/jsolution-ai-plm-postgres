"use client";
import "./table-header-filter.css";
export type HeaderFilterOption={value:string;label:string};
export function TableHeaderFilter({label,value,onChange,options,allValue=""}:{label:string;value:string;onChange:(value:string)=>void;options:HeaderFilterOption[];allValue?:string}){
  const unique=Array.from(new Map(options.filter(option=>option.value!==allValue).map(option=>[option.value,option])).values());
  return <label className="wv2-table-header-filter"><span>{label}</span><select aria-label={label+" 필터"} value={value} onChange={event=>onChange(event.target.value)}><option value={allValue}>전체</option>{value!==allValue&&!unique.some(option=>option.value===value)&&<option value={value}>{value.includes(",")?"여러 조건 선택":value}</option>}{unique.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
