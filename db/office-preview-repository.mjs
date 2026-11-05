import {sql} from "drizzle-orm";

// Every queue mutation is transactional. A lease token fences restarted/stale workers.
export function officePreviewRepository(db) {
  return {
    async enqueue(versionId, retry = false) {
      return db.transaction(async tx => {
        const result = await tx.execute(sql`INSERT INTO office_preview_jobs (version_id)
          SELECT id FROM deliverable_versions WHERE id=${versionId} AND deleted_at IS NULL
          ON CONFLICT (version_id) DO UPDATE SET state='queued', attempts=0, lease_token=NULL,
            lease_until=NULL, available_at=now(), error=NULL
          WHERE office_preview_jobs.state IN ('failed','done') AND ${retry}
          RETURNING version_id`);
        if (result.rows.length) await tx.execute(sql`UPDATE deliverable_versions
          SET conversion_status='office_pdf_pending', conversion_error=NULL WHERE id=${versionId}`);
        return result.rows.length > 0;
      });
    },
    async claim(token, leaseSeconds) {
      return db.transaction(async tx => {
        // Exhausted leases are failures, rather than leaving a permanent "preparing" state.
        await tx.execute(sql`WITH failed AS (UPDATE office_preview_jobs SET state='failed',
          error='변환 작업이 반복 중단되었습니다. 다시 시도해 주세요.'
          WHERE state='running' AND lease_until < now() AND attempts >= 3 RETURNING version_id,error)
          UPDATE deliverable_versions v SET conversion_status='office_pdf_failed', conversion_error=f.error
          FROM failed f WHERE v.id=f.version_id AND v.deleted_at IS NULL`);
        const jobs = await tx.execute(sql`WITH candidate AS (
          SELECT j.version_id FROM office_preview_jobs j JOIN deliverable_versions v ON v.id=j.version_id
          WHERE v.deleted_at IS NULL AND j.attempts < 3 AND
            ((j.state='queued' AND j.available_at<=now()) OR (j.state='running' AND j.lease_until<now()))
          ORDER BY j.available_at FOR UPDATE OF j SKIP LOCKED LIMIT 1
        ) UPDATE office_preview_jobs j SET state='running', attempts=j.attempts+1,
          lease_token=${token}, lease_until=now()+${leaseSeconds}*interval '1 second'
          FROM candidate c,deliverable_versions v WHERE j.version_id=c.version_id AND v.id=j.version_id
          RETURNING j.version_id AS "versionId",v.file_key AS "fileKey",v.file_name AS "fileName",
            v.project_id AS "projectId",v.deliverable_id AS "deliverableId",v.revision`);
        const job=jobs.rows[0];
        if(job) await tx.execute(sql`UPDATE deliverable_versions SET conversion_status='office_pdf_converting',
          conversion_error=NULL WHERE id=${job.versionId}`);
        return job;
      });
    },
    async finish(versionId, token, previewKey, error = null) {
      return db.transaction(async tx => {
        const job=await tx.execute(sql`UPDATE office_preview_jobs SET state=${error ? "failed" : "done"},
          error=${error},lease_until=NULL WHERE version_id=${versionId} AND lease_token=${token}
          AND state='running' RETURNING version_id`);
        if(!job.rows.length)return false;
        const result=await tx.execute(sql`UPDATE deliverable_versions SET
          conversion_status=${error ? "office_pdf_failed" : "office_pdf_ready"},conversion_error=${error},
          preview_file_key=CASE WHEN ${error === null} THEN ${previewKey} ELSE preview_file_key END,
          converted_at=CASE WHEN ${error === null} THEN extract(epoch FROM now())::integer ELSE converted_at END
          WHERE id=${versionId} AND deleted_at IS NULL RETURNING id`);
        return result.rows.length>0;
      });
    },
  };
}
