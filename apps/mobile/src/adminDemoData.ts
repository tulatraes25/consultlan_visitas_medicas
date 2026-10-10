import type { DemoVisit, Specialty } from "./demoData";

export type DemoPatient = Readonly<{ id: string; label: string }>;
export type DemoProfessional = Readonly<{
  id: string;
  label: string;
  specialty: Specialty;
}>;
export type DemoSlot = Readonly<{ id: string; label: string }>;

export const SPECIALTIES: readonly Specialty[] = [
  "Medicina", "Enfermería", "Kinesiología", "Fonoaudiología",
  "Terapia ocupacional", "Nutrición",
] as const;

export const DEMO_SLOTS: readonly DemoSlot[] = [
  { id: "09", label: "09:00 – 09:40" },
  { id: "10", label: "10:00 – 10:40" },
  { id: "11", label: "11:00 – 11:40" },
  { id: "14", label: "14:00 – 14:40" },
  { id: "15", label: "15:00 – 15:40" },
] as const;

export function createDemoPatients(): DemoPatient[] {
  return "ABCDEF".split("").map(code => ({
    id: "DEMO-PAT-" + code,
    label: "Paciente ficticio " + code,
  }));
}
export function createDemoProfessionals(): DemoProfessional[] {
  return SPECIALTIES.map((specialty, index) => ({
    id: "DEMO-PRO-" + String(index + 1),
    label: "Profesional ficticio " + String(index + 1),
    specialty,
  }));
}

const CODE_PATTERN = /^[A-Z0-9]{1,4}$/;
/**
 * Prevent people from entering real names, DNI, dates of birth or contact data
 * into an intentionally non-secure, ephemeral UX demo.
 */
export function normalizeDemoCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
export function createPatientEntry(
  code: string,
  existing: readonly DemoPatient[],
): DemoPatient | null {
  const normalized = normalizeDemoCode(code);
  if (!normalized) return null;
  const candidate = {
    id: "DEMO-PAT-" + normalized,
    label: "Paciente ficticio " + normalized,
  };
  return existing.some(p => p.id === candidate.id) ? null : candidate;
}
export function createProfessionalEntry(
  code: string, specialty: Specialty,
  existing: readonly DemoProfessional[],
): DemoProfessional | null {
  const normalized = normalizeDemoCode(code);
  if (!normalized || !SPECIALTIES.includes(specialty)) return null;
  const candidate = {
    id: "DEMO-PRO-CODE-" + normalized,
    label: "Profesional ficticio " + normalized,
    specialty,
  };
  return existing.some(p => p.id === candidate.id) ? null : candidate;
}
export function nextDemoDay(now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  date.setDate(date.getDate() + 1);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")].join("-");
}
export function createDemoAssignment(args: {
  patient: DemoPatient;
  professional: DemoProfessional;
  slot: DemoSlot;
  current: readonly DemoVisit[];
  day: string;
}): DemoVisit | null {
  const { patient, professional, slot, current, day } = args;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (current.some(v =>
    v.date === day && v.professionalRef === professional.id &&
    v.timeRange === slot.label && v.status !== "CLOSED_VERIFIED"
  )) return null;
  const nextId = "DEMO-M-" + String(current.length + 1).padStart(3, "0");
  return {
    id: nextId,
    reference: "VIS-" + nextId,
    patientLabel: patient.label,
    specialty: professional.specialty,
    professionalRef: professional.id,
    date: day,
    timeRange: slot.label,
    status: "ASSIGNED",
    neighborhood: "Domicilio ficticio · sin dirección real",
    detail: "Prestación de muestra asignada en memoria; no representa un turno real.",
  };
}
