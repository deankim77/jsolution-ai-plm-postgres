import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {convertOfficePdf} from "../services/office-pdf-converter.mjs";

test("PostgreSQL queue: duplicate requests, concurrent claims, lease recovery, stale fencing and retry",{skip:!process.env.OFFICE_PREVIEW_TEST_DATABASE_URL},async()=>{
  const {default:pg}=await import("pg");const {drizzle}=await import("drizzle-orm/node-postgres");
  const {officePreviewRepository}=await import("../db/office-preview-repository.mjs");
  const schema=`office_test_${randomUUID().replaceAll("-","")}`;
  const admin=new pg.Pool({connectionString:process.env.OFFICE_PREVIEW_TEST_DATABASE_URL});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({connectionString:process.env.OFFICE_PREVIEW_TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  try{
    await pool.query(`CREATE TABLE deliverable_versions(id text PRIMARY KEY,project_id text,deliverable_id text,revision integer,file_key text,file_name text,deleted_at integer,conversion_status text,conversion_error text,preview_file_key text,converted_at integer)`);
    await pool.query((await fs.readFile(new URL("../drizzle-postgres/0007_office_preview_jobs.sql",import.meta.url),"utf8")).replaceAll("--> statement-breakpoint",""));
    await pool.query("INSERT INTO deliverable_versions(id,file_name) VALUES ('v1','report.docx')");
    const repo=officePreviewRepository(drizzle(pool));
    await Promise.all([repo.enqueue("v1"),repo.enqueue("v1")]);
    assert.equal((await pool.query("SELECT * FROM office_preview_jobs")).rows.length,1);
    const jobs=await Promise.all([repo.claim("first",300),repo.claim("other",300)]);
    assert.equal(jobs.filter(Boolean).length,1);
    const oldToken=(await pool.query("SELECT lease_token FROM office_preview_jobs")).rows[0].lease_token;
    await pool.query("UPDATE office_preview_jobs SET lease_until=now()-interval '1 second'");
    assert.equal((await repo.claim("new",300)).versionId,"v1");
    assert.equal(await repo.finish("v1",oldToken,"stale.pdf"),false);
    assert.equal(await repo.finish("v1","new","ready.pdf"),true);
    assert.equal((await pool.query("SELECT conversion_status FROM deliverable_versions")).rows[0].conversion_status,"office_pdf_ready");
    assert.equal(await repo.enqueue("v1"),false);
    assert.equal(await repo.enqueue("v1",true),true);
    await repo.claim("crash",300);
    await pool.query("UPDATE office_preview_jobs SET attempts=3,lease_until=now()-interval '1 second'");
    assert.equal(await repo.claim("exhausted",300),undefined);
    assert.equal((await pool.query("SELECT conversion_status FROM deliverable_versions")).rows[0].conversion_status,"office_pdf_failed");
    await repo.enqueue("v1",true);await repo.claim("deleted",300);
    await pool.query("UPDATE deliverable_versions SET deleted_at=1");
    assert.equal(await repo.finish("v1","deleted","orphan.pdf"),false);
  }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
});

test("LibreOffice renders real DOCX, XLSX and PPTX into PDF",{skip:!process.env.OFFICE_PREVIEW_TEST_LIBREOFFICE,timeout:180000},async()=>{
  const fixture=JSON.parse(execFileSync(process.env.PYTHON||"python3",[new URL("./fixtures/office-preview-fixtures.py",import.meta.url).pathname],{encoding:"utf8"}));
  for(const [name,base64] of Object.entries(fixture)){
    const pdf=await convertOfficePdf(Buffer.from(base64,"base64"),name,{executable:process.env.LIBREOFFICE_PATH||"soffice"});
    assert.equal(pdf.subarray(0,5).toString(),"%PDF-");assert.ok(pdf.length>500,name);
  }
});
