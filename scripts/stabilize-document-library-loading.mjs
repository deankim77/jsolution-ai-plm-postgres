import {readFile,writeFile} from "node:fs/promises";

async function patchDocumentWorkspace(){
  const path="app/v2/document-preview-workspace-impl.tsx";
  let source=await readFile(path,"utf8");
  const before=source;

  const oldLoad='const load=useCallback(()=>{if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;setLoading(true);setLoadingMore(false);loadedHistory.current.clear();historyRequests.current.clear();fetchList(0,controller.signal).then(data=>{setItems(data.deliverables??[]);setVersions(data.versions??[]);setTotal(Number(data.total||0));setRegisteredCount(Number(data.registeredCount||0));setMissingRequiredCount(Number(data.missingRequiredCount||0));setTotalRevisionCount(Number(data.totalRevisionCount||0));setHasMore(Boolean(data.hasMore));setCategories(data.categories??[]);setNotice("")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError")){setItems([]);setVersions([]);setTotal(0);setRegisteredCount(0);setMissingRequiredCount(0);setTotalRevisionCount(0);setHasMore(false);setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.")}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[workspaceStateReady,requestKey,fetchList]);';

  const newLoad='const load=useCallback(()=>{if(!workspaceStateReady)return()=>{};const controller=new AbortController();requestKeyRef.current=requestKey;setLoading(true);setLoadingMore(false);loadedHistory.current.clear();historyRequests.current.clear();fetch(`/api/deliverables?${requestKey}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json() as ListResponse;if(!response.ok)throw new Error(data.error||"산출물을 불러오지 못했습니다.");return data}).then(data=>{setItems(data.deliverables??[]);setVersions(data.versions??[]);setTotal(Number(data.total||0));setRegisteredCount(Number(data.registeredCount||0));setMissingRequiredCount(Number(data.missingRequiredCount||0));setTotalRevisionCount(Number(data.totalRevisionCount||0));setHasMore(Boolean(data.hasMore));setCategories(data.categories??[]);setNotice("")}).catch(reason=>{if(!(reason instanceof DOMException&&reason.name==="AbortError")){setItems([]);setVersions([]);setTotal(0);setRegisteredCount(0);setMissingRequiredCount(0);setTotalRevisionCount(0);setHasMore(false);setNotice(reason instanceof Error?reason.message:"산출물을 불러오지 못했습니다.")}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[workspaceStateReady,requestKey]);';

  if(!source.includes(oldLoad))throw new Error("document workspace load block not found");
  source=source.replace(oldLoad,newLoad);

  const oldRender='>{loading?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:<div className="wv2-document-table wv2-preview-document-table"';
  const newRender='>{loading&&!items.length?<div className="wv2-preview-empty"><RefreshCw size={25}/><b>산출물을 불러오는 중…</b></div>:<div className="wv2-document-table wv2-preview-document-table"';
  if(!source.includes(oldRender))throw new Error("document workspace loading render block not found");
  source=source.replace(oldRender,newRender);

  if(source===before)throw new Error("document workspace unchanged");
  await writeFile(path,source,"utf8");
}

async function patchMyWorkTiming(){
  const path="app/api/my-work/route.ts";
  let source=await readFile(path,"utf8");
  const before=source;

  source=source.replace('  const totalStarted=Date.now();\n  const timings:Record<string,number>={};\n  const timed=async<T>(name:string,work:Promise<T>)=>{const started=Date.now();try{return await work}finally{timings[name]=Date.now()-started}};\n  const auth=await timed("auth",getChatGPTUser());\n  const db=await timed("db",runtimeDb());\n  let context;try{context=await timed("context",resolveRequestContext(request,db,{email:auth?.email}))}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}',
'  const auth=await getChatGPTUser();\n  const db=await runtimeDb();\n  let context;try{context=await resolveRequestContext(request,db,{email:auth?.email})}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}');

  source=source.replace('    timed("task",taskStatement.all()),\n    timed("count",countStatement.first<SummaryRow>()),\n    includeSummary?timed("summary",summaryStatement.first<SummaryRow>()):Promise.resolve(null),\n    timed("projects",projectsStatement.all<ProjectOption>()),',
'    taskStatement.all(),\n    countStatement.first<SummaryRow>(),\n    includeSummary?summaryStatement.first<SummaryRow>():Promise.resolve(null),\n    projectsStatement.all<ProjectOption>(),');

  source=source.replace('  timings.total=Date.now()-totalStarted;\n  const serverTiming=Object.entries(timings).map(([name,duration])=>`${name};dur=${duration}`).join(", ");\n  console.info("[MY_WORK_TIMING]",JSON.stringify({scope,includeSummary,limit,offset,...timings}));\n\n','');

  source=source.replace(',{headers:{"server-timing":serverTiming}}','');
  source=source.replace(', {headers:{"server-timing":serverTiming}}','');

  if(source===before)throw new Error("my-work timing block not found or unchanged");
  await writeFile(path,source,"utf8");
}

await patchDocumentWorkspace();
await patchMyWorkTiming();
console.log("Document library loading stabilized and MY_WORK timing debug removed.");
