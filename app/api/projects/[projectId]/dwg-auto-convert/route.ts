import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";
import {getLegacyDbCompat} from "../../../../../db/postgres-d1-compat";

/**
 * Legacy compatibility endpoint.
 *
 * DWG conversion is now upload-triggered in the deliverables POST flow:
 * DWG upload -> AutoDWG converter -> PDF preview -> same drawing revision.
 *
 * Do not scan projects or poll drawing libraries from this route. Keeping a
 * lightweight authenticated 200 response prevents older UI callers from
 * retrying a retired project-wide conversion endpoint.
 */
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const db=getLegacyDbCompat();
  try{
    const context=await resolveRequestContext(request,db);
    await requireProjectAccess(db,context,projectId,true);
  }catch(reason){
    return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500});
  }

  return Response.json({
    ok:true,
    mode:"upload-triggered",
    deprecated:true,
    converted:0,
    failed:0,
    skipped:0,
    total:0,
    message:"DWG 변환은 업로드 시 해당 Revision에 대해서만 실행됩니다."
  });
}
