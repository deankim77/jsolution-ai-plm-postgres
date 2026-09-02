"use client";

import "./workspace-fetch-cache";
import "./document-list-wbs-link.css";
import {Suspense,lazy,useEffect,useState,type ComponentType} from "react";
import DocumentManagementPanel from "./document-management-panel";

const Impl=lazy(()=>import("./document-preview-workspace-impl").then(module=>({default:module.PreviewDocumentsWorkspace})));

type DetailLookup={id:string;projectId:string;projectCode?:string;projectName?:string;taskId?:string;taskCode?:string;taskName?:string;name:string};
type LibraryMode="document"|"drawing";

function DocumentWorkspaceBridge(props:any){
  const [detailId,setDetailId]=useState("");
  const [resolving,setResolving]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);
  const [libraryMode,setLibraryMode]=useState<LibraryMode>("document");

  useEffect(()=>{
    const refresh=()=>setRefreshKey(value=>value+1);
    window.addEventListener("v2-deliverables-updated",refresh);
    return()=>window.removeEventListener("v2-deliverables-updated",refresh);
  },[]);

  useEffect(()=>{
    const decorateTabs=()=>{
      const nav=document.querySelector<HTMLElement>(".wv2-document-workspace .wv2-preview-tabs");
      if(!nav)return;
      const documentTab=nav.querySelector<HTMLButtonElement>(":scope > button:first-child");
      if(!documentTab)return;
      documentTab.dataset.library="document";
      const libraryVisible=documentTab.classList.contains("active")||Boolean(nav.querySelector(":scope > button[data-library='drawing'].active"));
      documentTab.classList.toggle("active",libraryVisible&&libraryMode==="document");

      let drawingTab=nav.querySelector<HTMLButtonElement>(":scope > button[data-library='drawing']");
      if(!drawingTab){
        drawingTab=document.createElement("button");
        drawingTab.type="button";
        drawingTab.dataset.library="drawing";
        drawingTab.innerHTML='<span style="display:inline-flex;align-items:center;gap:7px"><span aria-hidden="true">▧</span>도면 라이브러리</span>';
        documentTab.insertAdjacentElement("afterend",drawingTab);
      }
      drawingTab.classList.toggle("active",libraryVisible&&libraryMode==="drawing");
    };

    const decorateRows=()=>{
      document.querySelectorAll<HTMLElement>(".wv2-preview-document-table > article").forEach(row=>{
        const previewButton=row.querySelector<HTMLButtonElement>(":scope > button:last-child");
        if(previewButton&&!previewButton.classList.contains("wv2-document-wbs-link"))previewButton.classList.add("wv2-document-preview-link");
        if(row.querySelector(".wv2-document-wbs-link"))return;
        const taskLabel=row.querySelector(".wv2-document-task small")?.textContent?.trim()||"";
        if(!taskLabel||taskLabel==="프로젝트 공통")return;
        const button=document.createElement("button");
        button.type="button";
        button.className="wv2-document-wbs-link";
        button.textContent="WBS 이동";
        button.title="연결된 WBS Task와 산출물 탭 열기";
        row.appendChild(button);
      });
    };

    const decorate=()=>{decorateTabs();decorateRows()};
    decorate();
    const observer=new MutationObserver(decorate);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[refreshKey,libraryMode]);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const tab=target?.closest(".wv2-preview-tabs > button[data-library]") as HTMLButtonElement|null;
      if(!tab)return;
      const mode=tab.dataset.library as LibraryMode|undefined;
      if(!mode)return;
      if(mode==="document"&&!event.isTrusted)return;
      setLibraryMode(mode);
      if(mode==="drawing"){
        const documentTab=tab.parentElement?.querySelector<HTMLButtonElement>(":scope > button[data-library='document']");
        documentTab?.click();
      }
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[]);

  useEffect(()=>{
    const resolveRow=async(row:HTMLElement)=>{
      const name=row.querySelector("button.name b")?.textContent?.trim()||"";
      if(!name)return null;
      const projectLabel=row.querySelector(".wv2-document-task b")?.textContent?.trim()||"";
      const taskLabel=row.querySelector(".wv2-document-task small")?.textContent?.trim()||"";
      const response=await fetch(`/api/deliverables?q=${encodeURIComponent(name)}&limit=100&offset=0`,{cache:"no-store"});
      const data=await response.json() as {deliverables?:DetailLookup[]};
      if(!response.ok)return null;
      const candidates=(data.deliverables??[]).filter(item=>item.name===name);
      return candidates.find(item=>{
        const projectOk=!projectLabel||projectLabel.includes(item.projectCode||"")||projectLabel.includes(item.projectName||"");
        const taskOk=!taskLabel||!item.taskCode||taskLabel.includes(item.taskCode);
        return projectOk&&taskOk;
      })||candidates[0]||null;
    };

    const openDetail=async(row:HTMLElement)=>{
      if(resolving)return;
      setResolving(true);
      try{const item=await resolveRow(row);if(item)setDetailId(item.id)}finally{setResolving(false)}
    };

    const handler=(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      if(!target)return;
      const row=target.closest(".wv2-preview-document-table > article") as HTMLElement|null;
      if(!row)return;
      if(target.closest(".select")||target.closest("input[type='checkbox']"))return;
      if(target.closest(".wv2-document-wbs-link")){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        if(resolving)return;
        setResolving(true);
        void resolveRow(row).then(item=>{if(item?.taskId){setDetailId("");props.onOpenTask?.(item.projectId,item.taskId)}}).finally(()=>setResolving(false));
        return;
      }
      if(target.closest(".wv2-document-preview-link"))return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      void openDetail(row);
    };

    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[resolving,props.onOpenTask]);

  return <>
    <Suspense fallback={null}><Impl key={refreshKey} {...props} libraryMode={libraryMode}/></Suspense>
    {detailId&&<DocumentManagementPanel deliverableId={detailId} onClose={()=>setDetailId("")} onOpenTask={(projectId,taskId)=>{setDetailId("");props.onOpenTask?.(projectId,taskId)}}/>}
  </>;
}

export const PreviewDocumentsWorkspace=((props:any)=><DocumentWorkspaceBridge {...props}/>) as ComponentType<any>;
