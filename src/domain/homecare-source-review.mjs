/**
 * HC-UX-03A: read-only source-review boundary for original Pediatrics forms.
 *
 * Structural labels were checked against private source material in FORM-001.
 * This module does NOT see original DOCX, raster scans, real patient data, or
 * authorization evidence. No result can approve signatures, PDF generation,
 * monthly foliating, medical treatment, or use with real minors.
 */
import {
  HOMECARE_FORM_CONTRACTS,
  BEDSIDE_PAPER_RECORDS,
  MONTHLY_DOSSIER,
} from "./homecare-form-contracts.mjs";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const REVIEW_CHECKS = Object.freeze([
  "PRIVATE_ORIGINAL_VISUAL_COMPARISON",
  "PAGE_LAYOUT_AND_REPEATED_COPIES",
  "FAMILY_REPRESENTATION_AND_SIGNING",
  "PROFESSIONAL_SIGNING_REQUIREMENTS",
  "FINANCIER_DOCUMENT_FORMAT",
  "MEDICAL_LEAD_APPROVAL",
  "ADMINISTRATION_APPROVAL",
]);
const DOSSIER_CHECKS = Object.freeze([
  "PRIVATE_ORIGINAL_56_PAGE_SAMPLE_REVIEW",
  "SECTION_ORDER_AND_FOLIATION",
  "PERIOD_ALLOCATION_OF_OVERNIGHT_SHIFTS",
  "FINANCIER_AND_AUDIT_REQUIREMENTS",
  "MEDICAL_LEAD_APPROVAL",
  "ADMINISTRATION_APPROVAL",
]);
const PAPER_CHECKS = Object.freeze([
  "PRIVATE_PAPER_SOURCE_VERIFICATION",
  "BEDSIDE_CUSTODY_AND_ACCOUNTABILITY",
  "NO_AUTOMATIC_DIGITAL_SUBSTITUTION",
]);

export const SOURCE_REVIEW_MATRIX = deepFreeze({
  version: "HC-UX-03A",
  sourceContract: "HC-03A",
  stage: "STRUCTURE_VERIFIED_PRIVATE_ORIGINAL_PENDING",
  forms: Object.values(HOMECARE_FORM_CONTRACTS).map(form => ({
    templateId: form.id,
    source: form.source,
    kind: form.kind,
    headerIds: form.headerFields.map(f => f.id),
    rowIds: form.rowFields.map(f => f.id),
    reviewedOriginalLayout: false,
    medicalApproval: false,
    administrativeApproval: false,
    canEmit: false,
    requiredChecks: REVIEW_CHECKS,
  })),
  paper: Object.values(BEDSIDE_PAPER_RECORDS).map(record => ({
    templateId: record.id,
    source: record.source,
    status: "PAPER_ONLY",
    canEmit: false,
    unknownColumns: Boolean(record.unknownColumns),
    requiredChecks: PAPER_CHECKS,
  })),
  dossier: {
    templateId: MONTHLY_DOSSIER.id,
    source: MONTHLY_DOSSIER.source,
    status: "REFERENCE_ONLY",
    scannedSamplePageCount: 56, // Historical example, NOT a mandated page count.
    requiredPageCount: null,
    approvedFoliation: false,
    approvedSectionOrder: false,
    canEmit: false,
    requiredChecks: DOSSIER_CHECKS,
  },
  approvedForClinicalUse: false,
  originalDocsInPublicRepository: false,
});

const OWN = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const validObject = value => value !== null && typeof value === "object" &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const staticResult = (code, status = "REJECTED") =>
  Object.freeze({
    code,
    status,
    structuralAgreement: false,
    originalLayoutCertified: false,
    approvalGranted: false,
    canEmit: false,
  });

/**
 * Checks ONLY IDs observed by a human in a PRIVATE environment. Passing the
 * check means the caller-reported structural list agrees with the existing
 * source contract, NOT that we have inspected the original file.
 *
 * For privacy no arbitrary labels, patient information, paths, file names,
 * hashes, signatures or unknown fields may enter this API or its output.
 */
