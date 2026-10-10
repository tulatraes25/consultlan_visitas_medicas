import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { formIdForSpecialty } from '../src/FormCatalogDemo';

function viewport(width: number, height = 844) {
  const metrics = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: metrics, screen: metrics });
}
beforeEach(() => viewport(390));

describe('HC-03B: verified-source form previews only', () => {
  test('mobile Planillas tab lists the six original specialty attendance forms', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    expect(screen.getByText('Planillas y constancias')).toBeTruthy();
    expect(screen.getByText('Constancias por especialidad')).toBeTruthy();
    expect(screen.getByText('6 modelos disponibles')).toBeTruthy();
    for (const source of [
      'Planilla médica', 'Enfermería/cuidadoras', 'Kinesiología',
      'Fonoaudiología', 'Terapia ocupacional', 'Nutrición',
    ]) {
      expect(screen.getByRole('button', { name: `Ver estructura de ${source}` })).toBeTruthy();
    }
    expect(screen.getByText(/SOLO PREVISUALIZACIÓN/)).toBeTruthy();
    expect(screen.queryByText('Ventana táctil de firma')).toBeNull();
  });

  test('phone selecting medical sheet shows verified field placeholders, no form inputs or sign actions', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Planilla médica' }));
    expect(screen.getByTestId('form-preview-MEDICAL_ATTENDANCE')).toBeTruthy();
    expect(screen.getByText('Firma padre/madre/tutor')).toBeTruthy();
    expect(screen.getByText('Firma profesional pendiente · no habilitada')).toBeTruthy();
    expect(screen.getByText('No se puede guardar ni firmar')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Firmar documento|Enviar planilla|Guardar evolución/i })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Volver al catálogo de planillas' }));
    expect(screen.getByText('6 modelos disponibles')).toBeTruthy();
    expect(screen.queryByTestId('form-preview-MEDICAL_ATTENDANCE')).toBeNull();
  });

  test('nursing sheet retains its time field and distinct family and professional evidence', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Enfermería/cuidadoras' }));
    expect(screen.getByTestId('form-preview-NURSING_CAREGIVER_ATTENDANCE')).toBeTruthy();
    expect(screen.getByText('Horario')).toBeTruthy();
    expect(screen.getByText('Firma y sello profesional')).toBeTruthy();
    expect(screen.getByText('Firma familiar')).toBeTruthy();
    expect(screen.getByText('Horario sin completar')).toBeTruthy();
    expect(screen.getByText('Conformidad familiar pendiente · no habilitada')).toBeTruthy();
  });

  test('clinical evolution category is separate from attendance, and displays no editable narrative', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Categoría de planillas: Evolución' }));
    expect(screen.getByText('1 modelo disponible')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Hoja evolución' }));
    expect(screen.getByTestId('form-preview-CLINICAL_EVOLUTION')).toBeTruthy();
    expect(screen.getByText('Evolución bloqueada · sin captura clínica')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText('Firma familiar')).toBeNull();
  });

  test('paper-only category keeps Kardex, vital signs, procedures and crisis sheets at home', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Categoría de planillas: Hojas en domicilio' }));
    expect(screen.getByText('4 modelos disponibles')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Ficha Kardex' }));
    expect(screen.getByTestId('paper-preview-KARDEX')).toBeTruthy();
    expect(screen.getByText(/Hay encabezados ilegibles o no confirmados/)).toBeTruthy();
    expect(screen.getByText('El documento permanece en papel')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Volver al catálogo de planillas' }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Hoja de crisis' }));
    expect(screen.getByTestId('paper-preview-CRISIS_SHEET')).toBeTruthy();
    expect(screen.getByText('Tipo de crisis')).toBeTruthy();
    expect(screen.getByText(/No implica triaje o monitoreo de emergencias/)).toBeTruthy();
  });

  test('visit detail opens the correct specialty preview without leaking demo patient context', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio D/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver planilla de esta especialidad (demo)' }));
    expect(screen.getByTestId('form-preview-SPEECH_ATTENDANCE')).toBeTruthy();
    expect(screen.queryByText('Paciente ficticio D')).toBeNull();
    expect(screen.queryByText('Domicilio simulado · Zona D')).toBeNull();
    expect(screen.getByText('No se puede guardar ni firmar')).toBeTruthy();
  });

  test('wide tablet displays catalog and preview simultaneously; switching specialties updates preview', () => {
    viewport(1280, 900);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    expect(screen.getByTestId('form-catalog-list')).toBeTruthy();
    expect(screen.getByTestId('form-preview-MEDICAL_ATTENDANCE')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Kinesiología' }));
    expect(screen.getByTestId('form-preview-PHYSIOTHERAPY_ATTENDANCE')).toBeTruthy();
    expect(screen.queryByTestId('form-preview-MEDICAL_ATTENDANCE')).toBeNull();
    fireEvent.press(screen.getByRole('radio', { name: 'Categoría de planillas: Hojas en domicilio' }));
    expect(screen.getByTestId('paper-preview-KARDEX')).toBeTruthy();
  });

  test('medium tablet uses a focused detail and back navigation rather than twin columns', () => {
    viewport(1000, 850);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver estructura de Nutrición' }));
    expect(screen.getByTestId('form-preview-NUTRITION_ATTENDANCE')).toBeTruthy();
    expect(screen.queryByTestId('form-catalog-list')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Volver al catálogo de planillas' }));
    expect(screen.getByTestId('form-catalog-list')).toBeTruthy();
  });

  test('demo specialty mapping selects only the seven verified form IDs, no consultorio identifiers', () => {
    const mapping = {
      Medicina: 'MEDICAL_ATTENDANCE',
      Enfermería: 'NURSING_CAREGIVER_ATTENDANCE',
      Kinesiología: 'PHYSIOTHERAPY_ATTENDANCE',
      Fonoaudiología: 'SPEECH_ATTENDANCE',
      'Terapia ocupacional': 'OCCUPATIONAL_THERAPY_ATTENDANCE',
      Nutrición: 'NUTRITION_ATTENDANCE',
    } as const;
    for (const [specialty, id] of Object.entries(mapping)) {
      expect(formIdForSpecialty(specialty as keyof typeof mapping)).toBe(id);
    }
  });
});
