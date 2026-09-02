import {readFile,writeFile} from "node:fs/promises";

const path="app/api/deliverables/route.ts";
let source=await readFile(path,"utf8");

const old='const drawingIdentitySql="(COALESCE(d.drawing_code,\'\')<>\'\' OR COALESCE(d.document_kind,\'document\')=\'drawing\')";';
const next='const drawingIdentitySql="(COALESCE(d.document_kind,\'document\')=\'drawing\' OR (COALESCE(d.drawing_code,\'\')<>\'\' AND COALESCE(d.category,\'\')=\'DESIGN_DRAWING\'))";';

if(source.includes(next)){
  console.log("Drawing library filter already fixed.");
  process.exit(0);
}
if(!source.includes(old))throw new Error("drawingIdentitySql did not match expected source");
source=source.replace(old,next);
await writeFile(path,source,"utf8");
console.log("Drawing library filter fixed: drawing_code alone no longer classifies documents as drawings.");
