import {readFile,writeFile} from "node:fs/promises";

const read=path=>readFile(path,"utf8");
const write=(path,content)=>writeFile(path,content,"utf8");

async function normalizeWorkspaceBridge(){
  const path="app/v2/document-preview-workspace.tsx";
  const source=`"use client";\n\nimport "./workspace-fetch-cache";\nimport {Suspense,lazy,useEffect,useState,type ComponentType} from "react";\nimport DocumentManagementPanel from "./document-management-panel";\n\nconst Impl=lazy(()=>import("./document-preview-workspace-impl").then(module=>({default:module.PreviewDocumentsWorkspace})));\ntype LibraryMode="document"|"drawing";\n\nfunction DocumentWorkspace(props:any){\n  const [libraryMode,setLibraryMode]=useState<LibraryMode>("document");\n  const [detailId,setDetailId]=useState("");\n  const [refreshKey,setRefreshKey]=useState(0);\n\n  useEffect(()=>{\n    const refresh=()=>setRefreshKey(value=>value+1);\n    window.addEventListener("v2-deliverables-updated",refresh);\n    return()=>window.removeEventListener("v2-deliverables-updated",refresh);\n  },[]);\n\n  return <>\n    <Suspense fallback={null}><Impl key={refreshKey} {...props} libraryMode={libraryMode} onLibraryModeChange={setLibraryMode} onOpenDetail={setDetailId}/></Suspense>\n    {detailId&&<DocumentManagementPanel deliverableId={detailId} onClose={()=>setDetailId("")} onOpenTask={(projectId,taskId)=>{setDetailId("");props.onOpenTask?.(projectId,taskId)}}/>}\n  </>;\n}\n\nexport const PreviewDocumentsWorkspace=((props:any)=><DocumentWorkspace {...props}/>) as ComponentType<any>;\n`;
  await write(path,source);
}

async function normalizeWorkspaceImpl(){
  const path="app/v2/document-preview-workspace-impl.tsx";
  let source=await read(path);
  source=source.replace('const isDrawing=(item:Deliverable)=>item.documentKind==="drawing"||Boolean(item.drawingCode?.trim());','const isDrawing=(item:Deliverable)=>item.documentKind==="drawing";');

  const oldSignature='export function PreviewDocumentsWorkspace({project,projects,tasks,initialDeliverableId,onInitialOpened,onOpenTask,onAddDeliverable,onOpenFilter,libraryMode="document"}:{project:V2Project|null;projects:V2Project[];tasks:ModuleTask[];initialDeliverableId?:string;onInitialOpened?:()=>void;onOpenTask:(projectId:string,taskId:string)=>void;onAddDeliverable:(projectId:string,taskId:string,mode?:"deliverable"|"drawing",deliverableId?:string)=>void;onOpenFilter:(config:WorkspaceFilterConfig)=>void;libraryMode?:LibraryMode}){';
  const newSignature='export function PreviewDocumentsWorkspace({project,projects,tasks,initialDeliverableId,onInitialOpened,onOpenTask,onAddDeliverable,onOpenFilter,libraryMode="document",onLibraryModeChange,onOpenDetail}:{project:V2Project|null;projects:V2Project[];tasks:ModuleTask[];initialDeliverableId?:string;onInitialOpened?:()=>void;onOpenTask:(projectId:string,taskId:string)=>void;onAddDeliverable:(projectId:string,taskId:string,mode?:"deliverable"|"drawing",deliverableId?:string)=>void;onOpenFilter:(config:WorkspaceFilterConfig)=>void;libraryMode?:LibraryMode;onLibraryModeChange?:(mode:LibraryMode)=>void;onOpenDetail?:(deliverableId:string)=>void}){';
  if(source.includes(oldSignature))source=source.replace(oldSignature,newSignature);
  else if(!source.includes('onLibraryModeChange'))throw new Error("document workspace signature not found");

  const navPattern=/<nav className="wv2-preview-tabs">.*?<\/nav>/s;
  const nav='<nav className="wv2-preview-tabs"><button className={activeTab==="library"&&libraryMode==="document"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("document")}}><FileText size={18}/>문서 라이브러리</button><button className={activeTab==="library"&&libraryMode==="drawing"?"active":""} onClick={()=>{setActiveTab("library");onLibraryModeChange?.("drawing")}}><FileText size={18}/>도면 라이브러리</button>{tabs.map(tab=><button key={tab.id} className={activeTab===tab.id?"active":""} onClick={()=>setActiveTab(tab.id)}><span>{tab.title}</span><X size={18} onClick={event=>{event.stopPropagation();closeTab(tab.id)}}/></button>)}<button className="add" onClick={()=>setActiveTab("library")}><Plus size={18}/></button></nav>';
  if(navPattern.test(source))source=source.replace(navPattern,nav);else throw new Error("document workspace tabs not found");

  if(!source.includes('onClick={()=>onOpenDetail?onOpenDetail(item.id):latest&&openPreview(item)}')){
    source=source.replace('onClick={()=>latest&&openPreview(item)}><Icon size={18}/>','onClick={()=>onOpenDetail?onOpenDetail(item.id):latest&&openPreview(item)}><Icon size={18}/>');
  }

  const oldLoad='const load=useCallback(()=>{if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;setLoading(true);setLoadingMore(false);loadedHistory.current.clear();historyRequests.current.clear();fetchList(0,controller.signal).then(data=>{setItems(data.deliverables??[]);setVersions(data.versions??[]);setTotal(Number(data.total||0));setRegisteredCount(Number(data.registeredCount||0));setMissingRequiredCount(Number(data.missingRequiredCount||0));setTotalRevisionCount(Number(data.totalRevisionCount||0));setHasMore(Boolean(data.hasMore));setCategories(data.categories??[]);setNotice("")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError")){setItems([]);setVersions([]);setTotal(0);setRegisteredCount(0);setMissingRequiredCount(0);setTotalRevisionCount(0);setHasMore(false);setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.")}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[workspaceStateReady,requestKey,fetchList]);';
  const newLoad='const load=useCallback(()=>{if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;setLoading(true);setLoadingMore(false);loadedHistory.current.clear();historyRequests.current.clear();fetch(`/api/deliverables?${requestKey}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json() as ListResponse;if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");return data}).then(data=>{setItems(data.deliverables??[]);setVersions(data.versions??[]);setTotal(Number(data.total||0));setRegisteredCount(Number(data.registeredCount||0));setMissingRequiredCount(Number(data.missingRequiredCount||0));setTotalRevisionCount(Number(data.totalRevisionCount||0));setHasMore(Boolean(data.hasMore));setCategories(data.categories??[]);setNotice("")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError")){setItems([]);setVersions([]);setTotal(0);setRegisteredCount(0);setMissingRequiredCount(0);setTotalRevisionCount(0);setHasMore(false);setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.")}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[workspaceStateReady,requestKey]);';
  if(source.includes(oldLoad))source=source.replace(oldLoad,newLoad);
  source=source.replace('>{loading?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:<div className="wv2-document-table wv2-preview-document-table"','>{loading&&!items.length?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:<div className="wv2-document-table wv2-preview-document-table"');
  await write(path,source);
}

