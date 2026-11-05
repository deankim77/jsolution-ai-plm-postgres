import test from "node:test";
import assert from "node:assert/strict";
import {isOfficeDocument,officePreviewState} from "../lib/office-preview.mjs";
import {requestOfficePreview,serveOfficePreview} from "../services/office-preview-service.mjs";
import {processOfficeJob,convertOfficePdf} from "../services/office-pdf-converter.mjs";

const version={versionId:"v1",fileName:"report.docx"};
const fakeStorage=()=>{
  const files=new Map([["original",new TextEncoder().encode("original office bytes")]]);
  return {files,async get(key){const bytes=files.get(key);return bytes?{body:new Blob([bytes]).stream()}:null},async put(key,bytes){files.set(key,bytes)},async delete(key){files.delete(key)}};
};
test("Office detection leaves PDF, images, text and AI content outside conversion",()=>{
  for(const ext of ["doc","docx","xls","xlsx","ppt","pptx"])assert.equal(isOfficeDocument(`file.${ext.toUpperCase()}`),true);
  for(const name of ["file.pdf","file.png","file.txt","file.docx.exe",""])assert.equal(isOfficeDocument(name),false);
  assert.equal(officePreviewState("office_text_cached"),"pending");
});
test("enqueue returns without invoking a converter",async()=>{
  let calls=0;const repository={async enqueue(id,retry){calls++;assert.equal(id,"v1");assert.equal(retry,false);return true}};
  assert.equal(await requestOfficePreview(repository,version),true);assert.equal(calls,1);
  for(const status of ["office_pdf_ready","office_pdf_pending","office_pdf_converting","office_pdf_failed"]){
    assert.equal(await requestOfficePreview(repository,{...version,conversionStatus:status}),false);
  }
  assert.equal(calls,1);
});
test("old Office text previews are lazily queued for PDF",async()=>{
  let queued=false;
  const response=await serveOfficePreview({async enqueue(){queued=true}},fakeStorage(),{...version,conversionStatus:"office_text_cached"});
  assert.equal(response.status,202);assert.equal((await response.json()).state,"pending");assert.equal(queued,true);
  assert.equal(response.headers.get("cache-control"),"no-store");
});
test("pending status cannot be cached as a PDF or mistaken for success",async()=>{
  const response=await serveOfficePreview({},fakeStorage(),{...version,conversionStatus:"office_pdf_converting"},true);
  assert.equal(response.status,202);assert.equal(response.headers.get("retry-after"),"3");
});
test("ready PDF is returned from storage, while status query only returns JSON",async()=>{
  const storage=fakeStorage();await storage.put("preview",new TextEncoder().encode("%PDF-preview"));
  const ready={...version,conversionStatus:"office_pdf_ready",previewFileKey:"preview"};
  const status=await serveOfficePreview({},storage,ready,true);assert.deepEqual(await status.json(),{state:"ready"});
  const response=await serveOfficePreview({},storage,ready);assert.equal(response.headers.get("content-type"),"application/pdf");assert.equal(await response.text(),"%PDF-preview");
});
test("conversion failure and missing converted file preserve original download",async()=>{
  for(const input of [{conversionStatus:"office_pdf_failed",conversionError:"timeout"},{conversionStatus:"office_pdf_ready",previewFileKey:"absent"}]){
    const response=await serveOfficePreview({},fakeStorage(),{...version,...input});
    assert.equal(response.status,422);assert.equal((await response.json()).downloadAvailable,true);
  }
});
test("explicit retry is enqueued even for a failed version",async()=>{
  let retried=false;await requestOfficePreview({async enqueue(id,retry){retried=retry}}, {...version,conversionStatus:"office_pdf_failed"},true);assert.equal(retried,true);
});
const job={...version,fileKey:"original",projectId:"p1",deliverableId:"d1",revision:1};
test("worker stores separate PDF linked to the precise version without altering original",async()=>{
  const storage=fakeStorage();let finished;
  await processOfficeJob({storage,job,token:"lease1",repository:{async finish(...args){finished=args;return true}},async convert(bytes,name){assert.equal(bytes.toString(),"original office bytes");assert.equal(name,"report.docx");return Buffer.from("%PDF-test")}});
  assert.equal(finished[0],"v1");assert.equal(finished[1],"lease1");assert.equal(storage.files.size,2);
  assert.equal(new TextDecoder().decode(storage.files.get("original")),"original office bytes");
});
test("stale or deleted job removes its generated object",async()=>{
  const storage=fakeStorage();await processOfficeJob({storage,job,token:"old",repository:{async finish(){return false}},async convert(){return Buffer.from("%PDF-test")}});assert.equal(storage.files.size,1);
});
test("worker records conversion failure and retains original",async()=>{
  const storage=fakeStorage();let finished;
  await processOfficeJob({storage,job,token:"lease",repository:{async finish(...args){finished=args;return true}},async convert(){throw new Error("invalid document")}});
  assert.equal(finished[3],"invalid document");assert.equal(storage.files.size,1);
});
test("missing source is a recoverable failure",async()=>{
  let error;await processOfficeJob({storage:fakeStorage(),job:{...job,fileKey:"missing"},token:"lease",repository:{async finish(id,token,key,message){error=message;return true}},async convert(){assert.fail("must not convert a missing source")}});assert.match(error,/원본/);
});
test("converter rejects unsupported, empty and oversized input before launching LibreOffice",async()=>{
  await assert.rejects(convertOfficePdf(Buffer.from("x"),"file.exe"),/지원하지/);
  await assert.rejects(convertOfficePdf(Buffer.alloc(0),"file.docx"),/빈 파일/);
  await assert.rejects(convertOfficePdf(Buffer.alloc(2),"file.docx",{maxBytes:1}),/용량/);
});
