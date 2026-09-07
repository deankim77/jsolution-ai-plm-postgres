import {
  deleteWorkflowSourcePartLinks,
  findActiveWorkflowPart,
  listWorkflowSourceParts,
  replaceWorkflowSourcePartLinks,
  searchActiveWorkflowParts,
  type WorkflowPart,
  type WorkflowSourceType,
} from "../db/repositories/workflow-part-repository";

function normalizeSourceType(value: string): WorkflowSourceType {
  if (value === "ECR" || value === "QUALITY") return value;
  throw new Error("지원하지 않는 PART 연결 업무 유형입니다.");
}

export async function listWorkflowPartOptions(companyId: string, query = "") {
  return searchActiveWorkflowParts(companyId, query, 80);
}

export async function requireWorkflowPart(companyId: string, partId: string): Promise<WorkflowPart> {
  const normalized = partId.trim();
  if (!normalized) throw new Error("대상 PART를 선택해 주세요.");
  const part = await findActiveWorkflowPart(companyId, normalized);
  if (!part) throw new Error("선택한 PART를 찾을 수 없거나 사용할 수 없습니다.");
  return part;
}

export async function setSourcePrimaryPart(companyId: string, sourceType: string, sourceId: string, partId: string) {
  const type = normalizeSourceType(sourceType);
  const part = await requireWorkflowPart(companyId, partId);
  await replaceWorkflowSourcePartLinks(companyId, type, sourceId, [part.id]);
  return part;
}

export async function getSourcePrimaryPart(companyId: string, sourceType: string, sourceId: string) {
  const type = normalizeSourceType(sourceType);
  const rows = await listWorkflowSourceParts(companyId, type, [sourceId]);
  return rows.sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
}

export async function getSourcePartsMap(companyId: string, sourceType: string, sourceIds: string[]) {
  const type = normalizeSourceType(sourceType);
  const rows = await listWorkflowSourceParts(companyId, type, sourceIds);
  const map = new Map<string, typeof rows>();
  rows.forEach(row => map.set(row.sourceId, [...(map.get(row.sourceId) ?? []), row]));
  return map;
}

export async function clearSourceParts(companyId: string, sourceType: string, sourceId: string) {
  await deleteWorkflowSourcePartLinks(companyId, normalizeSourceType(sourceType), sourceId);
}
