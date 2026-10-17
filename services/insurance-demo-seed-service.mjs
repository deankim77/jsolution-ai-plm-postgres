import {randomUUID} from "node:crypto";
import {insuranceDemoProfiles,buildInsuranceDemo,planIdentityChanges,selectDean,addDays,previousBusinessDate} from "../scripts/demo-data/insurance-projects.mjs";
import {insuranceDocumentSpecs} from "./insurance-demo-document-service.mjs";

export async function seedInsuranceDemos(repository,storage,renderDocument,{companyId,asOf,migrateUsers=true}={}) {
  const written=[];
  try {
    return await repository.transaction(async tx=>{
      const companies=await tx.companies();
      const company=companyId?companies.find(item=>item.id===companyId):companies.length===1?companies[0]:null;
      if(!company)throw Error("활성 회사를 하나로 확정할 수 없습니다. PMS_COMPANY_ID를 지정하세요.");
      await tx.lock(company.id);
      let allUsers=await tx.users();
      const dean=selectDean(allUsers,company.id);
      const changes=migrateUsers?planIdentityChanges(allUsers,company.id):[];
      const now=Math.floor(Date.now()/1000);
      // Validate both projects and templates before changing users or writing files.
      const plans=[];
      for(const profile of insuranceDemoProfiles){
        const existing=await tx.project(company.id,profile.code);
        if(existing){plans.push({profile,existing});continue;}
        const template=await tx.template(company.id,profile.templateCode);
        if(!template)throw Error("보험 템플릿이 없습니다. seed-insurance-templates.mjs --apply를 먼저 실행하세요.");
        const definition=JSON.parse(template.definition);
        if(definition.wbs?.length!==30||!definition.wbs.some(task=>task.id==="G6-REVIEW"))throw Error("보험 템플릿 구조가 예상과 다릅니다. 기존 템플릿을 확인하세요.");
        plans.push({profile,template,definition,demo:buildInsuranceDemo(profile,definition,asOf)});
      }
      for(const user of changes){
        const old=allUsers.find(item=>item.id===user.id);
        await tx.updateUser(company.id,user);
        await tx.insert("auditLogs",[{id:randomUUID(),companyId:company.id,actorUserId:dean.id,action:"USER_UPDATED",entityType:"USER",entityId:user.id,detail:JSON.stringify({source:"insurance-demo-domain-migration",before:{email:old.email,name:old.name},after:{email:user.email,name:user.name}}),createdAt:now}]);
      }
      allUsers=allUsers.map(user=>changes.find(item=>item.id===user.id)||user);
      const people=allUsers.filter(user=>user.companyId===company.id&&user.status==="active"&&user.id!==dean.id).sort((a,b)=>a.email.localeCompare(b.email));
      const results=[];
      const lookupOrCreate=async(table,code,name,extra={})=>{
        const existing=await tx.lookup(table,company.id,code);
        if(existing)return existing.id;
        const id=randomUUID();await tx.insert(table,[{id,companyId:company.id,code,name,...extra,createdAt:now,updatedAt:now}]);return id;
      };
      for(const plan of plans){
        const {profile}=plan;
        if(plan.existing){results.push({code:profile.code,status:"skipped"});continue;}
        const {definition,demo,template}=plan,projectId=randomUUID();
        const partnerId=await lookupOrCreate("partners","NH-INSURANCE-DEMO","농협손해보험 (가상 데모)",{category:"CUSTOMER",status:"active"});
        const typeId=await lookupOrCreate("projectTypes",profile.templateCode,profile.templateCode==="INS-PRODUCT-G6"?"신규 보험상품 개발":"손해보험 업무 개선",{description:"손해보험 가상 데모",status:"active"});
        const assignments=new Map(definition.roles.map((role,index)=>[role,role==="PM"?dean.id:people.length?people[(index-1+people.length)%people.length].id:dean.id]));
        await tx.insert("projectsDb",[{id:projectId,companyId:company.id,templateVersionId:template.versionId,code:profile.code,name:profile.name,customerName:"농협손해보험 (가상 데모)",partnerId,projectTypeId:typeId,startDate:demo.startDate,endDate:demo.endDate,status:"active",templateSnapshot:JSON.stringify(definition),createdAt:now,updatedAt:now}]);
        await tx.insert("projectProfiles",[{projectId,description:profile.purpose+" 가상 데모 데이터이며 실제 보험사의 업무·상품 정보가 아닙니다.",referenceCode:"INSURANCE-DEMO-V1",visibility:"company",updatedAt:now}]);
        for(const [index,role] of definition.roles.entries()){
          await lookupOrCreate("projectRoleCatalog",role,role,{groupName:"프로젝트",required:role==="PM"?1:0,enabled:1,sortOrder:100+index});
        }
        await tx.insert("projectRoles",definition.roles.map((code,index)=>({id:randomUUID(),projectId,code,name:code,sortOrder:index,createdAt:now,updatedAt:now})));
        const memberRoles=new Map([[dean.id,"PM"]]);
        for(const [role,userId]of assignments)if(!memberRoles.has(userId))memberRoles.set(userId,role);
        await tx.insert("projectMembers",[...memberRoles].map(([userId,projectRole])=>({projectId,userId,projectRole,createdAt:now,updatedAt:now})));
        const ids=new Map(demo.tasks.map(task=>[task.id,randomUUID()]));
        const rows=demo.tasks.map(task=>({id:ids.get(task.id),projectId,wbsCode:task.id,parentId:ids.get(task.parentId)||null,level:task.level,sortOrder:task.sortOrder,kind:task.kind,name:task.name,taskType:task.taskType||"normal",durationDays:task.durationDays,plannedStart:task.plannedStart,plannedEnd:task.plannedEnd,predecessorId:ids.get(task.predecessor)||null,roleCode:task.kind==="summary"?null:task.role,assigneeUserId:task.kind==="summary"?null:assignments.get(task.role),progress:task.progress,status:task.status,completionActor:task.taskType==="gate"?"PM":"assignee",completionCriteria:task.completionCriteria,createdAt:now,updatedAt:now}));
        await tx.insert("wbsTasks",rows);
        const baselineId=randomUUID();
        await tx.insert("projectBaselines",[{id:baselineId,projectId,version:1,name:"프로젝트 착수 기준 일정 · 가상 데모",capturedAt:Date.parse(demo.startDate+"T09:00:00+09:00")/1000,capturedBy:dean.id,isActive:1}]);
        await tx.insert("projectBaselineTasks",demo.tasks.map(task=>({baselineId,taskId:ids.get(task.id),wbsCode:task.id,name:task.name,plannedStart:task.baselineEnd<task.plannedStart?task.baselineEnd:task.plannedStart,plannedEnd:task.baselineEnd,durationDays:task.durationDays,sortOrder:task.sortOrder})));
        const slots=new Map();
        for(const task of demo.tasks.filter(item=>item.kind!=="summary")){
          const id=randomUUID();slots.set(task.id,id);
          await tx.insert("deliverables",[{id,projectId,taskId:ids.get(task.id),name:task.deliverables[0].name,category:task.deliverables[0].type,required:1,status:task.upload?(task.complete?"approved":"submitted"):"planned",version:task.upload?"Rev."+String(1+(profile.revisions[task.id]?.length||0)).padStart(2,"0"):null,createdAt:now,updatedAt:now}]);
        }
        const specs=insuranceDocumentSpecs(demo),latest=new Map();
        for(const spec of specs){
          const versionId=randomUUID(),deliverableId=slots.get(spec.taskCode),fileKey=projectId+"/"+deliverableId+"/rev-"+String(spec.revision).padStart(2,"0")+"-"+versionId+".docx",previewKey=fileKey+"-preview.txt";
          const bytes=await renderDocument(spec);
          written.push(fileKey);await storage.put(fileKey,new Blob([bytes]),{httpMetadata:{contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}});
          written.push(previewKey);await storage.put(previewKey,spec.text,{httpMetadata:{contentType:"text/plain; charset=utf-8"}});
          const stamp=Date.parse(spec.date+"T15:00:00+09:00")/1000;
          await tx.insert("deliverableVersions",[{id:versionId,projectId,deliverableId,taskId:ids.get(spec.taskCode),revision:spec.revision,fileKey,fileName:spec.fileName,fileSize:bytes.length,contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",note:spec.note,createdBy:assignments.get(demo.tasks.find(task=>task.id===spec.taskCode).role),createdAt:stamp,previewFileKey:previewKey,conversionStatus:"office_text_cached",convertedAt:stamp}]);
          latest.set(spec.taskCode,{versionId,fileKey,deliverableId,revision:spec.revision});
        }
        // File key and revision on the current slot are consumed by existing library queries.
        for(const [code,item]of latest){
          await tx.setDeliverableFile(item.deliverableId,item.fileKey);
          if(demo.tasks.find(task=>task.id===code).complete)await tx.insert("deliverableReviews",[{id:randomUUID(),projectId,deliverableId:item.deliverableId,versionId:item.versionId,action:"approve",note:"가상 데모 검토 완료",reviewedBy:dean.id,reviewedAt:now}]);
        }
        const actuals=demo.tasks.filter(task=>task.kind!=="summary"&&task.progress>0).map(task=>({id:randomUUID(),projectId,taskId:ids.get(task.id),userId:assignments.get(task.role),actualDate:previousBusinessDate(task.complete?task.plannedEnd:asOf),actualHours:task.complete?4:3,progress:task.progress,workNote:task.taskType==="gate"?"필수 문서·활동 확인 후 단계 승인 완료 · 가상 데모":profile.stageContent[Number(task.id[1])-1][Number(task.id.match(/A(\d+)/)[1])-1],completed:task.complete?1:0,createdAt:now,updatedAt:now}));
        await tx.insert("taskActuals",actuals);
        await tx.insert("projectGateDecisions",demo.tasks.filter(task=>task.taskType==="gate"&&task.complete).map(task=>({id:randomUUID(),projectId,gateTaskId:ids.get(task.id),gateCode:task.parentId,decision:"PASS",note:"단계별 실적·필수 산출물 확인 완료 · 가상 데모",decidedBy:dean.id,decidedAt:Date.parse(task.plannedEnd+"T17:00:00+09:00")/1000})));
        await tx.insert("projectIssues",[
          {id:randomUUID(),projectId,taskId:ids.get(profile.delayedCodes[0]),issueType:"issue",title:profile.issueTitle,description:profile.issueDetail,severity:"high",status:"in_progress",ownerUserId:assignments.get(demo.tasks.find(task=>task.id===profile.delayedCodes[0]).role),createdBy:dean.id,dueDate:addDays(asOf,3),createdAt:now,updatedAt:now},
          {id:randomUUID(),projectId,taskId:ids.get(profile.delayedCodes[0]),issueType:"collaboration",title:"관련 부서 검토 의견·보완 일정 회신 요청",description:"최신 리비전의 추가 항목을 검토하고 미확정 문구와 완료 예정일을 회신한다. 실제 고객 정보는 포함하지 않는다.",severity:"medium",status:"open",ownerUserId:dean.id,createdBy:dean.id,dueDate:addDays(asOf,2),createdAt:now,updatedAt:now},
        ]);
        await tx.insert("auditLogs",[{id:randomUUID(),companyId:company.id,actorUserId:dean.id,action:"PROJECT_CREATED",entityType:"PROJECT",entityId:projectId,detail:JSON.stringify({source:"insurance-demo",templateCode:profile.templateCode,asOf,documentVersions:specs.length}),createdAt:now}]);
        results.push({code:profile.code,name:profile.name,status:"created",tasks:rows.length,completed:actuals.filter(row=>row.completed).length,delayed:profile.delayedCodes.length,documents:latest.size,revisions:specs.length,pm:"Dean"});
      }
      return {company:company.name,asOf,identityChanges:changes.length,deanEmail:(changes.find(user=>user.id===dean.id)||dean).email,results};
    });
  } catch(error) {
    await Promise.allSettled(written.map(key=>storage.delete(key)));
    throw error;
  }
}
