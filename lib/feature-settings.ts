export const featureKeys = ["designChange", "quality", "partBom", "drawings", "cost"] as const;
export type FeatureKey = typeof featureKeys[number];
export type FeatureSettings = Record<FeatureKey, boolean>;
export const defaultFeatureSettings: FeatureSettings = {designChange:true, quality:true, partBom:true, drawings:true, cost:true};
export const featureLabels: Record<FeatureKey,string> = {designChange:"설계변경", quality:"품질관리", partBom:"PART · BOM", drawings:"도면관리", cost:"원가관리"};
export function normalizeFeatureSettings(value: unknown): FeatureSettings {
  const source = value && typeof value === "object" ? value as Record<string,unknown> : {};
  return Object.fromEntries(featureKeys.map(key=>[key, typeof source[key] === "boolean" ? source[key] : true])) as FeatureSettings;
}
export function validFeatureSettings(value: unknown): value is FeatureSettings {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === featureKeys.length && featureKeys.every(key=>typeof (value as Record<string,unknown>)[key] === "boolean"));
}
export function featureForWorkspace(view:string): FeatureKey | undefined {
  if(view==="ecr"||view==="create-ecr")return "designChange";
  if(view==="quality"||view==="create-quality")return "quality";
  if(view==="product-data"||view==="bom-compare")return "partBom";
  if(view==="cost")return "cost";
}
export function workspaceEnabled(view:string, features:FeatureSettings) {
  const key=featureForWorkspace(view);
  return !key || features[key];
}
