export const reportLabels={weekly:"주간보고서",meeting:"회의 안건",schedule:"Baseline 일정 분석"} as const;
export type ReportKind=keyof typeof reportLabels;
export type ReportProject={id:string;code:string;name:string};
export type ReportContextItem={id?:string;kind?:string;title?:string;meta?:string};
export type ReportResult={id:string;conversationId:string;projectId:string;projectName:string;projectCode:string;kind:ReportKind;title:string;period:string;author:string;createdAt:number;format:"pptx"|"docx";content?:string};
export type SavedReportRow={id:string;conversationId:string;title:string;source:string;contextTitle:string;contextItems:string;prompt:string|null;createdAt:number;author:string|null;excerpt:string;hasSlides:boolean;content?:string};
export function reportContextItems(value:string):ReportContextItem[]{try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[]}catch{return[]}}
export function savedReport(row:SavedReportRow,projects:ReportProject[]):ReportResult|null{
  if(!row.excerpt.trim()||/^(AI 연결 오류|AI 응답 생성에 실패|AI 서비스 연결에 실패|OpenAI (인증|사용 한도|모델).*확인|질문을 저장했습니다)/.test(row.excerpt.trim()))return null;
  const items=reportContextItems(row.contextItems),marker=items.find(item=>item.kind?.startsWith("보고서:"));
  const explicit=marker?.kind?.split(":")[1];
  const prompt=row.prompt||row.title;
  const kind:ReportKind|undefined=explicit&&explicit in reportLabels?explicit as ReportKind:/주간\s*(프로젝트\s*)?보고/.test(prompt)?"weekly":/회의\s*안건|회의.*준비/.test(prompt)?"meeting":/Baseline.*(비교|영향|현재 계획)|기준.*일정.*비교/i.test(prompt)?"schedule":undefined;
  if(!kind)return null;
  const linked=items.find(item=>item.id&&projects.some(project=>project.id===item.id)&&(/프로젝트|보고서:/.test(item.kind||"")));
  const project=projects.find(project=>project.id===(marker?.id||linked?.id))||[...projects].sort((a,b)=>b.name.length-a.name.length).find(project=>row.contextTitle.startsWith(project.name+" ·")||items.some(item=>item.title===project.name||item.title===`${project.name} 실행 현황`));
  if(!project)return null;
  const period=marker?.meta?.match(/보고 기간: (\d{4}-\d{2}-\d{2} ~ \d{4}-\d{2}-\d{2})/)?.[1]||"기간 미지정";
  return {id:row.id,conversationId:row.conversationId,projectId:project.id,projectName:project.name,projectCode:project.code,kind,title:`${project.name} · ${reportLabels[kind]}`,period,author:row.author||"작성자 미지정",createdAt:Number(row.createdAt),format:row.hasSlides?"pptx":"docx",...(row.content!==undefined?{content:row.content}:{})};
}
