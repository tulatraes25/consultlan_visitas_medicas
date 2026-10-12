import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';
import { FormCatalogDemo, formIdForSpecialty } from '../src/FormCatalogDemo';

function viewport(width: number, height = 844) {
  const metrics = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: metrics, screen: metrics });
}
beforeEach(() => viewport(390));

describe('HC-UX-04A: one-tap assigned form for a new professional (demo only)', () => {
  test('Inicio opens next pending synthetic specialty without a form catalog', () => {
    render(<App />);
    expect(screen.getByText('Tu próxima planilla, sin buscarla.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {
      name: 'Abrir planilla de mi próxima prestación (demo)',
    }));
    // The earlier finished nursing visit must not replace the next pending
    // physiotherapy task. The preview gets only the specialty, never patient data.
    expect(screen.getByText('Tu planilla para esta prestación')).toBeTruthy();
    expect(screen.getByTestId('form-preview-PHYSIOTHERAPY_ATTENDANCE')).toBeTruthy();
    expect(screen.getByTestId('auto-selected-form-explanation')).toBeTruthy();
    expect(screen.queryByTestId('form-preview-NURSING_CAREGIVER_ATTENDANCE')).toBeNull();
    expect(screen.queryByTestId('form-catalog-list')).toBeNull();
    expect(screen.queryAllByRole('radio', { name: /Categoría de planillas/ })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ver estructura de Planilla médica' })).toBeNull();
    expect(screen.queryByText('Paciente ficticio B')).toBeNull();
    expect(screen.queryByText('DEMO-EPI-B')).toBeNull();
    expect(screen.queryByText('Domicilio simulado · Zona B')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('No se puede guardar ni firmar')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Volver a la agenda' }));
    expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
  });

  test('Agenda detail opens the matched specialty, no chooser and no episode data', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio D/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Ver planilla de esta especialidad (demo)' }));
    expect(screen.getByTestId('form-preview-SPEECH_ATTENDANCE')).toBeTruthy();
    expect(screen.queryByTestId('form-catalog-list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver estructura de Nutrición' })).toBeNull();
    expect(screen.queryByText('Paciente ficticio D')).toBeNull();
    expect(screen.queryByText('Domicilio simulado · Zona D')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Volver a la agenda' }));
    expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
  });

  test('Tablet focus stays on one form; the general catalog is still available separately', () => {
    viewport(1280, 900);
    render(<App />);
    fireEvent.press(screen.getByRole('button', {
      name: 'Abrir planilla de mi próxima prestación (demo)',
    }));
    expect(screen.getByTestId('form-preview-PHYSIOTHERAPY_ATTENDANCE')).toBeTruthy();
    expect(screen.queryByTestId('form-catalog-list')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Categoría de planillas: Evolución' })).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'Planillas' }));
    expect(screen.getByText('Planillas y constancias')).toBeTruthy();
    expect(screen.getByTestId('form-catalog-list')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Categoría de planillas: Evolución' })).toBeTruthy();
  });

  test('Runtime mapping fails closed for unknown, forged or prototype specialties', () => {
    for(const invalid of [undefined, null, '', 'Pediatría', '__proto__',
      'CLINICAL_EVOLUTION', 'KARDEX', 'Medicina ', {}, 42, false]) {
      expect(formIdForSpecialty(invalid)).toBeUndefined();
    }
    const expected = {
      Medicina: 'MEDICAL_ATTENDANCE',
      Enfermería: 'NURSING_CAREGIVER_ATTENDANCE',
      Kinesiología: 'PHYSIOTHERAPY_ATTENDANCE',
      Fonoaudiología: 'SPEECH_ATTENDANCE',
      'Terapia ocupacional': 'OCCUPATIONAL_THERAPY_ATTENDANCE',
      Nutrición: 'NUTRITION_ATTENDANCE',
    };
    for (const [specialty, template] of Object.entries(expected)) {
      expect(formIdForSpecialty(specialty)).toBe(template);
    }
  });

  test('Focused mode refuses unknown, evolution and paper IDs without a medical fallback', () => {
    for (const id of ['KARDEX', 'CLINICAL_EVOLUTION', 'NO_SUCH_FORM']) {
      const {unmount} = render(<FormCatalogDemo
        initialTemplateId={id} focusAssignedTemplate
      />);
      expect(screen.getByTestId('assigned-form-unavailable')).toBeTruthy();
      expect(screen.getByText('Planilla no disponible')).toBeTruthy();
      expect(screen.queryByTestId('form-preview-MEDICAL_ATTENDANCE')).toBeNull();
      expect(screen.queryByTestId('paper-preview-KARDEX')).toBeNull();
      expect(screen.queryByTestId('form-catalog-list')).toBeNull();
      expect(screen.queryByRole('textbox')).toBeNull();
      unmount();
    }
  });
});
