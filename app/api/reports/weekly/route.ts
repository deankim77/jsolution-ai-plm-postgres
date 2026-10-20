import {getLegacyDbCompat} from "../../../../db/postgres-d1-compat";
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";
import {createWeeklyReport} from "../../../../services/weekly-report-service";
export async function POST(request:Request){
  try{
    const db=getLegacyDbCompat(),context=await resolveRequestContext(request,db);
    let input;try{input=await request.json()}catch{return Response.json({error:"올바른 작성 조건을 지정해 주세요."},{status:400})}
    if(!input||typeof input.projectId!=="string"||!input.projectId)return Response.json({error:"프로젝트를 선택해 주세요."},{status:400});
    await requireProjectAccess(db,context,input.projectId);
    return Response.json({report:await createWeeklyReport(context,input)},{status:201,headers:{"Cache-Control":"no-store"}});
  }catch(reason){return contextErrorResponse(reason)??Response.json({error:"주간보고서를 저장하지 못했습니다. 다시 시도해 주세요."},{status:500})}
}
