"use client";

import {Suspense,lazy,type ComponentType} from "react";

const lazyNamed=(loader:()=>Promise<{default:ComponentType<any>}>)=>{
  const Component=lazy(loader);
  return (props:any)=><Suspense fallback={null}><Component {...props}/></Suspense>;
};

export const EcrWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.EcrWorkspace})));
export const MyWorkWorkflowWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.MyWorkWorkflowWorkspace})));
export const ProjectWorkflowWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.ProjectWorkflowWorkspace})));
export const QualityWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.QualityWorkspace})));
export const SourceCreateWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.SourceCreateWorkspace})));
export const WorkflowCreateWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.WorkflowCreateWorkspace})));
export const WorkflowTemplateWorkspace=lazyNamed(()=>import("./workflow-workspaces-impl").then(module=>({default:module.WorkflowTemplateWorkspace})));
