"use client";

import {ChevronsDown,ChevronsUp} from "lucide-react";

export function ProjectCostHierarchyActions({disabled,onCollapseAll,onExpandAll}:{disabled?:boolean;onCollapseAll:()=>void;onExpandAll:()=>void}){
  return <>
    <button type="button" className="secondary" disabled={disabled} onClick={onCollapseAll}><ChevronsUp size={18}/>모두 접기</button>
    <button type="button" className="secondary" disabled={disabled} onClick={onExpandAll}><ChevronsDown size={18}/>모두 펼치기</button>
  </>;
}
