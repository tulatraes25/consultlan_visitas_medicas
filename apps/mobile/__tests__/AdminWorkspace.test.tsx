import React from "react";
import { Dimensions } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import {
  createDemoPatients, createDemoProfessionals, createPatientEntry,
  createProfessionalEntry, createDemoAssignment, DEMO_SLOTS, nextDemoDay,
} from "../src/adminDemoData";

function phone() {
  Dimensions.set({
    window: { width: 390, height: 844, scale: 2, fontScale: 1 },
    screen: { width: 390, height: 844, scale: 2, fontScale: 1 },
  });
}

beforeEach(phone);

test("management workspace is unmistakably an offline synthetic demo", () => {
  render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Gestión" }));
  expect(screen.getByText("Administración de visitas")).toBeTruthy();
  expect(screen.getByText("SOLO DEMOSTRACIÓN · SIN CONEXIÓN A SUPABASE")).toBeTruthy();
  expect(screen.getByText(/Todo se pierde al reiniciar la aplicación/)).toBeTruthy();
  expect(screen.getByText("Alta de pacientes ficticios")).toBeTruthy();
});

test("admin can simulate creating patient and professional, assigning slot and finding agenda entry", () => {
  render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Gestión" }));

  fireEvent.changeText(screen.getByLabelText("Código ficticio del nuevo paciente"), "G");
  fireEvent.press(screen.getByRole("button", { name: "Agregar paciente de muestra" }));
  expect(screen.getByText("Paciente ficticio G")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "Módulo Profesionales" }));
  fireEvent.changeText(screen.getByLabelText("Código ficticio del nuevo profesional"), "K7");
  fireEvent.press(screen.getByRole("radio", { name: "Especialidad Kinesiología" }));
  fireEvent.press(screen.getByRole("button", { name: "Agregar profesional de muestra" }));
  expect(screen.getByText("Profesional ficticio K7")).toBeTruthy();

  fireEvent.press(screen.getByRole("tab", { name: "Módulo Asignaciones" }));
  fireEvent.press(screen.getByRole("radio", { name: "Asignar a Paciente ficticio G" }));
  fireEvent.press(screen.getByRole("radio", { name: "Seleccionar Profesional ficticio K7" }));
  fireEvent.press(screen.getByRole("radio", { name: "Horario 14:00 – 14:40" }));
  fireEvent.press(screen.getByRole("button", { name: "Simular asignación de visita" }));
  expect(screen.getByText("Visita ficticia asignada solo en la memoria de la aplicación.")).toBeTruthy();
  expect(screen.getByText("Agenda ficticia actual: 7 prestaciones")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Consultar agenda simulada" }));
  expect(screen.getByText("Agenda domiciliaria")).toBeTruthy();
  expect(screen.getByText("Paciente ficticio G")).toBeTruthy();
});

test("duplicate patient codes are rejected instead of creating an apparent real patient", () => {
  render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Gestión" }));
  fireEvent.changeText(screen.getByLabelText("Código ficticio del nuevo paciente"), "A");
  fireEvent.press(screen.getByRole("button", { name: "Agregar paciente de muestra" }));
  expect(screen.getByText(/Código inválido o repetido/)).toBeTruthy();
  expect(screen.getByText("Directorio simulado · 6")).toBeTruthy();
});

test("duplicate professional and overlapping fixture slots are blocked", () => {
  const existing = createDemoProfessionals();
  const added = createProfessionalEntry("K7", "Kinesiología", existing);
  expect(added).not.toBeNull();
  expect(createProfessionalEntry("k7", "Kinesiología", [...existing, added!])).toBeNull();

  const patients = createDemoPatients();
  const date = nextDemoDay(new Date(2026, 9, 10));
  const one = createDemoAssignment({
    patient: patients[0], professional: existing[1], slot: DEMO_SLOTS[0],
    day: date, current: [],
  });
  expect(one).not.toBeNull();
  const duplicate = createDemoAssignment({
    patient: patients[1], professional: existing[1], slot: DEMO_SLOTS[0],
    day: date, current: [one!],
  });
  expect(duplicate).toBeNull();
});

test("synthetic-only labels reject full personal names and unsupported characters", () => {
  expect(createPatientEntry("Juan Pérez", createDemoPatients())).toBeNull();
  expect(createPatientEntry("12-3445", createDemoPatients())).toBeNull();
  expect(createPatientEntry("G", createDemoPatients())?.label).toBe("Paciente ficticio G");
});

test("tablet navigation keeps management separate from clinical signatures", () => {
  Dimensions.set({
    window: { width: 1280, height: 900, scale: 2, fontScale: 1 },
    screen: { width: 1280, height: 900, scale: 2, fontScale: 1 },
  });
  render(<App />);
  fireEvent.press(screen.getByRole("tab", { name: "Gestión" }));
  expect(screen.getByText("Administración de visitas")).toBeTruthy();
  expect(screen.queryByText("Ventana táctil de firma")).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "Agenda" }));
  expect(screen.getByText("Agenda domiciliaria")).toBeTruthy();
});
