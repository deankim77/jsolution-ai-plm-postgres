import {and,eq,desc,sql} from "drizzle-orm";
import * as schema from "../schema.ts";

const tables = Object.fromEntries(["projectsDb","projectMembers","projectRoles","wbsTasks","projectBaselines","projectBaselineTasks","deliverables","deliverableVersions","deliverableReviews","taskActuals","projectGateDecisions","projectIssues","projectProfiles","auditLogs","partners","projectTypes","projectRoleCatalog"].map(name=>[name,schema[name]]));
export function insuranceDemoRepository(db) {
  return {
    transaction:work=>db.transaction(tx=>work(insuranceDemoRepository(tx))),
    lock:companyId=>db.execute(sql`select pg_advisory_xact_lock(hashtext(${"insurance-demo:"+companyId}))`),
    companies:()=>db.select({id:schema.companies.id,name:schema.companies.name}).from(schema.companies).where(eq(schema.companies.status,"active")),
    users:()=>db.select().from(schema.users),
    template:async(companyId,code)=>(await db.select({id:schema.templates.id,versionId:schema.templateVersions.id,definition:schema.templateVersions.definition}).from(schema.templates).innerJoin(schema.templateVersions,eq(schema.templateVersions.templateId,schema.templates.id)).where(and(eq(schema.templates.companyId,companyId),eq(schema.templates.code,code))).orderBy(desc(schema.templateVersions.updatedAt),desc(schema.templateVersions.createdAt)).limit(1))[0],
    project:async(companyId,code)=>(await db.select().from(schema.projectsDb).where(and(eq(schema.projectsDb.companyId,companyId),eq(schema.projectsDb.code,code))).limit(1))[0],
    lookup:async(name,companyId,code)=>(await db.select().from(tables[name]).where(and(eq(tables[name].companyId,companyId),eq(tables[name].code,code))).limit(1))[0],
    setDeliverableFile:(id,fileKey)=>db.update(schema.deliverables).set({fileKey}).where(eq(schema.deliverables.id,id)),
    updateUser:(companyId,user)=>db.update(schema.users).set({email:user.email,name:user.name,updatedAt:Math.floor(Date.now()/1000)}).where(and(eq(schema.users.id,user.id),eq(schema.users.companyId,companyId))),
    insert:async(name,rows)=>{if(!tables[name])throw Error("Unsupported demo table");if(!rows.length)return;for(let i=0;i<rows.length;i+=50)await db.insert(tables[name]).values(rows.slice(i,i+50));},
  };
}
