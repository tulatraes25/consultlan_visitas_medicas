import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { EpisodeOverviewDemo } from "../src/EpisodeOverviewDemo";
import {
  DEMO_PLAN_DRAFTS, demoPlanDraftSummary, type DemoPlanDraft,
} from "../src/planDraftDemo";
import { createDemoPatients, createDemoProfessionals, createPatientEntry } from "../src/adminDemoData";
import { createDemoVisits } from "../src/demoData";

const patients = createDemoPatients();
const professionals = createDemoProfessionals();
const visits = createDemoVisits(new Date(2026, 9, 11, 12));

describe("MOB-HC-PLAN-01 synthetic care plan metadata only", () => {
  test("shows only a draft version count and never claims approval", () => {
    expect(demoPlanDraftSummary(patients[0])).toEqual({
      latestVersion: 1, draftVersions: 1, status: "BORRADOR · SIN APROBACIÓN",
    });
    expect(demoPlanDraftSummary(patients[1])).toEqual({
      latestVersion: 2, draftVersions: 2, status: "BORRADOR · SIN APROBACIÓN",
    });
    expect(demoPlanDraftSummary(patients[2])).toBeNull();
    expect(Object.isFrozen(DEMO_PLAN_DRAFTS)).toBe(true);
    expect(DEMO_PLAN_DRAFTS.every(item => Object.isFrozen(item))).toBe(true);
  });

  test("never combines patient, episode or plan records with mismatched identities", () => {
    const a = DEMO_PLAN_DRAFTS[0];
    const otherEpisode = { ...a, episodeRef: patients[1].episodeRef };
    const otherPatient = { ...a, patientRef: patients[1].id };
    expect(demoPlanDraftSummary(patients[0], [otherEpisode, otherPatient])).toBeNull();
    expect(demoPlanDraftSummary({
      ...patients[0], episodeRef: patients[1].episodeRef,
    }, DEMO_PLAN_DRAFTS)).toBeNull();
    expect(demoPlanDraftSummary({
      id: "real-id", episodeRef: patients[0].episodeRef, label: "Real name",
    }, DEMO_PLAN_DRAFTS)).toBeNull();
    expect(demoPlanDraftSummary(undefined, DEMO_PLAN_DRAFTS)).toBeNull();
    expect(demoPlanDraftSummary(patients[0], DEMO_PLAN_DRAFTS)).not.toBeNull();
  });

  test("fail-closed on approved or clinical fields, altered ids, duplicates and malformed versions", () => {
    const a = DEMO_PLAN_DRAFTS[0];
    const invalid: DemoPlanDraft[] = [
      { ...a, planState: "APPROVED" as never },
      { ...a, id: "DEMO-PLAN-B-1" },
      { ...a, id: "DEMO-PLAN-A-0", versionNumber: 0 },
      { ...a, versionNumber: 1.5 },
      { ...a, id: "DEMO-PLAN-A-1000", versionNumber: 1000 },
      { ...a, diagnosis: "DO NOT DISPLAY" } as DemoPlanDraft,
      { ...a, approvedBy: "DO NOT DISPLAY" } as DemoPlanDraft,
    ];
    for (const entry of invalid) {
      expect(demoPlanDraftSummary(patients[0], [entry])).toBeNull();
    }
    expect(demoPlanDraftSummary(patients[0], [a, { ...a }])).toBeNull();
  });

  test("multiple versions are projected in deterministic numeric order without modifying input", () => {
    const a = DEMO_PLAN_DRAFTS[0];
    const second = { ...a, id: "DEMO-PLAN-A-2", versionNumber: 2 };
    const third = { ...a, id: "DEMO-PLAN-A-3", versionNumber: 3 };
    const list = [third, a, second] as const;
    expect(demoPlanDraftSummary(patients[0], list)).toEqual({
      latestVersion: 3, draftVersions: 3, status: "BORRADOR · SIN APROBACIÓN",
    });
    expect(list.map(item => item.versionNumber)).toEqual([3, 1, 2]);
  });

  test("mobile episode selection cannot leak another draft, approve plans or edit instructions", () => {
    const { toJSON } = render(<EpisodeOverviewDemo
      patients={patients} professionals={professionals} visits={visits}
    />);
    expect(screen.getByTestId("episode-plan-draft")).toBeTruthy();
    expect(screen.getByText("Versión de muestra 1")).toBeTruthy();
    expect(screen.getByText("BORRADOR · SIN APROBACIÓN")).toBeTruthy();
    expect(screen.getByText("1 versión de borrador de muestra")).toBeTruthy();
    expect(screen.queryByRole("button", {
      name: /aprobar plan|firmar plan|activar plan|prescribir|indicar medicación/i,
    })).toBeNull();
    expect(screen.queryByRole("textbox", {
      name: /medicación|evolución|diagnóstico|indicación/i,
    })).toBeNull();

    fireEvent.press(screen.getByRole("button", {
      name: "Ver episodio de Paciente ficticio B",
    }));
    expect(screen.getByText("Versión de muestra 2")).toBeTruthy();
    expect(screen.getByText("2 versiones de borrador de muestra")).toBeTruthy();
    expect(screen.queryByText("Versión de muestra 1")).toBeNull();

    fireEvent.press(screen.getByRole("button", {
      name: "Ver episodio de Paciente ficticio C",
    }));
    expect(screen.getByTestId("episode-plan-empty")).toBeTruthy();
    expect(screen.queryByTestId("episode-plan-draft")).toBeNull();

    const sample = createPatientEntry("K9", patients)!;
    expect(demoPlanDraftSummary(sample)).toBeNull();
    expect(toJSON()).toBeTruthy();
  });
});
