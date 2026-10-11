import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import { ProfessionalRosterPreviewDemo } from "../src/ProfessionalRosterPreviewDemo";
import {
  demoOwnProfessionalLabel, isDemoProfessional, projectDemoOwnRoster,
} from "../src/professionalRosterDemo";
import { createDemoProfessionals } from "../src/adminDemoData";
import { createDemoVisits } from "../src/demoData";

const professionals=createDemoProfessionals();
const visits=createDemoVisits(new Date(2026,9,11,12));

describe("MOB-HC-PRO-01 own roster is synthetic and scoped to a single professional",()=>{
  test("never projects another professional's visit or unsanitized free text",()=>{
    const nurse=professionals[1];
    const mine=projectDemoOwnRoster(nurse,visits);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toEqual({
      id:"DEMO-0001",code:"VIS-DEMO-0001",episodeRef:"DEMO-EPI-A",
      patientDisplay:"Paciente ficticio A",specialty:"Enfermería",
      modality:"VISIT",date:visits[0].date,startTime:"08:30",
      endTime:"09:15",status:"CLOSED_VERIFIED",
      civilStartMinute:expect.any(Number),
    });
    const poisoned={...visits[0],
      patientLabel:"REAL PERSON NAME",reference:"REAL PATIENT NUMBER",
      neighborhood:"REAL PATIENT ADDRESS",detail:"REAL PATIENT DIAGNOSIS"};
    const row=projectDemoOwnRoster(nurse,[poisoned]);
    expect(JSON.stringify(row)).not.toMatch(/REAL PERSON|REAL PATIENT|ADDRESS|DIAGNOSIS/);
    expect(row[0].patientDisplay).toBe("Paciente ficticio A");
    expect(demoOwnProfessionalLabel({...nurse,label:"PRIVATE NAME"}))
      .toBe("Profesional ficticio 2");
    expect(isDemoProfessional({...nurse,id:"human-doctor"})).toBe(false);
    expect(projectDemoOwnRoster({...nurse,id:"human-doctor"},visits)).toEqual([]);
    expect(projectDemoOwnRoster(undefined,visits)).toEqual([]);
  });

  test("malformed same-professional rows make the own roster fail closed",()=>{
    const nurse=professionals[1], source=visits[0];
    const invalid=[
      {...source,patientRef:"DEMO-PAT-B",episodeRef:"DEMO-EPI-A"},
      {...source,episodeRef:"DEMO-EPI-B"},
      {...source,professionalRef:nurse.id,specialty:"Medicina" as const},
      {...source,professionalRef:nurse.id,serviceKind:"OTHER" as never},
      {...source,professionalRef:nurse.id,status:"SIGNED" as never},
      {...source,professionalRef:nurse.id,startTime:"not-time"},
      {...source,professionalRef:nurse.id,id:"real-visit"},
    ];
    for(const row of invalid){
      expect(projectDemoOwnRoster(nurse,[row])).toEqual([]);
      expect(projectDemoOwnRoster(nurse,[source,row])).toEqual([]);
    }
    expect(projectDemoOwnRoster(nurse,[source,{...source}])).toEqual([]);
    expect(projectDemoOwnRoster(nurse,[])).toEqual([]);
  });

  test("sorts own synthetic visits and shifts by civil time, including overnight",()=>{
    const nurse=professionals[1],source=visits[0];
    const afternoon={...source,id:"DEMO-SHIFT-2",date:"2026-10-11",
      startTime:"20:00",endTime:"08:00",serviceKind:"SHIFT" as const};
    const morning={...source,id:"DEMO-VISIT-1",date:"2026-10-11",
      startTime:"10:00",endTime:"11:00"};
    const next={...source,id:"DEMO-VISIT-3",date:"2026-10-12",
      startTime:"08:00",endTime:"10:00"};
    const sorted=projectDemoOwnRoster(nurse,[next,afternoon,morning]);
    expect(sorted.map(row=>row.id)).toEqual([
      "DEMO-VISIT-1","DEMO-SHIFT-2","DEMO-VISIT-3",
    ]);
    expect(sorted[1].code).toBe("GUA-DEMO-SHIFT-2");
  });

  test("professional perspective selector does not claim real authentication",()=>{
    render(<ProfessionalRosterPreviewDemo
      professionals={professionals} visits={visits} />);
    expect(screen.getByText("SIN AUTENTICACIÓN · NO ES CONTROL DE ACCESO")).toBeTruthy();
    expect(screen.getByText("Mi agenda de muestra")).toBeTruthy();
    expect(screen.getByTestId("own-roster-DEMO-0003")).toBeTruthy();
    expect(screen.queryByTestId("own-roster-DEMO-0001")).toBeNull();
    fireEvent.press(screen.getByRole("button",{
      name:"Simular agenda de Profesional ficticio 2",
    }));
    expect(screen.getByTestId("own-roster-DEMO-0001")).toBeTruthy();
    expect(screen.queryByTestId("own-roster-DEMO-0003")).toBeNull();
    expect(screen.queryByTestId("own-roster-DEMO-0002")).toBeNull();
    expect(screen.queryByRole("button",{name:/Firmar|Aprobar|Activar caso|Iniciar visita real/i})).toBeNull();
    fireEvent.press(screen.getByRole("button",{
      name:"Simular agenda de Profesional ficticio 3",
    }));
    expect(screen.getByTestId("own-roster-DEMO-0002")).toBeTruthy();
    expect(screen.queryByTestId("own-roster-DEMO-0001")).toBeNull();
  });

  test("empty fictional registry and unavailable professional show no data",()=>{
    const noReal={...professionals[0],id:"REAL-ID",label:"PRIVATE NAME"};
    render(<ProfessionalRosterPreviewDemo professionals={[noReal]} visits={visits} />);
    expect(screen.getByTestId("own-roster-no-professionals")).toBeTruthy();
    expect(screen.queryByTestId("own-roster-list")).toBeNull();
    expect(screen.queryByText("PRIVATE NAME")).toBeNull();
  });

  test("management route exposes simulation on phone without enabling clinical actions",()=>{
    render(<App />);
    fireEvent.press(screen.getByRole("tab",{name:"Gestión"}));
    fireEvent.press(screen.getByRole("tab",{name:"Módulo Vista profesional"}));
    expect(screen.getByTestId("professional-own-roster-demo")).toBeTruthy();
    expect(screen.getByText("SIN AUTENTICACIÓN · NO ES CONTROL DE ACCESO")).toBeTruthy();
    expect(screen.queryByRole("button",{name:/Firmar|Autorizar|Aceptar relevo clínico/i})).toBeNull();
  });
});
