import fs from "node:fs";
import {randomUUID} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";
import pg from "pg";
import {drizzle} from "drizzle-orm/node-postgres";
import {officePreviewRepository} from "../db/office-preview-repository.mjs";
import {getStorageAdapter} from "../lib/storage-adapter.ts";
import {processOfficeJob} from "../services/office-pdf-converter.mjs";

if(fs.existsSync(".env"))process.loadEnvFile(".env");
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:2});
const repository=officePreviewRepository(drizzle(pool)),storage=getStorageAdapter();
let stopping=false;
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>{stopping=true});
console.info("[office-preview] worker started");
try{
  while(!stopping){
    try{
      const token=randomUUID(),job=await repository.claim(token,300);
      if(job)await processOfficeJob({repository,storage,job,token});
      else await delay(2000);
    }catch(error){console.error("[office-preview] worker iteration failed",error);await delay(5000)}
  }
}finally{await pool.end();console.info("[office-preview] worker stopped")}
