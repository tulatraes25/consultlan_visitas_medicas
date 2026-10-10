/**
 * HC-03A - Source-faithful form inventory for homecare program.
 * Source: docs/specs/FORM-001-inventario-clinico.md
 *
 * This is a PROVISIONAL RENDERING CONTRACT, NOT a clinical form submission API.
 * It contains no names, diagnoses, treatment orders or actual signatures.
 * CONSULTLAN clinic records are never a source of values.
 */

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

const field = (id, sourceLabel, kind) => ({ id, sourceLabel, kind });
const system = (id, sourceLabel) => field(id, sourceLabel, "CASE_CONTEXT");
const signing = (id, sourceLabel, kind) => field(id, sourceLabel, kind);
const date = (id = "serviceDate", sourceLabel = "Fecha") =>
  field(id, sourceLabel, "DATE_ONLY");
const professionalSignature = (sourceLabel) =>
  signing("professionalSignature", sourceLabel, "PROFESSIONAL_SIGNATURE_REQUEST");
const familySignature = (sourceLabel) =>
  signing("responsibleSignature", sourceLabel, "RESPONSIBLE_ATTESTATION_REQUEST");

const patientAndInsurer = [
  system("homecarePatient", "Paciente"),
  system("insurer", "Obra social"),
];

function attendance({ id, source, specialty, header, row, limitations = [] }) {
  return {
    id, source, specialty, kind: "ATTENDANCE",
    status: "SOURCE_VERIFIED_STRUCTURE_PENDING_APPROVAL",
    patientOrigin: "HOMECARE_EPISODE_ONLY",
    rowMultiplicity: "MANY",
    headerFields: header,
    rowFields: row,
    limitations,
    submissionEnabled: false,
    professionalSigningEnabled: false,
    caregiverSigningEnabled: false,
    physicalCopyReplaced: false,
  };
}

export const HOMECARE_FORM_CONTRACTS = deepFreeze({
  MEDICAL_ATTENDANCE: attendance({
    id: "MEDICAL_ATTENDANCE",
    source: "Planilla médica",
    specialty: "MEDICINA",
    header: [...patientAndInsurer,date("sheetDate","Fecha")],
    row: [
      date(), professionalSignature("Firma profesional"),
      familySignature("Firma padre/madre/tutor"),
    ],
    limitations: ["No equivale a evolución clínica ni orden médica."],
  }),
  NURSING_CAREGIVER_ATTENDANCE: attendance({
    id: "NURSING_CAREGIVER_ATTENDANCE",
    source: "Enfermería/cuidadoras",
    specialty: "ENFERMERIA_O_CUIDADOS",
    header: [...patientAndInsurer,date("sheetDate","Fecha")],
    row: [
      date(), field("serviceTime", "Horario", "TIME_ONLY"),
      professionalSignature("Firma y sello profesional"),
      familySignature("Firma familiar"),
    ],
    limitations: [
      "La tabla original tiene dos ejemplares, no dos atenciones simultáneas.",
      "Los profesionales cuidadores y los familiares autorizados son identidades diferentes.",
      "El tipo de cobertura puede ser SHIFT; no forzar visita de 40 minutos.",
    ],
  }),
  PHYSIOTHERAPY_ATTENDANCE: attendance({
    id: "PHYSIOTHERAPY_ATTENDANCE",
    source: "Kinesiología",
    specialty: "KINESIOLOGIA",
    header: [...patientAndInsurer,date("sheetDate","Fecha")],
    row: [
      date(), professionalSignature("Firma kinesiólogo"),
      familySignature("Firma familiar"),
    ],
    limitations: ["Las copias duplicadas de la hoja no son sesiones duplicadas."],
  }),
  SPEECH_ATTENDANCE: attendance({
    id: "SPEECH_ATTENDANCE",
    source: "Fonoaudiología",
    specialty: "FONOAUDIOLOGIA",
    header: [...patientAndInsurer,date("sheetDate","Fecha")],
    row: [
      date(), professionalSignature("Firma especialista"),
      familySignature("Firma familiar"),
    ],
    limitations: ["La definición de prestación válida requiere aprobación de Pediatrics."],
  }),
  OCCUPATIONAL_THERAPY_ATTENDANCE: attendance({
    id: "OCCUPATIONAL_THERAPY_ATTENDANCE",
    source: "Terapia ocupacional",
    specialty: "TERAPIA_OCUPACIONAL",
    header: [...patientAndInsurer,date("sheetDate","Fecha")],
    row: [
      date(), professionalSignature("Firma especialista"),
      familySignature("Firma familiar"),
    ],
    limitations: ["No agregar intervenciones clínicas no verificadas en la plantilla."],
  }),
  NUTRITION_ATTENDANCE: attendance({
    id: "NUTRITION_ATTENDANCE",
    source: "Nutrición",
    specialty: "NUTRICION",
    header: [...patientAndInsurer],
    row: [
      date(), professionalSignature("Firma y sello profesional"),
      familySignature("Firma tutor"),
    ],
    limitations: ["La hoja no certifica por sí misma una indicación nutricional."],
  }),
  CLINICAL_EVOLUTION: {
    id: "CLINICAL_EVOLUTION",
    source: "Hoja evolución",
    specialty: "EQUIPO_TRATANTE_SEGUN_ASIGNACION",
    kind: "CLINICAL_EVOLUTION",
    status: "SOURCE_VERIFIED_STRUCTURE_PENDING_APPROVAL",
    patientOrigin: "HOMECARE_EPISODE_ONLY",
    headerFields: [...patientAndInsurer,date("sheetDate","Fecha")],
    rowMultiplicity: "BY_CLINICAL_EVENT",
    rowFields: [field("evolution", "Evolución", "CLINICAL_NARRATIVE")],
    limitations: [
      "La narrativa se almacena separada de constancias de asistencia.",
      "Solo podrá escribir el profesional habilitado y asignado al episodio.",
    ],
    submissionEnabled: false,
    professionalSigningEnabled: false,
    caregiverSigningEnabled: false,
    physicalCopyReplaced: false,
  },
});

