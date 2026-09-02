"use client";

import {useEffect,useState,type ComponentType} from "react";

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
};

type ListResponse={
  deliverables?:Deliverable[];
  total?:number;
  error?:string;
};

function DocumentWorkspace(){
  const [items,setItems]=useState<Deliverable[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
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

  return <section className="wv2-module wv2-document-workspace">
    <header className="wv2-module-head">
      <div>
        <small>DOCUMENT · DELIVERABLE</small>
        <h1>문서 · 산출물</h1>
        <p>전체 프로젝트의 문서와 산출물을 확인합니다.</p>
      </div>
    </header>

    <div style={{padding:"0 24px 18px",fontSize:13}}>
      {loading?"목록 조회 중...":error?error:`전체 ${total}건 · 현재 ${items.length}건`}
    </div>

    {!loading&&!error&&<div style={{display:"grid",gap:8,padding:"0 24px 24px",overflow:"auto"}}>
      {items.map(item=><div key={item.id} style={{display:"grid",gridTemplateColumns:"minmax(240px,2fr) minmax(220px,1fr)",gap:16,padding:"12px 14px",border:"1px solid #e5e7eb",borderRadius:8,background:"#fff"}}>
        <div style={{minWidth:0}}>
          <b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</b>
          <small>{item.type||"일반문서"}</small>
        </div>
        <div style={{minWidth:0}}>
          <b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.projectCode||""}{item.projectName?` · ${item.projectName}`:""}</b>
          <small>{item.taskCode?`${item.taskCode} ${item.taskName||""}`:"프로젝트 공통"}</small>
        </div>
      </div>)}
    </div>}
  </section>;
}

export const PreviewDocumentsWorkspace=DocumentWorkspace as ComponentType<any>;
