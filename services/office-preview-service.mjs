import {isOfficeDocument,officePreviewState} from "../lib/office-preview.mjs";

export async function requestOfficePreview(repository, version, retry = false) {
  if(!isOfficeDocument(version.fileName))return false;
  if(!retry && /^(office_pdf_ready|office_pdf_failed|office_pdf_pending|office_pdf_converting)$/.test(version.conversionStatus||""))return false;
  return repository.enqueue(version.versionId, retry);
}

export async function serveOfficePreview(repository, storage, version, statusOnly = false) {
  await requestOfficePreview(repository,version);
  const state=officePreviewState(version.conversionStatus);
  const headers={"cache-control":"no-store"};
  if(state==="ready"){
    // Polling checks metadata only; never load the PDF bytes just to report ready.
    if(statusOnly&&version.previewFileKey&&typeof storage.head==="function"){
      if(await storage.head(version.previewFileKey))return Response.json({state:"ready"},{headers});
      return Response.json({state:"failed",error:"미리보기 PDF를 찾을 수 없습니다. 다시 생성해 주세요.",downloadAvailable:true},{status:422,headers});
    }
    const file=version.previewFileKey?await storage.get(version.previewFileKey):null;
    if(file){
      if(statusOnly)return Response.json({state:"ready"},{headers});
      return new Response(file.body,{headers:{...headers,"content-type":"application/pdf","content-disposition":"inline"}});
    }
    return Response.json({state:"failed",error:"미리보기 PDF를 찾을 수 없습니다. 다시 생성해 주세요.",downloadAvailable:true},{status:422,headers});
  }
  if(state==="failed")return Response.json({state,error:version.conversionError||"미리보기 생성에 실패했습니다.",downloadAvailable:true},{status:422,headers});
  return Response.json({state:"pending",conversionStatus:version.conversionStatus||"office_pdf_pending",downloadAvailable:true},{status:202,headers:{...headers,"retry-after":"3"}});
}
