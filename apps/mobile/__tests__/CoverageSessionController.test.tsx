import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createCoverageSessionController } from "../src/coverageSessionController";
import { StagingOwnRosterPreview } from "../src/StagingOwnRosterPreview";
import type { ReadOnlyCoverageConfig } from "../src/readonlyCoverageClient";

const ORIGIN="a".repeat(20),FORBIDDEN="b".repeat(20);
const JWT_A="headerA.syntheticA.signatureA";
const JWT_B="headerB.syntheticB.signatureB";
const firstRow=()=>({
  id:"11111111-1111-4111-8111-111111111111",
  episode_id:"22222222-2222-4222-8222-222222222222",
  service_kind:"SHIFT",coverage_state:"ASSIGNED",
  scheduled_start:"2026-10-15T20:00:00Z",
  scheduled_end:"2026-10-16T08:00:00Z",
});
const secondRow=()=>({
  ...firstRow(),id:"33333333-3333-4333-8333-333333333333",
  service_kind:"VISIT",scheduled_start:"2026-10-16T09:00:00Z",
  scheduled_end:"2026-10-16T10:00:00Z",
});
const success=(rows=[firstRow()])=>({status:200,
  json:async()=>({ok:true,result:rows})});
const deferred=<T,>()=>{
  let resolve!: (value:T)=>void;
  let reject!: (reason:unknown)=>void;
  const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});
  return {promise,resolve,reject};
};
function config(
  fetcher:ReadOnlyCoverageConfig["fetcher"]=async()=>success(),
  getAccessToken:ReadOnlyCoverageConfig["getAccessToken"]=async()=>JWT_A,
):ReadOnlyCoverageConfig{
  return {
    projectRef:ORIGIN,forbiddenProjectRefs:[FORBIDDEN],
    publishableKey:"sb_publishable_"+"x".repeat(32),
    getAccessToken,fetcher,stagingReadAuthorized:true,
  };
}

describe("MOB-DATA-02 session-bound staging read controller",()=>{
  test("initial construction and subscription use zero Auth/network, explicit refresh only",async()=>{
    let fetches=0,tokens=0;
    const ctrl=createCoverageSessionController(config(
      async()=>{fetches++;return success();},
      async()=>{tokens++;return JWT_A;},
    ));
    const snapshots:string[]=[];
    const off=ctrl.subscribe(s=>{snapshots.push(s.state);});
    expect(ctrl.getSnapshot().state).toBe("idle");
    expect(tokens).toBe(0);
    expect(fetches).toBe(0);
    expect(await ctrl.refresh()).toBe(true);
    expect(fetches).toBe(1);
    expect(tokens).toBe(2);
    expect(snapshots).toEqual(["idle","loading","ready"]);
    expect(ctrl.getSnapshot().rows).toHaveLength(1);
    expect(Object.isFrozen(ctrl.getSnapshot())).toBe(true);
    expect(Object.isFrozen(ctrl.getSnapshot().rows)).toBe(true);
    expect(Object.isFrozen(ctrl.getSnapshot().rows[0])).toBe(true);
    off();
    ctrl.clear();
    expect(snapshots).toEqual(["idle","loading","ready"]);
    expect(ctrl.getSnapshot().rows).toEqual([]);
  });

  test("session token rotated during fetch: never publishes prior actor's rows",async()=>{
    let authToken=JWT_A;
    const request=deferred<ReturnType<typeof success>>();
    let called=0;
    const ctrl=createCoverageSessionController(config(
      async()=>{called++;return request.promise;},
      async()=>authToken,
    ));
    const refresh=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    expect(called).toBe(1);
    authToken=JWT_B;
    request.resolve(success());
    expect(await refresh).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({
      state:"error",rows:[],possiblyTruncated:false,
      errorCode:"ROSTER_SESSION_CHANGED",
    });
    expect(JSON.stringify(ctrl.getSnapshot())).not.toMatch(/11111111|22222222|Bearer|signatureA/);
  });

  test("late HTTP result after clear(), signout or app background is never rendered",async()=>{
    const pending=deferred<ReturnType<typeof success>>();
    const ctrl=createCoverageSessionController(config(async()=>pending.promise));
    const request=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    expect(ctrl.getSnapshot().state).toBe("loading");
    ctrl.clear();
    expect(ctrl.getSnapshot()).toMatchObject({state:"idle",rows:[]});
    pending.resolve(success());
    expect(await request).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({state:"idle",rows:[]});
  });

  test("overlapping refresh requests cannot publish an older response",async()=>{
    const first=deferred<ReturnType<typeof success>>();
    const second=deferred<ReturnType<typeof success>>();
    let number=0;
    const ctrl=createCoverageSessionController(config(async()=>{
      number++;return number===1?first.promise:second.promise;
    }));
    const prior=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    const newest=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    second.resolve(success([secondRow()]));
    expect(await newest).toBe(true);
    expect(ctrl.getSnapshot().rows[0].id).toBe(secondRow().id);
    first.resolve(success([firstRow()]));
    expect(await prior).toBe(false);
    expect(ctrl.getSnapshot().rows[0].id).toBe(secondRow().id);
    expect(ctrl.getSnapshot().rows).toHaveLength(1);
  });

  test("error after a successful read wipes rows; exceptions never leak patient data",async()=>{
    let call=0;
    const ctrl=createCoverageSessionController(config(async()=>{
      call++;
      if(call===1)return success();
      throw new Error("private patient narrative, access token, address");
    }));
    expect(await ctrl.refresh()).toBe(true);
    expect(ctrl.getSnapshot().rows).toHaveLength(1);
    expect(await ctrl.refresh()).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({
      state:"error",rows:[],errorCode:"ROSTER_TRANSPORT_FAILED",
    });
    expect(JSON.stringify(ctrl.getSnapshot())).not.toMatch(/private patient|address|Bearer|signature/);
  });

  test("duplicate coverage response wipes a previously accepted roster",async()=>{
    let count=0;
    const ctrl=createCoverageSessionController(config(async()=>{
      count++;
      return success(count===1?[firstRow()]:[firstRow(),{...firstRow()}]);
    }));
    expect(await ctrl.refresh()).toBe(true);
    expect(ctrl.getSnapshot().rows).toHaveLength(1);
    expect(await ctrl.refresh()).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({
      state:"error",rows:[],errorCode:"ROSTER_DUPLICATE_COVERAGE_ID",
    });
  });

  test("no token or denied session fails without stale data",async()=>{
    let token:string|null=null,network=0;
    const ctrl=createCoverageSessionController(config(
      async()=>{network++;return success();},async()=>token,
    ));
    expect(await ctrl.refresh()).toBe(false);
    expect(network).toBe(0);
    expect(ctrl.getSnapshot()).toMatchObject({
      state:"error",rows:[],errorCode:"ROSTER_USER_SESSION_REQUIRED",
    });
    token=JWT_A;
    expect(await ctrl.refresh()).toBe(true);
    expect(network).toBe(1);
    ctrl.clear();
    expect(ctrl.getSnapshot().rows).toEqual([]);
  });

  test("disposing cancels inflight work, clears rows and rejects any future refresh",async()=>{
    let calls=0;
    const pending=deferred<ReturnType<typeof success>>();
    const ctrl=createCoverageSessionController(config(async()=>{calls++;return pending.promise;}));
    const request=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    ctrl.dispose();
    pending.resolve(success());
    expect(await request).toBe(false);
    expect(await ctrl.refresh()).toBe(false);
    expect(ctrl.getSnapshot()).toMatchObject({state:"idle",rows:[]});
    expect(calls).toBe(1);
  });

  test("invalid project or key fails before token source or network",()=>{
    let network=0,auth=0;
    expect(()=>createCoverageSessionController({
      ...config(async()=>{network++;return success();},async()=>{auth++;return JWT_A;}),
      projectRef:FORBIDDEN,
    })).toThrow("ROSTER_STAGING_CONFIG_REJECTED");
    expect(network).toBe(0);
    expect(auth).toBe(0);
  });
});

