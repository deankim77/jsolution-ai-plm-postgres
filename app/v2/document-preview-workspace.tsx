"use client";

import {Suspense,lazy,useState,type ComponentType} from "react";
import DocumentManagementPanel from "./document-management-panel";

const Impl=lazy(()=>import("./document-preview-workspace-impl").then(module=>({default:module.PreviewDocumentsWorkspace})));
type LibraryMode="document"|"drawing";

function DocumentWorkspace(props:any){
  const [libraryMode,setLibraryMode]=useState<LibraryMode>("document");
  const [detailId,setDetailId]=useState("");

  return <>
    <Suspense fallback={null}>
      <Impl {...props} libraryMode={libraryMode} onLibraryModeChange={setLibraryMode} onOpenDetail={setDetailId}/>
    </Suspense>
    {detailId&&<DocumentManagementPanel deliverableId={detailId} onClose={()=>setDetailId("")} onOpenTask={(projectId,taskId)=>{setDetailId("");props.onOpenTask?.(projectId,taskId)}}/>}
  </>;
}

export const PreviewDocumentsWorkspace=((props:any)=><DocumentWorkspace {...props}/>) as ComponentType<any>;
