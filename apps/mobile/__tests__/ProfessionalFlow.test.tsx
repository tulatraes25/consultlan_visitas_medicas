import React from "react";
import {act,fireEvent,render,screen} from "@testing-library/react-native";
import {StagingProfessionalFlowPreview} from "../src/StagingProfessionalFlowPreview";
import {createPagedCoverageController} from "../src/pagedCoverageController";
import {createAssignedFormSessionController} from "../src/assignedFormSessionController";
import type {ReadOnlyCoverageConfig} from "../src/readonlyCoverageClient";

const PROJECT="a".repeat(20),FORBIDDEN="b".repeat(20);
const ID="c0000000-0000-4000-8000-000000000000";
const WINDOW={startUtc:"2026-11-02T00:00:00Z",endUtc:"2026-11-05T00:00:00Z"};
const ZONE="America/Argentina/Buenos_Aires";
const row=()=>({
  id:ID,episode_id:"e1000000-0000-4000-8000-000000000001",
  service_kind:"VISIT",coverage_state:"ASSIGNED",
  scheduled_start:"2026-11-02T10:00:00+00:00",
  scheduled_end:"2026-11-02T11:00:00+00:00",
});
const envelope=(data:unknown)=>({status:200,json:async()=>({ok:true,result:data})});
const page=()=>envelope({rows:[row()],hasMore:false,nextCursor:null});
const form=()=>envelope({templateId:"NURSING_CAREGIVER_ATTENDANCE",mode:"READ_ONLY_STRUCTURE_PREVIEW"});

function provider(){
  const subscribers=new Set<(event:string,session:unknown)=>void>();
  const auth={onAuthStateChange(listener:(event:string,session:unknown)=>void){
    subscribers.add(listener);
    return {data:{subscription:{unsubscribe(){subscribers.delete(listener);}}}};
  }};
  return {auth,emit(event:string){
    for(const fn of [...subscribers])fn(event,{access_token:"SENSITIVE_FAKE_TOKEN"});
  },get subscribers(){return subscribers.size;}};
}
function config(fetcher:ReadOnlyCoverageConfig["fetcher"]):ReadOnlyCoverageConfig{
  return {
    projectRef:PROJECT,forbiddenProjectRefs:[FORBIDDEN],
    stagingReadAuthorized:true,
    publishableKey:"sb_publishable_"+"x".repeat(32),
    getAccessToken:async()=>"synthetic.header.signature",fetcher,
  };
}
function prepare(denyForm=false){
  const actions:string[]=[];
  const auth=provider();
  const cfg=config(async(_,init)=>{
    const request=JSON.parse(String(init.body)) as Record<string,unknown>;
    actions.push(String(request.action));
    if(request.action==="listMyHomecareCoveragesPage")return page();
    if(request.action==="resolveMyHomecareAttendanceTemplate"){
      if(denyForm)return {status:403,json:async()=>({error:"SECRET_NEVER_RENDER"})};
      if(request.coverageId!==ID)throw new Error("unexpected coverage UUID");
      return form();
    }
    throw new Error("unexpected action");
  });
  const rosterController=createPagedCoverageController(cfg);
  const formController=createAssignedFormSessionController(cfg);
  const element=<StagingProfessionalFlowPreview rosterController={rosterController}
    formController={formController} authEvents={auth.auth}
    serviceTimeZone={ZONE} windowStart={WINDOW.startUtc}
    windowEnd={WINDOW.endUtc}/>;
  return {rosterController,formController,auth,actions,element};
}

describe("HC-UX-04B5 own-roster to one authorized form staging composition",()=>{
  test("manual roster, select ONLY returned coverage, then server selects form",async()=>{
    const p=prepare();
    const view=render(p.element);
    expect(p.actions).toEqual([]); // render itself cannot call network
    expect(screen.queryByTestId("staging-professional-form-flow")).toBeNull();
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));
    });
    expect(screen.getByTestId("paged-open-form-0")).toBeTruthy();
    expect(p.actions).toEqual(["listMyHomecareCoveragesPage"]);
    await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
    expect(screen.getByTestId("staging-professional-form-flow")).toBeTruthy();
    expect(p.actions).toHaveLength(1); // choosing a row alone never fetches
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));
    });
    expect(p.actions).toEqual([
      "listMyHomecareCoveragesPage","resolveMyHomecareAttendanceTemplate",
    ]);
    expect(screen.getByTestId("assigned-form-focused-preview")).toBeTruthy();
    const visible=JSON.stringify(view.toJSON());
    expect(visible).not.toContain(ID);
    expect(visible).not.toContain("SENSITIVE_FAKE_TOKEN");
    expect(visible).not.toMatch(/e1000000|patient_id|service_role/i);
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Volver a mis coberturas de prueba"}));
    });
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(p.formController.getSnapshot().templateId).toBeNull();
    view.unmount();
    expect(p.auth.subscribers).toBe(0);
  });

  test("Auth signout instantly invalidates old selection and both controllers",async()=>{
    const p=prepare();
    const view=render(p.element);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));});
    await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));});
    expect(screen.getByTestId("assigned-form-focused-preview")).toBeTruthy();
    await act(async()=>{p.auth.emit("SIGNED_OUT");});
    expect(p.rosterController.getSnapshot().rows).toHaveLength(0);
    expect(p.formController.getSnapshot().templateId).toBeNull();
    expect(screen.queryByTestId("staging-professional-form-flow")).toBeNull();
    // A newly loaded roster never automatically reuses the former selection.
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));});
    expect(screen.queryByTestId("staging-professional-form-flow")).toBeNull();
    view.unmount();
  });

  test("changed window hides selected form before rerender effects run",async()=>{
    const p=prepare();
    const view=render(p.element);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));});
    await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));});
    expect(screen.getByTestId("assigned-form-focused-preview")).toBeTruthy();
    view.rerender(<StagingProfessionalFlowPreview
      rosterController={p.rosterController} formController={p.formController}
      authEvents={p.auth.auth} serviceTimeZone={ZONE}
      windowStart={WINDOW.startUtc} windowEnd="2026-11-04T00:00:00Z"/>);
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(p.formController.getSnapshot().templateId).toBeNull();
    view.unmount();
  });

  test("Edge denies form: no fallback even after valid roster",async()=>{
    const p=prepare(true);
    const view=render(p.element);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));});
    await act(async()=>{fireEvent.press(screen.getByTestId("paged-open-form-0"));});
    await act(async()=>{fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));});
    expect(screen.getByTestId("assigned-form-error")).toBeTruthy();
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain("SECRET_NEVER_RENDER");
    view.unmount();
  });
});