export const BEDSIDE_PAPER_RECORDS = deepFreeze({
  KARDEX: {
    id: "KARDEX", source: "Ficha Kardex", status: "PAPER_ONLY",
    confirmedLabels: ["Paciente", "Medicación"],
    unknownColumns: true,
    restrictions: [
      "No inferir dosis, vía, frecuencia ni encabezados no legibles.",
      "Permanece físicamente en el domicilio.",
    ],
  },
  VITAL_SIGNS: {
    id: "VITAL_SIGNS", source: "Signos vitales", status: "PAPER_ONLY",
    confirmedLabels: [
      "Paciente", "Fecha", "Horario", "SpO2", "FC", "FR", "T°",
      "T/A", "Firma y sello",
    ],
    restrictions: [
      "No establecer umbrales ni reglas de alarmas clínicas.",
      "Permanece físicamente en el domicilio.",
    ],
  },
  PROCEDURE_SHEET: {
    id: "PROCEDURE_SHEET", source: "Control procedimientos", status: "PAPER_ONLY",
    confirmedLabels: [
      "Paciente", "Obra social", "Fecha", "Horario", "Procedimiento",
      "Firma profesional",
    ],
    restrictions: [
      "Los procedimientos indicados en origen no forman un catálogo cerrado.",
      "No documentar una práctica ejecutada con una referencia al papel.",
    ],
  },
  CRISIS_SHEET: {
    id: "CRISIS_SHEET", source: "Hoja de crisis", status: "PAPER_ONLY",
    confirmedLabels: ["Fecha", "Tipo de crisis", "Duración"],
    restrictions: [
      "No implica triaje o monitoreo de emergencias.",
      "Permanece físicamente en el domicilio.",
    ],
  },
});

export const MONTHLY_DOSSIER = deepFreeze({
  id: "MONTHLY_DOSSIER",
  source: "PDF mensual de 56 páginas escaneadas",
  status: "REFERENCE_ONLY",
  extractedFieldMap: false,
  importPatientData: false,
  reproduceOriginalSignatures: false,
});

/**
 * A preview guard for NON-CLINICAL form design.
 * This is not database authorization, signature verification or triage.
 * An explicit intent to store patient data or emit a signed document is denied.
 */
export function inspectFormPreviewRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    return { allowed: false, code: "INVALID_PREVIEW_REQUEST" };
  }
  const { templateId, action } = request;
  if (typeof templateId !== "string" || typeof action !== "string") {
    return { allowed: false, code: "INVALID_PREVIEW_REQUEST" };
  }
  if (Object.hasOwn(request, "patient") ||
      Object.hasOwn(request, "patientId") ||
      Object.hasOwn(request, "clinicPatientId") ||
      Object.hasOwn(request, "clinicalValues") ||
      Object.hasOwn(request, "signatureImage") ||
      Object.hasOwn(request, "privateKey") ||
      Object.hasOwn(request, "rawInk")) {
    return { allowed: false, code: "IDENTIFIABLE_OR_SIGNATURE_DATA_NOT_ACCEPTED" };
  }
  // Preview is a schema lookup only. No arbitrary fields may carry real data.
  const keys = Object.keys(request);
  if (keys.length !== 2 || keys.some(key => key !== "templateId" && key !== "action")) {
    return { allowed: false, code: "EXTRA_PREVIEW_FIELDS_NOT_ACCEPTED" };
  }
  if (Object.hasOwn(BEDSIDE_PAPER_RECORDS, templateId)) {
    return action === "REFERENCE_PAPER_RECORD"
      ? { allowed: true, code: "PAPER_REFERENCE_ONLY" }
      : { allowed: false, code: "PAPER_RECORD_NOT_DIGITALIZED" };
  }
  if (!Object.hasOwn(HOMECARE_FORM_CONTRACTS, templateId)) {
    return { allowed: false, code: "UNKNOWN_TEMPLATE" };
  }
  return action === "PREVIEW_STRUCTURE"
    ? { allowed: true, code: "PREVIEW_ONLY" }
    : { allowed: false, code: "CLINICAL_SUBMISSION_NOT_IMPLEMENTED" };
}
