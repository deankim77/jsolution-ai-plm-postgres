import {normalizeFeatureSettings,validFeatureSettings} from "../lib/feature-settings";
import {readFeatureSettings,writeFeatureSettings} from "../db/repositories/feature-settings-repository";
import {RequestContextError,type RequestContext} from "../db/request-context";
export async function loadFeatureSettings(context:RequestContext) {
  const raw=await readFeatureSettings(context.companyId);
  return normalizeFeatureSettings(raw ? JSON.parse(raw) : undefined);
}
export async function saveFeatureSettings(context:RequestContext,value:unknown) {
  if(!context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role)))throw new RequestContextError("시스템 관리자만 사용 기능을 변경할 수 있습니다.",403);
  if(!validFeatureSettings(value))throw new RequestContextError("다섯 가지 기능의 사용 여부를 모두 지정해 주세요.",400);
  await writeFeatureSettings(context.companyId,context.userId,value);
  return value;
}
