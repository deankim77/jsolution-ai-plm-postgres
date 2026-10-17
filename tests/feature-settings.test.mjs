import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {stripTypeScriptTypes} from "node:module";
const loadTs=async source=>import("data:text/javascript;base64,"+Buffer.from(stripTypeScriptTypes(source)).toString("base64"));
const policy=await loadTs(fs.readFileSync(new URL("../lib/feature-settings.ts",import.meta.url),"utf8"));
const {defaultFeatureSettings:defaults,featureKeys,normalizeFeatureSettings,validFeatureSettings,workspaceEnabled}=policy;
test("existing companies retain all five features without a stored setting",()=>assert.deepEqual(normalizeFeatureSettings(undefined),defaults));
test("explicit false survives serialization and later re-enabling",()=>{
  const off=Object.fromEntries(featureKeys.map(key=>[key,false]));
  assert.deepEqual(normalizeFeatureSettings(JSON.parse(JSON.stringify(off))),off);
  assert.deepEqual(normalizeFeatureSettings(JSON.parse(JSON.stringify(defaults))),defaults);
});
test("partial historical settings preserve explicit values and default missing keys",()=>assert.deepEqual(normalizeFeatureSettings({cost:false}),{...defaults,cost:false}));
test("writes reject incomplete, extra, and non-boolean values",()=>{
  for(const value of [null,[],{}, {cost:false},{...defaults,cost:"false"},{...defaults,other:true}])assert.equal(validFeatureSettings(value),false);
  assert.equal(validFeatureSettings({...defaults,cost:false}),true);
});
test("each switch affects only its associated dedicated workspaces",()=>{
  const views={designChange:["ecr","create-ecr"],quality:["quality","create-quality"],partBom:["product-data","bom-compare"],cost:["cost"],drawings:[]};
  for(const key of featureKeys){
    const features={...defaults,[key]:false};
    for(const [owner,targets] of Object.entries(views))for(const view of targets)assert.equal(workspaceEnabled(view,features),owner!==key,view+" / "+key);
  }
});
test("disabling all optional modules preserves workflow and core PMS screens",()=>{
  const off=Object.fromEntries(featureKeys.map(key=>[key,false]));
  for(const view of ["workflows","create-workflow","workflow-templates","wbs","documents","portfolio","projects","my-work","settings"])assert.equal(workspaceEnabled(view,off),true,view);
});
const memory=new Map(),writes=[];
globalThis.__featureSettingsTest={memory,writes};
const repositoryUrl="data:text/javascript;base64,"+Buffer.from(`
export async function readFeatureSettings(companyId){return globalThis.__featureSettingsTest.memory.get(companyId);}
export async function writeFeatureSettings(companyId,userId,value){globalThis.__featureSettingsTest.writes.push({companyId,userId,value});globalThis.__featureSettingsTest.memory.set(companyId,JSON.stringify(value));}
`).toString("base64");
const contextUrl="data:text/javascript;base64,"+Buffer.from('export class RequestContextError extends Error {constructor(message,status){super(message);this.status=status;}}').toString("base64");
const policyUrl="data:text/javascript;base64,"+Buffer.from(stripTypeScriptTypes(fs.readFileSync(new URL("../lib/feature-settings.ts",import.meta.url),"utf8"))).toString("base64");
const serviceSource=fs.readFileSync(new URL("../services/feature-settings-service.ts",import.meta.url),"utf8")
 .replace('"../lib/feature-settings"',JSON.stringify(policyUrl))
 .replace('"../db/repositories/feature-settings-repository"',JSON.stringify(repositoryUrl))
 .replace('"../db/request-context"',JSON.stringify(contextUrl));
const service=await loadTs(serviceSource);
const context=(companyId,roles=["ADMIN"])=>({companyId,userId:"user-1",systemRoles:roles});
test("non-admin cannot persist changes",async()=>{
  const count=writes.length;
  await assert.rejects(service.saveFeatureSettings(context("A",["MEMBER"]),defaults),error=>error.status===403);
  assert.equal(writes.length,count);
});
test("invalid settings do not produce writes",async()=>{
  const count=writes.length;
  await assert.rejects(service.saveFeatureSettings(context("A"),{cost:false}),error=>error.status===400);
  assert.equal(writes.length,count);
});
test("company settings persist independently and re-enable without deleting values",async()=>{
  const a=context("company-A"),b=context("company-B");
  await service.saveFeatureSettings(a,{...defaults,cost:false,drawings:false});
  assert.equal((await service.loadFeatureSettings(a)).cost,false);
  assert.deepEqual(await service.loadFeatureSettings(b),defaults);
  await service.saveFeatureSettings(a,defaults);
  assert.deepEqual(await service.loadFeatureSettings(a),defaults);
  assert.equal(writes.at(-1).companyId,"company-A");
});
test("all existing administrator roles can save",async()=>{
  for(const role of ["ADMIN","SUPER_ADMIN","SYSTEM_ADMIN"])await service.saveFeatureSettings(context("role-"+role,[role]),defaults);
});
test("corrupt persisted JSON fails instead of silently enabling modules",async()=>{
  memory.set("broken","not-json");
  await assert.rejects(service.loadFeatureSettings(context("broken")));
});
