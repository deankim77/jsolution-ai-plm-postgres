import fs from "node:fs";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {buildItSystemDemo,itSystemTemplate} from "./demo-data/it-system-project.mjs";
import {itSystemDocumentSpecs} from "../services/it-system-demo-document-service.mjs";
import {seedItSystemDemo} from "../services/it-system-demo-seed-service.mjs";
import {writeBusinessBriefDocx} from "./lib/minimal-docx.mjs";

if(fs.existsSync(".env"))process.loadEnvFile(".env");
const asOf=process.env.IT_DEMO_DATE||new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}),demo=buildItSystemDemo(asOf),out=resolve(".demo-generated/it-system-g6");
console.log(`${itSystemTemplate.name}: G1~G6 · 2레벨 · ${demo.tasks.length}행`);
console.log(`${demo.profile.name}: ${demo.startDate} 시작 / 기준일 ${asOf} / PM Dean`);
const renderDocument=async spec=>{const path=join(out,spec.fileName);await writeBusinessBriefDocx(path,spec.document);return readFile(path);};
if(process.argv.includes("--documents-only")){
  await mkdir(out,{recursive:true});const specs=itSystemDocumentSpecs(demo);
  for(const spec of specs)await renderDocument(spec);
  await writeFile(join(out,"manifest.json"),JSON.stringify(specs.map(({document,text,...rest})=>rest),null,2),"utf8");
  console.log(`문서 생성 완료: ${specs.length}개 리비전 / ${out}`);
}else if(process.argv.includes("--apply")){
  if(!process.env.DATABASE_URL)throw Error("DATABASE_URL이 필요합니다. 프로젝트 .env를 확인하세요.");
  const [{Pool},{drizzle},{itSystemDemoRepository},{getStorageAdapter}]=await Promise.all([import("pg"),import("drizzle-orm/node-postgres"),import("../db/repositories/it-system-demo-repository.mjs"),import("../lib/storage-adapter.ts")]);
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  try{const result=await seedItSystemDemo(itSystemDemoRepository(drizzle(pool)),getStorageAdapter(),renderDocument,{companyId:process.env.PMS_COMPANY_ID,asOf});console.log(JSON.stringify(result,null,2));console.log("완료. 브라우저를 새로고침하여 템플릿 및 프로젝트 목록을 확인하세요.");}finally{await pool.end();}
}else console.log("미리보기만 실행했습니다. --apply: 템플릿·프로젝트·실적·산출물·리비전 등록 / --documents-only: 문서만 생성. 실행 중인 서버를 중지하거나 브라우저에 로그인할 필요는 없습니다.");
