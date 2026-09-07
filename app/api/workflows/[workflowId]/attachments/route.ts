/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getStorageAdapter} from "../../../../../lib/storage-adapter";
import {nowSeconds,parseJson,workflowDb,workflowDetail} from "../../shared";

type StoredObject={body:ReadableStream;httpMetadata?:{contentType?:string}};
type Storage={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:unknown)=>Promise<unknown>;get:(key:string)=>Promise<StoredObject|null>};

type StepAttachment={id:string;fileKey:string;fileName:string;fileSize:number;contentType?:string;stepId:string;stepOrder:number;stepName:string;createdAt:number;createdBy:string};

const canAttach=(detail:any,context:any)=>{
  const w=detail.workflow,steps=detail.steps??[],current=steps.find((step:any)=>Number(step.step_order)===Number(w.current_step_order));
  const isAdmin=context.systemRoles.some((role:string)=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  return Boolean(isAdmin||(w.status==="in_progress"&&current?.assignee_user_id===context.userId)||(["draft","supplement","recalled"].includes(w.status)&&w.requester_user_id===context.userId));
};

export async function POST(request:Request,{params}:{params:Promise<{workflowId:string}>}){
  const {workflowId}=await params,db=await workflowDb();let context;
  try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const detail=await workflowDetail(db,context,workflowId);if(!detail)return Response.json({error:"Workflow를 찾을 수 없습니다."},{status:404});
  try{await requireProjectAccess(db,context,detail.workflow.project_id,true)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"Workflow 처리 권한이 없습니다."},{status:403})}
  if(!canAttach(detail,context))return Response.json({error:"현재 단계 담당자만 첨부파일을 등록할 수 있습니다."},{status:403});
  const w=detail.workflow,steps=detail.steps as any[],current=steps.find(step=>Number(step.step_order)===Number(w.current_step_order))||steps[0];
  if(!current)return Response.json({error:"첨부할 Workflow 단계가 없습니다."},{status:409});
  const form=await request.formData(),file=form.get("file");if(!(file instanceof File)||!file.size)return Response.json({error:"등록할 파일을 선택하세요."},{status:400});
  const attachmentId=crypto.randomUUID(),now=nowSeconds(),cleanName=file.name.replace(/[\\/:*?"<>|]/g,"_"),fileKey=`${w.project_id}/workflow-attachments/${workflowId}/${current.id}/${attachmentId}-${cleanName}`;
  const storage=getStorageAdapter() as unknown as Storage;await storage.put(fileKey,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{originalName:file.name,workflowId,stepId:current.id,attachmentId}});
  const attachment:StepAttachment={id:attachmentId,fileKey,fileName:file.name,fileSize:file.size,contentType:file.type||"application/octet-stream",stepId:current.id,stepOrder:Number(current.step_order||0),stepName:current.name||"현재 단계",createdAt:now,createdBy:context.userId};
  await db.prepare("INSERT INTO workflow_history (id,workflow_id,step_id,actor_user_id,action,previous_status,next_status,attachments,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),workflowId,current.id,context.userId,"ATTACHMENT",w.status,w.status,JSON.stringify([attachment]),now).run();
  return Response.json({ok:true,attachment:{...attachment,fileKey:undefined}});
}

export async function GET(request:Request,{params}:{params:Promise<{workflowId:string}>}){
  const {workflowId}=await params,db=await workflowDb();let context;
  try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}
  const detail=await workflowDetail(db,context,workflowId);if(!detail)return Response.json({error:"Workflow를 찾을 수 없습니다."},{status:404});
  try{await requireProjectAccess(db,context,detail.workflow.project_id)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"첨부파일 접근 권한이 없습니다."},{status:403})}
  const attachmentId=new URL(request.url).searchParams.get("attachmentId")||"";
  const attachments=(detail.history??[]).flatMap((entry:any)=>parseJson<any[]>(entry.attachments,[]).map(item=>({...item,historyId:entry.id,actorName:entry.actorName,createdAt:item.createdAt||entry.created_at}))).filter((item:any)=>item?.id&&item?.fileKey);
  if(!attachmentId)return Response.json({attachments:attachments.map(({fileKey,...item}:any)=>item)});
  const item=attachments.find((row:any)=>String(row.id)===attachmentId);if(!item)return Response.json({error:"첨부파일을 찾을 수 없습니다."},{status:404});
  const storage=getStorageAdapter() as unknown as Storage,object=await storage.get(item.fileKey);if(!object)return Response.json({error:"저장된 첨부파일을 찾을 수 없습니다."},{status:404});
  return new Response(object.body,{headers:{"content-type":item.contentType||object.httpMetadata?.contentType||"application/octet-stream","content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(item.fileName||"attachment")}`}});
}
