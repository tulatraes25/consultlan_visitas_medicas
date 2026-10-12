import React from "react";
import {Dimensions} from "react-native";
import {act,fireEvent,render,screen,waitFor} from "@testing-library/react-native";
import {
  createAuthorizedFormPreviewClient,isAuthorizedCoverageId,
  parseAuthorizedFormPreview,
} from "../src/authorizedFormPreviewClient";
import {createAssignedFormSessionController} from "../src/assignedFormSessionController";
import {StagingAssignedFormPreview} from "../src/StagingAssignedFormPreview";
import {bindCoverageAuthEvents,type SupabaseLikeAuthEvents} from "../src/coverageAuthEvents";
import type {ReadOnlyCoverageConfig} from "../src/readonlyCoverageClient";

const PROJECT="a".repeat(20),FORBIDDEN="b".repeat(20);
const A="synthetic.jwtA.signatureA",B="synthetic.jwtB.signatureB";
const COV_A="d1000000-0000-4000-8000-000000000001";
const COV_B="d1000000-0000-4000-8000-000000000002";
const FORMS=[
  "MEDICAL_ATTENDANCE","NURSING_CAREGIVER_ATTENDANCE",
  "PHYSIOTHERAPY_ATTENDANCE","SPEECH_ATTENDANCE",
  "OCCUPATIONAL_THERAPY_ATTENDANCE","NUTRITION_ATTENDANCE",
] as const;
const payload=(templateId:string=FORMS[1])=>({
  ok:true,result:{templateId,mode:"READ_ONLY_STRUCTURE_PREVIEW"},
});
const good=(templateId:string=FORMS[1])=>({
  status:200,json:async()=>payload(templateId),
});
function config(
  fetcher:ReadOnlyCoverageConfig["fetcher"]=async()=>good(),
  getAccessToken:ReadOnlyCoverageConfig["getAccessToken"]=async()=>A,
):ReadOnlyCoverageConfig{
  return {
    projectRef:PROJECT,forbiddenProjectRefs:[FORBIDDEN],
    publishableKey:"sb_publishable_"+"x".repeat(32),
    stagingReadAuthorized:true,getAccessToken,fetcher,
  };
}
function deferred<T>(){
  let resolve!:(value:T)=>void;
  const promise=new Promise<T>(r=>{resolve=r;});
  return {promise,resolve};
}
function provider() {
  const events=new Set<(event:string,session:unknown)=>void>();
  let unsubs=0;
  const auth:SupabaseLikeAuthEvents={
    onAuthStateChange(listener){
      events.add(listener);
      return {data:{subscription:{unsubscribe(){
        unsubs++;events.delete(listener);
      }}}};
    },
  };
  return {auth,emit(name:string){
    for(const cb of events)cb(name,{access_token:"SECRET_NEVER_DISPLAY"});
  },get count(){return events.size;},get unsubs(){return unsubs;}};
}
beforeEach(()=>{
  const metrics={width:390,height:844,scale:2,fontScale:1};
  Dimensions.set({window:metrics,screen:metrics});
});

