// Company-scoped revisions keep project/dashboard caches from reusing old master names.
const revisions=new Map<string,number>();
export const projectMasterRevision=(companyId:string)=>revisions.get(companyId)??0;
export function invalidateProjectMaster(companyId:string){
  revisions.set(companyId,projectMasterRevision(companyId)+1);
}
