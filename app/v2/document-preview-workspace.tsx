"use client";

import type {ComponentType} from "react";

function DocumentWorkspace(){
  return <section className="wv2-module wv2-document-workspace">
    <header className="wv2-module-head">
      <div>
        <small>DOCUMENT · DELIVERABLE</small>
        <h1>문서 · 산출물</h1>
        <p>전체 프로젝트의 문서와 산출물을 확인합니다.</p>
      </div>
    </header>
    <div className="wv2-preview-empty">
      <b>문서 · 산출물</b>
    </div>
  </section>;
}

export const PreviewDocumentsWorkspace=DocumentWorkspace as ComponentType<any>;