describe("HC-UX-04B2 staging-only authorized form reader",()=>{
  test("initialization is offline, first read posts only coverageId and returns a sealed template",async()=>{
    let tokens=0,network=0;
    const calls:Array<{url:string;options:RequestInit}>=[];
    const cfg=config(async(url,options)=>{
      network++;calls.push({url,options});return good(FORMS[2]);
    },async()=>{tokens++;return A;});
    const reader=createAuthorizedFormPreviewClient(cfg);
    createAssignedFormSessionController(cfg);
    expect(network).toBe(0);expect(tokens).toBe(0);
    expect(await reader.read(COV_A)).toEqual({
      templateId:FORMS[2],mode:"READ_ONLY_STRUCTURE_PREVIEW",
    });
    expect(network).toBe(1);expect(tokens).toBe(1);
    expect(calls[0].url).toBe("https://"+PROJECT+".supabase.co/functions/v1/visits");
    expect(calls[0].options).toMatchObject({
      method:"POST",redirect:"error",cache:"no-store",
      headers:{authorization:"Bearer "+A,apikey:cfg.publishableKey},
    });
    expect(JSON.parse(String(calls[0].options.body))).toEqual({
      action:"resolveMyHomecareAttendanceTemplate",coverageId:COV_A,
    });
    expect(String(calls[0].options.body)).not.toMatch(
      /actor|organization|patient|role|specialty|templateId|diagnosis/i,
    );
  });

  test("the six approved attendance sheets pass; paper, evolution and private metadata fail",()=>{
    for(const id of FORMS){
      const item=parseAuthorizedFormPreview(payload(id));
      expect(item.templateId).toBe(id);
      expect(Object.isFrozen(item)).toBe(true);
    }
    for(const bad of [
      payload("KARDEX"),payload("CLINICAL_EVOLUTION"),
      payload("NO_SUCH_SOURCE"),[payload()],null,
      {...payload(),patientName:"SECRET"},
      {ok:true,result:{...payload().result,patientId:COV_A}},
      {ok:true,result:{...payload().result,clinicalNote:"PRIVATE"}},
      {ok:true,result:{...payload().result,canSign:true}},
      {ok:true,result:{templateId:FORMS[0],mode:"CLINICALLY_APPROVED"}},
      {ok:false,result:payload().result},
      {ok:true,result:{templateId:FORMS[0]}},
    ]){
      expect(()=>parseAuthorizedFormPreview(bad)).toThrow(
        "FORM_PREVIEW_UNEXPECTED_SHAPE",
      );
    }
  });

  test("invalid/forged UUID and disallowed project/key fail before token or HTTP",async()=>{
    let tokens=0,network=0;
    const cfg=config(async()=>{network++;return good();},
      async()=>{tokens++;return A;});
    const reader=createAuthorizedFormPreviewClient(cfg);
    for(const bad of ["", "Medicina", "KARDEX","__proto__",
      " "+COV_A,null,undefined,{},17]) {
      expect(isAuthorizedCoverageId(bad)).toBe(false);
      await expect(reader.read(bad as string)).rejects.toMatchObject({
        code:"FORM_PREVIEW_COVERAGE_INVALID",
      });
    }
    for(const invalid of [
      {...cfg,projectRef:FORBIDDEN},
      {...cfg,projectRef:"https://"+PROJECT+".supabase.co"},
      {...cfg,forbiddenProjectRefs:[]},
      {...cfg,publishableKey:"sb_secret_BAD"},
      {...cfg,stagingReadAuthorized:false as never},
    ]){
      expect(()=>createAuthorizedFormPreviewClient(invalid))
        .toThrow("FORM_PREVIEW_STAGING_CONFIG_REJECTED");
    }
    expect(tokens).toBe(0);expect(network).toBe(0);
  });

  test("no user JWT, failed authorization, upstream schema and network errors are safe",async()=>{
    await expect(createAuthorizedFormPreviewClient(config(
      async()=>good(),async()=>null,
    )).read(COV_A)).rejects.toMatchObject({
      code:"FORM_PREVIEW_USER_SESSION_REQUIRED",
    });
    for(const [status,code] of [
      [401,"FORM_PREVIEW_ACCESS_DENIED"],[403,"FORM_PREVIEW_ACCESS_DENIED"],
      [422,"FORM_PREVIEW_OPERATION_REJECTED"],[503,"FORM_PREVIEW_SERVICE_UNAVAILABLE"],
    ] as const){
      await expect(createAuthorizedFormPreviewClient(config(async()=>({
        status,json:async()=>({patient:"PRIVATE"}),
      }))).read(COV_A)).rejects.toMatchObject({code});
    }
    await expect(createAuthorizedFormPreviewClient(config(async()=>({
      status:200,json:async()=>({ok:true,result:{
        ...payload().result,patientId:COV_A,
      }}),
    }))).read(COV_A)).rejects.toMatchObject({
      code:"FORM_PREVIEW_UNEXPECTED_SHAPE",
    });
    await expect(createAuthorizedFormPreviewClient(config(async()=>{
      throw Error("PRIVATE medical report");
    })).read(COV_A)).rejects.toMatchObject({
      code:"FORM_PREVIEW_TRANSPORT_FAILED",
    });
  });

  test("already aborted requests never acquire token or use transport",async()=>{
    let tokens=0,network=0;
    const reader=createAuthorizedFormPreviewClient(config(async()=>{
      network++;return good();
    },async()=>{tokens++;return A;}));
    const abort=new AbortController();abort.abort();
    await expect(reader.read(COV_A,abort.signal)).rejects.toMatchObject({
      code:"FORM_PREVIEW_CANCELLED",
    });
    expect(tokens).toBe(0);expect(network).toBe(0);
  });
});

