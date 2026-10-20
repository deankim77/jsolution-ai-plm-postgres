export type ReportSlide={title:string;body:string};
/** Shared page boundaries for preview and PPT. Explicit slides are never truncated. */
export function reportSlides(content:string):ReportSlide[]{
  const parts=content.split(/(?=^슬라이드\s*\d+\s*[:.-])/m).map(value=>value.trim()).filter(Boolean);
  return parts.map(part=>{const [first,...rest]=part.split(/\r?\n/);return {title:first.replace(/^슬라이드\s*\d+\s*[:.-]\s*/,""),body:rest.join("\n")}});
}
