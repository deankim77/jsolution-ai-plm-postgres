import {readFile,writeFile} from "node:fs/promises";

const target="app/v2/work-panel.tsx";
let source=await readFile(target,"utf8");
const before=source;

function replaceOnce(from,to,label){
  if(!source.includes(from))throw new Error(`${label} did not match expected source`);
  source=source.replace(from,to);
}

replaceOnce(
  'if(!activeProject||!file||(!uploadId&&!adding)){',
  'if(!file||(!uploadId&&!adding)){',
  'upload prerequisite'
);

replaceOnce(
  'form.set("file",file);try{const response=await fetch(`/api/projects/${activeProject.id}/deliverables`,{method:"POST",body:form});',
  'form.set("file",file);try{let targetProjectId=activeProject?.id||"";if(registrationOnly&&!selectedProjectId){const libraryResponse=await fetch("/api/library-project",{cache:"no-store"});const library=await libraryResponse.json();if(!libraryResponse.ok||!library.projectId)throw new Error(library.error||"공통 문서 라이브러리를 준비하지 못했습니다.");targetProjectId=String(library.projectId)}if(!targetProjectId)throw new Error("등록 대상 프로젝트를 확인하지 못했습니다.");const response=await fetch(`/api/projects/${targetProjectId}/deliverables`,{method:"POST",body:form});',
  'standalone target project resolution'
);

replaceOnce(
  'window.dispatchEvent(new CustomEvent("v2-deliverables-updated",{detail:{projectId:activeProject.id}}));if(registrationOnly){onCompleted();return}resetUpload();void load(activeProject.id,task?.id||"")',
  'window.dispatchEvent(new CustomEvent("v2-deliverables-updated",{detail:{projectId:targetProjectId}}));if(registrationOnly){onCompleted();return}resetUpload();void load(targetProjectId,task?.id||"")',
  'upload completion project id'
);

replaceOnce(
  'disabled={saving||!file||!activeProject||Boolean(selectedProjectId&&!selectedTaskId)||Boolean(adding&&!drawing&&!category)||Boolean(showDrawingFields&&(!name.trim()||!drawingType))}',
  'disabled={saving||!file||Boolean(!registrationOnly&&!activeProject)||Boolean(selectedProjectId&&!selectedTaskId)||Boolean(adding&&!drawing&&!category)||Boolean(showDrawingFields&&(!name.trim()||!drawingType))}',
  'standalone submit button condition'
);

if(source===before)throw new Error("No changes applied");
await writeFile(target,source,"utf8");
console.log("Standalone document/drawing registration restored in app/v2/work-panel.tsx");
