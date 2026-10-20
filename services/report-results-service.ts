import {readReportProjects,readReportResults,readPeriodActuals} from "../db/repositories/report-results-repository";
import {savedReport} from "../lib/report-results";
import {RequestContextError,type RequestContext} from "../db/request-context";

export async function loadReportResults(context:RequestContext,options:{id?:string;offset?:number}){
  const offset=Math.max(0,Math.floor(options.offset||0));
  const [projects,rows]=await Promise.all([readReportProjects(context.companyId),readReportResults(context.companyId,context.userId,{...options,offset})]);
  const reports=rows.map(row=>savedReport(row,projects)).filter((row):row is NonNullable<typeof row>=>Boolean(row));
  if(options.id&&!reports.length)throw new RequestContextError("저장된 보고서를 찾을 수 없습니다.",404);
  return {reports,hasMore:!options.id&&rows.length===100,nextOffset:offset+rows.length};
}

export async function loadReportActuals(projectId:string,from:string,to:string){
  const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!valid(from)||!valid(to)||from>to)throw new RequestContextError("올바른 보고 기간을 지정해 주세요.",400);
  return readPeriodActuals(projectId,from,to);
}
