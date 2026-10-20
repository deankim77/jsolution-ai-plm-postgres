import {eq,sql} from "drizzle-orm";
import {getDb} from "../index";
import {projectsDb} from "../schema";
import type {SavedReportRow} from "../../lib/report-results";

export async function readReportProjects(companyId:string){
  return getDb().select({id:projectsDb.id,code:projectsDb.code,name:projectsDb.name}).from(projectsDb).where(eq(projectsDb.companyId,companyId));
}

export async function readPeriodActuals(projectId:string,from:string,to:string){
  const db=getDb();
  const [totals,details]=await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS count,COALESCE(SUM(actual_hours),0) AS hours FROM task_actuals WHERE project_id=${projectId} AND actual_date>=${from} AND actual_date<=${to}`),
    db.execute(sql`SELECT a.actual_date AS date,w.wbs_code AS code,w.name,a.progress,a.actual_hours AS hours,LEFT(a.work_note,200) AS note FROM task_actuals a JOIN wbs_tasks w ON w.id=a.task_id AND w.project_id=a.project_id WHERE a.project_id=${projectId} AND a.actual_date>=${from} AND a.actual_date<=${to} ORDER BY a.actual_date DESC,a.created_at DESC,a.id DESC LIMIT 15`),
  ]);
  return {count:Number(totals.rows[0]?.count||0),hours:Number(totals.rows[0]?.hours||0),details:details.rows};
}
export async function readReportResults(companyId:string,userId:string,{id,offset=0}:{id?:string;offset?:number}={}){
  const result=await getDb().execute(sql`
    SELECT m.id,m.conversation_id AS "conversationId",c.title,c.source,c.context_title AS "contextTitle",c.context_items AS "contextItems",
      (SELECT um.content FROM ai_messages um WHERE um.conversation_id=c.id AND um.role='user' ORDER BY um.created_at,um.id LIMIT 1) AS prompt,
      m.created_at AS "createdAt",u.name AS author,LEFT(m.content,300) AS excerpt,
      (m.content ~* '슬라이드[[:space:]]*[0-9]+') AS "hasSlides"${id?sql`,m.content`:sql``}
    FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id
    LEFT JOIN users u ON u.id=c.user_id AND u.company_id=c.company_id
    WHERE c.company_id=${companyId} AND c.user_id=${userId} AND m.role='assistant'
      ${id?sql`AND m.id=${id}`:sql`AND (c.context_items LIKE '%보고서:%' OR c.context_items LIKE '%프로젝트 보고%' OR c.title ~* '주간.*보고|회의.*안건|회의.*준비|Baseline')`}
    ORDER BY m.created_at DESC,m.id DESC LIMIT ${id?1:100} OFFSET ${offset}`);
  return result.rows as unknown as SavedReportRow[];
}
