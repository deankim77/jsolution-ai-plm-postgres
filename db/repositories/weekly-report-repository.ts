import {sql} from "drizzle-orm";
import {getDb} from "../index";
import {aiConversations,aiMessages} from "../schema";
import type {RequestContext} from "../request-context";
import type {WeeklyReportData} from "../../services/weekly-report-builder";

/** One repeatable snapshot; every child query is restricted to the authorized project. */
export async function readWeeklyReportData(companyId:string,projectId:string):Promise<WeeklyReportData>{
  return getDb().transaction(async tx=>{
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    const project=await tx.execute(sql`SELECT p.id,p.code,p.name,p.start_date AS "startDate",p.end_date AS "endDate",(SELECT string_agg(u.name,', ' ORDER BY u.name) FROM project_members m JOIN users u ON u.id=m.user_id AND u.company_id=p.company_id WHERE m.project_id=p.id AND m.project_role='PM') AS pm FROM projects p WHERE p.id=${projectId} AND p.company_id=${companyId}`);
    const tasks=await tx.execute(sql`SELECT w.id,w.wbs_code AS code,w.kind,w.task_type AS "taskType",w.name,w.status,w.progress,w.planned_start AS "plannedStart",w.planned_end AS "plannedEnd",u.name AS owner FROM wbs_tasks w LEFT JOIN users u ON u.id=w.assignee_user_id AND u.company_id=${companyId} WHERE w.project_id=${projectId} ORDER BY w.sort_order,w.id`);
    const actuals=await tx.execute(sql`SELECT task_id AS "taskId",actual_date AS date,progress,actual_hours AS hours,work_note AS note,completed FROM task_actuals WHERE project_id=${projectId} ORDER BY actual_date,created_at,id`);
    const issues=await tx.execute(sql`SELECT i.id,i.task_id AS "taskId",i.issue_type AS type,i.title,i.description,i.status,i.severity,i.due_date AS "dueDate",i.created_at AS "createdAt",u.name AS owner FROM project_issues i LEFT JOIN users u ON u.id=i.owner_user_id AND u.company_id=${companyId} WHERE i.project_id=${projectId} ORDER BY i.created_at,i.id`);
    const actions=await tx.execute(sql`SELECT issue_id AS "issueId",action,note,created_at AS "createdAt" FROM project_issue_actions WHERE project_id=${projectId} ORDER BY created_at,id`);
    const outputs=await tx.execute(sql`SELECT d.id,d.task_id AS "taskId",d.name,d.required,d.status,d.version,u.name AS owner FROM deliverables d LEFT JOIN users u ON u.id=d.owner_user_id AND u.company_id=${companyId} WHERE d.project_id=${projectId} ORDER BY d.created_at,d.id`);
    const revisions=await tx.execute(sql`SELECT deliverable_id AS "deliverableId",revision,created_at AS "createdAt",file_name AS "fileName" FROM deliverable_versions WHERE project_id=${projectId} AND deleted_at IS NULL ORDER BY created_at,id`);
    const baseline=await tx.execute(sql`SELECT bt.task_id AS "taskId",bt.planned_end AS "plannedEnd" FROM project_baseline_tasks bt JOIN project_baselines b ON b.id=bt.baseline_id WHERE b.project_id=${projectId} AND b.is_active=1 ORDER BY b.version DESC`);
    return {project:project.rows[0],tasks:tasks.rows,actuals:actuals.rows,issues:issues.rows,actions:actions.rows,outputs:outputs.rows,revisions:revisions.rows,baseline:baseline.rows} as unknown as WeeklyReportData;
  });
}

/** Reuse the saved report result store, marked as deterministic; never calls an AI provider. */
export async function saveWeeklyReport(context:RequestContext,project:{id:string;name:string},from:string,to:string,content:string){
  const id=crypto.randomUUID(),conversationId=crypto.randomUUID(),now=Math.floor(Date.now()/1000);
  await getDb().transaction(async tx=>{
    await tx.insert(aiConversations).values({id:conversationId,companyId:context.companyId,userId:context.userId,title:`${project.name} 주간보고서`,source:"주간보고서 자동 작성 · AI 미사용",contextType:"report",contextTitle:project.name,contextItems:JSON.stringify([{id:project.id,kind:"보고서:weekly",title:project.name,meta:`보고 기간: ${from} ~ ${to}\n작성 방식: 저장 데이터 자동 집계 · AI 미사용`}]),createdAt:now,updatedAt:now});
    await tx.insert(aiMessages).values([{id:crypto.randomUUID(),conversationId,role:"user",content:`${from} ~ ${to} 주간보고서 자동 작성`,createdAt:now},{id,conversationId,role:"assistant",content,createdAt:now}]);
  });
  return id;
}
