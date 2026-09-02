import fs from "node:fs";

const path="app/v2/document-preview-workspace-impl.tsx";
let source=fs.readFileSync(path,"utf8");
const original=source;

source=source.replace(/\nconst PAGE_SIZE=50;\n/,"\n");
source=source.replace(
  /const buildParams=useCallback\(\(value=filters,offset=0,limit=PAGE_SIZE\)=>\{const params=new URLSearchParams\(\{mode:"latest",limit:String\(limit\),offset:String\(offset\),documentKind:libraryMode\}\);/,
  'const buildParams=useCallback((value=filters)=>{const params=new URLSearchParams({mode:"latest",documentKind:libraryMode});'
);
source=source.replace(
  /const requestKey=useMemo\(\(\)=>buildParams\(filters,0,PAGE_SIZE\)\.toString\(\),\[buildParams,filters\]\);/,
  'const requestKey=useMemo(()=>buildParams(filters).toString(),[buildParams,filters]);'
);
source=source.replace(
  /const fetchList=useCallback\(async\(offset:number,signal\?:AbortSignal,value=filters,limit=PAGE_SIZE\)=>\{const response=await fetch\(`\/api\/deliverables\?\$\{buildParams\(value,offset,limit\)\}`/,
  'const fetchList=useCallback(async(signal?:AbortSignal,value=filters)=>{const response=await fetch(`/api/deliverables?${buildParams(value)}`'
);
source=source.replace(/fetchList\(0,controller\.signal\)/g,'fetchList(controller.signal)');
source=source.replace(/fetchList\(0,controller\.signal,draftFilters,10\)/g,'fetchList(controller.signal,draftFilters)');

source=source.replace(/\n\s*const loadMore=useCallback\(async\(\)=>\{.*?\},\[loading,loadingMore,hasMore,items\.length,fetchList\]\);\n/s,"\n");
source=source.replace(/\s+onScroll=\{event=>\{const node=event\.currentTarget;if\(node\.scrollHeight-node\.scrollTop-node\.clientHeight<220\)void loadMore\(\)\}\}/g,"");

if(source===original)throw new Error("No document pagination patterns were changed. Inspect current source before retrying.");
if(/PAGE_SIZE=50|limit:String\(limit\)|offset:String\(offset\)|loadMore\(\)/.test(source))throw new Error("Document pagination residue remains after patch.");

fs.writeFileSync(path,source,"utf8");
console.log("Document/drawing library pagination removed; lists now load in one request.");
