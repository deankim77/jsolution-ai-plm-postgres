"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowLeft,FileText,RefreshCw} from "lucide-react";
import DocumentPreviewRenderer,{type DocumentPreviewDeliverable,type DocumentPreviewVersion} from "./document-preview-renderer";
export type DocumentPreviewTarget={deliverableId:string;versionId?:string;name:string};
type Detail=DocumentPreviewDeliverable&{taskId?:string};
/** Opens an exact document/revision without loading or searching the library list. */
export default function DocumentPreviewSession({target,onClose,onRegisterRevision}:{target:DocumentPreviewTarget;onClose:()=>void;onRegisterRevision:(item:Detail)=>void}){
  const [detail,setDetail]=useState<Detail|null>(null),[versions,setVersions]=useState<DocumentPreviewVersion[]>([]),[versionId,setVersionId]=useState(target.versionId||"");
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[reload,setReload]=useState(0),viewerRef=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setDetail(null);setVersions([]);
    void fetch(`/api/deliverables?deliverableId=${encodeURIComponent(target.deliverableId)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");
      if(!data.deliverable||data.deliverable.id!==target.deliverableId)throw new Error("산출물을 찾을 수 없습니다.");
      if(controller.signal.aborted)return;
      const history=(data.versions??[]) as DocumentPreviewVersion[];
      if(target.versionId&&!history.some(item=>item.id===target.versionId))throw new Error("선택한 Revision이 삭제되었거나 조회할 수 없습니다.");
      setDetail(data.deliverable);setVersions(history);setVersionId(target.versionId||history[0]?.id||"");
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[target.deliverableId,target.versionId,reload]);
  useEffect(()=>{const refresh=()=>setReload(value=>value+1);window.addEventListener("v2-deliverables-updated",refresh);return()=>window.removeEventListener("v2-deliverables-updated",refresh)},[]);
  return <section className="wv2-module wv2-document-workspace"><div className="wv2-module-toolbar"><button onClick={onClose}><ArrowLeft size={18}/>업무로 돌아가기</button><span>{detail?.name||target.name} · 산출물 미리보기</span></div>
    {loading?<div className="wv2-preview-empty"><RefreshCw size={24}/><b>산출물을 불러오는 중…</b></div>:error?<div className="wv2-preview-empty" role="alert"><FileText size={24}/><b>{error}</b><button onClick={()=>setReload(value=>value+1)}>다시 시도</button></div>:detail&&versions.length?<DocumentPreviewRenderer key={detail.id} projectId={detail.projectId} tab={{id:`preview:${detail.id}`,projectId:detail.projectId,deliverableId:detail.id,title:detail.name,versionId}} item={detail} versions={versions} onVersion={setVersionId} onRegisterRevision={()=>onRegisterRevision(detail)} viewerRef={viewerRef}/>:<div className="wv2-preview-empty"><FileText size={24}/><b>등록된 파일이 없습니다.</b></div>}
  </section>;
}
