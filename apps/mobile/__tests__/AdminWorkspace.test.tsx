import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { createDemoVisits } from '../src/demoData';
import {
  createDemoPatients, createDemoProfessionals, createPatientEntry,
  createProfessionalEntry, createDemoAssignment, nextDemoDay,
} from '../src/adminDemoData';
import {
  coverageDurationLabel, demoWindowsOverlap, findDemoContinuityHints,
  formatDemoTimeRange, hasDemoProfessionalCollision, resolveDemoWindow,
} from '../src/coverageDemo';

function viewport(width = 390, height = 844) {
  const metrics = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: metrics, screen: metrics });
}
beforeEach(() => viewport());

test('management workspace remains an offline synthetic demo', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
  expect(screen.getByText('Administración de coberturas')).toBeTruthy();
  expect(screen.getByText('SOLO DEMOSTRACIÓN · SIN CONEXIÓN A SUPABASE')).toBeTruthy();
  expect(screen.getByText(/Todo se pierde al reiniciar la aplicación/)).toBeTruthy();
  expect(screen.getByText('Alta de pacientes ficticios')).toBeTruthy();
});

test('admin creates fictitious patient/professional and a variable overnight shift in agenda', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
  fireEvent.changeText(screen.getByLabelText('Código ficticio del nuevo paciente'), 'G');
  fireEvent.press(screen.getByRole('button', { name: 'Agregar paciente de muestra' }));
  expect(screen.getByText('Paciente ficticio G')).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: 'Módulo Profesionales' }));
  fireEvent.changeText(screen.getByLabelText('Código ficticio del nuevo profesional'), 'K7');
  fireEvent.press(screen.getByRole('radio', { name: 'Especialidad Kinesiología' }));
  fireEvent.press(screen.getByRole('button', { name: 'Agregar profesional de muestra' }));
  expect(screen.getByText('Profesional ficticio K7')).toBeTruthy();

  fireEvent.press(screen.getByRole('tab', { name: 'Módulo Asignaciones' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Asignar a Paciente ficticio G' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Seleccionar Profesional ficticio K7' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Modalidad Guardia prolongada' }));
  fireEvent.changeText(screen.getByLabelText('Inicio de cobertura HH:mm'), '20:00');
  fireEvent.changeText(screen.getByLabelText('Fin de cobertura HH:mm'), '08:00');
  expect(screen.getByText(/12 h · termina al día siguiente/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Simular asignación de cobertura' }));
  expect(screen.getByText('Guardia ficticia asignada solo en la memoria de la aplicación.')).toBeTruthy();
  expect(screen.getByText('Agenda ficticia actual: 7 prestaciones')).toBeTruthy();

  fireEvent.press(screen.getByRole('button', { name: 'Consultar agenda simulada' }));
  expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
  expect(screen.getByText('Paciente ficticio G')).toBeTruthy();
  expect(screen.getByText('20:00 – 08:00 (+1 día)')).toBeTruthy();
  expect(screen.getAllByText('Guardia prolongada').length).toBeGreaterThan(0);
});

test('invalid date/time is rejected and does not insert a coverage', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Módulo Asignaciones' }));
  fireEvent.changeText(screen.getByLabelText('Fecha ficticia AAAA-MM-DD'), '2026-02-30');
  fireEvent.press(screen.getByRole('button', { name: 'Simular asignación de cobertura' }));
  expect(screen.getByText(/Fecha u horario inválidos/)).toBeTruthy();
  expect(screen.getByText('Agenda ficticia actual: 6 prestaciones')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Fecha ficticia AAAA-MM-DD'), '2026-10-12');
  fireEvent.changeText(screen.getByLabelText('Inicio de cobertura HH:mm'), '25:00');
  fireEvent.press(screen.getByRole('button', { name: 'Simular asignación de cobertura' }));
  expect(screen.getByText('Agenda ficticia actual: 6 prestaciones')).toBeTruthy();
});

test('duplicate patient codes and personal names cannot enter the fake directory', () => {
  render(<App />);
  fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
  fireEvent.changeText(screen.getByLabelText('Código ficticio del nuevo paciente'), 'A');
  fireEvent.press(screen.getByRole('button', { name: 'Agregar paciente de muestra' }));
  expect(screen.getByText(/Código inválido o repetido/)).toBeTruthy();
  expect(screen.getByText('Directorio simulado · 6')).toBeTruthy();
  expect(createPatientEntry('Juan Pérez', createDemoPatients())).toBeNull();
  expect(createPatientEntry('12-3445', createDemoPatients())).toBeNull();
  expect(createPatientEntry('G', createDemoPatients())?.label).toBe('Paciente ficticio G');
});

test('duplicate professional codes and overlapping cross-kind slots are denied', () => {
  const professionals = createDemoProfessionals();
  const added = createProfessionalEntry('K7', 'Kinesiología', professionals);
  expect(added).not.toBeNull();
  expect(createProfessionalEntry('k7', 'Kinesiología', [...professionals, added!])).toBeNull();

  const patients = createDemoPatients();
  const day = nextDemoDay(new Date(2026, 9, 10));
  const shift = createDemoAssignment({
    patient: patients[0], professional: professionals[1], kind: 'SHIFT',
    day, startTime: '08:00', endTime: '20:00', current: [],
  });
  expect(shift?.serviceKind).toBe('SHIFT');
  expect(createDemoAssignment({
    patient: patients[1], professional: professionals[1], kind: 'VISIT',
    day, startTime: '15:30', endTime: '16:15', current: [shift!],
  })).toBeNull();
  expect(createDemoAssignment({
    patient: patients[1], professional: professionals[1], kind: 'VISIT',
    day, startTime: '20:00', endTime: '20:30', current: [shift!],
  })).not.toBeNull(); // Adjacent end-exclusive is safe
  expect(createDemoAssignment({
    patient: patients[1], professional: professionals[2], kind: 'SHIFT',
    day, startTime: '15:30', endTime: '22:00', current: [shift!],
  })).not.toBeNull(); // Different professional can work at same time
});

test('previous-day overnight shift blocks following morning and permits boundary adjacency', () => {
  const patients = createDemoPatients(), professionals = createDemoProfessionals();
  const overnight = createDemoAssignment({
    patient: patients[0], professional: professionals[0], kind: 'SHIFT',
    day: '2026-10-11', startTime: '20:00', endTime: '08:00', current: [],
  });
  expect(overnight).not.toBeNull();
  expect(createDemoAssignment({
    patient: patients[1], professional: professionals[0], kind: 'VISIT',
    day: '2026-10-12', startTime: '07:59', endTime: '09:00',
    current: [overnight!],
  })).toBeNull();
  expect(createDemoAssignment({
    patient: patients[1], professional: professionals[0], kind: 'VISIT',
    day: '2026-10-12', startTime: '08:00', endTime: '09:00',
    current: [overnight!],
  })).not.toBeNull();
  expect(formatDemoTimeRange('20:00','08:00')).toBe('20:00 – 08:00 (+1 día)');
});

test('civil time parser rejects nonexistent days, unbounded times and malformed clocks', () => {
  expect(resolveDemoWindow('2026-02-30','09:00','10:00')).toBeNull();
  expect(resolveDemoWindow('2025-02-29','09:00','10:00')).toBeNull();
  expect(resolveDemoWindow('2024-02-29','09:00','10:00')).not.toBeNull();
  expect(resolveDemoWindow('2026-11-31','09:00','10:00')).toBeNull();
  for(const t of ['9:00','24:00','12:60','09:0','09:00<script>']) {
    expect(resolveDemoWindow('2026-10-11',t,'10:00')).toBeNull();
  }
  const fullDay = resolveDemoWindow('2026-10-11','07:00','07:00');
  expect(fullDay?.durationMinutes).toBe(1440);
  expect(coverageDurationLabel(1440)).toBe('24 h');
  const consecutiveA = resolveDemoWindow('2026-10-11','06:00','18:00')!;
  const consecutiveB = resolveDemoWindow('2026-10-11','18:00','23:00')!;
  expect(demoWindowsOverlap(consecutiveA, consecutiveB)).toBe(false);
});

test('synthetic completed visit still blocks historical collision by same professional', () => {
  const fixtures = createDemoVisits(new Date(2026,9,10));
  const patient = createDemoPatients()[1];
  const pro = createDemoProfessionals()[1];
  const overlap = createDemoAssignment({
    patient, professional: pro, kind:'VISIT',
    day:'2026-10-10', startTime:'08:35', endTime:'09:30', current: fixtures,
  });
  expect(overlap).toBeNull();
  expect(hasDemoProfessionalCollision(fixtures,pro.id,
    resolveDemoWindow('2026-10-10','09:15','10:00')!)).toBe(false);
});

test('possible handover hint requires same episode, different professional and adjacent SHIFTs', () => {
  const patients=createDemoPatients(), professionals=createDemoProfessionals();
  const a=createDemoAssignment({patient:patients[0], professional:professionals[0],
    kind:'SHIFT',day:'2026-10-11',startTime:'06:00',endTime:'18:00',current:[]})!;
  const b=createDemoAssignment({patient:patients[0], professional:professionals[1],
    kind:'SHIFT',day:'2026-10-11',startTime:'18:00',endTime:'06:00',current:[a]})!;
  const wrongPatient=createDemoAssignment({patient:patients[1],professional:professionals[2],
    kind:'SHIFT',day:'2026-10-12',startTime:'06:00',endTime:'18:00',current:[a,b]})!;
  expect(findDemoContinuityHints([a,b])).toEqual([
    {outgoingId:a.id,incomingId:b.id},
  ]);
  expect(findDemoContinuityHints([a,wrongPatient])).toEqual([]);
  const visit={...b,serviceKind:'VISIT' as const};
  expect(findDemoContinuityHints([a,visit])).toEqual([]);
  expect(findDemoContinuityHints([a,{...b,professionalRef:a.professionalRef}])).toEqual([]);
});

test('tablet management stays a demo and uses the same variable coverage editor', () => {
  viewport(1280,900);
  render(<App />);
  fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
  expect(screen.getByText('Administración de coberturas')).toBeTruthy();
  expect(screen.queryByText('Ventana táctil de firma')).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: 'Módulo Asignaciones' }));
  expect(screen.getByRole('radio', {name:'Modalidad Guardia prolongada'})).toBeTruthy();
  expect(screen.getByLabelText('Fin de cobertura HH:mm')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
  expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
});
