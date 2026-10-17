// Generic insurance demo templates; not an insurer's internal procedures.
const productStages = [
  ["착수·상품 기획", [
    ["시장·고객 수요 및 경쟁상품 조사", "상품기획", 5, "시장·고객 수요 조사서"],
    ["상품 개발 목표·범위 및 추진 조직 확정", "PM", 3, "상품 개발 추진계획서"],
    ["상품 콘셉트·목표 고객 및 추진 일정 수립", "상품기획", 4, "상품 기획안"],
  ], "상품 기획 승인"],
  ["상품 구조·개발 요건 확정", [
    ["보장 범위·가입 대상 및 가입 조건 정의", "상품기획", 5, "상품 개발 요건 정의서"],
    ["보험료·손해율 가정 및 사업성 검토", "계리", 7, "보험료·사업성 검토서"],
    ["인수·보상·준법 관련 요건 협의", "준법", 4, "부서별 요건 협의서"],
  ], "상품 구조·개발 요건 승인"],
  ["상품 상세안·운영 기준 수립", [
    ["약관·상품설명서 초안 작성", "상품기획", 7, "약관·상품설명서 초안"],
    ["인수심사·보험금 지급 기준 수립", "보상", 5, "인수·보상 운영 기준서"],
    ["계약자 안내·소비자 보호 및 준법 검토", "준법", 5, "상품 상세안 검토서"],
  ], "상품 상세안 승인"],
  ["출시·판매 준비", [
    ["판매 채널·계약 및 보상 처리 준비", "영업", 7, "판매·업무 운영 준비 점검표"],
    ["상품 안내자료·업무 매뉴얼 작성", "상품기획", 5, "상품 안내자료·업무 매뉴얼"],
    ["판매·고객지원·보상 담당자 교육", "영업", 3, "담당자 교육 결과서"],
  ], "출시 준비 완료 확인"],
  ["출시 검증·최종 승인", [
    ["청약·계약·보상 업무 시나리오 점검", "보상", 4, "출시 전 업무 점검 결과서"],
    ["심의·신고 등 해당 절차 완료 여부 확인", "준법", 3, "상품별 필요 절차 확인서"],
    ["미비사항 보완 및 출시 계획 확정", "PM", 3, "출시 계획·보완 완료서"],
  ], "상품 출시 승인"],
  ["상품 출시·초기 운영", [
    ["판매 개시 및 채널별 출시 현황 확인", "영업", 2, "상품 출시 확인서"],
    ["초기 계약·고객 문의 및 보상 운영 점검", "고객지원", 10, "초기 운영 점검 결과서"],
    ["운영 인계·출시 성과 및 완료보고", "PM", 3, "운영 인계서·상품 개발 완료보고서"],
  ], "초기 운영·프로젝트 완료 승인"],
];

