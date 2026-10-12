import React from "react";
import {act,fireEvent,render,screen} from "@testing-library/react-native";
import {StagingProfessionalWorkflowPreview} from "../src/StagingProfessionalWorkflowPreview";
import type {ReadOnlyCoverageConfig} from "../src/readonlyCoverageClient";
import type {SupabaseLikeAuthEvents} from "../src/coverageAuthEvents";

const PROJECT="a".repeat(20),FORBIDDEN="b".repeat(20);
const WINDOW={
  startUtc:"2026-11-02T00:00:00Z",
  endUtc:"2026-11-05T00:00:00Z",
};
const COVERAGE="d1000000-0000-4000-8000-000000000001";
const row={
  id:COVERAGE,episode_id:"e1000000-0000-4000-8000-000000000001",
  service_kind:"VISIT",coverage_state:"ASSIGNED",
  scheduled_start:"2026-11-02T10:00:00+00:00",
  scheduled_end:"2026-11-02T11:00:00+00:00",
};
const ok=(result:unknown)=>({
  status:200,json:async()=>({ok:true,result}),
});
const pages=()=>({rows:[row],hasMore:false,nextCursor:null});
const form=()=>({
  templateId:"NURSING_CAREGIVER_ATTENDANCE",
  mode:"READ_ONLY_STRUCTURE_PREVIEW",
});
function setup(denyForm=false){
  const calls:string[]=[];
  let jwt="synthetic.header.signature";
  const config:ReadOnlyCoverageConfig={
    projectRef:PROJECT,forbiddenProjectRefs:[FORBIDDEN],
    publishableKey:"sb_publishable_"+"x".repeat(32),
    stagingReadAuthorized:true,
    getAccessToken:async()=>jwt,
    fetcher:async(_url,init)=>{
      const payload=JSON.parse(String(init.body)) as {
        action:string;coverageId?:string;
      };
      calls.push(payload.action);
      if(payload.action==="listMyHomecareCoveragesPage")return ok(pages());
      if(payload.action==="resolveMyHomecareAttendanceTemplate"){
        if(denyForm)return {status:403,json:async()=>({error:"UPSTREAM_SECRET_NEVER_DISPLAY"})};
        if(payload.coverageId!==COVERAGE)
          throw new Error("Unexpected coverage in synthetic form request");
        return ok(form());
      }
      throw new Error("No other API supported in this staging fixture");
    },
  };
  const listeners=new Set<(event:string,session:unknown)=>void>();
  const authEvents:SupabaseLikeAuthEvents={
    onAuthStateChange(listener){
      listeners.add(listener);
      return {data:{subscription:{unsubscribe(){listeners.delete(listener);}}}};
    },
  };
  return {
    config,authEvents,calls,
    emit(event:string){
      for(const listener of [...listeners]){
        listener(event,{access_token:"SECRET_NEVER_PRINT"});
      }
    },
    revoke(){jwt="synthetic.revoked.signature";},
    get listeners(){return listeners.size;},
  };
}
const props=(f:ReturnType<typeof setup>)=>({
  config:f.config,authEvents:f.authEvents,
  serviceTimeZone:"America/Argentina/Buenos_Aires",
  windowStart:WINDOW.startUtc,windowEnd:WINDOW.endUtc,
});

async function openAuthorizedForm(){
  await act(async()=>{
    fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));
  });
  expect(screen.getByTestId("paged-roster-row-0")).toBeTruthy();
  expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
  await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
  expect(screen.getByTestId("staging-workflow-selected")).toBeTruthy();
  // Hidden roster must be absent from ordinary accessibility-aware queries.
  expect(screen.queryByTestId("staging-workflow-roster")).toBeNull();
  expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
  await act(async()=>{
    fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));
  });
  expect(screen.getByTestId("assigned-form-focused-preview")).toBeTruthy();
  expect(screen.getByTestId("form-preview-NURSING_CAREGIVER_ATTENDANCE")).toBeTruthy();
}

describe("HC-UX-04C staging-only professional workflow",()=>{
  test("roster -> authorized coverage -> single read-only form needs explicit actions",async()=>{
    const f=setup();
    const view=render(<StagingProfessionalWorkflowPreview {...props(f)}/>);
    expect(f.calls).toEqual([]);
    expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
    await openAuthorizedForm();
    expect(f.calls).toEqual([
      "listMyHomecareCoveragesPage",
      "resolveMyHomecareAttendanceTemplate",
    ]);
    const rendered=JSON.stringify(view.toJSON());
    expect(rendered).not.toMatch(/d1000000|e1000000|synthetic.header.signature|SECRET_NEVER_PRINT/);
    expect(rendered).toMatch(/DEMOSTRACIÓN DE STAGING/);
    fireEvent.press(screen.getByRole("button",{name:"Volver a mis coberturas de prueba"}));
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
    expect(screen.getByTestId("staging-workflow-roster")).toBeTruthy();
    view.unmount();
    expect(f.listeners).toBe(0);
  });

  test("logout or token refresh hides form and roster without network fallback",async()=>{
    const f=setup();
    const view=render(<StagingProfessionalWorkflowPreview {...props(f)}/>);
    await openAuthorizedForm();
    const previousCalls=f.calls.length;
    await act(async()=>{f.emit("SIGNED_OUT");});
    expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    expect(screen.getByTestId("staging-workflow-no-selection")).toBeTruthy();
    expect(f.calls).toHaveLength(previousCalls);
    view.unmount();
  });

  test("changing window or Auth provider removes the chosen form before any new request",async()=>{
    const first=setup(),replacement=setup();
    const view=render(<StagingProfessionalWorkflowPreview {...props(first)}/>);
    await openAuthorizedForm();
    view.rerender(<StagingProfessionalWorkflowPreview {...props(first)}
      windowEnd="2026-11-04T00:00:00Z"/>);
    expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    view.rerender(<StagingProfessionalWorkflowPreview {...props(replacement)}/>);
    expect(screen.queryByTestId("staging-workflow-selected")).toBeNull();
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    expect(replacement.calls).toEqual([]);
    view.unmount();
    expect(first.listeners).toBe(0);
    expect(replacement.listeners).toBe(0);
  });

  test("server 403 never falls back to another form or leaks upstream payload",async()=>{
    const f=setup(true);
    const view=render(<StagingProfessionalWorkflowPreview {...props(f)}/>);
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));
    });
    await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));
    });
    expect(screen.getByTestId("assigned-form-error")).toBeTruthy();
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain("UPSTREAM_SECRET_NEVER_DISPLAY");
    view.unmount();
  });

  test("disallowed Supabase project fails before Auth and network",()=>{
    const f=setup(),config={...f.config,projectRef:FORBIDDEN};
    expect(()=>render(<StagingProfessionalWorkflowPreview
      {...props(f)} config={config}/>)).toThrow();
    expect(f.calls).toEqual([]);
    expect(f.listeners).toBe(0);
  });
});
