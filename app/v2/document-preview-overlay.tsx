"use client";
import OfficeDocumentPreview from "../office-document-preview";
import {isOfficeDocument} from "../../lib/office-preview.mjs";

import {useEffect,useMemo,useRef,useState,type CSSProperties} from "react";
import {createPortal} from "react-dom";
import {ChevronDown,Download,ExternalLink,FileText,Maximize2,Minus,RefreshCw,X,ZoomIn} from "lucide-react";
import "./document-preview-overlay.css";

type Deliverable={id:string;projectId:string;projectCode?:string;projectName?:string;taskId?:string;taskCode?:string;taskName?:string;name:string;documentKind?:string;drawingCode?:string;drawingType?:string;workflowNumber?:string;approvedAt?:number;finalApprover?:string};
type DeliverableVersion={id:string;deliverableId:string;revision:number;fileName:string;fileSize:number;contentType?:string;conversionStatus?:string;conversionError?:string};
type DetailResponse={deliverable?:Deliverable;versions?:DeliverableVersion[];error?:string};
type PreviewTarget={deliverableId:string;projectId?:string;versionId?:string;name?:string};

const bytes=(value:number)=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${Math.round(value/1024)} KB`:`${value||0} B`;
const previewEvent="v2-open-document-overlay";

function findLibraryItem(row:HTMLElement){
  const name=row.querySelector("button.name b")?.textContent?.trim()||"";
  const projectLabel=row.querySelector(".wv2-document-task b")?.textContent?.trim()||"";
  const taskLabel=row.querySelector(".wv2-document-task small")?.textContent?.trim()||"";
  return {name,projectLabel,taskLabel};
}

async function resolveDeliverable(row:HTMLElement,projectOnly=false){
  const library=findLibraryItem(row);
  const name=library.name||row.querySelector("span.name b")?.textContent?.trim()||"";
  if(!name)return null;
  const response=await fetch(`/api/deliverables?q=${encodeURIComponent(name)}&limit=100&offset=0`,{cache:"no-store"});
  const data=await response.json() as {deliverables?:Deliverable[]};
  if(!response.ok)return null;
  const candidates=(data.deliverables??[]).filter(item=>item.name===name);
  if(projectOnly){
    const projectCode=document.querySelector<HTMLElement>(".wv2-project-code")?.textContent?.trim()||"";
    return candidates.find(item=>!projectCode||item.projectCode===projectCode)||candidates[0]||null;
  }
  return candidates.find(item=>{
    const projectOk=!library.projectLabel||library.projectLabel.includes(item.projectCode||"")||library.projectLabel.includes(item.projectName||"");
    const taskOk=!library.taskLabel||!item.taskCode||library.taskLabel.includes(item.taskCode);
    return projectOk&&taskOk;
  })||candidates[0]||null;
}

export default function DocumentPreviewOverlayBridge(){
  const [mounted,setMounted]=useState(false);
  const [target,setTarget]=useState<PreviewTarget|null>(null);
  const [active,setActive]=useState(false);
  const [tabHost,setTabHost]=useState<HTMLElement|null>(null);
  const [contentHost,setContentHost]=useState<HTMLElement|null>(null);
  const [item,setItem]=useState<Deliverable|null>(null);
  const [versions,setVersions]=useState<DeliverableVersion[]>([]);
  const [versionId,setVersionId]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [text,setText]=useState("");
  const [previewLoading,setPreviewLoading]=useState(false);
  const [previewError,setPreviewError]=useState("");
  const [zoom,setZoom]=useState(100);
  const [fit,setFit]=useState(true);
  const [reloadKey,setReloadKey]=useState(0);
  const [conversionStatus,setConversionStatus]=useState("");
  const [conversionError,setConversionError]=useState("");
  const [conversionSaving,setConversionSaving]=useState(false);
  const viewerRef=useRef<HTMLElement|null>(null);

  const ensureHosts=()=>{
    const tabs=document.querySelector<HTMLElement>(".wv2-work-tabs");
    const content=document.querySelector<HTMLElement>(".wv2-content");
    if(!tabs||!content)return false;
    let tab=tabs.querySelector<HTMLElement>(":scope > .document-central-tab-host");
    if(!tab){tab=document.createElement("div");tab.className="document-central-tab-host";tabs.appendChild(tab)}
    else if(tab!==tabs.lastElementChild)tabs.appendChild(tab);
    let panel=content.querySelector<HTMLElement>(":scope > .document-central-content-host");
    if(!panel){panel=document.createElement("div");panel.className="document-central-content-host";content.appendChild(panel)}
    setTabHost(tab);setContentHost(panel);return true;
  };

  const activate=()=>{
    if(!ensureHosts())return;
    document.querySelector<HTMLElement>(".wv2-work-tabs")?.classList.add("document-central-active");
    document.querySelector<HTMLElement>(".wv2-content")?.classList.add("document-central-active");
    setActive(true);
  };
  const deactivate=()=>{
    document.querySelector<HTMLElement>(".wv2-work-tabs")?.classList.remove("document-central-active");
    document.querySelector<HTMLElement>(".wv2-content")?.classList.remove("document-central-active");
    setActive(false);
  };
  const closePreview=()=>{deactivate();setTarget(null);setItem(null);setVersions([]);setVersionId("")};

  useEffect(()=>setMounted(true),[]);

  useEffect(()=>{
    const open=(event:Event)=>{const detail=(event as CustomEvent<PreviewTarget>).detail;if(detail?.deliverableId){setTarget(detail);window.setTimeout(activate,0)}};
    window.addEventListener(previewEvent,open);
    return()=>window.removeEventListener(previewEvent,open);
  },[]);

  useEffect(()=>{
    const handler=(event:MouseEvent)=>{
      const node=event.target as HTMLElement|null;if(!node)return;
      const normalTab=node.closest(".wv2-work-tabs > button");
      if(normalTab&&!node.closest(".document-central-work-tab"))deactivate();
    };
    document.addEventListener("click",handler,true);return()=>document.removeEventListener("click",handler,true);
  },[]);

  useEffect(()=>{
    if(!target)return;
    const controller=new AbortController();setLoading(true);setError("");setItem(null);setVersions([]);setVersionId("");
    fetch(`/api/deliverables?deliverableId=${encodeURIComponent(target.deliverableId)}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json() as DetailResponse;if(!response.ok)throw new Error(data.error||"문서를 불러오지 못했습니다.");return data})
      .then(data=>{const history=data.versions??[];setItem(data.deliverable??null);setVersions(history);setVersionId(target.versionId&&history.some(version=>version.id===target.versionId)?target.versionId:history[0]?.id||"")})
      .catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setError(reason instanceof Error?reason.message:"문서를 불러오지 못했습니다.")})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[target?.deliverableId,target?.versionId]);

  const version=useMemo(()=>versions.find(candidate=>candidate.id===versionId)??versions[0],[versions,versionId]);
  const projectId=item?.projectId||target?.projectId||"";
  const url=version&&projectId?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}&preview=1`:"";
  const download=version&&projectId?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}`:"";
  const lower=version?.fileName.toLowerCase()||"";
  const kind=version?.contentType?.startsWith("image/")||/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)?"image":version?.contentType==="application/pdf"||lower.endsWith(".pdf")?"pdf":lower.endsWith(".dwg")?"dwg":isOfficeDocument(lower)?"office":/\.(txt|csv|json|xml|md)$/i.test(lower)||version?.contentType?.startsWith("text/")?"text":"unsupported";

  useEffect(()=>{
    setText("");setPreviewError("");setZoom(100);setFit(true);setConversionStatus(version?.conversionStatus||"");setConversionError(version?.conversionError||"");
    if(!version||!url||kind!=="text"){setPreviewLoading(false);return}
    const controller=new AbortController();setPreviewLoading(true);
    fetch(url,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json().catch(()=>null) as {text?:string;error?:string}|null;if(!response.ok)throw new Error(data?.error||"문서 미리보기를 불러오지 못했습니다.");setText(data?.text||"")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError"))setPreviewError(reason instanceof Error?reason.message:"문서 미리보기를 불러오지 못했습니다.")}).finally(()=>{if(!controller.signal.aborted)setPreviewLoading(false)});
    return()=>controller.abort();
  },[version?.id,reloadKey,url,kind]);

  useEffect(()=>{
    const decorate=()=>{
      const nav=document.querySelector<HTMLElement>(".wv2-document-workspace .wv2-preview-tabs");
      if(nav){const buttons=[...nav.querySelectorAll<HTMLButtonElement>(":scope > button")];buttons.forEach((button,index)=>{const isLibrary=index===0||Boolean(button.dataset.library);const isDrawing=button.dataset.library==="drawing";if(!isLibrary&&!button.classList.contains("add"))button.style.display="none";if(button.classList.contains("add"))button.style.display="none";if(isDrawing)button.style.display="inline-flex"})}
      document.querySelectorAll<HTMLElement>(".wv2-preview-document-table > article").forEach(row=>{const action=row.querySelector<HTMLButtonElement>(":scope > button:last-child");if(action&&!action.classList.contains("wv2-document-wbs-link")){if(action.textContent!=="미리보기")action.textContent="미리보기";if(!action.classList.contains("wv2-document-preview-overlay-trigger"))action.classList.add("wv2-document-preview-overlay-trigger")}});
      document.querySelectorAll<HTMLElement>(".project-plm-table:not(.drawings):not(.bom)").forEach(table=>{const head=table.querySelector<HTMLElement>(":scope > .head");if(head&&!head.querySelector(".project-plm-preview-head")){const cell=document.createElement("span");cell.className="project-plm-preview-head";cell.textContent="액션";head.appendChild(cell)}table.querySelectorAll<HTMLElement>(":scope > button").forEach(row=>{if(row.querySelector(".project-plm-preview-action"))return;const action=document.createElement("span");action.className="project-plm-preview-action";action.textContent="미리보기";action.setAttribute("role","button");action.setAttribute("tabindex","0");row.appendChild(action)})});
    };
    decorate();const observer=new MutationObserver(decorate);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    let resolving=false;
    const openFound=(found:Deliverable|null)=>{if(found){setTarget({deliverableId:found.id,projectId:found.projectId,name:found.name});window.setTimeout(activate,0)}};
    const handler=(event:MouseEvent)=>{
      const targetNode=event.target as HTMLElement|null;if(!targetNode)return;
      const projectAction=targetNode.closest(".project-plm-preview-action");
      if(projectAction){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(resolving)return;const row=projectAction.closest(".project-plm-table > button") as HTMLElement|null;if(!row)return;resolving=true;void resolveDeliverable(row,true).then(openFound).finally(()=>{resolving=false});return}
      const row=targetNode.closest(".wv2-preview-document-table > article") as HTMLElement|null;if(!row)return;
      if(targetNode.closest(".wv2-document-wbs-link")||targetNode.closest(".wv2-document-task")||targetNode.closest(".select")||targetNode.closest("input[type='checkbox']"))return;
      const previewControl=targetNode.closest(".wv2-document-preview-overlay-trigger,.wv2-document-preview-link");if(!previewControl)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(resolving)return;resolving=true;void resolveDeliverable(row,false).then(openFound).finally(()=>{resolving=false});
    };
    document.addEventListener("click",handler,true);return()=>document.removeEventListener("click",handler,true);
  },[]);

  const retryConversion=async()=>{
    if(!version||!projectId)return;setConversionSaving(true);setConversionError("");
    try{const response=await fetch(`/api/projects/${projectId}/deliverables`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"retry-conversion",versionId:version.id})});const result=await response.json();if(!response.ok)throw new Error(result.error||"DWG 변환에 실패했습니다.");setConversionStatus(result.status||"converted");setConversionError(result.error||"");setReloadKey(value=>value+1)}catch(reason){setConversionStatus("failed");setConversionError(reason instanceof Error?reason.message:"DWG 변환에 실패했습니다.")}finally{setConversionSaving(false)};
  };

  if(!mounted||!target||!tabHost||!contentHost)return null;
  const textStyle={"--v2-preview-text-size":`${Math.max(12,Math.round(zoom*0.14))}px`} as CSSProperties;
  const approvalMeta=item?.workflowNumber?`승인 완료 · ${item.workflowNumber} · ${item.finalApprover||"최종 승인자"}${item.approvedAt?` · ${new Date(Number(item.approvedAt)*1000).toLocaleDateString("ko-KR")}`:""}`:"";
  const title=item?.drawingCode?`${item.drawingCode} · ${item.name}`:item?.name||target.name||"문서 미리보기";

  const tab=createPortal(<button type="button" className={`document-central-work-tab ${active?"active":""}`} onClick={()=>activate()}><FileText size={18}/><span>{item?.documentKind==="drawing"?`도면 · ${title}`:`문서 · ${title}`}</span><X size={18} onClick={event=>{event.stopPropagation();closePreview()}}/></button>,tabHost);
  const panel=createPortal(<section className={`document-central-preview ${active?"active":""}`} ref={viewerRef as React.RefObject<HTMLElement>}>
    <header className="wv2-document-overlay-head"><div><small>{item?.documentKind==="drawing"?"DRAWING PREVIEW":"DOCUMENT PREVIEW"}</small><b>{title}</b><span>{version?.fileName||"등록된 Revision 없음"}{version?` · ${bytes(version.fileSize)}`:""}</span>{approvalMeta&&<em>{approvalMeta}</em>}</div><div className="wv2-document-overlay-actions">{version&&<label>Revision <select value={version.id} onChange={event=>setVersionId(event.target.value)}>{versions.map(candidate=><option key={candidate.id} value={candidate.id}>Rev.{String(candidate.revision).padStart(2,"0")} · {candidate.fileName}</option>)}</select><ChevronDown size={18}/></label>}<button title="축소" disabled={!version} onClick={()=>{setFit(false);setZoom(value=>Math.max(50,(fit?100:value)-10))}}><Minus size={18}/></button><button className="zoom" title="화면 맞춤" disabled={!version} onClick={()=>{setFit(true);setZoom(100)}}>{fit?"맞춤":`${zoom}%`}</button><button title="확대" disabled={!version} onClick={()=>{setFit(false);setZoom(value=>Math.min(200,(fit?100:value)+10))}}><ZoomIn size={18}/></button><button title="전체 화면" disabled={!version} onClick={()=>viewerRef.current?.requestFullscreen()}><Maximize2 size={18}/></button>{version&&<a href={download} download><Download size={18}/>다운로드</a>}<button className="close" title="닫기" onClick={closePreview}><X size={20}/></button></div></header>
    <main className="wv2-document-overlay-body">{loading?<div className="wv2-document-overlay-empty"><RefreshCw className="wv2-spin" size={25}/><b>문서를 불러오는 중…</b></div>:error?<div className="wv2-document-overlay-empty error"><FileText size={26}/><b>{error}</b></div>:!version?<div className="wv2-document-overlay-empty"><FileText size={28}/><b>미리볼 Revision이 없습니다.</b><span>파일 등록은 연결된 WBS 업무에서 처리할 수 있습니다.</span></div>:previewLoading?<div className="wv2-document-overlay-empty"><RefreshCw className="wv2-spin" size={25}/><b>문서를 변환하는 중…</b></div>:previewError?<div className="wv2-document-overlay-empty error"><FileText size={26}/><b>{previewError}</b><button onClick={()=>setReloadKey(value=>value+1)}><RefreshCw size={18}/>다시 시도</button></div>:kind==="image"?<div className={`wv2-document-overlay-image ${fit?"fit":"zoomed"}`}><img src={url} alt={version.fileName} style={fit?undefined:{width:`${zoom}%`}}/></div>:kind==="pdf"?<iframe src={url} title={version.fileName}/>:kind==="office"&&version?<OfficeDocumentPreview key={version.id} projectId={projectId} versionId={version.id} title={version.fileName}/>:kind==="text"?<pre style={textStyle}>{text}</pre>:kind==="dwg"?(conversionStatus==="converted"?<iframe src={`${url}&reload=${reloadKey}`} title={`${version.fileName} PDF 변환 미리보기`}/>:<div className="wv2-document-overlay-empty"><RefreshCw size={26}/><b>{conversionStatus==="c…8004 tokens truncated…me={activeTab===tab.id?"active":""} onClick={()=>setActiveTab(tab.id)}><span>{tab.title}</span><X size={18} onClick={event=>{event.stopPropagation();closeTab(tab.id)}}/></button>)}<button className="add" onClick={()=>setActiveTab("library")}><Plus size={18}/></button></nav>
    {notice&&<p className="wv2-module-notice">{notice}</p>}
    {active?<DocumentPreview projectId={active.projectId} tab={active} item={items.find(item=>item.id===active.deliverableId)} versions={versions.filter(version=>version.deliverableId===active.deliverableId)} onVersion={versionId=>updateTabVersion(active.id,versionId)} onRegisterRevision={item=>void openDialog(item)} viewerRef={viewerRef}/>:<><div className="wv2-module-summary"><article><span>전체 항목</span><b>{total}</b></article><article><span>등록 완료</span><b>{registeredCount}</b></article><article><span>필수 미등록</span><b>{missingRequiredCount}</b></article><article><span>전체 Revision</span><b>{totalRevisionCount}</b></article></div><div className="wv2-module-toolbar"><label><FileText size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="프로젝트·산출물명·도면코드·카테고리 검색"/></label><button className={activeFilterCount?"active":""} onClick={()=>{setDraftFilters({...filters});setFilterOpen(true)}}><Filter size={18}/>상세 필터{activeFilterCount>0&&<em>{activeFilterCount}</em>}</button><CommonProjectSelector compact projects={projects} value={projectFilter==="all"?"":projectFilter} onChange={id=>setProjectFilter(id||"all")}/><select className="wv2-document-status-filter" value={registrationFilter} onChange={event=>setRegistrationFilter(event.target.value)}><option value="all">전체 상태</option><option value="planned">등록 예정</option><option value="completed">등록 완료</option></select><span>{total}개 항목</span></div>{loading&&!items.length?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:<div className="wv2-document-table wv2-preview-document-table" onScroll={event=>{const node=event.currentTarget;if(node.scrollHeight-node.scrollTop-node.clientHeight<220)void loadMore()}}><header><span className="select"><input type="checkbox" checked={Boolean(visible.length)&&visible.every(item=>selection.has(contextFor(item)))} onChange={()=>visible.every(item=>selection.has(contextFor(item)))?selection.clear():visible.forEach(item=>{if(!selection.has(contextFor(item)))selection.toggle(contextFor(item))})}/></span><span>산출물</span><span>프로젝트 · WBS</span><span>구분</span><span>Revision</span><span>상태</span><span/></header>{visible.map(item=>{const latest=latestFor(item.id),Icon=latest?iconFor(latest.fileName):FileText,drawing=isDrawing(item);return <article key={item.id}><span className="select"><input type="checkbox" checked={selection.has(contextFor(item))} onChange={()=>selection.toggle(contextFor(item))}/></span><button className="name" onClick={()=>onOpenDetail?onOpenDetail(item.id):latest&&openPreview(item)}><Icon size={18}/><span><b>{item.name}</b><small>{drawing?`${item.drawingCode||"도면코드 생성 중"} · ${item.drawingType||"도면"}`:item.type||"기타 > 일반문서"}</small></span></button><button className="wv2-document-task" onClick={()=>item.taskId&&onOpenTask(item.projectId,item.taskId)}><b>{item.projectCode} · {item.projectName}</b><small>{item.taskCode?`${item.taskCode} ${item.taskName||""}`:"프로젝트 공통"}</small></button><em>{drawing?"도면":item.source==="planned"?"계획":item.source==="ai"?"AI":"추가"}{!drawing&&Boolean(item.required)&&" · 필수"}</em><button className="wv2-revision-link" disabled={!latest} onClick={()=>latest&&openPreview(item)}>{latest?<><b>Rev.{String(latest.revision).padStart(2,"0")}</b><small>{latest.fileName} · {bytes(latest.fileSize)}</small></>:"—"}</button><span className="wv2-document-status"><i className={item.status==="planned"?"planned":"submitted"}>{drawing?(item.status==="planned"?"등록 예정":"최신본"):registrationStatusLabel(item.status)}</i>{!drawing&&item.status!=="planned"&&<small className={item.status}>{reviewStatusLabel(item.status)}</small>}</span><button onClick={()=>latest?openPreview(item):item.taskId&&onOpenTask(item.projectId,item.taskId)}>{latest?"미리보기":"업무 열기"}</button></article>})}</div>}</>}
    {dialog&&<div className="wv2-module-dialog-backdrop"><form className="wv2-module-dialog" onSubmit={submit}><header><div><small>DELIVERABLE UPLOAD</small><h2>{form.deliverableId?"산출물 Revision 등록":"추가 산출물 등록"}</h2></div><button type="button" onClick={()=>setDialog(false)}>×</button></header><label><span>연결 Task *</span><select required value={form.taskId} onChange={event=>setForm(current=>({...current,taskId:event.target.value}))}><option value="">선택</option>{dialogTasks.filter(task=>task.kind==="task").map(task=><option value={task.id} key={task.id}>{task.wbsCode} {task.name}</option>)}</select></label>{form.deliverableId?<label><span>산출물</span><select value={form.deliverableId} onChange={event=>setForm(current=>({...current,deliverableId:event.target.value}))}>{items.filter(item=>!isDrawing(item)).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>:<><label><span>산출물명</span><input value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))}/></label><label><span>문서 카테고리</span><input value={form.category} onChange={event=>setForm(current=>({...current,category:event.target.value}))}/></label></>}<label><span>파일</span><input ref={fileRef} type="file" required/></label><label><span>등록 메모</span><textarea rows={3} value={form.note} onChange={event=>setForm(current=>({...current,note:event.target.value}))}/></label><footer><button type="button" onClick={()=>setDialog(false)}>취소</button><button className="primary" disabled={saving}>{saving?"등록 중…":"파일 등록"}</button></footer></form></div>}
  </section>;
}

function DocumentPreview({projectId,tab,item,versions,onVersion,onRegisterRevision,viewerRef}:{projectId:string;tab:PreviewTab;item?:Deliverable;versions:DeliverableVersion[];onVersion:(id:string)=>void;onRegisterRevision:(item:Deliverable)=>void;viewerRef:RefObject<HTMLDivElement|null>}){
  const version=versions.find(candidate=>candidate.id===tab.versionId)??versions[0];const [text,setText]=useState("");const [error,setError]=useState<{message:string;downloadAvailable:boolean}|null>(null);const [loading,setLoading]=useState(true);const [zoom,setZoom]=useState(100);const [fit,setFit]=useState(true);const [reloadKey,setReloadKey]=useState(0);const [conversionStatus,setConversionStatus]=useState(version?.conversionStatus||"");const [conversionError,setConversionError]=useState(version?.conversionError||"");const [conversionSaving,setConversionSaving]=useState(false);useEffect(()=>{setConversionStatus(version?.conversionStatus||"");setConversionError(version?.conversionError||"")},[version?.id,version?.conversionStatus,version?.conversionError]);
  const url=version?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}&preview=1`:"";const lower=version?.fileName.toLowerCase()||"";const kind=version?.contentType?.startsWith("image/")||/\.(png|jpe?g|gif|webp|svg)$/i.test(lower)?"image":version?.contentType==="application/pdf"||lower.endsWith(".pdf")?"pdf":lower.endsWith(".dwg")?"dwg":isOfficeDocument(lower)?"office":/\.(txt|csv|json|xml|md)$/i.test(lower)||version?.contentType?.startsWith("text/")?"text":"unsupported";
  useEffect(()=>{setText("");setError(null);setZoom(100);setFit(true);if(!version){setLoading(false);return}if(kind!=="text"){setLoading(false);return}setLoading(true);fetch(url,{cache:"no-store"}).then(async response=>{const data=await response.json().catch(()=>null) as {text?:string;error?:string;downloadAvailable?:boolean}|null;if(!response.ok)throw {message:data?.error||"문서 미리보기를 불러오지 못했습니다.",downloadAvailable:Boolean(data?.downloadAvailable)};setText(data?.text||"")}).catch(reason=>setError({message:typeof reason?.message==="string"?reason.message:"문서 미리보기를 불러오지 못했습니다.",downloadAvailable:Boolean(reason?.downloadAvailable)})).finally(()=>setLoading(false))},[version?.id,reloadKey]);
  const download=version?`/api/projects/${projectId}/deliverables?versionId=${encodeURIComponent(version.id)}`:"";
  const retryConversion=async()=>{if(!version)return;setConversionSaving(true);setConversionError("");try{const response=await fetch(`/api/projects/${projectId}/deliverables`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"retry-conversion",versionId:version.id})});const result=await response.json();if(!response.ok)throw new Error(result.error||"DWG 변환에 실패했습니다.");setConversionStatus(result.status||"converted");if(result.error)setConversionError(result.error);setReloadKey(value=>value+1)}catch(reason){setConversionStatus("failed");setConversionError(reason instanceof Error?reason.message:"DWG 변환에 실패했습니다.")}finally{setConversionSaving(false)}};
  const textStyle={"--v2-preview-text-size":`${Math.max(12,Math.round(zoom*0.14))}px`} as CSSProperties;
  const approvalMeta=item?.workflowNumber?`승인 완료 · ${item.workflowNumber} · ${item.finalApprover||"최종 승인자"}${item.approvedAt?` · ${new Date(Number(item.approvedAt)*1000).toLocaleDateString("ko-KR")}`:""}`:"";
  return <div className="wv2-document-preview" ref={viewerRef}><header><div><span><b>{item?.drawingCode?`${item.drawingCode} · ${item.name}`:item?.name||tab.title}</b><small>{version?.fileName||"Revision 없음"}{version?` · ${bytes(version.fileSize)}`:""}</small>{approvalMeta&&<em>{approvalMeta}</em>}</span></div><div className="wv2-preview-actions"><label>Revision <select value={version?.id||""} onChange={event=>onVersion(event.target.value)}>{versions.map(candidate=><option key={candidate.id} value={candidate.id}>Rev.{String(candidate.revision).padStart(2,"0")} · {candidate.fileName}</option>)}</select><ChevronDown size={18}/></label><button title="축소" onClick={()=>{setFit(false);setZoom(value=>Math.max(50,(fit?100:value)-10))}}><Minus size={18}/></button><button className="wv2-preview-zoom-label" title="화면 맞춤" onClick={()=>{setFit(true);setZoom(100)}}>{fit?"맞춤":`${zoom}%`}</button><button title="확대" onClick={()=>{setFit(false);setZoom(value=>Math.min(200,(fit?100:value)+10))}}><ZoomIn size={18}/></button><button title="전체 화면" onClick={()=>viewerRef.current?.requestFullscreen()}><Maximize2 size={18}/></button>{item&&<button onClick={()=>onRegisterRevision(item)}><Upload size={18}/>{isDrawing(item)?"새 Rev 등록":"Revision 등록"}</button>}<a href={download} download><Download size={18}/>다운로드</a></div></header><main>{loading?<div className="wv2-preview-empty"><RefreshCw className="wv2-spin" size={24}/><b>문서를 변환하는 중…</b></div>:error?<div className="wv2-preview-empty wv2-preview-error"><FileText size={24}/><b>{error.message}</b><span>{error.downloadAvailable?"원본 파일은 정상이며 다운로드하여 확인할 수 있습니다.":"파일 등록 상태를 확인한 뒤 다시 시도해 주세요."}</span><div><button onClick={()=>setReloadKey(value=>value+1)}><RefreshCw size={18}/>다시 시도</button>{error.downloadAvailable&&<a href={download} download><Download size={18}/>원본 다운로드</a>}</div></div>:kind==="image"?<div className={`wv2-image-preview ${fit?"fit":"zoomed"}`}><img src={url} alt={version?.fileName} style={fit?undefined:{width:`${zoom}%`}}/></div>:kind==="pdf"?<iframe src={url} title={version?.fileName}/>:kind==="office"&&version?<OfficeDocumentPreview key={version.id} projectId={projectId} versionId={version.id} title={version.fileName}/>:kind==="text"?<pre style={textStyle}>{text}</pre>:kind==="dwg"?(conversionStatus==="converted"?<iframe src={`${url}&reload=${reloadKey}`} title={`${version?.fileName} PDF 변환 미리보기`}/>:<div className="wv2-preview-empty"><RefreshCw size={26}/><b>{conversionStatus==="converting"?"DWG를 PDF로 변환하는 중입니다.":conversionStatus==="unconfigured"?"DWG 변환 서버 연결이 필요합니다.":conversionStatus==="failed"?"DWG 변환에 실패했습니다.":"DWG PDF 미리보기를 준비 중입니다."}</b><span>{conversionError||"원본 DWG는 정상 보관되며 변환 후 브라우저 미리보기가 제공됩니다."}</span><div><button disabled={conversionSaving} onClick={retryConversion}><RefreshCw size={18}/>{conversionSaving?"변환 요청 중…":"변환 다시 시도"}</button><a href={download} download><Download size={18}/>원본 다운로드</a></div></div>):<div className="wv2-preview-empty"><ExternalLink size={26}/><b>이 형식은 브라우저 내 미리보기를 지원하지 않습니다.</b><span>다운로드하여 원본 프로그램에서 확인해 주세요.</span><a href={download}>파일 열기</a></div>}</main></div>;
}

