"use client";

import {lazy,Suspense,useEffect,useRef,useState} from "react";
import {FileImage,FileSpreadsheet,FileText,FileType2,Plus,RefreshCw,Upload,X} from "lucide-react";
import type {V2Project} from "./project-workspaces";
import {useAiContextSelection} from "./ai-context-selection";
import type {DocumentPreviewDeliverable,DocumentPreviewTab,DocumentPreviewVersion} from "./document-preview-renderer";

const DocumentPreviewRenderer=lazy(()=>import("./document-preview-renderer"));

type ModuleTask={id:string;wbsCode:string;kind:string;name:string};
type LibraryMode="document"|"drawing";
type Deliverable=DocumentPreviewDeliverable&{
  projectCode?:string;
  projectName?:string;
  taskId?:string;
  taskCode?:string;
  taskName?:string;
  type?:string;
  status:string;
  source:string;
  revisionCount:number;
  drawingType?:string;
};
type DeliverableVersion=DocumentPreviewVersion&{
  taskId?:string;
  note?:string;
  createdAt:number;
  createdBy?:string;
};
type ListResponse={deliverables?:Deliverable[];versions?:DeliverableVersion[];error?:string};

type Props={
  project:V2Project|null;
  projects:V2Project[];
  tasks:ModuleTask[];
  initialDeliverableId?:string;
  onInitialOpened?:()=>void;
  onOpenTask:(projectId:string,taskId:string)=>void;
  onAddDeliverable:(projectId:string,taskId:string,mode?:"deliverable"|"drawing",deliverableId?:string)=>void;
  onOpenFilter?:unknown;
  libraryMode?:LibraryMode;
  onLibraryModeChange?:(mode:LibraryMode)=>void;
  onOpenDetail?:(deliverableId:string)=>void;
  refreshVersion?:number;
};