const improvementStages = [
  ["개선 착수·목표 수립", [
    ["개선 대상 업무·문제 및 범위 선정", "업무기획", 3, "업무 개선 과제 정의서"],
    ["목표 지표·측정 기준 및 추진 조직 확정", "PM", 3, "업무 개선 추진계획서"],
    ["현업·관련 부서 착수 협의", "업무기획", 2, "착수 협의 결과서"],
  ], "개선 추진계획 승인"],
  ["현황·원인 분석", [
    ["현행 업무 절차·역할 및 처리 실적 조사", "현업", 5, "현행 업무 분석서"],
    ["지연·반복 처리·고객 불편 원인 분석", "업무기획", 4, "문제·원인 분석서"],
    ["개선 요구사항·우선순위 및 기준값 확정", "업무기획", 3, "개선 요구사항·기준 지표표"],
  ], "현황 분석·개선 요건 승인"],
  ["개선 실행안 수립", [
    ["개선 업무 절차·부서별 역할 설계", "업무기획", 5, "개선 업무 절차·역할 정의서"],
    ["업무 지침·표준 서식 및 예외 처리안 작성", "현업", 4, "개정 업무 지침·표준 서식 초안"],
    ["준법·소비자 보호·정보보호 영향 검토", "준법", 3, "개선안 관련 부서 검토서"],
  ], "개선 실행안 승인"],
  ["시범 적용·운영", [
    ["시범 적용 대상·기간 및 운영 계획 확정", "PM", 3, "시범 운영 계획서"],
    ["현업 담당자 교육·적용 준비", "현업", 2, "교육 결과·적용 준비 점검표"],
    ["개선 절차 시범 운영·문제점 수집", "현업", 10, "시범 운영 기록·문제점 목록"],
  ], "시범 운영 완료 확인"],
  ["효과 검증·보완", [
    ["처리시간·재처리율 등 개선 전후 지표 비교", "업무기획", 4, "개선 전후 성과 비교표"],
    ["현업·고객지원 의견 수렴 및 미비점 보완", "고객지원", 4, "의견 수렴·보완 조치 결과서"],
    ["확대 적용 범위·일정 및 관리 기준 확정", "PM", 3, "확대 적용 계획서"],
  ], "개선 효과·확대 적용 승인"],
  ["확대 적용·운영 정착", [
    ["개선 업무 확대 적용 및 정착 상태 점검", "현업", 7, "확대 적용·정착 점검 결과서"],
    ["업무 지침·표준 서식 확정 및 운영 인계", "업무기획", 3, "개정 업무 지침·표준 서식·운영 인계서"],
    ["성과·잔여 과제 정리 및 완료보고", "PM", 2, "업무 개선 완료보고서"],
  ], "업무 개선·프로젝트 완료 승인"],
];

function buildTemplate(code, name, stages) {
  const roles = ["PM", ...new Set(stages.flatMap(stage => stage[1].map(task => task[1])))].filter((role,index,all)=>all.indexOf(role)===index);
  let previousGate = "";
  const wbs = stages.flatMap(([name,tasks,approval],index) => {
    const gate = `G${index+1}`;
    let predecessor = previousGate;
    const children = tasks.map(([taskName,role,durationDays,deliverable],taskIndex) => {
      const id = `${gate}-A${String(taskIndex+1).padStart(2,"0")}`;
      const task = {id,parentId:gate,level:2,kind:"task",taskType:"normal",name:taskName,durationDays,predecessor,role,completionActor:"assignee",completionCriteria:"PROGRESS,REQUIRED_UPLOAD",deliverables:[{name:deliverable,type:"COMMON_REFERENCE",required:true,documentKind:"document"}]};
      predecessor = id;
      return task;
    });
    const reviewId = `${gate}-REVIEW`;
    const review = {id:reviewId,parentId:gate,level:2,kind:"task",taskType:"gate",name:`${gate} Gate · ${approval}`,durationDays:1,predecessor,role:"PM",completionActor:"PM",completionCriteria:"PROGRESS,REQUIRED_UPLOAD,REQUIRED_APPROVAL,GATE_APPROVAL",deliverables:[{name:`${gate} 단계 검토·승인 기록`,type:"APPROVAL_GATE",required:true,documentKind:"document"}]};
    previousGate = reviewId;
    return [{id:gate,level:1,kind:"summary",taskType:"normal",name:`${gate} ${name}`,durationDays:0,role:"PM",completionCriteria:"CHILD_COMPLETE"},...children,review];
  });
  return {code,name,version:"v1.0",status:"active",definition:{description:"손해보험사 데모용 표준안. 특정 회사의 실제 내부 절차가 아닙니다. G1~G6, 2레벨, 단계별 실행 업무 3개와 Gate 승인 1개. 기간은 영업일 기준 예시이며 프로젝트 생성 시 조정합니다. 상품별 심의·신고 등 적용 절차는 담당 부서 확인이 필요합니다.",roles,wbs}};
}

export const insuranceTemplates = [
  buildTemplate("INS-PRODUCT-G6","신규 보험상품 개발 프로젝트",productStages),
  buildTemplate("INS-IMPROVEMENT-G6","손해보험 업무 개선 프로젝트",improvementStages),
];
