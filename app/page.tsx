"use client";

import {useEffect} from "react";
import NewWorkViewApp from "./v2/NewWorkViewApp";
import {AdminProjectDeleteControl} from "./v2/admin-project-delete-control";
import {ProductDataBridge} from "./v2/product-data-bridge";
import {PinnedTabsSettings} from "./v2/pinned-tabs-settings";
import "./v2/document-preview-fix.css";
import "./v2/right-panel-defaults.css";

export default function Home(){
  useEffect(()=>{
    const applyBrand=()=>{const brand=document.querySelector<HTMLElement>(".wv2-context header b");if(brand&&brand.textContent!=="J SOLUTION AI PLM")brand.textContent="J SOLUTION AI PLM"};
    applyBrand();
    const observer=new MutationObserver(applyBrand);observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  return <><NewWorkViewApp/><AdminProjectDeleteControl/><ProductDataBridge/><PinnedTabsSettings/></>;
}
