"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from "react";
import {featureKeys,normalizeFeatureSettings,validFeatureSettings,type FeatureSettings} from "../../lib/feature-settings";
const hiddenFeatures=Object.fromEntries(featureKeys.map(key=>[key,false])) as FeatureSettings;
type FeatureContext={features:FeatureSettings;loading:boolean;error:string;canEdit:boolean;reload:()=>void;save:(value:FeatureSettings)=>Promise<void>};
const Context=createContext<FeatureContext|null>(null);
export function FeatureSettingsProvider({children}:{children:ReactNode}) {
  const [features,setFeatures]=useState<FeatureSettings>(hiddenFeatures),[loading,setLoading]=useState(true),[error,setError]=useState(""),[canEdit,setCanEdit]=useState(false);
  const requestVersion=useRef(0);
  const reload=useCallback(async()=>{
    const version=++requestVersion.current;
    try {
      const response=await fetch("/api/system/features",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok||!validFeatureSettings(data.features))throw new Error(data.error||"사용 기능 설정을 불러오지 못했습니다.");
      if(version===requestVersion.current){setFeatures(current=>featureKeys.every(key=>current[key]===data.features[key])?current:normalizeFeatureSettings(data.features));setCanEdit(Boolean(data.canEdit));setError("");}
    }catch(reason){if(version===requestVersion.current){setFeatures(hiddenFeatures);setError(reason instanceof Error?reason.message:"사용 기능 설정을 불러오지 못했습니다.");}}
    finally{if(version===requestVersion.current)setLoading(false);}
  },[]);
  useEffect(()=>{void reload();const refresh=()=>{void reload();};window.addEventListener("focus",refresh);return()=>{requestVersion.current++;window.removeEventListener("focus",refresh);};},[reload]);
  const save=useCallback(async(value:FeatureSettings)=>{
    ++requestVersion.current;
    const response=await fetch("/api/system/features",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({features:value})});
    const data=await response.json();
    if(!response.ok||!validFeatureSettings(data.features))throw new Error(data.error||"사용 기능 설정을 저장하지 못했습니다.");
    ++requestVersion.current;setFeatures(data.features);setLoading(false);setError("");
  },[]);
  return <Context.Provider value={{features,loading,error,canEdit,reload,save}}>{children}</Context.Provider>;
}
export function useFeatureSettings() {const context=useContext(Context);if(!context)throw new Error("FeatureSettingsProvider is required");return context;}
