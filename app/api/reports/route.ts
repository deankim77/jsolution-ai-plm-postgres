import {getLegacyDbCompat} from "../../../db/postgres-d1-compat";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";
import {loadReportResults} from "../../../services/report-results-service";

export async function GET(request:Request){
  try{
    const context=await resolveRequestContext(request,getLegacyDbCompat());
    const query=new URL(request.url).searchParams,offset=Number(query.get("offset")||0);
    if(!Number.isSafeInteger(offset)||offset<0)return Response.json({error:"올바른 조회 범위를 지정해 주세요."},{status:400});
    return Response.json(await loadReportResults(context,{id:query.get("id")||undefined,offset}),{headers:{"Cache-Control":"no-store"}});
  }catch(reason){return contextErrorResponse(reason)??Response.json({error:"저장된 보고서를 불러오지 못했습니다."},{status:500})}
}
