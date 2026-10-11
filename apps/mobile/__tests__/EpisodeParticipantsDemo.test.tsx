import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  demoEpisodeParticipants, syntheticProfessionalLabel, EpisodeOverviewDemo,
} from "../src/EpisodeOverviewDemo";
import {
  createDemoPatients, createDemoProfessionals, createPatientEntry,
} from "../src/adminDemoData";
import { createDemoVisits } from "../src/demoData";

const patients=createDemoPatients();
const professionals=createDemoProfessionals();
const visits=createDemoVisits(new Date(2026,9,11,12));

describe("MOB-HC-TEAM-01 participants derived only from selected synthetic case",()=>{
  test("deduplicates per professional and per coverage and never mixes patient or episode",()=>{
    const nurse=visits[0];
    const shift={...nurse,id:"DEMO-SHIFT-TEAM-A",
      reference:"GUA-DEMO-TEAM-A",serviceKind:"SHIFT" as const};
    const physio={...nurse,id:"DEMO-VISIT-TEAM-A",
      reference:"VIS-DEMO-TEAM-A",specialty:"Kinesiología" as const,
      professionalRef:"DEMO-PRO-3"};
    const wrongPatient={...shift,id:"DEMO-FORGED-PAT",
      patientRef:patients[1].id,episodeRef:patients[0].episodeRef,
      professionalRef:"DEMO-PRO-3",specialty:"Kinesiología" as const};
    const wrongEpisode={...shift,id:"DEMO-FORGED-EPI",
      patientRef:patients[0].id,episodeRef:patients[1].episodeRef};
    const wrongSpecialty={...shift,id:"DEMO-FORGED-SPECIALTY",
      professionalRef:"DEMO-PRO-2",specialty:"Medicina" as const};
    const unknownProfessional={...shift,id:"DEMO-FORGED-UNKNOWN",
      professionalRef:"DEMO-PRO-UNKNOWN"};
    const unknownKind={...shift,id:"DEMO-FORGED-KIND",
      serviceKind:"UNSUPPORTED" as never};
    const result=demoEpisodeParticipants(patients[0],professionals,[
      nurse,shift,physio,wrongPatient,wrongEpisode,wrongSpecialty,
      unknownProfessional,unknownKind,nurse,
    ]);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({
      professionalRef:"DEMO-PRO-2",label:"Profesional ficticio 2",
      specialty:"Enfermería",visits:1,shifts:1,
    });
    expect(result).toContainEqual({
      professionalRef:"DEMO-PRO-3",label:"Profesional ficticio 3",
      specialty:"Kinesiología",visits:1,shifts:0,
    });
    expect(demoEpisodeParticipants(patients[1],professionals,[nurse,shift,physio])).toEqual([]);
    expect(demoEpisodeParticipants(undefined,professionals,[nurse,shift])).toEqual([]);
  });

  test("never echoes an injected real-looking professional name from a registry object",()=>{
    expect(syntheticProfessionalLabel({
      ...professionals[0],label:"A REAL PERSON NAME",
    })).toBe("Profesional ficticio 1");
    expect(syntheticProfessionalLabel({
      ...professionals[0],id:"person-a",label:"A REAL PERSON NAME",
    })).toBe("Profesional ficticio no identificado");
    expect(syntheticProfessionalLabel(undefined)).toBe("Profesional ficticio no identificado");
  });

  test("phone/tablet view only shows professionals who have coverages in selected case",()=>{
    const shift={...visits[0],id:"DEMO-SHIFT-TEAM-1",
      reference:"GUA-TEAM-1",serviceKind:"SHIFT" as const};
    const altPatient={...visits[0],id:"DEMO-WRONG-PRO",
      reference:"GUA-WRONG",patientRef:patients[1].id,
      episodeRef:patients[0].episodeRef,
      professionalRef:"DEMO-PRO-3",specialty:"Kinesiología" as const};
    render(<EpisodeOverviewDemo patients={patients}
      professionals={professionals} visits={[visits[0],shift,visits[1],altPatient]}
    />);
    expect(screen.getByTestId("episode-demo-participants")).toBeTruthy();
    expect(screen.getByTestId("episode-participant-DEMO-PRO-2")).toBeTruthy();
    expect(screen.queryByTestId("episode-participant-DEMO-PRO-3")).toBeNull();
    expect(screen.getByText("1 visita · 1 guardia de muestra")).toBeTruthy();
    expect(screen.queryByText("GUA-WRONG")).toBeNull();
    expect(screen.queryByRole("button",{name:/Aprobar equipo|Validar matr/i})).toBeNull();

    fireEvent.press(screen.getByRole("button",{name:"Ver episodio de Paciente ficticio B"}));
    expect(screen.getByTestId("episode-participant-DEMO-PRO-3")).toBeTruthy();
    expect(screen.queryByTestId("episode-participant-DEMO-PRO-2")).toBeNull();
    expect(screen.getByText("Este listado no acredita equipo asistencial, matrícula ni asignación clínica.")).toBeTruthy();
  });

  test("a newly introduced sample episode has no care team and no coverages",()=>{
    const added=createPatientEntry("K9",patients)!;
    render(<EpisodeOverviewDemo patients={[...patients,added]}
      professionals={professionals} visits={visits} />);
    fireEvent.press(screen.getByRole("button",{name:"Ver episodio de Paciente ficticio K9"}));
    expect(screen.getByTestId("episode-demo-participants-empty")).toBeTruthy();
    expect(screen.getByTestId("episode-empty")).toBeTruthy();
    expect(screen.queryByTestId("episode-demo-participants")).toBeNull();
  });
});