describe("MOB-DATA-02 standalone staging read-only preview screen",()=>{
  test("no automatic network; only minimal coverage metadata after manual action",async()=>{
    let calls=0;
    const ctrl=createCoverageSessionController(config(async()=>{
      calls++;return success([{...firstRow(),rawClinicalNote:"not expected"} as never]);
    }));
    const view=render(<StagingOwnRosterPreview controller={ctrl} authEvents={{
      onAuthStateChange: () => ({data:{subscription:{unsubscribe:()=>{}}}}),
    }}/>);
    expect(screen.getByTestId("staging-own-roster-screen")).toBeTruthy();
    expect(screen.getByText(/NO HABILITADO PARA PACIENTES REALES/)).toBeTruthy();
    expect(screen.getByTestId("staging-roster-idle")).toBeTruthy();
    expect(calls).toBe(0);
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{
        name:"Consultar mis coberturas de prueba",
      }));
    });
    expect(calls).toBe(1);
    expect(screen.getByTestId("staging-roster-error")).toBeTruthy();
    expect(screen.queryByTestId("staging-roster-list")).toBeNull();
    view.unmount();
    expect(ctrl.getSnapshot().rows).toEqual([]);
  });

  test("shows only type/state/time and removes all rows when unmounted",async()=>{
    const ctrl=createCoverageSessionController(config());
    const view=render(<StagingOwnRosterPreview controller={ctrl} authEvents={{
      onAuthStateChange: () => ({data:{subscription:{unsubscribe:()=>{}}}}),
    }}/>);
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{
        name:"Consultar mis coberturas de prueba",
      }));
    });
    expect(screen.getByTestId("staging-roster-list")).toBeTruthy();
    expect(screen.getByTestId("staging-roster-row-0")).toBeTruthy();
    expect(screen.getByText("Guardia de prueba 1")).toBeTruthy();
    const visible=JSON.stringify(view.toJSON());
    expect(visible).not.toMatch(/11111111|22222222|Bearer|auth\.users|medicacion|diagnostico/);
    expect(visible).toMatch(/2026-10-15T20:00:00Z/);
    view.unmount();
    expect(ctrl.getSnapshot().state).toBe("idle");
    expect(ctrl.getSnapshot().rows).toEqual([]);
  });
});
