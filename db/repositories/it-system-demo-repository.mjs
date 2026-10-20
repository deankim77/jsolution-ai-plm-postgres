import {randomUUID} from "node:crypto";
import {and,eq,sql} from "drizzle-orm";
import * as schema from "../schema.ts";
import {insuranceDemoRepository} from "./insurance-demo-repository.mjs";

export function itSystemDemoRepository(db){
  const common=insuranceDemoRepository(db);
  return {...common,
    transaction:work=>db.transaction(tx=>work(itSystemDemoRepository(tx))),
    lock:companyId=>db.execute(sql`select pg_advisory_xact_lock(hashtext(${"it-system-demo:"+companyId}))`),
    calendar:async companyId=>{const [calendar]=await db.select().from(schema.workCalendars).where(and(eq(schema.workCalendars.companyId,companyId),eq(schema.workCalendars.isDefault,1))).limit(1);if(!calendar)return undefined;const holidays=await db.select({date:schema.calendarHolidays.holidayDate}).from(schema.calendarHolidays).where(eq(schema.calendarHolidays.calendarId,calendar.id));return {...calendar,workingDays:JSON.parse(calendar.workingDays),holidays};},
    partnerByName:async(companyId,name)=>(await db.select().from(schema.partners).where(and(eq(schema.partners.companyId,companyId),eq(schema.partners.name,name),eq(schema.partners.status,"active")))),
    createTemplate:async(companyId,userId,template)=>{const id=randomUUID(),versionId=randomUUID(),now=Math.floor(Date.now()/1000);await db.insert(schema.templates).values({id,companyId,code:template.code,name:template.name,status:template.status,createdAt:now,updatedAt:now});await db.insert(schema.templateVersions).values({id:versionId,templateId:id,version:template.version,definition:JSON.stringify(template.definition),publishedAt:now,createdBy:userId,createdAt:now,updatedAt:now});await common.insert("auditLogs",[{id:randomUUID(),companyId,actorUserId:userId,action:"TEMPLATE_CREATED",entityType:"TEMPLATE",entityId:id,detail:JSON.stringify({source:"it-system-seed",version:template.version}),createdAt:now}]);return {id,versionId,definition:JSON.stringify(template.definition)};},
  };
}
