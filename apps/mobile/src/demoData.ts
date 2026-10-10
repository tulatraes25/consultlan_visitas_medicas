/**
 * Fully synthetic, ephemeral fixtures. Never connect to CONSULTLAN or store PHI.
 * Identifiers intentionally cannot be confused with real patient identifiers.
 */
export type VisitStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'CLOSED_VERIFIED';
export type Specialty =
  | 'Enfermería' | 'Kinesiología' | 'Medicina' | 'Fonoaudiología'
  | 'Terapia ocupacional' | 'Nutrición';

export type DemoVisit = Readonly<{
  id: string;
  reference: string;
  patientLabel: string;
  specialty: Specialty;
  date: string;
  timeRange: string;
  status: VisitStatus;
  neighborhood: string;
  detail: string;
}>;

const formatLocalDate = (value: Date): string => [
  value.getFullYear(),
  String(value.getMonth() + 1).padStart(2, '0'),
  String(value.getDate()).padStart(2, '0'),
].join('-');

function dayOffset(date: Date, offset: number): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  copy.setDate(copy.getDate() + offset);
  return formatLocalDate(copy);
}

export function createDemoVisits(now = new Date()): DemoVisit[] {
  return [
    {
      id: 'DEMO-0001', reference: 'VIS-DEMO-0001', patientLabel: 'Paciente ficticio A',
      specialty: 'Enfermería', date: dayOffset(now, 0), timeRange: '08:30 – 09:15',
      status: 'CLOSED_VERIFIED', neighborhood: 'Domicilio simulado · Zona A',
      detail: 'Control de enfermería de demostración. No contiene indicaciones clínicas.',
    },
    {
      id: 'DEMO-0002', reference: 'VIS-DEMO-0002', patientLabel: 'Paciente ficticio B',
      specialty: 'Kinesiología', date: dayOffset(now, 0), timeRange: '10:00 – 10:45',
      status: 'IN_PROGRESS', neighborhood: 'Domicilio simulado · Zona B',
      detail: 'Sesión de kinesiología ficticia. Sin registro de evolución real.',
    },
    {
      id: 'DEMO-0003', reference: 'VIS-DEMO-0003', patientLabel: 'Paciente ficticio C',
      specialty: 'Medicina', date: dayOffset(now, 0), timeRange: '15:00 – 15:40',
      status: 'ASSIGNED', neighborhood: 'Domicilio simulado · Zona C',
      detail: 'Visita médica ficticia. No existe historia clínica asociada.',
    },
    {
      id: 'DEMO-0004', reference: 'VIS-DEMO-0004', patientLabel: 'Paciente ficticio D',
      specialty: 'Fonoaudiología', date: dayOffset(now, 1), timeRange: '09:00 – 09:50',
      status: 'ASSIGNED', neighborhood: 'Domicilio simulado · Zona D',
      detail: 'Sesión de fonoaudiología ficticia para probar el flujo de agenda.',
    },
    {
      id: 'DEMO-0005', reference: 'VIS-DEMO-0005', patientLabel: 'Paciente ficticio E',
      specialty: 'Terapia ocupacional', date: dayOffset(now, 1), timeRange: '11:30 – 12:15',
      status: 'ASSIGNED', neighborhood: 'Domicilio simulado · Zona E',
      detail: 'Sesión de terapia ocupacional ficticia para demostrar el detalle.',
    },
    {
      id: 'DEMO-0006', reference: 'VIS-DEMO-0006', patientLabel: 'Paciente ficticio F',
      specialty: 'Nutrición', date: dayOffset(now, 2), timeRange: '14:00 – 14:30',
      status: 'ASSIGNED', neighborhood: 'Domicilio simulado · Zona F',
      detail: 'Consulta nutricional ficticia. No contiene datos sanitarios.',
    },
  ];
}

export function formatDemoDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString('es-AR', {
    weekday: 'short', day: '2-digit', month: 'short',
  });
}
export function isPending(status: VisitStatus): boolean {
  return status !== 'CLOSED_VERIFIED';
}
export function statusLabel(status: VisitStatus): string {
  switch (status) {
    case 'ASSIGNED': return 'Asignada';
    case 'IN_PROGRESS': return 'En curso';
    case 'CLOSED_VERIFIED': return 'Finalizada (demo)';
  }
}
