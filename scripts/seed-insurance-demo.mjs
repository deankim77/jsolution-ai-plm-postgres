import fs from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {insuranceDemoProfiles,buildInsuranceDemo,defaultInsuranceDefinitions} from "./demo-data/insurance-projects.mjs";
import {insuranceDocumentSpecs} from "../services/insurance-demo-document-service.mjs";
import {seedInsuranceDemos} from "../services/insurance-demo-seed-service.mjs";
import {writeBusinessBriefDocx} from "./lib/minimal-docx.mjs";

if(fs.existsSync(".env"))process.loadEnvFile(".env");
const asOf=process.env.INSURANCE_DEMO_DATE||new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
const out=resolve(".demo-generated/insurance-g6");
const previews=insuranceDemoProfiles.map(profile=>buildInsuranceDemo(profile,defaultInsuranceDefinitions[profile.templateCode],asOf));
for(const demo of previews)console.log(`${demo.profile.name}: ${demo.startDate} 시작 / 기준일 ${asOf} / 지연 ${demo.profile.delayedCodes.length}개 / 문서 리비전 ${insuranceDocumentSpecs(demo).length}개`);
const renderDocument=async spec=>{
  const path=join(out,spec.fileName);
  await writeBusinessBriefDocx(path,spec.document);
  return readFile(path);
};
if(process.argv.includes("--documents-only")){
  await mkdir(out,{recursive:true});
  const manifest=[];
  for(const demo of previews)for(const spec of insuranceDocumentSpecs(demo)){
    await renderDocument(spec);
    manifest.push({project:demo.profile.code,task:spec.taskCode,name:spec.name,revision:spec.revision,date:spec.date,fileName:spec.fileName,note:spec.note});
  }
  await writeFile(join(out,"manifest.json"),JSON.stringify(manifest,null,2),"utf8");
  console.log("문서 생성 완료: "+out);
} else if(process.argv.includes("--apply")){
  if(!process.env.DATABASE_URL)throw Error("DATABASE_URL이 필요합니다. 프로젝트 .env를 확인하세요.");
  const [{Pool},{drizzle},{insuranceDemoRepository},{getStorageAdapter}]=await Promise.all([import("pg"),import("drizzle-orm/node-postgres"),import("../db/repositories/insurance-demo-repository.mjs"),import("../lib/storage-adapter.ts")]);
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  try {
    const result=await seedInsuranceDemos(insuranceDemoRepository(drizzle(pool)),getStorageAdapter(),renderDocument,{companyId:process.env.PMS_COMPANY_ID,asOf,migrateUsers:!process.argv.includes("--keep-user-domain")});
    console.log(JSON.stringify(result,null,2));
    await mkdir(out,{recursive:true});
    await writeFile(join(out,"seed-result.json"),JSON.stringify(result,null,2),"utf8");
    console.log("등록 완료. 사용자 도메인이 변경되었다면 "+result.deanEmail+"로 다시 로그인하세요. 비밀번호는 동일합니다.");
  }finally{await pool.end();}
}else console.log("미리보기만 실행했습니다. --apply: 프로젝트·실적·파일·리비전 등록 및 사용자 도메인 변경 / --documents-only: 문서만 생성");