async function normalizeDeliverableList(){
  const path="app/api/deliverables/route.ts";
  let source=await read(path);
  source=source.replace('const drawingIdentitySql="(COALESCE(d.drawing_code,\'\')<>\'\' OR COALESCE(d.document_kind,\'document\')=\'drawing\')";','const drawingIdentitySql="(COALESCE(d.document_kind,\'document\')=\'drawing\')";');
  await write(path,source);
}

function ensureImport(source,line,after){
  if(source.includes(line))return source;
  if(!source.includes(after))throw new Error(`import anchor not found: ${after}`);
  return source.replace(after,`${after}\n${line}`);
}

async function normalizeDeliverableLinks(){
  const path="app/api/projects/[projectId]/deliverable-links/route.ts";
  let source=await read(path);
  const anchor='import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";';
  source=ensureImport(source,'import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";',anchor);
  source=ensureImport(source,'import {getStorageAdapter} from "../../../../../lib/storage-adapter";',anchor);
  source=source.replace('async function runtime(){const runtime=await import("cloudflare:workers");return runtime.env as unknown as {DB:D1;FILES?:R2Bucket};}','async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}');
  if(source.includes('cloudflare:workers'))throw new Error("deliverable-links still contains cloudflare runtime");
  await write(path,source);
}

async function normalizeDwgConversionResult(){
  const path="app/api/projects/[projectId]/dwg-conversion-result/route.ts";
  let source=await read(path);
  const anchor='import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";';
  source=ensureImport(source,'import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";',anchor);
  source=ensureImport(source,'import {getStorageAdapter} from "../../../../../lib/storage-adapter";',anchor);
  source=source.replace('async function runtime(){const runtime=await import("cloudflare:workers");return runtime.env as unknown as {DB:D1;FILES?:R2Bucket};}','async function runtime(){return {DB:getLegacyDbCompat() as unknown as D1,FILES:getStorageAdapter() as unknown as R2Bucket};}');
  if(source.includes('cloudflare:workers'))throw new Error("dwg-conversion-result still contains cloudflare runtime");
  await write(path,source);
}

await normalizeWorkspaceBridge();
await normalizeWorkspaceImpl();
await normalizeDeliverableList();
await normalizeDeliverableLinks();
await normalizeDwgConversionResult();
console.log("Document/drawing module normalized: DOM bridge removed, drawing identity tightened, Workers storage routes moved to Node/PostgreSQL storage adapter.");
