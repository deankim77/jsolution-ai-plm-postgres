import {and,eq,ne,or,sql} from "drizzle-orm";
import {getDb} from "../index";
import {projectMembers,projectsDb,users,wbsTasks} from "../schema";

export async function readMyWorkRoleChoices(companyId:string,userId:string){
  return getDb().selectDistinct({role:wbsTasks.roleCode,assignee:users.name}).from(wbsTasks)
    .innerJoin(projectsDb,eq(projectsDb.id,wbsTasks.projectId))
    .leftJoin(users,eq(users.id,wbsTasks.assigneeUserId))
    .where(and(eq(projectsDb.companyId,companyId),ne(projectsDb.status,"completed"),eq(wbsTasks.kind,"task"),ne(wbsTasks.status,"completed"),or(
      eq(wbsTasks.assigneeUserId,userId),
      and(eq(wbsTasks.status,"review"),sql`exists (select 1 from ${projectMembers} where ${projectMembers.projectId}=${wbsTasks.projectId} and ${projectMembers.userId}=${userId} and ((${wbsTasks.completionActor}='PM' and ${projectMembers.projectRole}='PM') or (${wbsTasks.completionActor}='PL' and ${projectMembers.projectRole} in ('PL','PM'))))`)
    )));
}
