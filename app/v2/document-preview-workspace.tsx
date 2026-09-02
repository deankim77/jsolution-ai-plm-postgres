"use client";

import {useEffect,useState,type ComponentType} from "react";
import {FileText,Filter,Search} from "lucide-react";

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

const rowStyle={
  display:"grid",
  gridTemplateColumns:"minmax(280px,2fr) minmax(260px,1.45fr) minmax(120px,.65fr) 96px",
  alignItems:"center",
  minHeight:54,
  columnGap:14,
  padding:"0 16px",
} as const;

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

    <div className="wv2-module-summary">
      <article><span>전체 항목</span><b>{total}</b></article>
      <article><span>현재 표시</span><b>{items.length}</b></article>
      <article><span>문서 라이브러리</span><b>전체</b></article>
      <article><span>프로젝트 범위</span><b>전체</b></article>
    </div>

    <div className="wv2-module-toolbar">
      <label>
        <Search size={17}/>
        <input readOnly placeholder="프로젝트 · 산출물명 · 카테고리 검색"/>
      </label>
      <button type="button" disabled><Filter size={17}/>상세 필터</button>
      <span>{loading?"조회 중...":error?"조회 오류":`${total}개 항목`}</span>
    </div>

    {error&&<p className="wv2-module-notice">{error}</p>}

    {!error&&<div style={{margin:"0 24px 24px",border:"1px solid var(--wv2-border,#e5e7eb)",borderRadius:10,background:"#fff",overflow:"hidden"}}>
      <div style={{...rowStyle,minHeight:42,borderBottom:"1px solid var(--wv2-border,#e5e7eb)",background:"#f8fafc",fontSize:12,fontWeight:700,color:"#64748b"}}>
        <span>산출물</span>
        <span>프로젝트 · WBS</span>
        <span>구분</span>
        <span>작업</span>
      </div>

      {loading?<div style={{padding:"48px 16px",textAlign:"center",fontSize:13,color:"#64748b"}}>산출물 목록을 조회하고 있습니다.</div>:
        <div style={{maxHeight:"calc(100vh - 390px)",overflow:"auto"}}>
          {items.map((item,index)=><div key={item.id} style={{...rowStyle,borderBottom:index===items.length-1?"none":"1px solid #eef2f7",fontSize:13}}>
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
              <span style={{width:30,height:30,borderRadius:7,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#f1f5f9",flex:"0 0 auto"}}><FileText size={16}/></span>
              <span style={{minWidth:0}}>
                <b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:13}}>{item.name}</b>
                <small style={{display:"block",marginTop:3,color:"#64748b"}}>{item.type||"일반문서"}</small>
              </span>
            </div>
            <div style={{minWidth:0}}>
              <b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12.5}}>{item.projectCode||""}{item.projectName?` · ${item.projectName}`:""}</b>
              <small style={{display:"block",marginTop:3,color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.taskCode?`${item.taskCode} ${item.taskName||""}`:"프로젝트 공통"}</small>
            </div>
            <span style={{color:"#475569"}}>{item.type||"일반문서"}</span>
            <span style={{color:"#94a3b8"}}>—</span>
          </div>)}
        </div>
      }
    </div>}
  </section>;
}

export const PreviewDocumentsWorkspace=DocumentWorkspace as ComponentType<any>;
