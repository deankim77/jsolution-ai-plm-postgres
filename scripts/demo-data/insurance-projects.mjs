import {insuranceTemplates} from "./insurance-g6-templates.mjs";

export const insuranceDemoProfiles = [
  {code:"INS-CARE-DEMO",name:"간병인 보험상품 개발",templateCode:"INS-PRODUCT-G6",currentGate:4,delayedCodes:["G4-A02","G4-A03"],
    purpose:"간병인 사용 고객의 보장 이해와 보험금 청구 편의성을 높이는 신규 상품 개발. 보장·심사 수치는 확정 상품 조건이 아닌 가상 데모 가정이다.",
    stageContent:[
      ["고령층과 가족 보호자의 간병비 부담 및 서류 준비 불편을 조사했다. 목표 고객은 간병 서비스 이용 가능성을 대비하는 성인 고객이며, 실제 판매 대상·가입 조건은 별도 승인 대상이다.","기획·계리·보상·준법·영업·고객지원이 참여한다. Dean이 PM으로 범위·일정·Gate 승인 관리를 담당한다.","상품 콘셉트는 간병인 사용 사실과 비용 증빙을 명확히 안내하는 것이다. 상품 개발과 출시 준비를 포함하되 실제 판매·가격 확정은 데모 범위에 포함하지 않는다."],
      ["간병인 사용 사실, 입원 관련 확인 및 비용 증빙을 보장 요건 검토 대상으로 분리했다. 보장 범위와 제외 사항은 약관 검토 전 확정하지 않는다.","계리는 발생 빈도·이용 기간·청구 패턴을 가정 변수로 두고 민감도 분석 항목을 정리했다. 실제 보험료·손해율 및 수익성 수치는 제시하지 않는다.","보상은 청구 증빙 최소화, 준법은 설명의 명확성, 영업은 고객 안내 일관성을 요구했다. 요구사항별 담당 부서와 검토 결과를 추적한다."],
      ["약관 초안은 보장 대상, 지급 요건, 증빙, 제외·제한 사항, 고객 안내 순서로 구성했다. 모호한 표현은 검토 의견 목록으로 분리했다.","청구 접수 담당자는 증빙의 완결성을 확인하고 보상 담당자는 지급 요건을 검토한다. 확인이 어려운 건은 별도 검토자에게 이관하고 사유를 기록한다.","고객 안내 문구와 약관 문구의 불일치 여부를 교차 검토했다. 개인정보는 필요한 범위에서만 처리하고 실제 개인정보는 데모 문서에 포함하지 않았다."],
      ["판매·고객지원·보상 담당자가 공통 문서 번호로 동일한 상품 안내자료를 참조하도록 준비했다. 출시 전 업무 점검 시나리오의 초안을 완료했다.","상품 안내자료의 청구 증빙 안내 문구가 약관 검토 의견과 일치하는지 확인 중이다. 준법 회신 지연으로 최종 편집 및 매뉴얼 확정이 늦어지고 있다.","담당자 교육 교안은 기본 설명·청구 안내·예외 이관 순서로 구성했다. 안내자료 확정 지연으로 교육 확인본 작성이 대기 중이며 교육 일정은 재조정한다."],
      ["청약부터 계약 확인·청구 접수·보상 안내까지 가상 시나리오로 점검할 계획이다.","상품 유형에 따른 필요 심의·신고 등 적용 여부와 완료 상태를 담당 부서가 확인할 계획이다.","미비사항이 정리되면 Dean이 출시 준비 체크리스트를 취합하여 최종 승인을 요청한다."],
      ["판매 개시는 최종 승인 후 진행하는 계획 항목이다.","초기 문의와 청구 안내 오류를 수집하여 조치 담당자·기한을 관리할 계획이다.","확정 문서와 잔여 과제를 운영 부서에 인계하고 완료보고를 작성할 계획이다."],
    ],
    revisions:{
      "G2-A01":["청구 증빙 목록을 사용 사실 확인 자료와 비용 확인 자료로 구분하고 중복 제출 요청을 줄이는 확인 절차를 추가했다.","전자적 증빙으로 확인 가능한 경우 대체 제출 여부를 검토하도록 추가하고, 확인 불가 건의 보상 담당 이관 기준을 명시했다."],
      "G3-A01":["고객이 자주 묻는 보장 대상·제외 사항을 구분하는 안내 예시와 약관 용어 대조표를 추가했다.","간병인 사용 증빙이 일부 누락된 경우 보완 요청 문구와 처리 이력 기록 항목을 추가했다."],
      "G4-A02":["청구 접수부터 보완 요청까지의 단계별 안내 문구와 담당 부서 연락 흐름을 추가했다.","고객지원·보상 담당자 공통 체크리스트와 교육 확인 항목을 추가했다. 준법 최종 회신 전 검토본이며 확정본이 아니다."],
    },
    issueTitle:"청구 증빙 안내 문구 준법 검토 회신 지연",
    issueDetail:"G4-A02 안내자료와 G4-A03 교육 교안 확정에 영향. 준법 검토 의견을 반영한 Rev.03 검토본을 준비했으며 최종 회신 후 확정한다.",
  },
  {code:"INS-CANCER-DEMO",name:"암보험 개선 프로젝트",templateCode:"INS-IMPROVEMENT-G6",currentGate:5,delayedCodes:["G5-A02"],
    purpose:"기존 암보험의 고객 안내·청구 서류 보완·부서 간 이관 절차를 개선하는 업무 프로젝트. 보장 변경·요율 변경은 본 데모 범위에 포함하지 않는다.",
    stageContent:[
      ["암보험 청구 시 보완 서류 반복 안내와 부서 간 이관 누락을 개선 대상으로 선정했다.","기준 지표는 최초 접수 완결률, 추가 보완 요청률, 접수 후 안내 소요시간이다. 성과 수치는 실제 회사 실적이 아닌 가상 시범 자료로만 사용한다.","보상·고객지원·업무기획·준법 담당자가 착수 협의를 진행했다. Dean이 범위와 단계별 검토 결과를 관리한다."],
      ["현행 흐름은 청구 접수, 기본 서류 확인, 전문 검토 이관, 보완 안내, 결과 안내 순이다. 중복 확인과 담당 변경 시 인계 누락을 확인했다.","지연 원인은 서류 명칭의 부서별 차이, 보완 사유의 비표준 기록, 예외 건 이관 기준 부족으로 분류했다.","우선 개선 요구사항은 공통 서류 체크리스트, 보완 사유 코드, 담당자 인계 확인이다. 처리시간 측정 시작·종료 시점도 통일했다."],
      ["접수 담당자가 공통 체크리스트로 자료를 확인하고 예외 건은 보상 담당자에게 이관한다. 고객지원은 확정된 안내 문구만 사용한다.","업무 지침 초안에 일반 접수, 서류 보완, 추가 확인, 담당자 변경의 네 가지 흐름을 정의했다. 표준 서식은 보완 요청서와 인계 확인서다.","민감한 진단정보를 불필요하게 복사하지 않도록 검토했다. 접근 권한과 기록 보관은 기존 회사 정책 확인을 전제로 한다."],
      ["가상 시범 운영 범위는 고객지원과 보상 간 접수·보완 안내 업무다. 예외 건은 별도 검토 목록으로 분리했다.","담당자에게 공통 용어표, 체크리스트 사용법, 이관 확인 절차를 교육했다. 교육 결과와 질문·답변을 문서화했다.","가상 시범 표본 40건에서 최초 접수 완결 32건, 보완 요청 8건을 기록했다. 이는 실제 고객·실제 보험금 청구 데이터가 아닌 데모용 수치다."],
      ["동일한 가상 표본 규모 40건을 기준으로 개선 전 완결 24건에서 시범 운영 완결 32건으로 변화를 비교했다. 통계적 효과나 실제 성과를 입증하는 자료는 아니다.","고객지원 의견 중 예외 건 안내 문구와 인계 확인 누락 방지 항목을 보완 중이다. 보상 부서 추가 의견 취합 지연으로 결과서 확정이 늦어지고 있다.","확대 적용은 보완 조치와 Gate 승인을 전제로 한다. 적용 대상·교육 일정·점검 책임자는 확대 적용 계획에서 확정한다."],
      ["확대 적용 후 최초 접수 완결률과 보완 요청률을 동일한 정의로 점검할 계획이다.","개정 업무 지침·서식과 예외 이관 기준을 확정하여 운영 부서에 인계할 계획이다.","성과와 잔여 과제, 담당자별 후속 조치를 정리하여 최종 완료 승인을 요청할 계획이다."],
    ],
    revisions:{
      "G2-A01":["접수·보완·이관의 단계별 입력 항목을 추가하고 중복 요청이 발생하는 지점을 구분했다.","고객지원에서 보상으로 이관할 때 확인할 필수 항목과 접수 완결 여부 기록 기준을 추가했다."],
      "G3-A02":["공통 서류 체크리스트와 표준 보완 사유 코드를 추가하고 담당자 변경 시 인계 확인 절차를 신설했다.","보완 요청이 반복되는 경우의 검토자 이관 절차와 고객 안내 이력 확인 항목을 추가했다."],
      "G5-A01":["개선 전후 비교 표본을 각 40건으로 맞추고 최초 접수 완결률을 60%에서 80%로 비교했다. 모든 수치는 가상 데모 값이다.","보완 요청률 40%에서 20%로의 변화와 예외 건 별도 집계 기준을 추가했다. 표본의 한계와 실제 운영 성과로 해석하지 않는다는 유의사항을 명시했다."],
    },
    issueTitle:"예외 청구 건 안내·인계 기준 현업 의견 취합 지연",
    issueDetail:"G5-A02 보완 조치 결과서 확정 지연. 고객지원과 보상의 의견을 공통 체크리스트에 반영하고 G5 확대 적용 승인 전 검토를 마칠 예정이다.",
  },
];
export const addDays=(date,days)=>{const value=new Date(date+"T00:00:00Z");value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
export const businessDate=date=>{let value=date;while([0,6].includes(new Date(value+"T00:00:00Z").getUTCDay()))value=addDays(value,1);return value;};
export function previousBusinessDate(date){let value=date;while([0,6].includes(new Date(value+"T00:00:00Z").getUTCDay()))value=addDays(value,-1);return value;}
export function buildInsuranceDemo(profile,definition,asOf) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||new Date(asOf+"T00:00:00Z").toISOString().slice(0,10)!==asOf)throw Error("기준일 형식 오류");
  const tasks=definition.wbs.map((source,index)=>{
    const gate=Number(source.id.match(/^G(\d)/)[1]),activity=Number(source.id.match(/A(\d+)/)?.[1]||0),summary=source.kind==="summary",review=source.taskType==="gate";
    const complete=gate<profile.currentGate||(gate===profile.currentGate&&activity===1);
    let start,end,progress,status;
    if(gate<profile.currentGate){
      start=businessDate(addDays(asOf,-10+(gate-1)*2));
      end=businessDate(addDays(start,review?1:0));
      progress=100;status="completed";
    } else if(gate===profile.currentGate){
      start=previousBusinessDate(addDays(asOf,activity===1?-4:-3));
      end=review?businessDate(addDays(asOf,9)):activity===1?previousBusinessDate(addDays(asOf,-3)):profile.delayedCodes.includes(source.id)?previousBusinessDate(addDays(asOf,-(activity===2?3:1))):businessDate(addDays(asOf,6));
      progress=summary?0:review?0:activity===1?100:activity===2?70:40;status=summary?"active":review?"planned":activity===1?"completed":"active";
    } else {
      start=businessDate(addDays(asOf,14+(gate-profile.currentGate-1)*20+Math.max(0,activity-1)*4));
      end=businessDate(addDays(start,review?14:3));progress=0;status="planned";
    }
    if(summary){const children=definition.wbs.filter(item=>item.parentId===source.id);const done=gate<profile.currentGate;progress=done?100:gate===profile.currentGate?53:0;status=done?"completed":gate===profile.currentGate?"active":"planned";}
    return {...source,durationDays:summary?0:1,predecessor:review?`G${gate}-A03`:"",sortOrder:index,plannedStart:review?end:start,plannedEnd:end,progress,status,complete:!summary&&complete,upload:!summary&&(complete||(gate===profile.currentGate&&activity===2)),baselineEnd:profile.delayedCodes.includes(source.id)?previousBusinessDate(addDays(end,-3)):end};
  });
  for(const task of tasks.filter(item=>item.kind!=="summary")){let days=0;for(let d=task.plannedStart;d<=task.plannedEnd;d=addDays(d,1))if(![0,6].includes(new Date(d+"T00:00:00Z").getUTCDay()))days++;task.durationDays=Math.max(1,days);}
  for(const task of tasks.filter(item=>item.kind==="summary")){const children=tasks.filter(item=>item.parentId===task.id);task.plannedStart=children.map(item=>item.plannedStart).sort()[0];task.plannedEnd=children.map(item=>item.plannedEnd).sort().at(-1);task.progress=Math.round(children.reduce((sum,item)=>sum+item.progress,0)/children.length);}
  return {profile,asOf,startDate:addDays(asOf,-10),endDate:tasks.at(-1).plannedEnd,tasks};
}
export function planIdentityChanges(allUsers,companyId) {
  const changes=allUsers.filter(user=>user.companyId===companyId).map(user=>({...user,email:user.email.replace(/@jjjsolution\.com$/i,"@jsolution.io"),name:user.name.replace(/jjjsolution\.com/gi,"jsolution.io")})).filter(user=>{const old=allUsers.find(row=>row.id===user.id);return old.email!==user.email||old.name!==user.name;});
  const final=allUsers.map(user=>changes.find(row=>row.id===user.id)||user),emails=new Map();
  for(const user of final){const key=user.email.toLowerCase();if(emails.has(key)&&changes.some(row=>row.id===user.id||row.id===emails.get(key)))throw Error("변경 후 중복 로그인 이메일이 발생합니다. 계정을 병합하지 않고 중단합니다.");emails.set(key,user.id);}
  return changes;
}
export function selectDean(users,companyId) {
  const candidates=users.filter(user=>user.companyId===companyId&&user.status==="active"&&/^dean@(?:jjjsolution\.com|jsolution\.io)$/i.test(user.email));
  if(candidates.length!==1)throw Error("대상 회사에서 Dean 계정을 하나로 확정할 수 없습니다.");
  return candidates[0];
}
export const defaultInsuranceDefinitions=Object.fromEntries(insuranceTemplates.map(item=>[item.code,item.definition]));
