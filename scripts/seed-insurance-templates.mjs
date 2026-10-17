import {insuranceTemplates} from "./demo-data/insurance-g6-templates.mjs";

const apply = process.argv.includes("--apply");
const base = new URL(process.env.PMS_URL || "http://localhost:5174");
if (!["http:","https:"].includes(base.protocol) || base.username || base.password) throw new Error("PMS_URL은 사용자 정보 없는 HTTP(S) 주소여야 합니다.");
if (process.env.PMS_COOKIE && base.protocol !== "https:" && !["localhost","127.0.0.1","[::1]"].includes(base.hostname)) throw new Error("원격 서버의 세션은 HTTPS로만 전달할 수 있습니다.");
const request = async (path,body) => {
  const response = await fetch(new URL(path,base),{method:body?"POST":"GET",redirect:"error",headers:{accept:"application/json",...(body?{"content-type":"application/json"}:{}),...(process.env.PMS_COOKIE?{cookie:process.env.PMS_COOKIE}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`${path}: ${data.error || response.status}`);
  return data;
};
if (!apply) {
  for (const template of insuranceTemplates) console.log(`${template.code} | ${template.name} | Gate 6개 · 실행 18개 · 승인 6개 · 총 ${template.definition.wbs.length}행`);
  console.log("등록하려면 --apply를 추가하세요. 기존 템플릿과 프로젝트는 수정하지 않습니다.");
} else {
  const session = await request("/api/session");
  if (!session.user?.id) throw new Error("로그인 세션을 확인하세요. 필요한 경우 PMS_COOKIE 환경변수로 서버의 로그인 세션을 전달하세요.");
  const listed = await request("/api/templates");
  if (!Array.isArray(listed.templates)) throw new Error("템플릿 목록 응답이 올바르지 않습니다.");
  for (const template of insuranceTemplates) {
    if (listed.templates.some(item=>item.code===template.code)) {
      console.log(`기존 템플릿 유지: ${template.code}`);
      continue;
    }
    await request("/api/templates",template);
    console.log(`등록 완료: ${template.name}`);
  }
}
