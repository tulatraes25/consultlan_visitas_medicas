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
    expect(screen.getByText('Registro clínico y firma válida no disponibles')).toBeTruthy();
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

  test('signature modal opens, captures a synthetic stroke, clears and discards on close', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio C/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Probar ventana táctil de firma (demo)' }));

    expect(screen.getByText('Ventana táctil de firma')).toBeTruthy();
    expect(screen.getByText('SIMULACIÓN SIN VALIDEZ LEGAL')).toBeTruthy();
    expect(screen.getByText('Trazos: 0')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: 'Vínculo de muestra: Tutor' }));
    expect(screen.getByText('Elegir un vínculo no acredita identidad ni representación legal.')).toBeTruthy();

    const pad = screen.getByTestId('demo-signature-pad');
    fireEvent(pad, 'layout', { nativeEvent: { layout: { width: 320, height: 180 } } });
    fireEvent(pad, 'responderGrant', { nativeEvent: { locationX: 12, locationY: 14 } });
    fireEvent(pad, 'responderMove', { nativeEvent: { locationX: 45, locationY: 60 } });
    expect(screen.getByText('Trazos: 1')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Borrar trazos de demostración' }));
    expect(screen.getByText('Trazos: 0')).toBeTruthy();

    fireEvent(pad, 'responderGrant', { nativeEvent: { locationX: 15, locationY: 30 } });
    expect(screen.getByText('Trazos: 1')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Cerrar y descartar demostración' }));
    expect(screen.queryByText('Ventana táctil de firma')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Probar ventana táctil de firma (demo)' }));
    expect(screen.getByText('Trazos: 0')).toBeTruthy();
  });

  test('medium tablet shows focused visit detail with a back action', () => {
    setViewport(1000, 850);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Agenda' }));
    fireEvent.press(screen.getByRole('button', { name: /Ver detalle de Paciente ficticio F/ }));
    expect(screen.getByText('Registro clínico y firma válida no disponibles')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Volver a la agenda' }).length).toBeGreaterThan(0);
  });

  test('episode-centered administration is reachable from phone navigation', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
    fireEvent.press(screen.getByRole('tab', { name: 'Módulo Episodios' }));
    expect(screen.getByTestId('demo-homecare-episodes')).toBeTruthy();
    expect(screen.getByText('VIS-DEMO-0001')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Ver episodio de Paciente ficticio C' }));
    expect(screen.getByText('VIS-DEMO-0003')).toBeTruthy();
    expect(screen.queryByText('VIS-DEMO-0001')).toBeNull();
    expect(screen.queryByRole('button', { name: /Aprobar plan|Activar internación/i })).toBeNull();
  });

  test('episode-centered administration is accessible on wide tablets', () => {
    setViewport(1280, 900);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
    fireEvent.press(screen.getByRole('tab', { name: 'Módulo Episodios' }));
    expect(screen.getByText('Episodios domiciliarios')).toBeTruthy();
    expect(screen.getByText('Sin autorización médica ni estado ACTIVE confirmado')).toBeTruthy();
  });

  test('review queue on phone is read-only, synthetic and never approves plans', () => {
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
    fireEvent.press(screen.getByRole('tab', { name: 'Módulo Revisiones' }));
    expect(screen.getByText('Solicitudes de revisión')).toBeTruthy();
    expect(screen.getAllByText('PENDIENTE')).toHaveLength(2);
    expect(screen.getByText('Episodio: CASO-DEMO-A')).toBeTruthy();
    expect(screen.getByText('SIN APROBACIONES NI ACTIVACIÓN CLÍNICA')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aprobar|Firmar|Activar/i })).toBeNull();
    expect(screen.queryByPlaceholderText('Código (por ejemplo G)')).toBeNull();
  });

  test('review queue is navigable on wide tablet without clinical actions', () => {
    setViewport(1280, 900);
    render(<App />);
    fireEvent.press(screen.getByRole('tab', { name: 'Gestión' }));
    fireEvent.press(screen.getByRole('tab', { name: 'Módulo Revisiones' }));
    expect(screen.getByTestId('plan-review-demo')).toBeTruthy();
    expect(screen.getByText('Episodio: CASO-DEMO-B')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Aprobar|Validar firma|Activar caso/i })).toBeNull();
  });

});
