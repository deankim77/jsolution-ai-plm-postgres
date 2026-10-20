import {projectPlanProgress} from "../lib/project-plan-progress";

type Task={id:string;code:string;name:string;kind:string;taskType:string;status:string;progress:number;plannedStart?:string|null;plannedEnd?:string|null;owner?:string|null};
type Actual={taskId:string;date:string;progress:number;hours:number;note?:string|null;completed:number};
type Issue={id:string;taskId?:string|null;type:string;title:string;description?:string|null;status:string;severity:string;dueDate?:string|null;createdAt:number;owner?:string|null};
type Output={id:string;taskId?:string|null;name:string;required:number;status:string;version?:string|null;owner?:string|null};
export type WeeklyReportData={project:{id:string;code:string;name:string;startDate:string;endDate:string;pm?:string|null};tasks:Task[];actuals:Actual[];issues:Issue[];actions:{issueId:string;action:string;note?:string|null;createdAt:number}[];outputs:Output[];revisions:{deliverableId:string;revision:number;createdAt:number;fileName:string}[];baseline:{taskId:string;plannedEnd?:string|null}[]};
const day=(date:string)=>Date.parse(date+"T00:00:00Z")/86400000;
const days=(from:string,to:string)=>Math.max(0,Math.round(day(to)-day(from)));
const addDays=(date:string,count:number)=>new Date((day(date)+count)*86400000).toISOString().slice(0,10);
export const koreaDate=(seconds:number)=>new Date(seconds*1000+9*3600000).toISOString().slice(0,10);
const state=(value:string)=>({planned:"예정",active:"진행",completed:"완료",review:"완료 검토",hold:"보류",open:"열림",in_progress:"처리 중",resolved:"해결 확인",closed:"종료"}[value]||value);
const severity=(value:string)=>({critical:"심각",high:"높음",medium:"보통",low:"낮음"}[value]||value);
const text=(value:unknown)=>String(value??"").replace(/\s+/g," ").trim();

