/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../../db/request-context";

type D1={prepare:(sql:string)=>any};
type R2Object={body:ReadableStream;httpMetadata?:{contentType?:string}};
type R2Bucket={put:(key:string,value:ReadableStream|ArrayBuffer|Blob|string,options?:any)=>Promise<unknown>;get:(key:string)=>Promise<R2Object|null>};

async function runtime(){const runtime=await import("cloudflare:workers");return runtime.env as unknown as {DB:D1;FILES?:R2Bucket;DWG_CONVERTER_URL?:string;DWG_CONVERTER_TOKEN?:string};}

export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  const env=await runtime();
  const {DB:db,FILES}=env;
  let context;
  try{context=await resolveRequestContext(request,db);await requireProjectAccess(db,context,projectId,true)}
  catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 권한을 확인하지 못했습니다."},{status:500})}
  if(!FILES)return Response.json({error:"파일 저장소가 연결되지 않았습니다."},{status:503});
  const converter=String(env.DWG_CONVERTER_URL||"").trim();
  if(!converter)return Response.json({error:"DWG 변환 서버가 설정되지 않았습니다."},{status:503});

  const rows=await db.prepare(`SELECT v.id,v.deliverable_id AS deliverableId,v.revision,v.file_key AS fileKey,v.file_name AS fileName,v.content_type AS contentType,v.preview_file_key AS previewFileKey,v.conversion_status AS conversionStatus FROM deliverable_versions v JOIN deliverables d ON d.id=v.deliverable_id JOIN projects p ON p.id=v.project_id WHERE v.project_id=? AND p.company_id=? AND v.deleted_at IS NULL AND lower(v.file_name) LIKE '%.dwg' AND v.revision=(SELECT MAX(v2.revision) FROM deliverable_versions v2 WHERE v2.deliverable_id=v.deliverable_id AND v2.deleted_at IS NULL) ORDER BY v.created_at DESC LIMIT 20`).bind(projectId,context.companyId).all();
  const candidates=(rows.results??[]) as Array<{id:string;deliverableId:string;revision:number;fileKey:string;fileName:string;contentType?:string;previewFileKey?:string;conversionStatus?:string}>;
  let converted=0,failed=0,skipped=0;
  for(const row of candidates){
    if(row.previewFileKey&&row.conversionStatus==="converted"){skipped++;continue}
    await db.prepare("UPDATE deliverable_versions SET conversion_status='converting',conversion_error=NULL WHERE id=?").bind(row.id).run();
    try{
      const source=await FILES.get(row.fileKey);if(!source)throw new Error("원본 DWG 파일을 찾을 수 없습니다.");
      const buffer=await new Response(source.body).arrayBuffer();
      const body=new FormData();body.set("file",new Blob([buffer],{type:row.contentType||"application/acad"}),row.fileName);body.set("output","pdf");
      const headers:Record<string,string>={};if(env.DWG_CONVERTER_TOKEN)headers.authorization=`Bearer ${env.DWG_CONVERTER_TOKEN}`;
      const response=await fetch(converter,{method:"POST",headers,body});if(!response.ok)throw new Error(`변환 서버 오류 ${response.status}`);
      const pdf=await response.arrayBuffer();if(!pdf.byteLength)throw new Error("변환된 PDF가 비어 있습니다.");
      const previewKey=`${projectId}/${row.deliverableId}/rev-${String(row.revision).padStart(2,"0")}-${row.id}-preview.pdf`;
      await FILES.put(previewKey,pdf,{httpMetadata:{contentType:"application/pdf"},customMetadata:{sourceVersionId:row.id,sourceFileName:row.fileName}});
      await db.prepare("UPDATE deliverable_versions SET preview_file_key=?,conversion_status='converted',conversion_error=NULL,converted_at=? WHERE id=?").bind(previewKey,Math.floor(Date.now()/1000),row.id).run();
      converted++;
    }catch(reason){const message=reason instanceof Error?reason.message:"DWG 변환에 실패했습니다.";await db.prepare("UPDATE deliverable_versions SET conversion_status='failed',conversion_error=? WHERE id=?").bind(message,row.id).run();failed++}
  }
  return Response.json({ok:true,converted,failed,skipped,total:candidates.length});
}
