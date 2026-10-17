import {randomUUID} from "node:crypto";
import {and,eq,inArray,asc,sql} from "drizzle-orm";
import {companies,users,roles,userRoles,templates,templateVersions,auditLogs} from "../schema.ts";

export function insuranceTemplateRepository(db) {
  return {
    transaction: work => db.transaction(tx=>work(insuranceTemplateRepository(tx))),
    lock: companyId => db.execute(sql`select pg_advisory_xact_lock(hashtext(${"insurance-templates:"+companyId}))`),
    companies: () => db.select({id:companies.id,name:companies.name}).from(companies).where(eq(companies.status,"active")),
    administrators: companyId => db.selectDistinct({id:users.id}).from(users)
      .innerJoin(userRoles,eq(userRoles.userId,users.id)).innerJoin(roles,eq(roles.id,userRoles.roleId))
      .where(and(eq(users.companyId,companyId),eq(users.status,"active"),eq(roles.companyId,companyId),inArray(roles.code,["ADMIN","SUPER_ADMIN","SYSTEM_ADMIN"]))).orderBy(asc(users.id)),
    find: async (companyId,code) => (await db.select({id:templates.id}).from(templates).where(and(eq(templates.companyId,companyId),eq(templates.code,code))).limit(1))[0],
    create: async (companyId,userId,template) => {
      const id=randomUUID(),now=Math.floor(Date.now()/1000);
      await db.insert(templates).values({id,companyId,code:template.code,name:template.name,status:template.status,createdAt:now,updatedAt:now});
      await db.insert(templateVersions).values({id:randomUUID(),templateId:id,version:template.version,definition:JSON.stringify(template.definition),publishedAt:now,createdBy:userId,createdAt:now,updatedAt:now});
      await db.insert(auditLogs).values({id:randomUUID(),companyId,actorUserId:userId,action:"TEMPLATE_CREATED",entityType:"TEMPLATE",entityId:id,detail:JSON.stringify({version:template.version,source:"insurance-template-seed"}),createdAt:now});
    },
  };
}
