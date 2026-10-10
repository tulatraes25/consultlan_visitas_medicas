import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';

function setViewport(width: number, height = 844) {
  const metrics = { width, height, scale: 2, fontScale: 1 };
  Dimensions.set({ window: metrics, screen: metrics });
}

describe('Pediatrics mobile demo interactions — synthetic data only', () => {
  beforeEach(() => setViewport(390));

  test('phone starts on branded demo dashboard without live clinical controls', () => {
    render(<App />);
    expect(screen.getByText('Mi jornada')).toBeTruthy();
    expect(screen.getAllByText(/MODO DEMO · datos ficticios/).length).toBeGreaterThan(0);
    expect(screen.getByText('Próximas prestaciones')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Firmar ahora/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Registrar visita real/i })).toBeNull();
  });

  test('phone can navigate home > agenda > detail > agenda', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir agenda de demostración' }));
    expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio C/ }));
    expect(screen.getByText('Paciente ficticio C')).toBeTruthy();
    expect(screen.getByText('Registro y firma no disponibles en esta demostración')).toBeTruthy();
    fireEvent.press(screen.getAllByRole('button', { name: 'Volver a la agenda' })[0]);
    expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
  });

  test('phone search and filters exclude nonmatching sample visits', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    const search = screen.getByPlaceholderText('Buscar visita o especialidad');
    fireEvent.changeText(search, 'ficticio C');
    expect(screen.getByText('Paciente ficticio C')).toBeTruthy();
    expect(screen.queryByText('Paciente ficticio A')).toBeNull();

    fireEvent.changeText(search, '');
    fireEvent.press(screen.getByRole('radio', { name: 'Filtrar visitas: Finalizadas' }));
    expect(screen.getByText('Paciente ficticio A')).toBeTruthy();
    expect(screen.queryByText('Paciente ficticio C')).toBeNull();

    fireEvent.press(screen.getByRole('radio', { name: 'Filtrar visitas: Pendientes' }));
    expect(screen.queryByText('Paciente ficticio A')).toBeNull();
    expect(screen.getByText('Paciente ficticio C')).toBeTruthy();
  });

  test('phone search displays helpful empty state and reset returns fixtures', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.changeText(screen.getByPlaceholderText('Buscar visita o especialidad'), 'no-existe-xyz');
    expect(screen.getByText('No encontramos visitas')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Restablecer búsqueda' }));
    expect(screen.getByText('Paciente ficticio A')).toBeTruthy();
  });

  test('wide tablet uses side navigation and side-by-side agenda detail', () => {
    setViewport(1280, 900);
    render(<App />);
    expect(screen.getByText('ESPACIO PROFESIONAL')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    expect(screen.getByText('Agenda domiciliaria')).toBeTruthy();
    expect(screen.getByText('Prestación domiciliaria')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio D/ }));
    expect(screen.getAllByText('Paciente ficticio D').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Fonoaudiología').length).toBeGreaterThan(1);
  });

  test('medium tablet shows focused visit detail with a back action', () => {
    setViewport(1000, 850);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio F/ }));
    expect(screen.getByText('Registro y firma no disponibles en esta demostración')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Volver a la agenda' }).length).toBeGreaterThan(0);
  });
});
