/* eslint-disable @typescript-eslint/no-explicit-any */
import {sessionTokenFromCookie,verifyAppSession} from "../lib/app-auth";

export type RequestContext={companyId:string;userId:string;email?:string;name?:string;systemRoles:string[]};
type ContextDb={prepare:(sql:string)=>any};

export class RequestContextError extends Error{status:number;constructor(message:string,status=401){super(message);this.name="RequestContextError";this.status=status}}

/** Resolve identity exclusively from the signed application session. */
export async function resolveRequestContext(request:Request,db:ContextDb,_identity?:{userId?:string;email?:string}):Promise<RequestContext>{
  const session=await verifyAppSession(sessionTokenFromCookie(request.headers.get("cookie")),process.env.APP_SESSION_SECRET||"");
  if(!session)throw new RequestContextError("로그인이 필요합니다.");
  const user=await db.prepare("SELECT id,company_id AS companyId,email,name,status FROM users WHERE lower(email)=?").bind(session.email).first();
  if(!user||user.status!=="active")throw new RequestContextError("로그인 사용자 정보를 확인할 수 없습니다.");
  const roles=await db.prepare("SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? AND r.company_id=?").bind(user.id,user.companyId).all().catch(()=>({results:[]}));
  return {companyId:String(user.companyId),userId:String(user.id),email:user.email?String(user.email):undefined,name:user.name?String(user.name):undefined,systemRoles:(roles.results??[]).map((row:any)=>String(row.code))};
}

export function contextErrorResponse(reason:unknown){return reason instanceof RequestContextError?Response.json({error:reason.message},{status:reason.status}):null}

export async function requireProjectAccess(db:ContextDb,context:RequestContext,projectId:string,write=false){
  const project=await db.prepare("SELECT id,status FROM projects WHERE id=? AND company_id=?").bind(projectId,context.companyId).first();
  if(!project)throw new RequestContextError("프로젝트를 찾을 수 없거나 접근할 수 없습니다.",404);
  const isAdmin=context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role));
  const member=await db.prepare("SELECT project_role AS projectRole FROM project_members WHERE project_id=? AND user_id=?").bind(projectId,context.userId).first();
  if(!isAdmin&&!member)throw new RequestContextError("프로젝트 참여자만 접근할 수 있습니다.",403);
  if(write&&project.status==="completed")throw new RequestContextError("완료된 프로젝트는 수정할 수 없습니다.",409);
  return {project,isAdmin,projectRole:member?.projectRole?String(member.projectRole):undefined};
}

export function canManageProject(context:RequestContext,projectRole?:string){return context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role))||["PM","PL"].includes(projectRole||"")}
