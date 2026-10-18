import {readMyWorkRoleChoices} from "../db/repositories/my-work-filter-repository";

function values(params:URLSearchParams,key:string){
  return Array.from(new Set((params.get(key)||"").split(",").map(value=>value.trim()).filter(Boolean))).slice(0,100);
}
export function parseMyWorkMultiFilters(params:URLSearchParams){
  return {projectIds:values(params,"projectIds"),roles:values(params,"roles").map(value=>value.toLowerCase())};
}
export async function getMyWorkRoleOptions(companyId:string,userId:string){
  const rows=await readMyWorkRoleChoices(companyId,userId);
  return Array.from(new Set(rows.flatMap(row=>[row.role,row.assignee]).filter((value):value is string=>Boolean(value)))).sort().map(value=>({value,label:value}));
}