const bytes=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${Math.round(value/1024)} KB`:`${value||0} B`;
const iconFor=(name:string)=>/\.(png|jpe?g|gif|webp|svg)$/i.test(name)?FileImage:/\.xlsx?$/i.test(name)?FileSpreadsheet:/\.(docx?|pdf|pptx?)$/i.test(name)?FileType2:FileText;
const isDrawing=(item:Deliverable)=>item.documentKind==="drawing";
const statusLabel=(status:string)=>status==="approved"?"승인":status==="rejected"?"반려":"등록 완료";

export default function DocumentLibraryWorkspace({project,projects,tasks,initialDeliverableId,onInitialOpened,onOpenTask,onAddDeliverable,libraryMode="document",onLibraryModeChange,onOpenDetail,refreshVersion=0}:Props){
  const selection=useAiContextSelection("문서 · 산출물");
  const [items,setItems]=useState<Deliverable[]>([]);
  const [versions,setVersions]=useState<DeliverableVersion[]>([]);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [tabs,setTabs]=useState<DocumentPreviewTab[]>([]);
  const [activeTab,setActiveTab]=useState("library");
  const viewerRef=useRef<HTMLDivElement|null>(null);

  const latestFor=(deliverableId:string)=>versions.find(version=>version.deliverableId===deliverableId);

  useEffect(()=>{
    const mountedAt=performance.now();
    console.info("[DOCUMENT_CLIENT] mount",Math.round(mountedAt));
    return()=>console.info("[DOCUMENT_CLIENT] unmount",Math.round(performance.now()));
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    const started=performance.now();
    setLoading(true);
    setNotice("");
    console.info("[DOCUMENT_CLIENT] fetch-start",{libraryMode,at:Math.round(started)});
    fetch(`/api/deliverables?documentKind=${libraryMode}&registration=completed`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        const data=await response.json() as ListResponse;
        console.info("[DOCUMENT_CLIENT] fetch-response",{libraryMode,status:response.status,duration:Math.round(performance.now()-started)});
        if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");
        return data;
      })
      .then(data=>{
        const nextVersions=data.versions??[];
        const registered=(data.deliverables??[]).filter(item=>nextVersions.some(version=>version.deliverableId===item.id));
        registered.sort((a,b)=>(nextVersions.find(version=>version.deliverableId===b.id)?.createdAt??0)-(nextVersions.find(version=>version.deliverableId===a.id)?.createdAt??0));
        console.info("[DOCUMENT_CLIENT] before-setItems",{count:registered.length,versions:nextVersions.length,at:Math.round(performance.now())});
        setVersions(nextVersions);
        setItems(registered);
        queueMicrotask(()=>console.info("[DOCUMENT_CLIENT] after-setItems-microtask",Math.round(performance.now())));
      })
      .catch(reason=>{
        if(reason instanceof DOMException&&reason.name==="AbortError")return;
        setItems([]);
        setVersions([]);
        setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.");
      })
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[libraryMode,refreshVersion]);

  const loadVersionHistory=async(deliverableId:string)=>{
    const response=await fetch(`/api/deliverables?deliverableId=${encodeURIComponent(deliverableId)}`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Revision 이력을 불러오지 못했습니다.");
    const history=(data.versions??[]) as DeliverableVersion[];
    if(data.deliverable)setItems(current=>current.map(item=>item.id===deliverableId?{...item,...data.deliverable}:item));
    setVersions(current=>[...current.filter(version=>version.deliverableId!==deliverableId),...history]);
    return history;
  };

  const openPreview=(item:Deliverable,version=latestFor(item.id))=>{
    if(!version){setNotice("미리볼 Revision이 없습니다.");return}
    const id=`preview:${item.id}`;
    setTabs(current=>current.some(tab=>tab.id===id)?current.map(tab=>tab.id===id?{...tab,versionId:version.id,title:item.name,projectId:item.projectId}:tab):[...current,{id,projectId:item.projectId,deliverableId:item.id,title:item.name,versionId:version.id}]);
    setActiveTab(id);
    void loadVersionHistory(item.id).catch(reason=>setNotice(reason instanceof Error?reason.message:"Revision 이력을 불러오지 못했습니다."));
  };

  useEffect(()=>{
    const handler=(event:Event)=>{
      const detail=(event as CustomEvent<{deliverableId?:string;versionId?:string}>).detail;
      const item=items.find(row=>row.id===detail?.deliverableId);
      if(!item)return;
      const local=detail?.versionId?versions.find(version=>version.id===detail.versionId):latestFor(item.id);
      if(local){openPreview(item,local);return}
      void loadVersionHistory(item.id).then(history=>openPreview(item,detail?.versionId?history.find(version=>version.id===detail.versionId):history[0])).catch(()=>undefined);
    };
    window.addEventListener("v2-open-document-preview",handler);
    return()=>window.removeEventListener("v2-open-document-preview",handler);
  },[items,versions]);

  useEffect(()=>{
    if(!initialDeliverableId||!items.length)return;
    const item=items.find(row=>row.id===initialDeliverableId);
    if(!item)return;
    const latest=latestFor(item.id);
    if(latest)openPreview(item,latest);
    else void loadVersionHistory(item.id).then(history=>openPreview(item,history[0]));
    onInitialOpened?.();
  },[initialDeliverableId,items,versions]);

  const closeTab=(id:string)=>{
    setTabs(current=>current.filter(tab=>tab.id!==id));
    if(activeTab===id)setActiveTab("library");
  };
  const updateTabVersion=(id:string,versionId:string)=>setTabs(current=>current.map(tab=>tab.id===id?{...tab,versionId}:tab));
  const active=tabs.find(tab=>tab.id===activeTab);
  const registrationProject=project||projects[0]||null;

  const getTasks=async(target:V2Project)=>{
    if(target.id===project?.id&&tasks.length)return tasks;
    const response=await fetch(`/api/projects/${target.id}/wbs`,{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Task를 불러오지 못했습니다.");
    return (data.tasks??[]) as ModuleTask[];
  };

  const openRegistration=async(mode:"deliverable"|"drawing")=>{
    if(!registrationProject){setNotice("등록할 프로젝트를 선택해 주세요.");return}
    try{
      const available=await getTasks(registrationProject);
      const task=available.find(row=>row.kind==="task");
      if(!task){setNotice("연결할 Task가 없습니다.");return}
      onAddDeliverable(registrationProject.id,task.id,mode);
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Task를 불러오지 못했습니다.")}
  };

  const contextFor=(item:Deliverable)=>{
    const latest=latestFor(item.id);
    return {id:item.id,kind:isDrawing(item)?"도면":"문서",title:item.name,meta:`${item.projectCode||"프로젝트 미지정"} · ${item.taskCode||"WBS 미지정"} · ${latest?`Rev.${latest.revision}`:"Revision 없음"}`,fileName:latest?.fileName,revision:latest?.revision,fileAttached:Boolean(latest)};
  };

  const registerRevision=(item:DocumentPreviewDeliverable)=>{
    const target=items.find(row=>row.id===item.id);
    if(target?.taskId){onAddDeliverable(target.projectId,target.taskId,isDrawing(target)?"drawing":"deliverable",target.id);return}
    onOpenDetail?.(item.id);
  };

  return <section className="wv2-module wv2-document-workspace">
    <header className="wv2-module-head">
      <div><small>DOCUMENT · DELIVERABLE · PREVIEW</small><h1>문서 · 산출물</h1><p>시스템에 실제 등록된 문서와 도면을 확인합니다.</p></div>
      <div className="wv2-module-head-actions"><button disabled={!registrationProject} onClick={()=>void openRegistration("drawing")}><FileText size={18}/>도면 등록</button><button className="primary" disabled={!registrationProject} onClick={()=>void openRegistration("deliverable")}><Upload size={18}/>추가 산출물 등록</button></div>
    </header>

    <nav className="wv2-preview-tabs">
      <button className={activeTab==="library"&&libraryMode==="document"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("document")}}><FileText size={18}/>문서 라이브러리</button>
      <button className={activeTab==="library"&&libraryMode==="drawing"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("drawing")}}><FileText size={18}/>도면 라이브러리</button>
      {tabs.map(tab=><button key={tab.id} className={activeTab===tab.id?"active":""} onClick={()=>setActiveTab(tab.id)}><span>{tab.title}</span><X size={18} onClick={event=>{event.stopPropagation();closeTab(tab.id)}}/></button>)}
      <button className="add" onClick={()=>setActiveTab("library")}><Plus size={18}/></button>
    </nav>

    {notice&&<p className="wv2-module-notice">{notice}</p>}

    {active?
      <Suspense fallback={<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={24}/><b>미리보기를 여는 중…</b></div>}>
        <DocumentPreviewRenderer projectId={active.projectId} tab={active} item={items.find(item=>item.id===active.deliverableId)} versions={versions.filter(version=>version.deliverableId===active.deliverableId)} onVersion={versionId=>updateTabVersion(active.id,versionId)} onRegisterRevision={registerRevision} viewerRef={viewerRef}/>
      </Suspense>
      :loading&&!items.length?<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={25}/><b>등록 문서를 불러오는 중…</b></div>
      :<div className="wv2-document-table wv2-preview-document-table">
        <header><span className="select"><input type="checkbox" checked={Boolean(items.length)&&items.every(item=>selection.has(contextFor(item)))} onChange={()=>items.every(item=>selection.has(contextFor(item)))?selection.clear():items.forEach(item=>{if(!selection.has(contextFor(item)))selection.toggle(contextFor(item))})}/></span><span>산출물</span><span>프로젝트 · WBS</span><span>구분</span><span>Revision</span><span>상태</span><span/></header>
        {items.map(item=>{const latest=latestFor(item.id),Icon=latest?iconFor(latest.fileName):FileText,drawing=isDrawing(item);return <article key={item.id}>
          <span className="select"><input type="checkbox" checked={selection.has(contextFor(item))} onChange={()=>selection.toggle(contextFor(item))}/></span>
          <button className="name" onClick={()=>onOpenDetail?onOpenDetail(item.id):latest&&openPreview(item)}><Icon size={18}/><span><b>{item.name}</b><small>{drawing?`${item.drawingCode||"도면코드"} · ${item.drawingType||"도면"}`:item.type||"일반문서"}</small></span></button>
          <button className="wv2-document-task" disabled={!item.taskId} onClick={()=>item.taskId&&onOpenTask(item.projectId,item.taskId)}><b>{item.projectCode||"프로젝트 미지정"} · {item.projectName||""}</b><small>{item.taskCode?`${item.taskCode} ${item.taskName||""}`:"WBS 미지정"}</small></button>
          <em>{drawing?"도면":"문서"}</em>
          <button className="wv2-revision-link" disabled={!latest} onClick={()=>latest&&openPreview(item)}>{latest?<><b>Rev.{String(latest.revision).padStart(2,"0")}</b><small>{latest.fileName} · {bytes(latest.fileSize)}</small></>:"—"}</button>
          <span className="wv2-document-status"><i className="submitted">{statusLabel(item.status)}</i></span>
          <button disabled={!latest} onClick={()=>latest&&openPreview(item)}>미리보기</button>
        </article>})}
      </div>}
  </section>;
}
