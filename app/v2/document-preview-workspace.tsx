"use client";

import {useEffect,useMemo,useState,type ComponentType} from "react";
import {FileText,RefreshCw} from "lucide-react";

type Deliverable={
  id:string;
  projectId:string;
  projectCode?:string;
  projectName?:string;
  taskId?:string;
  taskCode?:string;
  taskName?:string;
  name:string;
  type?:string;
  required?:boolean|number;
  status:string;
  source?:string;
  revisionCount?:number;
};

type DeliverableVersion={
  id:string;
  deliverableId:string;
  revision:number;
  fileName:string;
  fileSize:number;
};

type ListResponse={
  deliverables?:Deliverable[];
  versions?:DeliverableVersion[];
  total?:number;
  error?:string;
};

function DocumentWorkspace(props:any){
  const [items,setItems]=useState<Deliverable[]>([]);
  const [versions,setVersions]=useState<DeliverableVersion[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    fetch("/api/deliverables?mode=latest&limit=50&offset=0&documentKind=document",{
      cache:"no-store",
      signal:controller.signal,
    })
      .then(async response=>{
        const data=await response.json() as ListResponse;
        if(!response.ok)throw new Error(data.error||"산출물 목록을 불러오지 못했습니다.");
        return data;
      })
      .then(data=>{
        setItems(data.deliverables??[]);
        setVersions(data.versions??[]);
        setTotal(Number(data.total||0));
        setError("");
      })
      .catch(reason=>{
        if(reason instanceof DOMException&&reason.name==="AbortError")return;
        setError(reason instanceof Error?reason.message:"산출물 목록을 불러오지 못했습니다.");
      })
      .finally(()=>{
        if(!controller.signal.aborted)setLoading(false);
      });
    return()=>controller.abort();
  },[]);

  const latestByDeliverable=useMemo(()=>{
    const map=new Map<string,DeliverableVersion>();
    for(const version of versions){
      const current=map.get(version.deliverableId);
      if(!current||version.revision>current.revision)map.set(version.deliverableId,version);
    }
    return map;
  },[versions]);

  return <section className="wv2-module wv2-document-workspace">
    <header className="wv2-module-head">
      <div>
        <small>DOCUMENT · DELIVERABLE</small>
        <h1>문서 · 산출물</h1>
        <p>전체 프로젝트의 문서와 산출물을 확인합니다.</p>
      </div>
    </header>

    <div className="wv2-module-summary">
      <article><span>전체 항목</span><b>{total}</b></article>
      <article><span>현재 표시</span><b>{items.length}</b></article>
      <article><span>Revision</span><b>{versions.length}</b></article>
    </div>

    {error&&<p className="wv2-module-notice">{error}</p>}

    {loading?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:
      <div className="wv2-document-table wv2-preview-document-table">
        <header>
          <span/>
          <span>산출물</span>
          <span>프로젝트 · WBS</span>
          <span>구분</span>
          <span>Revision</span>
          <span>상태</span>
          <span/>
        </header>
        {items.map(item=>{
          const latest=latestByDeliverable.get(item.id);
          return <article key={item.id}>
            <span><FileText size={18}/></span>
            <button className="name" type="button">
              <span><b>{item.name}</b><small>{item.type||"일반문서"}</small></span>
            </button>
            <button className="wv2-document-task" type="button" onClick={()=>item.taskId&&props.onOpenTask?.(item.projectId,item.taskId)}>
              <b>{item.projectCode||""} · {item.projectName||""}</b>
              <small>{item.taskCode?`${item.taskCode} ${item.taskName||""}`:"프로젝트 공통"}</small>
            </button>
            <em>{item.source==="planned"?"계획":item.source==="ai"?"AI":"추가"}{Boolean(item.required)&&" · 필수"}</em>
            <span>{latest?`Rev.${String(latest.revision).padStart(2,"0")}`:"—"}</span>
            <span className="wv2-document-status"><i className={item.status==="planned"?"planned":"submitted"}>{item.status==="planned"?"등록 예정":"등록 완료"}</i></span>
            <button type="button" disabled>미리보기</button>
          </article>;
        })}
      </div>
    }
  </section>;
}

export const PreviewDocumentsWorkspace=DocumentWorkspace as ComponentType<any>;
