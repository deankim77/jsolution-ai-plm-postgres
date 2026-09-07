import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../index";
import { deliverables, projectsDb, wbsTasks } from "../schema";
import { workflowSourceDrawingLinks } from "../workflow-drawing-schema";

export type WorkflowDrawingSourceType = "ECR" | "QUALITY";

export type WorkflowDrawing = {
  id: string;
  projectId: string;
  drawingCode: string | null;
  name: string;
  drawingType: string | null;
  taskId: string | null;
  taskCode: string | null;
  taskName: string | null;
};

const drawingSelect = {
  id: deliverables.id,
  projectId: deliverables.projectId,
  drawingCode: deliverables.drawingCode,
  name: deliverables.name,
  drawingType: deliverables.drawingType,
  taskId: deliverables.taskId,
  taskCode: wbsTasks.wbsCode,
  taskName: wbsTasks.name,
};

export async function findWorkflowDrawing(companyId: string, projectId: string, drawingId: string): Promise<WorkflowDrawing | null> {
  const db = getDb();
  const [drawing] = await db.select(drawingSelect)
    .from(deliverables)
    .innerJoin(projectsDb, eq(projectsDb.id, deliverables.projectId))
    .leftJoin(wbsTasks, eq(wbsTasks.id, deliverables.taskId))
    .where(and(
      eq(projectsDb.companyId, companyId),
      eq(deliverables.projectId, projectId),
      eq(deliverables.id, drawingId),
      sql`COALESCE(deliverables.document_kind, 'document') = 'drawing'`,
    ))
    .limit(1);
  return drawing ?? null;
}

export async function replaceWorkflowSourceDrawingLinks(companyId: string, sourceType: WorkflowDrawingSourceType, sourceId: string, drawingIds: string[]) {
  const db = getDb();
  const uniqueDrawingIds = Array.from(new Set(drawingIds.filter(Boolean)));
  const now = Math.floor(Date.now() / 1000);
  await db.transaction(async tx => {
    await tx.delete(workflowSourceDrawingLinks).where(and(
      eq(workflowSourceDrawingLinks.companyId, companyId),
      eq(workflowSourceDrawingLinks.sourceType, sourceType),
      eq(workflowSourceDrawingLinks.sourceId, sourceId),
    ));
    if (uniqueDrawingIds.length) {
      await tx.insert(workflowSourceDrawingLinks).values(uniqueDrawingIds.map((drawingId, index) => ({
        companyId,
        sourceType,
        sourceId,
        drawingId,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      })));
    }
  });
}

export async function deleteWorkflowSourceDrawingLinks(companyId: string, sourceType: WorkflowDrawingSourceType, sourceId: string) {
  const db = getDb();
  await db.delete(workflowSourceDrawingLinks).where(and(
    eq(workflowSourceDrawingLinks.companyId, companyId),
    eq(workflowSourceDrawingLinks.sourceType, sourceType),
    eq(workflowSourceDrawingLinks.sourceId, sourceId),
  ));
}

export async function listWorkflowSourceDrawings(companyId: string, sourceType: WorkflowDrawingSourceType, sourceIds: string[]) {
  if (!sourceIds.length) return [] as Array<WorkflowDrawing & { sourceId: string; sortOrder: number }>;
  const db = getDb();
  return db.select({
    sourceId: workflowSourceDrawingLinks.sourceId,
    sortOrder: workflowSourceDrawingLinks.sortOrder,
    ...drawingSelect,
  })
    .from(workflowSourceDrawingLinks)
    .innerJoin(deliverables, eq(deliverables.id, workflowSourceDrawingLinks.drawingId))
    .innerJoin(projectsDb, eq(projectsDb.id, deliverables.projectId))
    .leftJoin(wbsTasks, eq(wbsTasks.id, deliverables.taskId))
    .where(and(
      eq(workflowSourceDrawingLinks.companyId, companyId),
      eq(workflowSourceDrawingLinks.sourceType, sourceType),
      eq(projectsDb.companyId, companyId),
      inArray(workflowSourceDrawingLinks.sourceId, sourceIds),
    ))
    .orderBy(asc(workflowSourceDrawingLinks.sourceId), asc(workflowSourceDrawingLinks.sortOrder));
}
