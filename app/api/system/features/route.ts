import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";
import {contextErrorResponse,resolveRequestContext} from "../../../../db/request-context";
import {loadFeatureSettings,saveFeatureSettings} from "../../../../services/feature-settings-service";
const failure=(reason:unknown)=>contextErrorResponse(reason)??Response.json({error:"사용 기능 설정을 처리하지 못했습니다."},{status:500});
export async function GET(request:Request) {
  try {const context=await resolveRequestContext(request,getLegacyDbCompat());return Response.json({features:await loadFeatureSettings(context),canEdit:context.systemRoles.some(role=>["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(role))},{headers:{"Cache-Control":"no-store"}});}
  catch(reason){return failure(reason);}
}
export async function PUT(request:Request) {
  try {
    const context=await resolveRequestContext(request,getLegacyDbCompat());
    let input:unknown;
    try{input=await request.json();}catch{return Response.json({error:"올바른 설정을 입력해 주세요."},{status:400});}
    return Response.json({features:await saveFeatureSettings(context,(input as {features?:unknown}|null)?.features)},{headers:{"Cache-Control":"no-store"}});
  }catch(reason){return failure(reason);}
}
