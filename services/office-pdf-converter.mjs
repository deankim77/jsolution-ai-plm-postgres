import {execFile} from "node:child_process";
import {promisify} from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {isOfficeDocument} from "../lib/office-preview.mjs";

const execute=promisify(execFile);
function runOffice(executable,args,timeoutMs){
  return new Promise((resolve,reject)=>{
    let timedOut=false;
    const child=execFile(executable,args,{windowsHide:true,detached:process.platform!=="win32",maxBuffer:1024*1024},error=>{
      if(timedOut)return;
      clearTimeout(timer);if(error)reject(error);else resolve(undefined);
    });
    const timer=setTimeout(async()=>{
      timedOut=true;
      try{
        if(child.pid){
          if(process.platform==="win32")await execute("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{windowsHide:true,timeout:10000});
          else process.kill(-child.pid,"SIGKILL");
        }
      }catch{/* The child may already have exited. */}
      const error=new Error("미리보기 변환 제한 시간을 초과했습니다.");
      reject(Object.assign(error,{killed:true}));
    },timeoutMs);
  });
}
export async function convertOfficePdf(buffer,fileName,{executable=process.env.LIBREOFFICE_PATH||"soffice",timeoutMs=120000,maxBytes=104857600}={}){
  if(!isOfficeDocument(fileName))throw new Error("지원하지 않는 오피스 파일 형식입니다.");
  if(!buffer.byteLength||buffer.byteLength>maxBytes)throw new Error("미리보기 변환 용량 제한을 초과했거나 빈 파일입니다.");
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"ai-plm-office-"));
  try{
    const input=path.join(directory,`source${path.extname(fileName).toLowerCase()}`);
    const profile=path.join(directory,"profile");
    await fs.mkdir(path.join(profile,"user"),{recursive:true});
    // Never execute embedded macros or update external document links.
    await fs.writeFile(path.join(profile,"user","registrymodifications.xcu"),`<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Common/Load"><prop oor:name="UpdateLinks" oor:op="fuse"><value>2</value></prop></item></oor:items>`);
    await fs.writeFile(input,buffer);
    await runOffice(executable,[`-env:UserInstallation=${pathToFileURL(profile).href}`,"--headless","--nologo","--nodefault","--nofirststartwizard","--convert-to","pdf","--outdir",directory,input],timeoutMs);
    const output=path.join(directory,"source.pdf"),info=await fs.stat(output);
    if(info.size>maxBytes)throw new Error("변환된 PDF가 미리보기 용량 제한을 초과했습니다.");
    const pdf=await fs.readFile(output);
    if(pdf.subarray(0,5).toString()!=="%PDF-")throw new Error("정상적인 PDF를 생성하지 못했습니다.");
    return pdf;
  }finally{
    // Only the freshly-created, internally-owned temporary directory is removed.
    await fs.rm(directory,{recursive:true,force:true});
  }
}

function writeOfficeLog(event,details){
  const line=`[office-preview] ${event} ${JSON.stringify({at:new Date().toISOString(),...details})}`;
  if(event==="FAILED")console.error(line);else console.info(line);
}

export async function processOfficeJob({repository,storage,job,token,convert=convertOfficePdf,log=writeOfficeLog}){
  let previewKey;
  const started=Date.now();
  const context={fileName:job.fileName,versionId:job.versionId,projectId:job.projectId,revision:job.revision};
  log("STARTED",context);
  try{
    const source=await storage.get(job.fileKey);
    if(!source)throw new Error("원본 첨부파일을 찾을 수 없습니다.");
    const sourceBytes=Buffer.from(await new Response(source.body).arrayBuffer());
    const pdf=await convert(sourceBytes,job.fileName);
    // A stale lease writes a distinct object and cannot overwrite a newer PDF.
    previewKey=`${job.projectId}/${job.deliverableId}/${job.versionId}-office-${token}.pdf`;
    await storage.put(previewKey,new Uint8Array(pdf).buffer,{httpMetadata:{contentType:"application/pdf"},customMetadata:{sourceVersionId:job.versionId,previewKind:"office-pdf"}});
    if(await repository.finish(job.versionId,token,previewKey)){
      log("COMPLETED",{...context,elapsedMs:Date.now()-started,pdfBytes:pdf.byteLength});
    }else{
      await storage.delete(previewKey);
      log("SKIPPED",{...context,elapsedMs:Date.now()-started,reason:"Revision deleted or worker lease superseded"});
    }
  }catch(reason){
    if(previewKey)await storage.delete(previewKey).catch(()=>{});
    const message=reason?.code==="ENOENT"?"LibreOffice 실행 경로 또는 변환 결과를 확인해 주세요.":reason?.killed?"미리보기 변환 제한 시간을 초과했습니다.":String(reason?.message||"미리보기 생성에 실패했습니다.").slice(0,500);
    log("FAILED",{...context,elapsedMs:Date.now()-started,error:message});
    await repository.finish(job.versionId,token,null,message);
  }
}
