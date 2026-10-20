import {randomUUID} from "node:crypto";
import {buildItSystemDemo,itSystemTemplate,itProjectProfile,selectDean} from "../scripts/demo-data/it-system-project.mjs";
import {itSystemDocumentSpecs} from "./it-system-demo-document-service.mjs";

export async function seedItSystemDemo(repository,storage,renderDocument,{companyId,asOf}={}){
  const written=[];
  try{return await repository.transaction(async tx=>{
    const companies=await tx.companies(),company=companyId?companies.find(row=>row.id===companyId):companies.length===1?companies[0]:null;
    if(!company)throw Error("대상 회사를 확정할 수 없습니다. PMS_COMPANY_ID를 지정하세요.");
    await tx.lock(company.id);
    const existing=await tx.project(company.id,itProjectProfile.code);
    if(existing)return {company:company.name,status:"skipped",name:existing.name,projectId:existing.id,message:"기존 프로젝트와 실적·문서를 유지했습니다."};
    const users=await tx.users(),dean=selectDean(users,company.id),people=users.filter(row=>row.companyId===company.id&&row.status==="active"&&row.id!==dean.id).sort((a,b)=>a.email.localeCompare(b.email));
    const calendar=await tx.calendar(company.id),demo=buildItSystemDemo(asOf,calendar),specs=itSystemDocumentSpecs(demo),now=Math.floor(Date.now()/1000);
    let template=await tx.template(company.id,itSystemTemplate.code);
    if(template){if(JSON.stringify(JSON.parse(template.definition))!==JSON.stringify(itSystemTemplate.definition))throw Error("기존 IT 템플릿이 변경되어 있습니다. 덮어쓰지 않고 중단합니다.");}
    else template=await tx.createTemplate(company.id,dean.id,itSystemTemplate);
    const exactPartners=await tx.partnerByName(company.id,itProjectProfile.customerName);if(exactPartners.length>1)throw Error("농협손해보험 거래처가 여러 건입니다. 공통 코드에서 거래처를 확인하세요.");
    let partner=exactPartners[0]||await tx.lookup("partners",company.id,"NH-INSURANCE-DEMO")||await tx.lookup("partners",company.id,"NH-INSURANCE");
    if(!partner){partner={id:randomUUID(),name:itProjectProfile.customerName};await tx.insert("partners",[{...partner,companyId:company.id,code:"NH-INSURANCE",category:"CUSTOMER",status:"active",createdAt:now,updatedAt:now}]);}
    else if(partner.status!=="active")throw Error("농협손해보험 거래처가 비활성 상태입니다. 거래처 정보를 확인하세요.");
    let type=await tx.lookup("projectTypes",company.id,itSystemTemplate.code);
    if(!type){type={id:randomUUID()};await tx.insert("projectTypes",[{...type,companyId:company.id,code:itSystemTemplate.code,name:"IT 시스템 개발",description:"IT 시스템 구축 및 개선 프로젝트",status:"active",createdAt:now,updatedAt:now}]);}
    else if(type.status!=="active")throw Error("IT 시스템 개발 프로젝트 유형이 비활성 상태입니다.");
    const projectId=randomUUID(),ids=new Map(demo.tasks.map(task=>[task.id,randomUUID()])),assignments=new Map(demo.definition.roles.map((role,i)=>[role,role==="PM"?dean.id:people.length?people[(i-1)%people.length].id:dean.id]));
    await tx.insert("projectsDb",[{id:projectId,companyId:company.id,templateVersionId:template.versionId,code:demo.profile.code,name:demo.profile.name,customerName:partner.name,partnerId:partner.id,projectTypeId:type.id,startDate:demo.startDate,endDate:demo.endDate,status:"active",templateSnapshot:JSON.stringify(demo.definition),createdAt:now,updatedAt:now}]);
    await tx.insert("projectProfiles",[{projectId,description:demo.profile.purpose+" 시연용 예시 자료이며 실제 고객 업무·계약 정보를 포함하지 않습니다.",referenceCode:"IT-SYSTEM-SEED-V1",visibility:"company",updatedAt:now}]);
    for(const [i,role] of demo.definition.roles.entries())if(!await tx.lookup("projectRoleCatalog",company.id,role))await tx.insert("projectRoleCatalog",[{id:randomUUID(),companyId:company.id,code:role,name:role,groupName:"프로젝트",required:role==="PM"?1:0,enabled:1,sortOrder:100+i,createdAt:now,updatedAt:now}]);
    await tx.insert("projectRoles",demo.definition.roles.map((code,i)=>({id:randomUUID(),projectId,code,name:code,sortOrder:i,createdAt:now,updatedAt:now})));
    const members=new Map([[dean.id,"PM"]]);for(const [role,userId] of assignments)if(!members.has(userId))members.set(userId,role);
    await tx.insert("projectMembers",[...members].map(([userId,projectRole])=>({projectId,userId,projectRole,createdAt:now,updatedAt:now})));
    await tx.insert("wbsTasks",demo.tasks.map(task=>({id:ids.get(task.id),projectId,wbsCode:task.id,parentId:ids.get(task.parentId)||null,level:task.level,sortOrder:task.sortOrder,kind:task.kind,name:task.name,taskType:task.taskType,durationDays:task.durationDays,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,predecessorId:ids.get(task.predecessor)||null,roleCode:task.kind==="task"?task.role:null,assigneeUserId:task.kind==="task"?assignments.get(task.role):null,progress:task.progress,status:task.status,completionActor:task.completionActor||"assignee",completionCriteria:task.completionCriteria,createdAt:now,updatedAt:now})));
    const baselineId=randomUUID();await tx.insert("projectBaselines",[{id:baselineId,projectId,version:1,name:"착수 기준 일정",capturedAt:Date.parse(demo.startDate+"T09:00:00+09:00")/1000,capturedBy:dean.id,isActive:1}]);
    await tx.insert("projectBaselineTasks",demo.tasks.map(task=>({baselineId,taskId:ids.get(task.id),wbsCode:task.id,name:task.name,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,durationDays:task.durationDays,sortOrder:task.sortOrder})));
    const slots=new Map();
    for(const task of demo.tasks.filter(row=>row.kind==="task")){
      const id=randomUUID(),count=specs.filter(row=>row.taskCode===task.id).length;slots.set(task.id,id);
      await tx.insert("deliverables",[{id,projectId,taskId:ids.get(task.id),name:task.deliverables[0].name,category:task.deliverables[0].type,documentKind:"document",required:1,status:task.upload?(task.complete?"approved":"submitted"):"planned",version:count?`Rev.${String(count).padStart(2,"0")}`:null,createdAt:now,updatedAt:now}]);
    }
    for(const spec of specs){
      const task=demo.tasks.find(row=>row.id===spec.taskCode),deliverableId=slots.get(task.id),versionId=randomUUID(),fileKey=`${projectId}/${deliverableId}/rev-${spec.revision}-${versionId}.docx`,previewFileKey=fileKey+"-preview.txt",bytes=await renderDocument(spec),stamp=Date.parse(spec.date+"T15:00:00+09:00")/1000+spec.revision;
      written.push(fileKey);await storage.put(fileKey,new Blob([bytes]),{httpMetadata:{contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}});
      written.push(previewFileKey);await storage.put(previewFileKey,spec.text,{httpMetadata:{contentType:"text/plain; charset=utf-8"}});
      await tx.insert("deliverableVersions",[{id:versionId,projectId,deliverableId,taskId:ids.get(task.id),revision:spec.revision,fileKey,fileName:spec.fileName,fileSize:bytes.length,contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",note:spec.note,createdBy:assignments.get(task.role),createdAt:stamp,previewFileKey,conversionStatus:"office_text_cached",convertedAt:stamp}]);
      await tx.setDeliverableFile(deliverableId,fileKey);
      if(task.complete)await tx.insert("deliverableReviews",[{id:randomUUID(),projectId,deliverableId,versionId,action:"approve",note:"문서 내용 및 필수 확인 항목 검토 완료",reviewedBy:dean.id,reviewedAt:stamp+60}]);
    }
    const actuals=[];
    for(const task of demo.tasks.filter(row=>row.kind==="task"&&row.progress>0)){
      const last=task.complete?task.plannedEnd:asOf,dates=[];for(let date=task.plannedStart;date<=last;){if(demo.dates.isWorking(date))dates.push(date);const next=new Date(date+"T00:00:00Z");next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10);}
      dates.forEach((date,index)=>actuals.push({id:randomUUID(),projectId,taskId:ids.get(task.id),userId:assignments.get(task.role),actualDate:date,actualHours:task.taskType==="gate"?1:4,progress:index===dates.length-1?task.progress:Math.min(task.progress,Math.round((index+1)/task.durationDays*80)),workNote:task.complete?`${task.name} 수행 및 산출물 검토 완료`:`${task.name} 검토 중. 권한 범위 확인 결과를 반영할 예정`,completed:task.complete&&index===dates.length-1?1:0,createdAt:Date.parse(date+"T18:00:00+09:00")/1000,updatedAt:now}));
    }
    await tx.insert("taskActuals",actuals);
    await tx.insert("projectGateDecisions",demo.tasks.filter(row=>row.taskType==="gate"&&row.complete).map(task=>({id:randomUUID(),projectId,gateTaskId:ids.get(task.id),gateCode:task.parentId,decision:"PASS",note:"단계별 업무 및 필수 산출물 확인 완료",decidedBy:dean.id,decidedAt:Date.parse(task.plannedEnd+"T17:00:00+09:00")/1000})));
    const active=demo.tasks.find(row=>row.status==="active"&&row.kind==="task");
    if(active)await tx.insert("projectIssues",[{id:randomUUID(),projectId,taskId:ids.get(active.id),issueType:"collaboration",title:"부서별 조회 권한과 첨부 접근 범위 검토 요청",description:"업무분석 결과에 보안 담당자의 검토 의견을 반영하고 요구사항 확정 전에 현업과 PM의 확인을 요청합니다.",severity:"medium",status:"open",ownerUserId:assignments.get("보안"),createdBy:dean.id,dueDate:demo.dates.next(asOf),createdAt:now,updatedAt:now}]);
    await tx.insert("auditLogs",[{id:randomUUID(),companyId:company.id,actorUserId:dean.id,action:"PROJECT_CREATED",entityType:"PROJECT",entityId:projectId,detail:JSON.stringify({source:"it-system-seed",asOf,templateCode:itSystemTemplate.code,documentVersions:specs.length}),createdAt:now}]);
    return {company:company.name,status:"created",name:demo.profile.name,projectId,pm:dean.name,template:itSystemTemplate.name,asOf,startDate:demo.startDate,endDate:demo.endDate,tasks:demo.tasks.length,completed:demo.tasks.filter(row=>row.complete).length,inProgress:demo.tasks.filter(row=>row.kind==="task"&&row.status==="active").length,documents:demo.tasks.filter(row=>row.upload).length,revisions:specs.length};
  });}catch(error){await Promise.allSettled(written.map(key=>storage.delete(key)));throw error;}
}
