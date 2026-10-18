import {createRequire} from "node:module";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const require=createRequire(import.meta.url),React=require("react"),ts=require("typescript");
const source=readFileSync("app/v2/common-code-hierarchy-settings.tsx","utf8");

test("common-code partner management preserves records and uses the partner CRUD API",async()=>{
  let cursor=0,masterChanges=0;const states=[],effects=[],requests=[];
  const partner={id:"partner-nh",code:"NH",name:"농협손해보험",category:"LEGACY",status:"inactive",address:"서울",note:"기존 비고",businessRegistrationNumber:"123-45"};
  const master={partners:[partner],codes:[{id:"customer",groupCode:"PARTNER_CATEGORY",code:"CUSTOMER",label:"고객사",enabled:1}],projectTypes:[],projectRoles:[]};
  const hooks={...React,useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],next=>{states[index]=typeof next==="function"?next(states[index]):next}]},useMemo:fn=>fn(),useEffect:fn=>effects.push(fn)};
  const mod={exports:{}};
  const mockRequire=id=>id==="react"?hooks:id==="react/jsx-runtime"?require(id):id==="lucide-react"?new Proxy({},{get:()=>()=>null}):id==="./use-column-filters"?{useColumnFilters:()=>({matches:()=>true,reset:()=>{},heading:()=>null}),V2FilterHeader:()=>null}:id==="./system-settings-panel"?{SystemSettingsPanel:()=>null}:{};
  new Function("require","module","exports",ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(mockRequire,mod,mod.exports);
  const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
  globalThis.fetch=async(url,options={})=>{if(options.method)requests.push({url,method:options.method,body:JSON.parse(options.body)});return new Response(JSON.stringify(url==="/api/system/master-data"&&!options.method?master:{categories:[],ok:true}))};
  globalThis.window={confirm:()=>true};
  const render=()=>{cursor=0;effects.length=0;return mod.exports.CommonCodeSettings({onMasterDataChanged:()=>masterChanges++})};
  const nodes=value=>Array.isArray(value)?value.flatMap(nodes):React.isValidElement(value)?[value,...nodes(value.props.children)]:[];
  const find=(tree,predicate)=>{const node=nodes(tree).find(predicate);assert.ok(node,"expected control exists");return node};
  const button=(tree,text)=>find(tree,n=>n.type==="button"&&n.props.children===text);
  try{
    let tree=render();effects[0]();await new Promise(resolve=>setImmediate(resolve));tree=render();
    find(tree,n=>n.type==="button"&&nodes(n).some(c=>c.type==="small"&&c.props.children==="PARTNER")).props.onClick();tree=render();
    assert.ok(nodes(tree).some(n=>n.type==="b"&&n.props.children===partner.name));
    button(tree,"수정").props.onClick();tree=render();
    const panel=find(tree,n=>typeof n.type==="function"&&n.props.submitLabel==="변경 저장");
    assert.ok(nodes(panel).some(n=>n.type==="option"&&n.props.value==="LEGACY"),"existing category remains available");
    const input=find(panel,n=>n.type==="input"&&n.props.value==="서울");assert.equal(input.props.value,"서울");
    await panel.props.onSubmit({preventDefault(){}});
    assert.deepEqual(requests[0],{url:"/api/system/master-data",method:"PATCH",body:{...partner,entity:"partner"}});
    tree=render();find(tree,n=>n.type==="button"&&React.Children.toArray(n.props.children).includes("거래처 추가")).props.onClick();tree=render();
    await find(tree,n=>typeof n.type==="function"&&n.props.submitLabel==="등록").props.onSubmit({preventDefault(){}});
    assert.equal(requests[1].method,"POST");assert.equal(requests[1].body.entity,"partner");assert.equal(requests[1].body.category,"CUSTOMER");
    tree=render();await find(tree,n=>n.type==="button"&&n.props.title==="삭제").props.onClick();
    assert.deepEqual(requests[2],{url:"/api/system/master-data",method:"DELETE",body:{entity:"partner",id:partner.id}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(masterChanges,3,"successful writes refresh project master consumers");
  }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow}
});
