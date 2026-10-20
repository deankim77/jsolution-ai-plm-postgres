import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";
import {loadReportActuals} from "../../../../services/report-results-service";
export async function GET(request:Request){
  try{
    const db=getLegacyDbCompat(),context=await resolveRequestContext(request,db),query=new URL(request.url).searchParams;
    const projectId=query.get("projectId")||"";
    if(!projectId)return Response.json({error:"프로젝트를 선택해 주세요."},{status:400});
    await requireProjectAccess(db,context,projectId);
    return Response.json(await loadReportActuals(projectId,query.get("from")||"",query.get("to")||""),{headers:{"Cache-Control":"no-store"}});
  }catch(reason){return contextErrorResponse(reason)??Response.json({error:"보고 기간의 실적을 불러오지 못했습니다."},{status:500})}
}
