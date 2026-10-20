"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {Download,Eye,Plus} from "lucide-react";
import {CommonProjectSelector} from "./common-project-selector";
import {ReportProjectSummary} from "./report-project-summary";
import {V2ListTable,type V2ListColumn} from "./v2-list-table";
import {useColumnFilters} from "./use-column-filters";
import {WorkPanelFrame} from "./work-panel-frame";
import {downloadAiArtifact} from "../ai-artifact-download";
import type {ArtifactPreviewData} from "../artifact-preview-view";
import type {V2Project} from "./project-workspaces";
import {buildReportDraft,reportContextLimit,type ReportDraftInput} from "../../lib/report-draft";
import {reportLabels,type ReportKind,type ReportResult} from "../../lib/report-results";
import "./reports-workspace.css";

export type ReportAiRequest=ReturnType<typeof buildReportDraft>&{autoSend?:boolean};
type Props={project:V2Project|null;projects:V2Project[];onAi:(request:ReportAiRequest)=>void;onPreview:(data:ArtifactPreviewData)=>void;};
const dateValue=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const createdDate=(row:ReportResult)=>dateValue(new Date(row.createdAt*1000));
const formatDate=(value:number)=>new Date(value*1000).toLocaleString("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});

export function ReportsWorkspace({project,projects,onAi,onPreview}:Props){
  const [items,setItems]=useState<ReportResult[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[hasMore,setHasMore]=useState(false),[nextOffset,setNextOffset]=useState(0),[opening,setOpening]=useState("");
  const [wide,setWide]=useState(true);
  const [creating,setCreating]=useState(false),[kind,setKind]=useState<ReportKind>("weekly"),[draftProjectId,setDraftProjectId]=useState(project?.id||"");
  const [from,setFrom]=useState(()=>{const date=new Date();date.setDate(date.getDate()-((date.getDay()+6)%7));return dateValue(date)}),[to,setTo]=useState(()=>{const date=new Date();date.setDate(date.getDate()+6-((date.getDay()+6)%7));return dateValue(date)});
  const [included,setIncluded]=useState({tasks:true,actuals:true,issues:true,deliverables:true,baseline:true});
  const [preparing,setPreparing]=useState(false),[prepared,setPrepared]=useState<ReportAiRequest|null>(null),[prepareError,setPrepareError]=useState("");
  const generation=useRef(0),preparation=useRef<AbortController|null>(null);
  const load=useCallback(async(offset=0)=>{
    const key=++generation.current;setLoading(true);setError("");
    try{const response=await fetch(`/api/reports?offset=${offset}`,{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error||"보고서를 불러오지 못했습니다.");if(key!==generation.current)return;setItems(current=>offset?[...current,...(data.reports??[]).filter((row:ReportResult)=>!current.some(item=>item.id===row.id))]:data.reports??[]);setHasMore(Boolean(data.hasMore));setNextOffset(data.nextOffset||0)}catch(reason){if(key===generation.current)setError(reason instanceof Error?reason.message:"보고서를 불러오지 못했습니다.")}finally{if(key===generation.current)setLoading(false)}
  },[]);
  useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener("jsolution-ai-conversation-updated",refresh);return()=>{generation.current++;preparation.current?.abort();window.removeEventListener("jsolution-ai-conversation-updated",refresh)}},[load]);
  const columnFilters=useColumnFilters(items,[{key:"project",label:"프로젝트",value:row=>row.projectId,options:projects.map(item=>({value:item.id,label:item.name}))},{key:"kind",label:"보고 유형",value:row=>reportLabels[row.kind]},{key:"period",label:"보고 기간",value:row=>row.period},{key:"author",label:"작성자",value:row=>row.author},{key:"created",label:"생성일",date:true,value:createdDate}],undefined,{project:project?.id?[project.id]:[]});
  useEffect(()=>{columnFilters.setSelection(current=>({...current,project:project?.id?[project.id]:[]}))},[project?.id,columnFilters.setSelection]);
  const visible=columnFilters.rows;
  const openResult=async(row:ReportResult,download=false)=>{
    if(opening)return;setOpening(row.id);setError("");
    try{const response=await fetch(`/api/reports?id=${encodeURIComponent(row.id)}`,{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error||"보고서를 열지 못했습니다.");const saved=data.reports?.[0] as ReportResult|undefined;if(!saved?.content)throw new Error("저장된 보고서 본문이 없습니다.");const fileBase=`${saved.projectCode}-${reportLabels[saved.kind]}-${createdDate(saved)}`;if(download)downloadAiArtifact(saved.format,saved.content,fileBase);else onPreview({type:saved.format,content:saved.content,title:saved.title,fileBase,generatedBy:saved.generatedBy})}catch(reason){setError(reason instanceof Error?reason.message:"보고서를 열지 못했습니다.")}finally{setOpening("")}
  };
  const closeCreate=()=>{preparation.current?.abort();setCreating(false);setPreparing(false);setPrepared(null);setPrepareError("")};
  const prepare=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(preparing)return;
    if(kind==="weekly"){
      const controller=new AbortController();preparation.current=controller;setPreparing(true);setPrepareError("");
      try{const response=await fetch("/api/reports/weekly",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId:draftProjectId,from,to}),signal:controller.signal}),data=await response.json();if(!response.ok)throw new Error(data.error||"주간보고서를 생성하지 못했습니다.");const saved=data.report as ReportResult;closeCreate();void load();onPreview({type:"pptx",content:saved.content||"",generatedBy:"system",title:saved.title,fileBase:`${saved.projectCode}-주간보고서-${from}`})}catch(reason){if(!controller.signal.aborted)setPrepareError(reason instanceof Error?reason.message:"주간보고서를 생성하지 못했습니다.")}finally{if(!controller.signal.aborted)setPreparing(false)}
      return;
    }
    if(prepared){onAi({...prepared,autoSend:true});closeCreate();return}
    const selected=projects.find(item=>item.id===draftProjectId);if(!selected||!from||!to||from>to||!Object.values(included).some(Boolean)){setPrepareError("프로젝트·보고 기간과 포함할 자료를 확인해 주세요.");return}
    const controller=new AbortController();preparation.current=controller;setPreparing(true);setPrepareError("");
    const read=async(url:string)=>{const response=await fetch(url,{cache:"no-store",signal:controller.signal}),data=await response.json();if(!response.ok)throw new Error(data.error||"선택한 자료를 불러오지 못했습니다.");return data};
    try{
      const [wbs,actuals,issues,deliverables,baseline]=await Promise.all([
        included.tasks?read(`/api/projects/${selected.id}/wbs`):null,
        included.actuals?read(`/api/reports/actuals?projectId=${encodeURIComponent(selected.id)}&from=${from}&to=${to}`):null,
        included.issues?read(`/api/projects/${selected.id}/issues`):null,
        included.deliverables?read(`/api/deliverables?projectId=${encodeURIComponent(selected.id)}`):null,
        included.baseline?read(`/api/projects/${selected.id}/baseline`):null,
      ]);
      if(controller.signal.aborted)return;
      setPrepared(buildReportDraft({project:selected,kind,from,to,...(wbs?{tasks:wbs.tasks}:{}),...(actuals?{actuals}:{}),...(issues?{issues:issues.issues}:{}),...(deliverables?{deliverables:deliverables.deliverables}:{}),...(baseline?{baseline}: {})} as ReportDraftInput));
    }catch(reason){if(!controller.signal.aborted)setPrepareError(reason instanceof Error?reason.message:"자료를 준비하지 못했습니다.")}finally{if(!controller.signal.aborted)setPreparing(false)}
  };
  const columns:V2ListColumn[]=useMemo(()=>[
    {key:"project",label:"프로젝트",width:320,header:columnFilters.heading("project")},
    {key:"kind",label:"보고 유형",width:150,header:columnFilters.heading("kind")},
    {key:"title",label:"보고서명",width:220,grow:true},
    {key:"period",label:"보고 기간",width:205,header:columnFilters.heading("period")},
    {key:"author",label:"작성자",width:100,header:columnFilters.heading("author")},
    {key:"created",label:"생성일",width:150,header:columnFilters.heading("created")},
    {key:"preview",label:"미리보기",width:90},
    {key:"open",label:"다운로드",width:90},
  ],[columnFilters]);
  return <section className="wv2-module wv2-reports-workspace">
    <header className="wv2-module-head"><div className="wv2-module-head-main"><small>REPORT · MEETING</small><div className="wv2-module-title-row"><h1>보고 · 회의</h1><p>주간보고서·회의 안건·Baseline 분석의 저장된 결과를 조회하고 활용합니다.</p></div></div><button className="primary" disabled={!projects.length} onClick={()=>{setDraftProjectId((columnFilters.selected.project?.length===1?columnFilters.selected.project[0]:project?.id)||projects[0]?.id||"");setPrepared(null);setPrepareError("");setWide(true);setCreating(true)}}><Plus size={18}/>보고서 작성</button></header>
    {project?.id&&<ReportProjectSummary key={project.id} projectId={project.id}/>}
    {error&&<p className="wv2-module-notice" role="alert">{error}</p>}
    <div className="wv2-module-toolbar" aria-label="보고서 조회 결과"><span>{visible.length}개 보고서</span></div>
    <V2ListTable label="보고 · 회의 결과 목록" columns={columns} empty={!visible.length?(loading?"저장된 보고서를 불러오는 중…":error?"보고서 조회에 실패했습니다.":items.length?"조회 조건에 맞는 결과가 없습니다.":"저장된 보고서가 없습니다. 보고서 작성에서 새 결과를 만들 수 있습니다."):undefined} footer={hasMore&&<div className="wv2-reports-more"><button disabled={loading} onClick={()=>void load(nextOffset)}>{loading?"불러오는 중…":"다음 결과 불러오기"}</button></div>}>
      {visible.map(row=><tr key={row.id}><td><span className="v2-list-cell" title={row.projectName}>{row.projectName}</span><small className="v2-list-cell" title={row.projectCode}>{row.projectCode}</small></td><td>{reportLabels[row.kind]}</td><td><button className="v2-list-name" disabled={Boolean(opening)} onClick={()=>void openResult(row)}><b>{row.title}</b><small>{row.format==="pptx"?"PPT 슬라이드":"문서"} 미리보기</small></button></td><td>{row.period}</td><td>{row.author}</td><td>{formatDate(row.createdAt)}</td><td><button className="v2-list-open" disabled={Boolean(opening)} title="미리보기" aria-label={`${row.title} 미리보기`} onClick={()=>void openResult(row)}><Eye size={18}/></button></td><td><button className="v2-list-open" disabled={Boolean(opening)} title="다운로드" aria-label={`${row.title} 다운로드`} onClick={()=>void openResult(row,true)}><Download size={18}/></button></td></tr>)}
    </V2ListTable>
    <p className="wv2-reports-note">현재 계정에 저장된 보고 결과입니다. 목록 조회·미리보기·다운로드는 AI를 다시 호출하지 않습니다.</p>
    {creating&&<WorkPanelFrame title={prepared?"AI 전송 자료 확인":"보고서 작성"} eyebrow="REPORT · MEETING" description={kind==="weekly"?"저장 데이터로 7개 항목의 주간보고 슬라이드를 작성합니다. AI 호출 없음.":prepared?"아래 요약을 확인한 뒤 AI 작성을 실행하세요.":"보고 기간과 필요한 자료를 선택하세요."} wide={wide} onWide={()=>setWide(value=>!value)} onClose={closeCreate}><section className="wv2-panel-body"><form className="wv2-form" onSubmit={prepare}>
      {prepared?<><p>{prepared.contextItems[0].meta.length.toLocaleString()}자 / 최대 {reportContextLimit.toLocaleString()}자 · 문서 원문 0개</p><pre className="wv2-reports-context">{prepared.contextItems[0].meta}</pre><div className="wv2-reports-more"><button type="button" onClick={()=>setPrepared(null)}>작성 조건 변경</button></div></>:<><CommonProjectSelector projects={projects} value={draftProjectId} onChange={setDraftProjectId} allowAll={false} allLabel="프로젝트 선택"/><label><span>보고 유형</span><select value={kind} onChange={event=>setKind(event.target.value as ReportKind)}>{Object.entries(reportLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="two"><label><span>보고 시작일</span><input required type="date" value={from} max={to} onChange={event=>{setFrom(event.target.value);if(kind==="weekly"&&event.target.value){const date=new Date(event.target.value+"T12:00:00");date.setDate(date.getDate()+6);setTo(dateValue(date))}}}/></label><label><span>보고 종료일</span><input required type="date" value={to} min={from} onChange={event=>setTo(event.target.value)}/></label></div><fieldset><legend>{kind==="weekly"?"주간보고서 구성":"포함할 자료"}</legend>{kind==="weekly"?<ol>{["프로젝트 전체 요약","금주 업무 진행·완료 현황","지연 업무 현황","미해결 이슈·리스크·협조 요청","산출물 제출 현황","다음 주 업무 계획","PM 확인·의사결정·지원 요청"].map(label=><li key={label}>{label}</li>)}</ol>:<>{([{key:"tasks",label:"현재 업무·진척 요약"},{key:"actuals",label:"보고 기간의 실적"},{key:"issues",label:"열린 이슈·담당자"},{key:"deliverables",label:"산출물 등록·미등록 요약"},{key:"baseline",label:"Baseline 변경·지연 요약"}] as const).map(item=><label className="wv2-check" key={item.key}><input type="checkbox" checked={included[item.key]} onChange={event=>setIncluded(current=>({...current,[item.key]:event.target.checked}))}/>{item.label}</label>)}</>}</fieldset><p>{kind==="weekly"?"7개 항목을 모두 작성합니다. 해당 사항 없음과 미등록을 구분하며, 업무가 많으면 슬라이드를 추가합니다. 보고 기간은 최대 7일입니다. 생성 후 목록에 저장하고 미리보기를 엽니다.":"자료 확인 단계에서는 AI를 호출하지 않습니다. 최종 ‘AI 작성’을 누르면 선택한 요약 자료로 한 번 요청합니다."}</p></>}
      {prepareError&&<p className="wv2-module-notice" role="alert">{prepareError}</p>}
      <button className="wv2-panel-save" disabled={preparing}>{preparing?"작성 중…":kind==="weekly"?"주간보고서 생성":prepared?"AI 작성":"전송 자료 확인"}</button>
    </form></section></WorkPanelFrame>}
  </section>;
}