export function comparePrivateSourceFieldIds(request) {
  if (!validObject(request)) return staticResult("INVALID_COMPARISON");
  const keys = Object.keys(request);
  const allowed = ["templateId", "observedHeaderIds", "observedRowIds"];
  if (keys.length !== allowed.length || keys.some(k => !allowed.includes(k)) ||
      allowed.some(k => !OWN(request, k))) {
    return staticResult("UNEXPECTED_COMPARISON_PROPERTY");
  }

  const {templateId, observedHeaderIds, observedRowIds} = request;
  if (typeof templateId !== "string") {
    return staticResult("INVALID_TEMPLATE");
  }
  if (OWN(BEDSIDE_PAPER_RECORDS,templateId)) {
    return staticResult("PAPER_SOURCE_NOT_DIGITALIZED");
  }
  if (templateId === MONTHLY_DOSSIER.id) {
    return staticResult("MONTHLY_DOSSIER_LAYOUT_UNVERIFIED");
  }
  if (!OWN(HOMECARE_FORM_CONTRACTS,templateId)) {
    return staticResult("UNKNOWN_TEMPLATE");
  }
  if (![observedHeaderIds,observedRowIds].every(
    ids => Array.isArray(ids) && ids.length <= 24 &&
      ids.every(id => typeof id === "string" && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(id))
  )) {
    return staticResult("INVALID_FIELD_ID_LIST");
  }
  // Strict privacy: never echo unknown field IDs. Observations of unexpected
  // text go back to the private reviewer, never into public GitHub or CI.
  const template=HOMECARE_FORM_CONTRACTS[templateId];
  const expectedHeaders=template.headerFields.map(f=>f.id);
  const expectedRows=template.rowFields.map(f=>f.id);
  const known=new Set([...expectedHeaders,...expectedRows]);
  if (![...observedHeaderIds,...observedRowIds].every(id=>known.has(id))) {
    return staticResult("FIELD_ID_OUTSIDE_APPROVED_CATALOG");
  }
  if (new Set(observedHeaderIds).size!==observedHeaderIds.length ||
      new Set(observedRowIds).size!==observedRowIds.length) {
    return staticResult("DUPLICATED_OBSERVED_FIELD_ID");
  }
  const agreement =
    expectedHeaders.length===observedHeaderIds.length &&
    expectedRows.length===observedRowIds.length &&
    expectedHeaders.every((id,i)=>id===observedHeaderIds[i]) &&
    expectedRows.every((id,i)=>id===observedRowIds[i]);

  return Object.freeze({
    code: agreement?"DECLARED_FIELDS_AGREE":"DECLARED_FIELDS_MISMATCH",
    status: agreement?"STRUCTURE_ONLY_SELF_CHECK":"NEEDS_PRIVATE_REVIEW",
    structuralAgreement: agreement,
    originalLayoutCertified: false,
    approvalGranted: false,
    canEmit: false,
  });
}

/** The gate remains blocked even when all caller-provided field IDs agree. */
export function inspectMonthlyDocumentGate() {
  return deepFreeze({
    status: "BLOCKED_PRIVATE_SOURCE_REVIEW",
    emittedDocuments: 0,
    canEmit: false,
    canPresentToInsurer: false,
    digitallySigned: false,
    formsRequiringPrivateLayoutReview: SOURCE_REVIEW_MATRIX.forms.length,
    paperRecordsRemainingAtHome: SOURCE_REVIEW_MATRIX.paper.length,
    scannedSamplePageCount: SOURCE_REVIEW_MATRIX.dossier.scannedSamplePageCount,
    mandatedPageCount: null,
    blockers: [
      "PRIVATE_DOCX_AND_PDF_SOURCE_COMPARISON",
      "MEDICAL_AND_ADMINISTRATIVE_AUTHORIZATION",
      "SIGNING_REPRESENTATION_AND_LEGAL_METHOD",
      "FINANCIER_REQUIREMENTS_AND_FOLIATION",
      "STANDALONE_SUPABASE_CLINICAL_RELEASE",
    ],
  });
}
