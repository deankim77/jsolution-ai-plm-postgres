"use client";
import {useEffect,useState} from "react";
import {Check,RefreshCw,Settings} from "lucide-react";
import {featureKeys,featureLabels,type FeatureSettings} from "../../lib/feature-settings";
import {useFeatureSettings} from "./feature-settings";
export function FeatureSettingsWorkspace() {
  const {features,loading,error,canEdit,reload,save}=useFeatureSettings();
  const [draft,setDraft]=useState<FeatureSettings>(features),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  useEffect(()=>{setDraft(features);},[features]);
  const submit=async()=>{setSaving(true);setNotice("");try{await save(draft);setNotice("사용 기능 설정을 저장했습니다.");}catch(reason){setNotice(reason instanceof Error?reason.message:"설정을 저장하지 못했습니다.");}finally{setSaving(false);}};
  return <section className="wv2-operational-settings"><header><div><Settings size={20}/><span><small>FEATURE SETTINGS</small><h2>사용 기능 설정</h2><p>회사 공통 메뉴와 관련 탭의 표시 여부를 설정합니다. 기존 데이터와 워크플로우 유형은 유지됩니다.</p></span></div><button className="primary" onClick={submit} disabled={loading||saving||Boolean(error)||!canEdit}><Check size={18}/>{saving?"저장 중…":"변경 저장"}</button></header>{loading?<p role="status">설정을 불러오는 중…</p>:error?<p role="alert">{error} <button onClick={reload}><RefreshCw size={18}/>다시 불러오기</button></p>:<div className="form checks">{featureKeys.map(key=><label key={key}><input type="checkbox" checked={draft[key]} disabled={saving||!canEdit} onChange={event=>setDraft(current=>({...current,[key]:event.target.checked}))}/>{featureLabels[key]} · {draft[key]?"사용":"사용 안 함"}</label>)}<p>PART·BOM은 WBS의 BOM 탭, 도면관리는 문서·산출물 및 WBS의 도면 탭에도 함께 적용됩니다.</p>{!canEdit&&<p>시스템 관리자만 변경할 수 있습니다.</p>}</div>}{notice&&<p className="wv2-module-notice" role="status">{notice}</p>}</section>;
}
