"use client";

import {useEffect,useState} from "react";
import {Download,FileText,RefreshCw} from "lucide-react";

type State={kind:"pending"|"ready"|"failed"|"unavailable";message?:string};
/** The same status contract is used by every uploaded Office document viewer. */
export default function OfficeDocumentPreview({projectId,versionId,title}:{projectId:string;versionId:string;title:string}){
  const [state,setState]=useState<State>({kind:"pending"});
  const [attempt,setAttempt]=useState(0),[retrying,setRetrying]=useState(false);
  const url=`/api/projects/${encodeURIComponent(projectId)}/deliverables?versionId=${encodeURIComponent(versionId)}`;
  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    setState({kind:"pending"});
    const check=async()=>{
      try{
        const response=await fetch(`${url}&preview=1&previewStatus=1`,{cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if(controller.signal.aborted)return;
        if(response.status===202&&data.state==="pending"){
          setState({kind:"pending"});timer=setTimeout(check,3000);return;
        }
        if(response.ok&&data.state==="ready"){setState({kind:"ready"});return}
        setState({kind:data.state==="failed"?"failed":"unavailable",message:data.error||"미리보기 상태를 확인하지 못했습니다."});
      }catch(reason){if(!controller.signal.aborted)setState({kind:"unavailable",message:reason instanceof Error?reason.message:"미리보기 상태를 확인하지 못했습니다."})}
    };
    void check();return()=>{controller.abort();clearTimeout(timer)};
  },[url,attempt]);
  const retry=async()=>{
    if(state.kind==="unavailable"){setAttempt(value=>value+1);return}
    setRetrying(true);
    try{
      const response=await fetch(`/api/projects/${encodeURIComponent(projectId)}/deliverables`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"retry-conversion",versionId})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"다시 생성하지 못했습니다.");
      setAttempt(value=>value+1);
    }catch(reason){setState({kind:"failed",message:reason instanceof Error?reason.message:"다시 생성하지 못했습니다."})}
    finally{setRetrying(false)}
  };
  if(state.kind==="ready")return <iframe className="document-native-pdf-preview" src={`${url}&preview=1`} title={`${title} PDF 미리보기`}/>;
  return <div className="wv2-preview-empty document-native-preview-empty" style={{width:"100%",flex:1,minWidth:0}} role="status" aria-live="polite">
    {state.kind==="pending"?<RefreshCw size={24}/>:<FileText size={24}/>}
    <b>{state.kind==="pending"?"미리보기를 준비하고 있습니다.":state.kind==="failed"?"미리보기 생성에 실패했습니다.":"미리보기 상태를 확인하지 못했습니다."}</b>
    <p>{state.kind==="pending"?"원본 첨부는 완료되었습니다. PDF 변환이 끝나면 자동으로 표시됩니다.":state.message}</p>
    <div>{state.kind!=="pending"&&<button disabled={retrying} onClick={()=>void retry()}><RefreshCw size={18}/>{retrying?"요청 중…":state.kind==="unavailable"?"다시 확인":"변환 다시 시도"}</button>}<a href={url} download><Download size={18}/>원본 다운로드</a></div>
  </div>;
}
