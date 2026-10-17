export type PortfolioFilterProject={id:string;customerName?:string;partnerId?:string;projectTypeId?:string;projectTypeName?:string};
export const unassignedProjectType="__unassigned__";
export function filterPortfolioProjects<T extends PortfolioFilterProject>(projects:T[],customer:string,projectType:string):T[]{
  return projects.filter(item=>(!customer||(item.customerName||"거래처 미지정")===customer)&&(!projectType||(projectType===unassignedProjectType?!item.projectTypeId:item.projectTypeId===projectType)));
}
export function portfolioTypeOptions(projects:PortfolioFilterProject[]){
  return Array.from(new Map(projects.map(item=>[item.projectTypeId||unassignedProjectType,{id:item.projectTypeId||unassignedProjectType,name:item.projectTypeName||"유형 미지정"}])).values()).sort((a,b)=>a.name.localeCompare(b.name,"ko"));
}
export function portfolioGateRows<T extends PortfolioFilterProject>(projects:T[],gateFor:(id:string)=>string|undefined){
  const names=Array.from(new Set(projects.map(item=>item.customerName||"거래처 미지정"))).sort();
  return names.map(customerName=>({customerName,stages:["G1","G2","G3","G4","G5","G6","COMPLETE"].map(gateCode=>({gateCode,count:projects.filter(item=>(item.customerName||"거래처 미지정")===customerName&&gateFor(item.id)===gateCode).length}))}));
}
