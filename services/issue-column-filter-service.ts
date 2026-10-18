/** JSON preserves names containing commas; CSV remains accepted for existing clients. */
export function parseIssueColumnFilters(params:URLSearchParams){
  const read=(key:string)=>{
    const raw=params.get(key)||"";
    let items:unknown[];
    try{const parsed=JSON.parse(raw);items=Array.isArray(parsed)?parsed:raw.split(",")}catch{items=raw.split(",")}
    return Array.from(new Set(items.filter((value):value is string=>typeof value==="string").map(value=>value.trim()).filter(Boolean))).slice(0,100);
  };
  return {projectIds:read("projectIds"),types:read("types"),statuses:read("statuses"),owners:read("owners")};
}
