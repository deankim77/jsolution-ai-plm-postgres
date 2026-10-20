import {addDays,selectDean} from "./insurance-projects.mjs";
export {selectDean};

const stages=[
  ["착수 및 계획",[["프로젝트 착수 및 추진계획 수립","PM",1,"프로젝트 착수계획서"],["업무 범위 및 추진 조직 확정","업무분석",1,"업무 범위 정의서"],["일정 및 품질관리 기준 수립","PM",1,"프로젝트 수행계획서"]],"착수계획 승인"],
  ["요구사항 분석",[["현행 업무 및 사용자 요구사항 조사","업무분석",1,"사용자 요구사항 정의서"],["기능 범위 및 인터페이스 요건 정리","업무분석",2,"기능 및 연계 요건 정의서"],["보안 및 개인정보 처리요건 검토","보안",1,"보안 요건 검토서"]],"요구사항 확정 승인"],
  ["시스템 설계",[["화면 및 업무 흐름 설계","설계",3,"화면 및 업무 흐름 설계서"],["데이터 및 인터페이스 설계","설계",3,"데이터 및 인터페이스 설계서"],["설계 검토 및 테스트 계획 수립","품질",2,"설계 검토 및 테스트 계획서"]],"설계 완료 승인"],
  ["개발 및 단위검증",[["공통 기능 및 권한 기능 개발","개발",5,"공통 기능 구현 명세서"],["업무 기능 및 연계 기능 개발","개발",5,"업무 기능 구현 명세서"],["단위 테스트 및 결함 보완","품질",3,"단위 테스트 결과서"]],"개발 및 단위검증 완료 승인"],
  ["통합검증 및 인수",[["통합 및 연계 테스트 수행","품질",3,"통합 테스트 결과서"],["사용자 인수검증 및 결함 조치","현업",2,"사용자 인수검증 결과서"],["전환 점검 및 운영 준비 확인","운영",2,"운영 전환 점검표"]],"운영 전환 승인"],
  ["오픈 및 안정화",[["서비스 오픈 및 전환 확인","운영",1,"서비스 오픈 확인서"],["초기 운영 안정화 및 잔여 결함 조치","운영",3,"안정화 점검 결과서"],["운영 인계 및 프로젝트 완료보고","PM",1,"운영 인계 및 완료보고서"]],"프로젝트 완료 승인"],
];
let previousGate="";
const wbs=stages.flatMap(([name,activities,approval],index)=>{
  const code=`G${index+1}`;let previous=previousGate;
  const tasks=activities.map(([name,role,durationDays,document],n)=>{const id=`${code}-A0${n+1}`,row={id,parentId:code,level:2,kind:"task",taskType:"normal",name,role,durationDays,predecessor:previous,completionActor:"assignee",completionCriteria:"PROGRESS,REQUIRED_UPLOAD",deliverables:[{name:document,type:"COMMON_REFERENCE",required:true,documentKind:"document"}]};previous=id;return row;});
  // A single predecessor is supported. Gate milestones form the explicit G1→G6 chain;
  // the approval date follows the stage's activities, and Gate checks review stage evidence.
  const gate={id:`${code}-REVIEW`,parentId:code,level:2,kind:"task",taskType:"gate",name:`${code} Gate ${approval}`,role:"PM",durationDays:1,predecessor:previousGate,completionActor:"PM",completionCriteria:"PROGRESS,REQUIRED_UPLOAD,REQUIRED_APPROVAL,GATE_APPROVAL",deliverables:[{name:`${code} 단계 검토 및 승인 기록`,type:"APPROVAL_GATE",required:true,documentKind:"document"}]};
  previousGate=gate.id;
  return [{id:code,level:1,kind:"summary",taskType:"normal",name:`${code} ${name}`,durationDays:0,role:"PM",completionCriteria:"CHILD_COMPLETE"},...tasks,gate];
});
export const itSystemTemplate={code:"IT-SYSTEM-G6",name:"IT 시스템 개발 표준 프로젝트",version:"v1.0",status:"active",definition:{description:"일반 IT 시스템 개발을 위한 G1~G6 표준안. 2레벨, 단계별 실행 업무 3개와 Gate 승인 1개. 기간은 근무일 기준 예시다. Gate는 G1부터 G6까지 직접 선후행으로 연결하며 각 단계 실행 업무 이후에 승인일을 배치한다.",roles:["PM","업무분석","설계","개발","품질","보안","현업","운영"],wbs}};
export const itProjectProfile={code:"IT-INS-SYSTEM",name:"보험업무 통합관리 시스템 구축",customerName:"농협손해보험",purpose:"보험업무의 요청 접수, 검토 이력, 처리 현황을 한곳에서 관리하는 내부 시스템을 구축한다. 실제 계약정보와 보험금 청구 원문을 다루는 기능은 제외한다."};

export function createDemoCalendar(calendar={}){
  const working=new Set(calendar.workingDays||[1,2,3,4,5]),holidays=new Set((calendar.holidays||[]).map(row=>row.date||row.holidayDate));
  if(!working.size||[...working].some(day=>!Number.isInteger(day)||day<0||day>6))throw Error("회사 근무요일 설정을 확인하세요.");
  const isWorking=date=>working.has(new Date(date+"T00:00:00Z").getUTCDay())&&!holidays.has(date);
  const next=(date,include=false)=>{let result=include?date:addDays(date,1),guard=0;while(!isWorking(result)){if(++guard>3660)throw Error("근무일을 찾을 수 없습니다.");result=addDays(result,1)}return result;};
  const end=(start,duration)=>{let result=next(start,true);for(let n=1;n<duration;n++)result=next(result);return result;};
  const elapsed=(start,end)=>{let count=0;for(let date=start;date<=end;date=addDays(date,1))if(isWorking(date))count++;return count;};
  return {isWorking,next,end,elapsed};
}
export function buildItSystemDemo(asOf,calendar={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf+"T00:00:00Z"))||new Date(asOf+"T00:00:00Z").toISOString().slice(0,10)!==asOf)throw Error("IT_DEMO_DATE는 YYYY-MM-DD 형식이어야 합니다.");
  const dates=createDemoCalendar(calendar),startDate=addDays(asOf,-7);let cursor=dates.next(startDate,true);
  const tasks=itSystemTemplate.definition.wbs.map((source,index)=>{
    if(source.kind==="summary")return {...source,sortOrder:index,progress:0,status:"planned"};
    const plannedStart=cursor,plannedEnd=dates.end(cursor,source.durationDays);cursor=dates.next(plannedEnd);
    const complete=plannedEnd<asOf,started=!complete&&plannedStart<=asOf&&source.taskType!=="gate",progress=complete?100:started?Math.max(20,Math.min(80,Math.round(dates.elapsed(plannedStart,asOf)/source.durationDays*60))):0;
    return {...source,sortOrder:index,plannedStart,plannedEnd,progress,status:complete?"completed":started?"active":"planned",complete,upload:complete||started,baselineStart:plannedStart,baselineEnd:plannedEnd};
  });
  for(const group of tasks.filter(row=>row.kind==="summary")){const children=tasks.filter(row=>row.parentId===group.id);group.plannedStart=children[0].plannedStart;group.plannedEnd=children.at(-1).plannedEnd;group.progress=Math.round(children.reduce((sum,row)=>sum+row.progress,0)/children.length);group.status=children.every(row=>row.complete)?"completed":children.some(row=>row.progress>0)?"active":"planned";}
  return {profile:itProjectProfile,definition:itSystemTemplate.definition,asOf,startDate,endDate:tasks.at(-1).plannedEnd,tasks,dates};
}