describe("HC-UX-04B2 session-bound form controller",()=>{
  test("explicit action publishes no clinical data and clear() erases it",async()=>{
    let tokens=0;
    const controller=createAssignedFormSessionController(config(
      async()=>good("SPEECH_ATTENDANCE"),
      async()=>{tokens++;return A;},
    ));
    const states:string[]=[];
    controller.subscribe(snapshot=>states.push(snapshot.state));
    expect(await controller.resolve(COV_A)).toBe(true);
    expect(tokens).toBe(2);
    expect(controller.getSnapshot()).toEqual({
      state:"ready",templateId:"SPEECH_ATTENDANCE",errorCode:null,
    });
    expect(Object.isFrozen(controller.getSnapshot())).toBe(true);
    controller.clear();
    expect(controller.getSnapshot()).toEqual({
      state:"idle",templateId:null,errorCode:null,
    });
    expect(states).toEqual(["idle","loading","ready","idle"]);
    controller.dispose();
    expect(await controller.resolve(COV_A)).toBe(false);
  });

  test("JWT rotates while HTTP pending: never publishes old user's sheet",async()=>{
    let token=A;
    const pending=deferred<ReturnType<typeof good>>();
    const controller=createAssignedFormSessionController(config(
      async()=>pending.promise,async()=>token,
    ));
    const running=controller.resolve(COV_A);
    await Promise.resolve();await Promise.resolve();
    token=B;pending.resolve(good());
    expect(await running).toBe(false);
    expect(controller.getSnapshot()).toEqual({
      state:"error",templateId:null,errorCode:"FORM_PREVIEW_SESSION_CHANGED",
    });
  });

  test("Auth signout clears loading immediately; late reply and prior selection ignored",async()=>{
    const pending=deferred<ReturnType<typeof good>>();
    const ctrl=createAssignedFormSessionController(config(async()=>pending.promise));
    const events=provider();
    const unlink=bindCoverageAuthEvents(ctrl,events.auth);
    const running=ctrl.resolve(COV_A);
    await Promise.resolve();await Promise.resolve();
    expect(ctrl.getSnapshot().state).toBe("loading");
    events.emit("SIGNED_OUT");
    expect(ctrl.getSnapshot().state).toBe("idle");
    pending.resolve(good());
    expect(await running).toBe(false);
    expect(ctrl.getSnapshot().templateId).toBeNull();
    unlink();
  });

  test("overlapping selections cannot restore first form from a delayed response",async()=>{
    const first=deferred<ReturnType<typeof good>>();
    const second=deferred<ReturnType<typeof good>>();
    let calls=0;
    const ctrl=createAssignedFormSessionController(config(async()=>{
      calls++;return calls===1?first.promise:second.promise;
    }));
    const before=ctrl.resolve(COV_A);
    await Promise.resolve();await Promise.resolve();
    const newer=ctrl.resolve(COV_B);
    await Promise.resolve();await Promise.resolve();
    second.resolve(good("NUTRITION_ATTENDANCE"));
    expect(await newer).toBe(true);
    first.resolve(good("MEDICAL_ATTENDANCE"));
    expect(await before).toBe(false);
    expect(ctrl.getSnapshot().templateId).toBe("NUTRITION_ATTENDANCE");
  });

  test("bad second result erases previous form; any Auth event, dispose erases",async()=>{
    let attempt=0;
    const ctrl=createAssignedFormSessionController(config(async()=>{
      attempt++;
      return attempt===1?good():{status:200,json:async()=>({
        ok:true,result:{...payload().result,diagnosis:"PRIVATE"},
      })};
    }));
    expect(await ctrl.resolve(COV_A)).toBe(true);
    expect(await ctrl.resolve(COV_A)).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({
      state:"error",templateId:null,errorCode:"FORM_PREVIEW_UNEXPECTED_SHAPE",
    });
    expect(JSON.stringify(ctrl.getSnapshot())).not.toContain("PRIVATE");
    const auth=provider(),unlink=bindCoverageAuthEvents(ctrl,auth.auth);
    auth.emit("TOKEN_REFRESHED");
    expect(ctrl.getSnapshot().state).toBe("idle");
    unlink();ctrl.dispose();expect(await ctrl.resolve(COV_A)).toBe(false);
  });
});

