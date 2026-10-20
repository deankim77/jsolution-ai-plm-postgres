import {reportLabels,type ReportKind,type ReportProject} from "./report-results";
type Task={id:string;wbsCode:string;name:string;kind:string;progress:number;status:string;plannedEnd?:string;assigneeName?:string};
type Issue={title:string;severity:string;status:string;ownerName?:string;dueDate?:string};
type Output={name:string;required?:number|boolean;status:string};
type Comparison={wbsCode:string;name:string;baselineEnd?:string;currentEnd?:string;delayDays?:number};
export type ReportDraftInput={project:ReportProject;kind:ReportKind;from:string;to:string;tasks?:Task[];actuals?:{count:number;hours:number;details:unknown[]};issues?:Issue[];deliverables?:Output[];baseline?:{baseline:unknown;comparisons:Comparison[]}};
export const reportContextLimit=8000;
export function buildReportDraft(input:ReportDraftInput){
  const {project,kind,from,to}=input,clip=(value:string,size=120)=>value.slice(0,size),lines=[`보고 기간: ${from} ~ ${to}`,`유형: ${reportLabels[kind]}`,"선택한 저장 데이터의 요약이며, 전체 문서 원문과 과거 대화는 포함하지 않음."];
  if(input.tasks){const tasks=input.tasks.filter(task=>task.kind==="task"),delayed=tasks.filter(task=>!['completed','review'].includes(task.status)&&task.plannedEnd&&task.plannedEnd<to);lines.push(`현재 업무: 총 ${tasks.length}, 완료 ${tasks.filter(task=>task.status==="completed").length}, 현재 진척률 ${Math.round(tasks.reduce((sum,task)=>sum+task.progress,0)/Math.max(1,tasks.length))}%. 보고 종료일 대비 현재 미완료 지연 후보 ${delayed.length}건(과거 시점의 상태 복원 아님).`,...delayed.slice(0,8).map(task=>`${task.wbsCode} ${clip(task.name)} / 담당 ${task.assigneeName||"미지정"} / 계획 종료 ${task.plannedEnd}`));}
  if(input.actuals)lines.push(`기간 내 실적 ${input.actuals.count}건, ${input.actuals.hours}시간. 최근 최대 15건: ${clip(JSON.stringify(input.actuals.details),2500)}`);
  if(input.issues){const open=input.issues.filter(issue=>!['resolved','closed','completed'].includes(issue.status));lines.push(`현재 열린 이슈 ${open.length}건(기간과 무관한 현재 미해결 항목), 중요도순 최대 8건:`,...open.sort((a,b)=>(b.severity==="critical"?3:b.severity==="high"?2:1)-(a.severity==="critical"?3:a.severity==="high"?2:1)).slice(0,8).map(issue=>`${clip(issue.title)} / ${issue.severity} / ${issue.ownerName||"담당 미지정"} / ${issue.dueDate||"기한 미지정"}`));}
  if(input.deliverables){const registered=input.deliverables.filter(item=>['submitted','approved','completed'].includes(item.status)),missing=input.deliverables.filter(item=>item.required&&!['submitted','approved','completed'].includes(item.status));lines.push(`현재 산출물 등록 ${registered.length}/${input.deliverables.length}, 필수 미등록 ${missing.length}. 최대 8건: ${missing.slice(0,8).map(item=>clip(item.name)).join(" / ")}`);}
  if(input.baseline)lines.push(input.baseline.baseline?`Baseline 대비 변경·지연 최대 8건: ${clip(JSON.stringify(input.baseline.comparisons.filter(item=>Number(item.delayDays)>0||item.baselineEnd!==item.currentEnd).slice(0,8)),1800)}`:"시작 Baseline 없음");
  const meta=lines.join("\n").slice(0,reportContextLimit);
  const instructions={weekly:"전체 요약, 기간 내 진행·완료, Baseline 변경·지연 영향, 열린 중요 이슈, 산출물 현황, 다음 기간 계획·요청 순서",meeting:"우선순위별 회의 안건, 확인 근거, 결정할 사항, 담당자·기한별 후속조치 순서",schedule:"기준 종료일·현재 종료일·지연일수, 영향 근거, 확인이 필요한 후속 업무, 조치 우선순위 순서"};
  return {source:`보고 · 회의 · ${reportLabels[kind]}`,prompt:`${project.name}의 ${reportLabels[kind]}를 작성해줘. 보고 기간은 ${from} ~ ${to}. 첨부한 요약 데이터만 사용하고 미포함·미확인 사항은 명시해줘. ${instructions[kind]}로 간결하게 정리해줘. 확인되지 않은 담당자·기한·일정 영향은 만들지 마. 텍스트 보고 내용 뒤에 같은 내용의 PPT 슬라이드 구성을 "슬라이드 1: 제목" 형식으로 작성해줘.`,contextItems:[{id:project.id,kind:`보고서:${kind}`,title:project.name,meta}]};
}
