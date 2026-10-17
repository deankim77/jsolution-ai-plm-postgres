import {addDays,previousBusinessDate} from "../scripts/demo-data/insurance-projects.mjs";

export function insuranceDocumentSpecs(demo) {
  return demo.tasks.filter(task=>task.upload).flatMap(task=>{
    const gate=Number(task.id.match(/^G(\d)/)[1]),activity=Number(task.id.match(/A(\d+)/)?.[1]||0);
    const changes=demo.profile.revisions[task.id]||[];
    return Array.from({length:1+changes.length},(_,index)=>{
      const revision=index+1,revisionDate=previousBusinessDate([task.plannedEnd,addDays(task.plannedStart,index),demo.asOf].sort()[1]);
      const facts=activity?demo.profile.stageContent[gate-1][activity-1]:`G${gate} 실행 업무 3건의 필수 산출물, 실적, 열린 이슈를 검토했다. 데모에서 해당 단계는 승인 완료 상태이며 다음 단계 진행을 허용한다.`;
      const sections=[
        {heading:"1. 목적·적용 범위",body:`${demo.profile.purpose} 본 문서는 ${task.name}에 대한 가상 데모 산출물이며 실제 농협손해보험의 약관·정책·승인 문서가 아니다.`},
        {heading:"2. 검토 내용·업무 결과",body:facts},
        {heading:"3. 확인 기준·담당 역할",body:`담당 역할: ${task.role}. PM: Dean. 관련 업무: ${task.id}. 문서와 업무 실적을 함께 확인하고 미확정 사항은 검토 목록에 남긴다. ${task.complete?"해당 업무는 완료했고 필수 문서 검토를 마쳤다.":"현재 검토 중인 초안이다. 최종 확인 전 승인 문서로 사용하지 않는다."}`},
        ...changes.slice(0,index).map((body,n)=>({heading:`${4+n}. Rev.${String(n+2).padStart(2,"0")} 추가·변경 사항`,body})),
        {heading:"후속 조치",body:demo.profile.delayedCodes.includes(task.id)?demo.profile.issueDetail:"이후 단계에서 본 문서의 결정 사항과 관련 산출물의 일치 여부를 확인하고 변경이 있으면 새 리비전으로 기록한다."},
      ];
      return {taskCode:task.id,name:task.deliverables[0].name,revision,date:revisionDate,
        fileName:`${demo.profile.code}_${task.id}_Rev${String(revision).padStart(2,"0")}.docx`,
        note:index?changes[index-1]:"최초 작성 · 가상 보험업무 데모 산출물",
        document:{title:task.deliverables[0].name,subtitle:demo.profile.name+" · 가상 데모",headerLabel:"JSOLUTION AI PMS · 손해보험 G1~G6 데모",
          metadata:{"문서 번호":demo.profile.code+"-"+task.id,"리비전":"Rev."+String(revision).padStart(2,"0"),"작성일":revisionDate,"PM":"Dean","관련 업무":task.id,"문서 상태":task.complete?"데모 검토 완료":"데모 검토 중"},sections,decision:task.complete?"가상 프로젝트의 단계별 검토 완료":"검토본 · 후속 의견 반영 후 확정"},
        text:sections.map(section=>section.heading+"\n"+section.body).join("\n\n"),
      };
    });
  });
}