describe("HC-UX-04B2 dormant phone/tablet preview",()=>{
  test("manual button shows one server-chosen sheet and no IDs or editable controls",async()=>{
    let network=0;
    const ctrl=createAssignedFormSessionController(config(async()=>{
      network++;return good();
    }));
    const auth=provider();
    const view=render(<StagingAssignedFormPreview controller={ctrl}
      authEvents={auth.auth} coverageId={COV_A}/>);
    expect(screen.getByTestId("assigned-form-idle")).toBeTruthy();
    expect(screen.getByText(/NO HABILITADO PARA PACIENTES REALES/)).toBeTruthy();
    expect(network).toBe(0);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{
      name:"Consultar mi planilla de prueba",
    }));});
    await waitFor(()=>expect(screen.getByTestId(
      "assigned-form-focused-preview")).toBeTruthy());
    expect(network).toBe(1);
    expect(screen.getByTestId("form-preview-NURSING_CAREGIVER_ATTENDANCE")).toBeTruthy();
    expect(screen.queryByTestId("form-catalog-list")).toBeNull();
    expect(screen.queryByTestId("form-preview-MEDICAL_ATTENDANCE")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    const ui=JSON.stringify(view.toJSON());
    expect(ui).not.toContain(COV_A);
    expect(ui).not.toContain(A);
    expect(ui).not.toContain("SECRET_NEVER_DISPLAY");
    fireEvent.press(screen.getByRole("button",{name:"Ocultar mi planilla de prueba"}));
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    view.unmount();expect(auth.count).toBe(0);
  });

  test("Auth event, coverage change and provider swap hide the previously chosen form",async()=>{
    const ctrl=createAssignedFormSessionController(config());
    const previous=provider(),later=provider();
    const view=render(<StagingAssignedFormPreview controller={ctrl}
      authEvents={previous.auth} coverageId={COV_A}/>);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{
      name:"Consultar mi planilla de prueba",
    }));});
    await waitFor(()=>expect(screen.getByTestId(
      "assigned-form-focused-preview")).toBeTruthy());
    act(()=>previous.emit("TOKEN_REFRESHED"));
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    await act(async()=>{fireEvent.press(screen.getByRole("button",{
      name:"Consultar mi planilla de prueba",
    }));});
    await waitFor(()=>expect(screen.getByTestId(
      "assigned-form-focused-preview")).toBeTruthy());
    view.rerender(<StagingAssignedFormPreview controller={ctrl}
      authEvents={later.auth} coverageId={COV_B}/>);
    expect(ctrl.getSnapshot().templateId).toBeNull();
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(previous.count).toBe(0);
    expect(later.count).toBe(1);
    view.unmount();expect(later.count).toBe(0);
  });

  test("invalid coverage or broken Auth provider never renders even a preloaded sheet",async()=>{
    let calls=0;
    const ctrl=createAssignedFormSessionController(config(async()=>{
      calls++;return good();
    }));
    expect(await ctrl.resolve(COV_A)).toBe(true);
    const auth=provider();
    const view=render(<StagingAssignedFormPreview controller={ctrl}
      authEvents={auth.auth} coverageId="invalid-coverage"/>);
    expect(screen.getByTestId("assigned-form-binding-blocked")).toBeTruthy();
    expect(screen.queryByTestId("assigned-form-focused-preview")).toBeNull();
    expect(ctrl.getSnapshot().state).toBe("idle");
    view.rerender(<StagingAssignedFormPreview controller={ctrl}
      authEvents={{onAuthStateChange:()=>({data:{subscription:{} as never}})}}
      coverageId={COV_A}/>);
    expect(screen.getByTestId("assigned-form-binding-blocked")).toBeTruthy();
    fireEvent.press(screen.getByRole("button",{name:"Consultar mi planilla de prueba"}));
    expect(calls).toBe(1);
    view.unmount();
  });

  test("wide tablet still shows one form and hides generic categories",async()=>{
    const wide={width:1280,height:900,scale:2,fontScale:1};
    Dimensions.set({window:wide,screen:wide});
    const ctrl=createAssignedFormSessionController(config(async()=>good("SPEECH_ATTENDANCE")));
    const auth=provider();
    const view=render(<StagingAssignedFormPreview controller={ctrl}
      authEvents={auth.auth} coverageId={COV_B}/>);
    await act(async()=>{fireEvent.press(screen.getByRole("button",{
      name:"Consultar mi planilla de prueba",
    }));});
    await waitFor(()=>expect(screen.getByTestId(
      "form-preview-SPEECH_ATTENDANCE")).toBeTruthy());
    expect(screen.queryByTestId("form-catalog-list")).toBeNull();
    expect(screen.queryByRole("radio",{name:"Categoría de planillas: Evolución"})).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    view.unmount();
  });
});
