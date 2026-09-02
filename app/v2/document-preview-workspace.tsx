"use client";

import {Suspense,lazy,useEffect,useState,type ComponentType} from "react";
import DocumentManagementPanel from "./document-management-panel";

const Impl=lazy(()=>import("./document-preview-workspace-impl").then(module=>({default:module.PreviewDocumentsWorkspace})));
type LibraryMode="document"|"drawing";

function DocumentWorkspaceBridge(props:any){
  const [detailId,setDetailId]=useState("");
  const [refreshKey,setRefreshKey]=useState(0);
  const [libraryMode,setLibraryMode]=useState<LibraryMode>("document");

  useEffect(()=>{
    const refresh=()=>setRefreshKey(value=>value+1);
    window.addEventListener("v2-deliverables-updated",refresh);
    return()=>window.removeEventListener("v2-deliverables-updated",refresh);
  },[]);

  return <>
    <Suspense fallback={null}>
      <Impl
        key={refreshKey}
        {...props}
        libraryMode={libraryMode}
        onLibraryModeChange={setLibraryMode}
        onOpenDetail={(deliverableId:string)=>setDetailId(deliverableId)}
      />
    </Suspense>
    {detailId&&<DocumentManagementPanel
      deliverableId={detailId}
      onClose={()=>setDetailId("")}
      onOpenTask={(projectId,taskId)=>{
        setDetailId("");
        props.onOpenTask?.(projectId,taskId);
      }}
    />}
  </>;
}

export const PreviewDocumentsWorkspace=((props:any)=><DocumentWorkspaceBridge {...props}/>) as ComponentType<any>;
