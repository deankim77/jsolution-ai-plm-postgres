import {and,eq} from "drizzle-orm";
import {getDb} from "../index";
import {auditLogs,systemSettings} from "../schema";
import type {FeatureSettings} from "../../lib/feature-settings";
const settingKey="FEATURE_SETTINGS";
export async function readFeatureSettings(companyId:string) {
  const [row]=await getDb().select({value:systemSettings.value}).from(systemSettings).where(and(eq(systemSettings.companyId,companyId),eq(systemSettings.settingKey,settingKey))).limit(1);
  return row?.value;
}
export async function writeFeatureSettings(companyId:string,userId:string,value:FeatureSettings) {
  const now=Math.floor(Date.now()/1000);
  await getDb().transaction(async tx=>{
    await tx.insert(systemSettings).values({companyId,settingKey,value:JSON.stringify(value),updatedBy:userId,updatedAt:now}).onConflictDoUpdate({target:[systemSettings.companyId,systemSettings.settingKey],set:{value:JSON.stringify(value),updatedBy:userId,updatedAt:now}});
    await tx.insert(auditLogs).values({id:crypto.randomUUID(),companyId,actorUserId:userId,action:"FEATURE_SETTINGS_UPDATED",entityType:"SETTING",entityId:settingKey,detail:JSON.stringify(value),createdAt:now});
  });
}
