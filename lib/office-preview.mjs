export const isOfficeDocument = (name = "") => /\.(docx?|xlsx?|pptx?)$/i.test(name);

export function officePreviewState(status) {
  if (status === "office_pdf_ready") return "ready";
  if (status === "office_pdf_failed") return "failed";
  return "pending";
}
