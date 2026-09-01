import {access,copyFile,mkdir,readFile,readdir,rename,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {spawn} from "node:child_process";

const BASE_URL=(process.env.CAD_WORKER_BASE_URL||"http://127.0.0.1:5174").replace(/\/$/,"");
const ROOT=process.env.CAD_WORKER_ROOT||join(process.cwd(),"cad-worker");
const INBOX=join(ROOT,"inbox"),PROCESSING=join(ROOT,"processing"),OUTPUT=join(ROOT,"output"),DONE=join(ROOT,"done"),ERROR=join(ROOT,"error");
const D2P_EXE=process.env.AUTODWG_D2P_EXE||"C:\\Program Files (x86)\\AutoDWG\\AutoDWG DWG to PDF Converter 2020\\D2P.exe";
const IDLE_POLL_MS=Number(process.env.CAD_WORKER_IDLE_POLL_MS||15000);
const ACTIVE_POLL_MS=Number(process.env.CAD_WORKER_ACTIVE_POLL_MS||1000);
const TIMEOUT_MS=Number(process.env.AUTODWG_CONVERT_TIMEOUT_MS||120000);
const seen=new Set();

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const safe=value=>String(value||"").replace(/[\\/:*?\"<>|]/g,"_").trim();
async function ensureFolders(){for(const dir of [INBOX,PROCESSING,OUTPUT,DONE,ERROR])await mkdir(dir,{recursive:true});}
function runD2P(input,output){return new Promise((resolve,reject)=>{const child=spawn(D2P_EXE,["/InFile",input,"/OutFile",output],{windowsHide:true,stdio:["ignore","pipe","pipe"]});const out=[],err=[];const timer=setTimeout(()=>{child.kill();reject(new Error(`AutoDWG conversion timed out after ${TIMEOUT_MS} ms.`))},TIMEOUT_MS);child.stdout.on("data",chunk=>out.push(chunk));child.stderr.on("data",chunk=>err.push(chunk));child.once("error",error=>{clearTimeout(timer);reject(error)});child.once("close",code=>{clearTimeout(timer);if(code!==0)return reject(new Error(`D2P.exe failed (${code}): ${Buffer.concat(err).toString("utf8").trim()||Buffer.concat(out).toString("utf8").trim()}`));resolve()})})}
async function waitForFile(path,timeout=10000){const started=Date.now();while(Date.now()-started<timeout){try{await access(path);const data=await readFile(path);if(data.length>4&&data.subarray(0,4).toString()==="%PDF")return}catch{}await sleep(200)}throw new Error("AutoDWG finished but a valid PDF was not created.")}

async function listPending(){
  const response=await fetch(`${BASE_URL}/api/deliverables?mode=latest&limit=200&documentKind=drawing&registration=completed`,{cache:"no-store"});
  if(!response.ok)throw new Error(`PLM 목록 조회 실패 ${response.status}`);
  const data=await response.json();const items=data.deliverables||[],versions=data.versions||[];const byId=new Map(items.map(item=>[item.id,item]));
  return versions.filter(v=>/\.dwg$/i.test(v.fileName||"")&&v.conversionStatus!=="converted"&&v.conversionStatus!=="converting").map(v=>({version:v,item:byId.get(v.deliverableId)})).filter(row=>row.item);
}
async function downloadOriginal(projectId,versionId){const response=await fetch(`${BASE_URL}/api/projects/${encodeURIComponent(projectId)}/deliverables?versionId=${encodeURIComponent(versionId)}`,{cache:"no-store"});if(!response.ok)throw new Error(`DWG 다운로드 실패 ${response.status}`);return Buffer.from(await response.arrayBuffer())}
async function uploadPdf(job,pdfPath){const pdf=await readFile(pdfPath);const form=new FormData();form.set("versionId",job.versionId);form.set("pdf",new Blob([pdf],{type:"application/pdf"}),job.pdfFileName);const response=await fetch(`${BASE_URL}/api/projects/${encodeURIComponent(job.projectId)}/dwg-conversion-result`,{method:"POST",body:form});const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error||`PDF 자동 등록 실패 ${response.status}`);return result}

async function stageJob(row){
  const {version,item}=row;if(seen.has(version.id))return false;
  const drawingCode=safe(item.drawingCode||`DRAWING-${item.id.slice(0,8)}`),rev=`Rev${String(Number(version.revision)||1).padStart(2,"0")}`,base=`${drawingCode}_${rev}`;
  const dwgName=`${base}.dwg`,pdfName=`${base}.pdf`,jobName=`${base}.job.json`;const dwgPath=join(INBOX,dwgName),jobPath=join(INBOX,jobName);
  const source=await downloadOriginal(version.projectId,version.id);await writeFile(dwgPath,source);
  const job={projectId:version.projectId,deliverableId:version.deliverableId,versionId:version.id,drawingCode:item.drawingCode||null,revision:Number(version.revision)||1,originalFileName:version.fileName,dwgFileName:dwgName,pdfFileName:pdfName,createdAt:new Date().toISOString()};await writeFile(jobPath,JSON.stringify(job,null,2),"utf8");seen.add(version.id);console.log(`[cad-worker] queued ${dwgName}`);return true
}
async function processJobs(){
  const names=(await readdir(INBOX)).filter(name=>name.endsWith(".job.json"));let processed=0;
  for(const jobName of names){let job;let processingJob=join(PROCESSING,jobName);try{job=JSON.parse(await readFile(join(INBOX,jobName),"utf8"));const inboxDwg=join(INBOX,job.dwgFileName),processingDwg=join(PROCESSING,job.dwgFileName);await rename(join(INBOX,jobName),processingJob);await rename(inboxDwg,processingDwg);const outputPdf=join(OUTPUT,job.pdfFileName);console.log(`[cad-worker] converting ${job.dwgFileName} -> ${job.pdfFileName}`);await runD2P(processingDwg,outputPdf);await waitForFile(outputPdf);await uploadPdf(job,outputPdf);await copyFile(processingDwg,join(DONE,job.dwgFileName));await copyFile(outputPdf,join(DONE,job.pdfFileName));await writeFile(join(DONE,jobName),JSON.stringify({...job,status:"converted",completedAt:new Date().toISOString()},null,2),"utf8");await rm(processingDwg,{force:true});await rm(processingJob,{force:true});await rm(outputPdf,{force:true});processed++;console.log(`[cad-worker] completed ${job.pdfFileName}`)}catch(error){const message=error instanceof Error?error.message:String(error);console.error(`[cad-worker] failed ${jobName}: ${message}`);try{if(job){await writeFile(join(ERROR,jobName),JSON.stringify({...job,status:"failed",error:message,failedAt:new Date().toISOString()},null,2),"utf8");for(const name of [job.dwgFileName,job.pdfFileName])for(const dir of [INBOX,PROCESSING,OUTPUT]){try{await rename(join(dir,name),join(ERROR,name));break}catch{}}}else await rename(processingJob,join(ERROR,jobName))}catch{}}}
  return processed
}
async function tick(){try{const rows=await listPending();let queued=0;for(const row of rows)if(await stageJob(row))queued++;const processed=await processJobs();return queued+processed}catch(error){console.error(`[cad-worker] poll failed: ${error instanceof Error?error.message:error}`);return 0}}

await ensureFolders();await access(D2P_EXE);console.log(`[cad-worker] PLM: ${BASE_URL}`);console.log(`[cad-worker] root: ${ROOT}`);console.log(`[cad-worker] D2P.exe: ${D2P_EXE}`);console.log(`[cad-worker] idle check: ${IDLE_POLL_MS} ms / active check: ${ACTIVE_POLL_MS} ms`);for(;;){const activity=await tick();await sleep(activity?ACTIVE_POLL_MS:IDLE_POLL_MS)}
