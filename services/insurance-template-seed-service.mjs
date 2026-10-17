export async function installInsuranceTemplates(repository,templates,{companyId,userId}={}) {
  return repository.transaction(async tx=>{
    const companies=await tx.companies();
    const company=companyId?companies.find(item=>item.id===companyId):companies.length===1?companies[0]:null;
    if(!company) throw new Error("등록할 회사를 하나로 확정할 수 없습니다. PMS_COMPANY_ID에 대상 회사 ID를 지정하세요.");
    const administrators=await tx.administrators(company.id);
    const administrator=userId?administrators.find(item=>item.id===userId):administrators[0];
    if(!administrator) throw new Error("대상 회사에 활성 관리자 계정이 필요합니다. PMS_SEED_USER_ID를 지정하면 해당 관리자 명의로 등록합니다.");
    await tx.lock(company.id);
    const results=[];
    for(const template of templates) {
      const existing=await tx.find(company.id,template.code);
      if(existing) {results.push({code:template.code,name:template.name,status:"skipped"});continue;}
      await tx.create(company.id,administrator.id,template);
      results.push({code:template.code,name:template.name,status:"created"});
    }
    return {company,results};
  });
}
