import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EpisodeOverviewDemo, demoEpisodeCoverages } from "../src/EpisodeOverviewDemo";
import { createDemoPatients, createDemoProfessionals, createPatientEntry } from "../src/adminDemoData";
import { createDemoVisits } from "../src/demoData";

const patients = createDemoPatients();
const professionals = createDemoProfessionals();
const visits = createDemoVisits(new Date(2026, 9, 10, 12));

describe("MOB-HC-EPISODE-01 synthetic case-first timeline", () => {
  test("never combines another episode with the selected case, including same-patient forged metadata", () => {
    const first = visits[0];
    const wrongEpisode = { ...first, id: "DEMO-BOGUS-01", reference: "VIS-DEMO-BOGUS",
      episodeRef: patients[1].episodeRef };
    const wrongPatient = { ...first, id: "DEMO-BOGUS-02", reference: "VIS-DEMO-WRONG-PATIENT",
      patientRef: patients[1].id };
    const oldUnbound = { ...first, id: "DEMO-BOGUS-03", reference: "VIS-DEMO-UNBOUND",
      patientRef: undefined, episodeRef: undefined };
    const scoped = demoEpisodeCoverages(patients[0], [
      ...visits, wrongEpisode, wrongPatient, oldUnbound,
    ]);
    expect(scoped.map(item => item.id)).toEqual(["DEMO-0001"]);
    expect(demoEpisodeCoverages(undefined, visits)).toEqual([]);
    expect(demoEpisodeCoverages(
      { id: "real-patient", label: "real", episodeRef: "real-episode" }, visits,
    )).toEqual([]);
  });

  test("phone can inspect an episode without revealing other cases or clinical controls", () => {
    render(<EpisodeOverviewDemo
      patients={patients} professionals={professionals} visits={visits}
    />);
    expect(screen.getByText("Episodios domiciliarios")).toBeTruthy();
    expect(screen.getByText("VIS-DEMO-0001")).toBeTruthy();
    expect(screen.queryByText("VIS-DEMO-0002")).toBeNull();
    expect(screen.getByText("EPISODIOS SIMULADOS · SIN ADMISIÓN CLÍNICA")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Firmar|Aprobar|Activar|Crear orden/i })).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Ver episodio de Paciente ficticio B" }));
    expect(screen.getByText("VIS-DEMO-0002")).toBeTruthy();
    expect(screen.queryByText("VIS-DEMO-0001")).toBeNull();
    expect(screen.getByText("DEMO-EPI-B")).toBeTruthy();
  });

  test("new synthetic case is empty until its own coverage is assigned", () => {
    const newPatient = createPatientEntry("G", patients);
    expect(newPatient).not.toBeNull();
    render(<EpisodeOverviewDemo patients={[...patients, newPatient!]}
      professionals={professionals} visits={visits} />);
    fireEvent.press(screen.getByRole("button", { name: "Ver episodio de Paciente ficticio G" }));
    expect(screen.getByTestId("episode-empty")).toBeTruthy();
    expect(screen.queryByText("VIS-DEMO-0001")).toBeNull();
  });

  test("shift and visit modalities are separate within the same episode", () => {
    const shift = { ...visits[0], id: "DEMO-SHIFT-01",
      reference: "GUA-DEMO-SHIFT-01", serviceKind: "SHIFT" as const };
    render(<EpisodeOverviewDemo patients={patients}
      professionals={professionals} visits={[...visits, shift]} />);
    expect(screen.getByTestId("episode-coverage-DEMO-SHIFT-01")).toBeTruthy();
    expect(screen.getByText("Visitas")).toBeTruthy();
    expect(screen.getByText("Guardias")).toBeTruthy();
    expect(screen.getByText("GUA-DEMO-SHIFT-01")).toBeTruthy();
  });
  test("adjacent overnight shifts show a possible handover only inside the selected patient episode", () => {
    const outgoing = { ...visits[0], id: "DEMO-SHIFT-A-1",
      reference: "GUA-DEMO-A-1", serviceKind: "SHIFT" as const,
      date: "2026-10-11", startTime: "20:00", endTime: "08:00",
      professionalRef: "DEMO-PRO-2" };
    const incoming = { ...visits[0], id: "DEMO-SHIFT-A-2",
      reference: "GUA-DEMO-A-2", serviceKind: "SHIFT" as const,
      date: "2026-10-12", startTime: "08:00", endTime: "20:00",
      professionalRef: "DEMO-PRO-3" };
    // Same episode string but a DIFFERENT patient: must never be displayed
    // or counted as clinical/staffing continuity.
    const forged = { ...incoming, id: "DEMO-SHIFT-BOGUS",
      reference: "GUA-DEMO-FORGED", patientRef: patients[1].id,
      date: "2026-10-12", startTime: "20:00", endTime: "08:00" };

    render(<EpisodeOverviewDemo
      patients={patients} professionals={professionals}
      visits={[...visits, outgoing, incoming, forged]}
    />);
    expect(screen.getByTestId("episode-continuity-list")).toBeTruthy();
    expect(screen.getByTestId("episode-continuity-DEMO-SHIFT-A-1")).toBeTruthy();
    expect(screen.getAllByText("HORARIOS CONSECUTIVOS · SIN RELEVO ACREDITADO")).toHaveLength(1);
    expect(screen.getByText("GUA-DEMO-A-1 → GUA-DEMO-A-2")).toBeTruthy();
    expect(screen.queryByText("GUA-DEMO-FORGED")).toBeNull();
    expect(screen.queryByRole("button", {name:/Aceptar relevo|Confirmar relevo|Firmar relevo/i})).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Ver episodio de Paciente ficticio B" }));
    expect(screen.queryByTestId("episode-continuity-list")).toBeNull();
    expect(screen.getByTestId("episode-continuity-empty")).toBeTruthy();
    expect(screen.queryByText("GUA-DEMO-A-1 → GUA-DEMO-A-2")).toBeNull();
  });

  test("same episode label with mismatched patient never creates a handover suggestion", () => {
    const first={ ...visits[0], id:"DEMO-FIRST-SHIFT", reference:"GUA-FIRST",
      serviceKind:"SHIFT" as const, date:"2026-10-11",startTime:"08:00",
      endTime:"20:00",professionalRef:"DEMO-PRO-2" };
    const mismatched={ ...first,id:"DEMO-WRONG-PATIENT",reference:"GUA-WRONG",
      patientRef:patients[1].id, episodeRef:patients[0].episodeRef,
      startTime:"20:00",endTime:"08:00",professionalRef:"DEMO-PRO-3" };
    render(<EpisodeOverviewDemo patients={patients}
      professionals={professionals} visits={[first,mismatched]} />);
    expect(screen.getByTestId("episode-continuity-empty")).toBeTruthy();
    expect(screen.queryByText("GUA-WRONG")).toBeNull();
    expect(screen.queryByTestId("episode-continuity-list")).toBeNull();
  });

});
