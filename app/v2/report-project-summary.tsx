"use client";

import {useEffect,useState} from "react";
type Task={kind:string;status:string;progress:number;plannedEnd?:string};
type Issue={status:string;severity:string};
type Deliverable={status:string;required?:boolean|number};
type Actual={totalHours?:number;latestActualDate?:string};
type Baseline={summary?:{delayed:number;changed:number;maxDelayDays:number}};
type Summary={progress:number;done:number;total:number;delayed:number;openIssues:number;importantIssues:number;registered:number;outputs:number;missing:number;hours:number;latest:string;baselineDelayed:number;changed:number;maxDelayDays:number};

export function summarizeReportProject(tasks:Task[],issues:Issue[],deliverables:Deliverable[],actuals:Actual[],baseline:Baseline,today:string):Summary{
  const leaf=tasks.filter(task=>task.kind==="task"),open=issues.filter(issue=>!["resolved","closed"].includes(issue.status));
  return {progress:Math.round(leaf.reduce((sum,task)=>sum+Number(task.progress||0),0)/Math.max(1,leaf.length)),done:leaf.filter(task=>task.status==="completed").length,total:leaf.length,delayed:leaf.filter(task=>task.status!=="completed"&&task.plannedEnd&&task.plannedEnd<today).length,openIssues:open.length,importantIssues:open.filter(issue=>["high","critical"].includes(issue.severity)).length,registered:deliverables.filter(item=>item.status==="submitted").length,outputs:deliverables.length,missing:deliverables.filter(item=>Boolean(item.required)&&item.status!=="submitted").length,hours:actuals.reduce((sum,item)=>sum+Number(item.totalHours||0),0),latest:actuals.map(item=>item.latestActualDate).filter((date):date is string=>Boolean(date)).sort().at(-1)||"실적 없음",baselineDelayed:baseline.summary?.delayed||0,changed:baseline.summary?.changed||0,maxDelayDays:baseline.summary?.maxDelayDays||0};
}

export function ReportProjectSummary({projectId}:{projectId:string}){
  const [summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    const read=async<T,>(url:string):Promise<T>=>{const response=await fetch(url,{cache:"no-store",signal:controller.signal}),data=await response.json();if(!response.ok)throw new Error(data.error||"프로젝트 요약을 불러오지 못했습니다.");return data};
    void Promise.all([
      read<{tasks:Task[]}>(`/api/projects/${projectId}/wbs`),
      read<{issues:Issue[]}>(`/api/projects/${projectId}/issues`),
      read<{deliverables:Deliverable[]}>(`/api/deliverables?projectId=${encodeURIComponent(projectId)}`),
      read<{summaries:Actual[]}>(`/api/projects/${projectId}/actuals`),
      read<Baseline>(`/api/projects/${projectId}/baseline`),
    ]).then(([wbs,issues,outputs,actuals,baseline])=>{if(!controller.signal.aborted)setSummary(summarizeReportProject(wbs.tasks??[],issues.issues??[],outputs.deliverables??[],actuals.summaries??[],baseline,new Date().toISOString().slice(0,10)))}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"프로젝트 요약을 불러오지 못했습니다.")});
    return()=>controller.abort();
  },[projectId]);
  return <>
    {error&&<p className="wv2-module-notice" role="alert">{error}</p>}
    <div className="wv2-module-summary" aria-label="프로젝트 보고 요약"><article><span>전체 진척률</span><b>{summary?`${summary.progress}%`:"—"}</b></article><article><span>Baseline 지연</span><b>{summary?.baselineDelayed??"—"}</b></article><article><span>열린 이슈</span><b>{summary?.openIssues??"—"}</b></article><article><span>필수 미등록</span><b>{summary?.missing??"—"}</b></article></div>
    {summary&&<div className="wv2-report-status"><span>완료 <b>{summary.done}/{summary.total}</b></span><span>현재일 지연 <b>{summary.delayed}</b></span><span>일정 변경 <b>{summary.changed}</b></span><span>최대 지연 <b>{summary.maxDelayDays}일</b></span><span>중요 이슈 <b>{summary.importantIssues}</b></span><span>등록 산출물 <b>{summary.registered}/{summary.outputs}</b></span><span>누적 공수 <b>{summary.hours}시간</b></span><span>최근 실적 <b>{summary.latest}</b></span></div>}
  </>;
}
