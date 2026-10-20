import {RequestContextError,type RequestContext} from "../db/request-context";
import {readWeeklyReportData,saveWeeklyReport} from "../db/repositories/weekly-report-repository";
import {buildWeeklyReport,koreaDate} from "./weekly-report-builder";
import {loadReportResults} from "./report-results-service";

export async function createWeeklyReport(context:RequestContext,input:{projectId?:unknown;from?:unknown;to?:unknown}){
  const {projectId,from,to}=input;
  const valid=(date:unknown):date is string=>typeof date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
  const today=koreaDate(Date.now()/1000);
  if(typeof projectId!=="string"||!projectId||!valid(from)||!valid(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>6||from>today)throw new RequestContextError("프로젝트와 최대 7일의 보고 기간을 확인해 주세요.",400);
  const data=await readWeeklyReportData(context.companyId,projectId);
  if(!data.project)throw new RequestContextError("프로젝트를 찾을 수 없습니다.",404);
  const content=buildWeeklyReport(data,from,to,today);
  const id=await saveWeeklyReport(context,data.project,from,to,content);
  return (await loadReportResults(context,{id})).reports[0];
}
