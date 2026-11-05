import {sql} from "drizzle-orm";
import {check,index,integer,pgTable,text,timestamp} from "drizzle-orm/pg-core";
import {deliverableVersions} from "./schema";

export const officePreviewJobs=pgTable("office_preview_jobs",{
  versionId:text("version_id").primaryKey().references(()=>deliverableVersions.id,{onDelete:"cascade"}),
  state:text("state").notNull().default("queued"),
  attempts:integer("attempts").notNull().default(0),
  availableAt:timestamp("available_at",{withTimezone:true}).notNull().defaultNow(),
  leaseToken:text("lease_token"),leaseUntil:timestamp("lease_until",{withTimezone:true}),error:text("error"),
},table=>[
  index("office_preview_jobs_available_idx").on(table.state,table.availableAt),
  check("office_preview_jobs_state_check",sql`${table.state} IN ('queued','running','done','failed')`),
]);