/** Complete seven-section report. Overflow becomes continuation slides, never omitted rows. */
export function buildWeeklyReport(data:WeeklyReportData,from:string,to:string,today:string){
  const {project}=data,tasks=data.tasks.filter(task=>task.kind==="task"),byId=new Map(tasks.map(task=>[task.id,task]));
  const slides:{title:string;body:string}[]=[];
  const push=(title:string,rows:string[])=>{
    const lines=rows.length?rows:["없음"];
    // Paragraphs remain intact. Width estimates are used only for page breaks,
    // not to inject newlines into dates, names or prose. The slide renderer wraps text.
    const width=(value:string)=>Array.from(value).reduce((sum,char)=>sum+(/\s/.test(char)?0.35:char.charCodeAt(0)<128?0.65:1),0);
    const visualLines=(value:string)=>{
      const result:string[]=[];let rest=value;
      while(rest){
        let end=0,used=0,lastSpace=0;
        for(const char of rest){const next=width(char);if(used+next>45)break;used+=next;end+=char.length;if(/\s/.test(char))lastSpace=end}
        if(end<rest.length&&lastSpace>0)end=lastSpace;
        end=Math.max(1,end);result.push(rest.slice(0,end));rest=rest.slice(end);
      }
      return result.length?result:[""];
    };
    let paragraphs:string[]=[],used=0,page=0;
    const flush=()=>{if(!paragraphs.length)return;slides.push({title:`${title}${page++?" (계속)":""}`,body:[`${project.name} · ${from} ~ ${to}`,...paragraphs].join("\n")});paragraphs=[];used=0};
    for(const line of lines){
      const paragraph=text(line),estimated=visualLines(paragraph);
      if(estimated.length<=12){if(used+estimated.length>12)flush();paragraphs.push(paragraph);used+=estimated.length}
      else{flush();for(let start=0;start<estimated.length;start+=12){paragraphs=[estimated.slice(start,start+12).join("")];used=Math.min(12,estimated.length-start);flush()}}
    }
    flush();
  };
  const inWeek=(date?:string|null)=>Boolean(date&&date>=from&&date<=to);
  const done=(task:Task)=>task.status==="completed";
  const delayed=tasks.filter(task=>!done(task)&&task.plannedEnd&&task.plannedEnd<today);
  const periodActuals=data.actuals.filter(item=>inWeek(item.date)&&item.date<=today);
  const open=data.issues.filter(item=>!["resolved","closed","completed"].includes(item.status));
  const plan=projectPlanProgress(tasks,today),actual=tasks.length?Math.round(tasks.reduce((sum,task)=>sum+Number(task.progress),0)/tasks.length):null;
  const taskLine=(task:Task)=>`• ${task.code} ${task.name} / ${task.owner||"담당 미배정"} / ${task.plannedStart||"시작일 미등록"} ~ ${task.plannedEnd||"종료일 미등록"} / ${state(task.status)} ${task.progress}%`;
  const important=open.filter(item=>["high","critical"].includes(item.severity));
  push("1. 프로젝트 전체 요약",[
    `프로젝트 ${project.code} / PM ${project.pm||"미배정"} / 전체 기간 ${project.startDate} ~ ${project.endDate}`,
    `상태 기준일 ${today} / 실적 조회 기간 ${from} ~ ${to}`,
    `계획 진척 ${plan===null?"산정 불가(업무 일정 미등록)":plan+"%"} / 실제 진척 ${actual===null?"업무 없음":actual+"%"} / 차이 ${plan===null||actual===null?"산정 불가":`${actual-plan>0?"+":""}${actual-plan}%p`}`,
    "진척 산식: 실행 Task 동일 가중 평균, 계획은 현재 일정의 날짜별 선형 진척(달력일).",
    `전체 ${tasks.length} / 완료 ${tasks.filter(done).length} / 진행 ${tasks.filter(task=>task.status==="active").length} / 완료 검토 ${tasks.filter(task=>task.status==="review").length} / 지연 ${delayed.length}건`,
    `미해결 이슈·리스크·협조 ${open.length}건 / 중요 미해결 ${important.length}건 / 금주 실적 ${periodActuals.length}건, ${periodActuals.reduce((sum,item)=>sum+Number(item.hours),0)}시간`,
    delayed.length||open.length?`확인 필요: 지연 업무 ${delayed.length}건, 미해결 사항 ${open.length}건. 상세 항목의 담당·기한 확인.`:"등록 데이터 기준 지연 업무·미해결 사항 없음.",
    "업무·이슈·산출물 상태는 생성 시점 기준. 과거 주간 선택 시 당시 상태를 복원하지 않음. AI 미사용.",
  ]);
  const weekly=tasks.filter(task=>(task.plannedStart&&task.plannedEnd&&task.plannedStart<=to&&task.plannedEnd>=from)||periodActuals.some(item=>item.taskId===task.id));
  push("2. 금주 업무 진행·완료 현황",weekly.flatMap(task=>{
    const entries=periodActuals.filter(item=>item.taskId===task.id),completion=data.actuals.filter(item=>item.taskId===task.id&&item.completed).at(-1);
    return [taskLine(task),`금주 종료 예정 ${inWeek(task.plannedEnd)?"해당":"아님"} / ${done(task)?`완료일 ${completion?.date||"미등록"}`:task.plannedEnd&&task.plannedEnd<today?`현재 ${days(task.plannedEnd,today)}일 지연`:"현재 종료기한 미도래"}`,...(entries.length?entries.map(item=>`실적 ${item.date} · ${item.hours}시간 · ${item.progress}% · ${text(item.note)||"내용 미등록"}`):["금주 등록 실적 없음"])]}));
  push("3. 지연 업무 현황",[
    "지연일수는 상태 기준일 대비 달력일. 완료 검토 중인 미승인 업무도 미완료에 포함.",
    ...(delayed.length?delayed.flatMap(task=>[taskLine(task),`${days(task.plannedEnd!,today)}일 지연 / ${task.plannedEnd!<from?"이전 주부터 누적":task.plannedEnd!>to?"보고 기간 이후 발생":"금주 발생"} / 별도 지연 사유·조치 계획 미등록`, `최근 등록 실적: ${text(data.actuals.filter(item=>item.taskId===task.id&&item.date<=today).at(-1)?.note)||"없음"} / 연결 미해결 사항: ${open.filter(item=>item.taskId===task.id).map(item=>item.title).join(", ")||"없음"}`]):["현재 지연 업무 없음"]),
    ...tasks.flatMap(task=>{const baseline=data.baseline.find(item=>item.taskId===task.id);return baseline?.plannedEnd&&task.plannedEnd&&baseline.plannedEnd!==task.plannedEnd?[`Baseline 변경 ${task.code} ${task.name}: ${baseline.plannedEnd} → ${task.plannedEnd} (${Math.round(day(task.plannedEnd)-day(baseline.plannedEnd))}일 변경). 후속 영향 별도 확인 필요.`]:[]}),
    ...(!data.baseline.length?["Baseline 미등록"]:[]),
  ]);
  const issueLines=(issue:Issue)=>{
    const registered=koreaDate(issue.createdAt),actions=data.actions.filter(item=>item.issueId===issue.id&&item.note),last=actions.at(-1);
    return [`• ${issue.title} / 중요도 ${severity(issue.severity)} / ${issue.owner||"담당 미배정"} / ${state(issue.status)}`,`등록 ${registered} · 미해결 ${days(registered,today)}일 · ${registered<from?"이전부터 계속 미해결":registered>to?"보고 기간 이후 등록":"금주 신규"} / 기한 ${issue.dueDate||"미등록"}${issue.dueDate&&issue.dueDate<today?` (${days(issue.dueDate,today)}일 초과)`:""}`,`내용: ${text(issue.description)||"미등록"}`,`최근 처리: ${last?`${koreaDate(last.createdAt)} ${text(last.note)}`:"회신 미등록"}`];
  };
  push("4. 미해결 이슈·리스크·협조 요청",[...[['issue','이슈'],['risk','리스크'],['collaboration','협조 요청']].flatMap(([type,label])=>{const items=open.filter(item=>item.type===type);return [`${label}: ${items.length?items.length+"건":"없음"}`,...items.flatMap(issueLines)]}),...open.filter(item=>!["issue","risk","collaboration"].includes(item.type)).flatMap(issueLines)]);
  const outputRows=data.outputs.flatMap(output=>{
    const task=output.taskId?byId.get(output.taskId):undefined,revisions=data.revisions.filter(item=>item.deliverableId===output.id),recent=revisions.filter(item=>inWeek(koreaDate(item.createdAt))),latest=revisions.at(-1);
    const registered=Boolean(latest)||["submitted","approved","completed"].includes(output.status),due=task?.plannedEnd;
    if(!inWeek(due)&&!recent.length&&!(output.required&&!registered))return [];
    return [`• ${output.name} / ${output.owner||task?.owner||"담당 미배정"} / 연결 업무 ${task?task.code+" "+task.name:"미연결"}`,`제출 예정 ${due||"미등록"}(연결 업무 종료일 기준) / ${registered?"등록":"미등록"}${!registered&&due&&due<today?` · ${days(due,today)}일 초과`:""} / ${output.required?"필수":"선택"} / 최신 Rev ${latest?.revision??output.version??"미등록"}`,...recent.map(revision=>`금주 등록 ${koreaDate(revision.createdAt)} · Rev.${revision.revision} · ${revision.fileName}`)];
  });
  push("5. 산출물 제출 현황",outputRows);
  const nextFrom=addDays(to,1),nextTo=addDays(to,7),nextTasks=tasks.filter(task=>!done(task)&&task.plannedStart&&task.plannedEnd&&task.plannedStart<=nextTo&&task.plannedEnd>=nextFrom);
  push("6. 다음 주 업무 계획",[`다음 주 ${nextFrom} ~ ${nextTo}`,...(nextTasks.length?nextTasks.flatMap(task=>[taskLine(task),`예정 산출물: ${data.outputs.filter(item=>item.taskId===task.id).map(item=>item.name).join(", ")||"미등록"}`]):["다음 주 일정에 등록된 업무 없음"]),...(delayed.length?[`누적 지연 ${delayed.length}건의 후속 일정·조치 계획 확인 필요(확정 계획을 자동 추정하지 않음).`]:[])]);
  const pending=open.filter(item=>item.type==="collaboration"||["high","critical"].includes(item.severity)||Boolean(item.dueDate&&item.dueDate<today));
  push("7. PM 확인·의사결정·지원 요청",[...(pending.length?pending.map(item=>`${item.type==="collaboration"?"협조 요청":"PM 확인 필요"}: ${item.title} / 요청 대상 ${item.owner||"미배정"} / 기한 ${item.dueDate||"미등록"} / ${state(item.status)}`):["미해결 중요·기한 초과·협조 요청 없음"]),...tasks.filter(task=>task.status==="review").map(task=>`완료 검토 필요: ${task.code} ${task.name} / ${task.owner||"미배정"}`),"위 항목은 등록된 미해결 사항·완료 검토에서 추린 확인 대상. 별도 의사결정·지원 요청 내용은 저장된 근거가 없으면 미등록."]);
  return slides.map((slide,index)=>`슬라이드 ${index+1}: ${slide.title}\n${slide.body}`).join("\n\n");
}
