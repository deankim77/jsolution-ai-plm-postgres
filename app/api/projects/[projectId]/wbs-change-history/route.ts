import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type D1={prepare:(sql:string)=>any;batch:(statements:any[])=>Promise<unknown>};
async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1}

async function ensureTables(db:D1){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_sets (id text PRIMARY KEY NOT NULL,project_id text NOT NULL,checked_in_at integer NOT NULL,checked_in_by text,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_sets_project_time_idx ON project_wbs_change_sets(project_id,checked_in_at DESC)"),
  db.prepare("CREATE TABLE IF NOT EXISTS project_wbs_change_items (id text PRIMARY KEY NOT NULL,change_set_id text NOT NULL,project_id text NOT NULL,task_id text,wbs_code text,task_name text,change_type text NOT NULL,before_value text,after_value text,sort_order integer NOT NULL DEFAULT 0,FOREIGN KEY(change_set_id) REFERENCES project_wbs_change_sets(id) ON DELETE CASCADE,FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE)"),
  db.prepare("CREATE INDEX IF NOT EXISTS project_wbs_change_items_task_idx ON project_wbs_change_items(project_id,task_id)"),
])}

const parseValue=(value:unknown)=>{if(value===null||value===undefined||value==="")return null;try{return JSON.parse(String(value))}catch{return String(value)}};

export async function GET(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params,db=await runtimeDb();
  let context;try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"프로젝트 접근 권한을 확인하지 못했습니다."},{status:403})}
  await ensureTables(db);
  const url=new URL(request.url),taskId=String(url.searchParams.get("taskId")||"").trim();
  const requested=Math.max(1,Math.min(100,Number(url.searchParams.get("limit")||30))),limit=requested+1;
  const sql=taskId
    ?`SELECT i.id,i.change_set_id AS changeSetId,i.task_id AS taskId,i.wbs_code AS wbsCode,i.task_name AS taskName,i.change_type AS changeType,i.before_value AS beforeValue,i.after_value AS afterValue,i.sort_order AS sortOrder,s.checked_in_at AS checkedInAt,s.checked_in_by AS checkedInBy,u.name AS changedBy FROM project_wbs_change_items i JOIN project_wbs_change_sets s ON s.id=i.change_set_id LEFT JOIN users u ON u.id=s.checked_in_by WHERE i.project_id=? AND i.task_id=? ORDER BY s.checked_in_at DESC,i.sort_order,i.id LIMIT ?`
    :`SELECT i.id,i.change_set_id AS changeSetId,i.task_id AS taskId,i.wbs_code AS wbsCode,i.task_name AS taskName,i.change_type AS changeType,i.before_value AS beforeValue,i.after_value AS afterValue,i.sort_order AS sortOrder,s.checked_in_at AS checkedInAt,s.checked_in_by AS checkedInBy,u.name AS changedBy FROM project_wbs_change_items i JOIN project_wbs_change_sets s ON s.id=i.change_set_id LEFT JOIN users u ON u.id=s.checked_in_by WHERE i.project_id=? ORDER BY s.checked_in_at DESC,i.sort_order,i.id LIMIT ?`;
  const rows=taskId?await db.prepare(sql).bind(projectId,taskId,limit).all():await db.prepare(sql).bind(projectId,limit).all();
  const result=(rows.results??[]) as any[],hasMore=result.length>requested,items=result.slice(0,requested).map(row=>({...row,beforeValue:parseValue(row.beforeValue),afterValue:parseValue(row.afterValue)}));
  return Response.json({items,hasMore,limit:requested});
}
