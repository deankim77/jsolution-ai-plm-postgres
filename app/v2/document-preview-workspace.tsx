"use client";

import {useEffect,useMemo,useState,type ComponentType} from "react";
import {FileText,Search} from "lucide-react";

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
  status?:string;
  source?:string;
};

type ListResponse={deliverables?:Deliverable[];error?:string};

function DocumentWorkspace(){
  const [items,setItems]=useState<Deliverable[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [query,setQuery]=useState("");

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/deliverables?mode=latest&limit=50&offset=0&documentKind=document",{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as ListResponse;
        if(!response.ok)throw new Error(data.error||"산출물 목록을 불러오지 못했습니다.");
        return data;
      })
      .then(data=>{setItems(data.deliverables??[]);setError("")})
      .catch(reason=>{
        if(reason instanceof DOMException&&reason.name==="AbortError")return;
        setError(reason instanceof Error?reason.message:"산출물 목록을 불러오지 못했습니다.");
      })
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[]);

  const visible=useMemo(()=>{
    const keyword=query.trim().toLowerCase();
    if(!keyword)return items;
    return items.filter(item=>[
      item.name,item.type,item.projectCode,item.projectName,item.taskCode,item.taskName,
    ].some(value=>String(value||"").toLowerCase().includes(keyword)));
  },[items,query]);

  return <section className="wv2-module wv2-issue-workspace">
    <header className="wv2-module-head">
      <div>
        <small>DOCUMENT · DELIVERABLE</small>
        <h1>문서 · 산출물</h1>
        <p>전체 프로젝트의 문서와 산출물을 확인합니다.</p>
      </div>
    </header>

    <div className="wv2-module-toolbar">
      <label><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="프로젝트 · WBS · 문서명 · 문서구분 검색"/></label>
    </div>

    {error&&<p className="wv2-module-notice">{error}</p>}

    {loading?<div className="wv2-module-empty"><b>산출물을 불러오는 중…</b></div>:
      <div className="wv2-issue-table">
        <header>
          <span>문서명</span>
          <span>프로젝트</span>
          <span>연결 WBS</span>
          <span>문서구분</span>
          <span>상태</span>
          <span>작업</span>
        </header>
        {visible.map(item=><article key={item.id}>
          <button type="button">
            <span className="dot issue"/>
            <span><small>문서 · 산출물</small><b>{item.name}</b><em>{item.type||"일반문서"}</em></span>
          </button>
          <span className="wv2-issue-wbs"><b>{item.projectCode||"-"} · {item.projectName||"프로젝트 미연결"}</b></span>
          <span><b>{item.taskCode||"프로젝트 공통"}</b><small>{item.taskName||""}</small></span>
          <i>{item.type||"일반문서"}</i>
          <span><b>{item.status==="planned"?"등록 예정":"등록 완료"}</b></span>
          <span><b>상세</b><small>미리보기 · WBS 이동</small></span>
        </article>)}
      </div>
    }

    {!loading&&!error&&!visible.length&&<div className="wv2-module-empty"><FileText size={28}/><b>조건에 맞는 문서가 없습니다.</b></div>}
  </section>;
}

export const PreviewDocumentsWorkspace=DocumentWorkspace as ComponentType<any>;
