import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {writeBusinessBriefDocx} from "../scripts/lib/minimal-docx.mjs";
import {insuranceDemoProfiles,buildInsuranceDemo,defaultInsuranceDefinitions} from "../scripts/demo-data/insurance-projects.mjs";
import {insuranceDocumentSpecs} from "../services/insurance-demo-document-service.mjs";

function storedZipEntries(bytes){
  const entries=new Map();let offset=0;
  while(bytes.readUInt32LE(offset)===0x04034b50){
    const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28),start=offset+30+nameLength+extraLength;
    entries.set(bytes.subarray(offset+30,offset+30+nameLength).toString("utf8"),bytes.subarray(start,start+size).toString("utf8"));
    offset=start+size;
  }
  return entries;
}
test("44개 DOCX에 정상 OOXML·보험 문맥·누적 리비전 변경 내용이 들어간다",async()=>{
  const temp=await mkdtemp(join(tmpdir(),"insurance-docx-"));
  try{
    let count=0;
    for(const profile of insuranceDemoProfiles){
      const demo=buildInsuranceDemo(profile,defaultInsuranceDefinitions[profile.templateCode],"2026-10-18");
      for(const spec of insuranceDocumentSpecs(demo)){
        const path=join(temp,spec.fileName);await writeBusinessBriefDocx(path,spec.document);
        const entries=storedZipEntries(await readFile(path)),xml=entries.get("word/document.xml");
        assert(entries.has("[Content_Types].xml"));assert(entries.has("word/styles.xml"));
        assert(xml.includes(profile.name));assert(xml.includes(spec.name));assert(xml.includes("가상"));
        assert(entries.get("word/header1.xml").includes("손해보험"));assert(!entries.get("word/header1.xml").includes("자동차"));
        if(spec.revision>1)for(const change of profile.revisions[spec.taskCode].slice(0,spec.revision-1))assert(xml.includes(change));
        count++;
      }
    }
    assert.equal(count,44);
  }finally{await rm(temp,{recursive:true,force:true});}
});
