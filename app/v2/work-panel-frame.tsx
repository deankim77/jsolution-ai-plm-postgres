"use client";
import type {ReactNode} from "react";
import {PanelRightClose,PanelRightOpen,X} from "lucide-react";
/** Shared business-panel shell: existing foundation width, header, and close/resize behavior. */
export function WorkPanelFrame({eyebrow,title,description,wide,onWide,onClose,children}:{eyebrow:string;title:string;description:string;wide:boolean;onWide:()=>void;onClose:()=>void;children:ReactNode}){
  return <aside className={`wv2-panel ${wide?"wide":""}`} aria-label={title}><div className="wv2-resize"/><header><div><small>{eyebrow}</small><h2>{title}</h2><span>{description}</span></div><div><button type="button" onClick={onWide} title="패널 너비 전환" aria-label="패널 너비 전환">{wide?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button><button type="button" onClick={onClose} aria-label="닫기"><X size={18}/></button></div></header>{children}</aside>;
}
