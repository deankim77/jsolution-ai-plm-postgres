import fs from "node:fs";
import {insuranceTemplates} from "./demo-data/insurance-g6-templates.mjs";
import {installInsuranceTemplates} from "../services/insurance-template-seed-service.mjs";

if (!process.argv.includes("--apply")) {
  for (const template of insuranceTemplates) console.log(`${template.code} | ${template.name} | Gate 6개 · 실행 18개 · 승인 6개 · 총 ${template.definition.wbs.length}행`);
  console.log("등록하려면 --apply를 추가하세요. 서버 실행·브라우저 로그인은 필요하지 않습니다.");
} else {
  // Match the migration runner: process environment first, then project .env.
  if(!process.env.DATABASE_URL && fs.existsSync(".env")) process.loadEnvFile(".env");
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL이 필요합니다. 프로젝트 폴더의 .env를 확인하세요.");
  const [{Pool},{drizzle},{insuranceTemplateRepository}]=await Promise.all([
    import("pg"),import("drizzle-orm/node-postgres"),import("../db/repositories/insurance-template-seed-repository.mjs"),
  ]);
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  try {
    const result=await installInsuranceTemplates(insuranceTemplateRepository(drizzle(pool)),insuranceTemplates,{companyId:process.env.PMS_COMPANY_ID,userId:process.env.PMS_SEED_USER_ID});
    console.log(`대상 회사: ${result.company.name} (${result.company.id})`);
    for(const item of result.results) console.log(`${item.status==="created"?"등록 완료":"기존 템플릿 유지"}: ${item.name}`);
    console.log("완료. 브라우저에서 템플릿 목록을 새로고침하세요.");
  } finally {await pool.end();}
}
