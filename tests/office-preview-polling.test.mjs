import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import {serveOfficePreview} from "../services/office-preview-service.mjs";

const version={versionId:"v1",fileName:"report.docx",fileKey:"original",previewFileKey:"preview"};
test("ready status reads PDF metadata but never loads file bytes",async()=>{
  for(const exists of [true,false]){
    const calls=[];
    const storage={async head(key){calls.push(key);return exists?{size:10}:null},async get(){assert.fail("status must not load PDF bytes")}};
    const response=await serveOfficePreview({},storage,{...version,conversionStatus:"office_pdf_ready"},true);
    assert.equal(response.status,exists?200:422);
    assert.equal((await response.json()).state,exists?"ready":"failed");
    assert.deepEqual(calls,["preview"]);
  }
});
const route=fs.readFileSync(new URL("../app/api/projects/[projectId]/deliverables/route.ts",import.meta.url),"utf8");
const getSource=stripTypeScriptTypes(route.slice(route.indexOf("export async function GET("),route.indexOf("\nexport async function POST("))).replace("export async function","async function");
function getHandler(input,storage){
  const db={prepare(sql){return {bind(){return this},async first(){
    if(sql.includes("FROM deliverable_versions"))return input;
    if(sql.includes("FROM projects"))return {id:"p1"};
    throw new Error("Unexpected query: "+sql);
  }}}};
  return new Function("runtime","ensureTablesOnce","resolveRequestContext","requireProjectAccess","contextErrorResponse","isOfficeDocument","officePreviewRepository","getDb","serveOfficePreview",
    getSource+";return GET;")(
    async()=>({DB:db,FILES:storage}),async()=>{},async()=>({companyId:"c1"}),async()=>{},()=>null,
    name=>/\.docx$/i.test(name),()=>({}),()=>({}),serveOfficePreview,
  );
}
test("Office status endpoint bypasses original file reads for queued, converting and ready jobs",async()=>{
  for(const conversionStatus of ["office_pdf_pending","office_pdf_converting","office_pdf_ready"]){
    const storage={async get(){assert.fail("status endpoint must not load original or PDF bytes")},async head(){return {size:20}}};
    const handler=getHandler({...version,conversionStatus},storage);
    const response=await handler(new Request("http://localhost/api/projects/p1/deliverables?versionId=v1&preview=1&previewStatus=1"),{params:Promise.resolve({projectId:"p1"})});
    assert.equal(response.status,conversionStatus==="office_pdf_ready"?200:202);
  }
});
test("Office PDF display reads only the preview while download still reads the original",async()=>{
  const reads=[];
  const storage={async get(key){reads.push(key);return {body:new Blob([key==="preview"?"%PDF-preview":"original bytes"]).stream()}}};
  const handler=getHandler({...version,conversionStatus:"office_pdf_ready"},storage);
  const response=await handler(new Request("http://localhost/api/projects/p1/deliverables?versionId=v1&preview=1"),{params:Promise.resolve({projectId:"p1"})});
  assert.equal(response.headers.get("content-type"),"application/pdf");
  assert.equal(await response.text(),"%PDF-preview");
  assert.deepEqual(reads,["preview"]);
  const download=await handler(new Request("http://localhost/api/projects/p1/deliverables?versionId=v1"),{params:Promise.resolve({projectId:"p1"})});
  assert.equal(await download.text(),"original bytes");
  assert.deepEqual(reads,["preview","original"]);
});

test("document HTTP routes cannot perform schema changes during reads or writes",()=>{
  const listing=fs.readFileSync(new URL("../app/api/deliverables/route.ts",import.meta.url),"utf8");
  for(const source of [route,listing]){
    assert.ok(!/\b(?:ALTER TABLE|CREATE TABLE|CREATE (?:UNIQUE )?INDEX|DROP INDEX)\b/i.test(source));
    assert.ok(!/ensureCompatibilityOnce|ensureTablesOnce|ensureWorkflowFoundation|ensureProjectDataFoundation/.test(source));
  }
});
