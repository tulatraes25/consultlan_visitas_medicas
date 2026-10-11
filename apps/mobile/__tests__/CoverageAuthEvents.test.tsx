import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  bindCoverageAuthEvents, CoverageAuthBindingError,
  type SupabaseLikeAuthEvents,
} from "../src/coverageAuthEvents";
import { createCoverageSessionController } from "../src/coverageSessionController";
import { StagingOwnRosterPreview } from "../src/StagingOwnRosterPreview";

const PROJECT="a".repeat(20),FORBIDDEN="b".repeat(20);
const JWT="signed.synthetic.header";
const row=()=>({
  id:"11111111-1111-4111-8111-111111111111",
  episode_id:"22222222-2222-4222-8222-222222222222",
  service_kind:"VISIT",coverage_state:"ASSIGNED",
  scheduled_start:"2026-10-15T09:00:00Z",
  scheduled_end:"2026-10-15T10:00:00Z",
});
function config(fetcher:()=>Promise<{
  status:number,json:()=>Promise<unknown>,
}>=async()=>({status:200,json:async()=>({ok:true,result:[row()]})})){
  return {
    projectRef:PROJECT,forbiddenProjectRefs:[FORBIDDEN],
    stagingReadAuthorized:true as const,
    publishableKey:"sb_publishable_"+"x".repeat(32),
    getAccessToken:async()=>JWT,
    fetcher,
  };
}
function fakeProvider(){
  const listeners=new Set<(event:string,session:unknown)=>void>();
  let unsubscribes=0;
  const auth:SupabaseLikeAuthEvents={
    onAuthStateChange(listener){
      listeners.add(listener);
      return {data:{subscription:{
        unsubscribe(){unsubscribes++;listeners.delete(listener);},
      }}};
    },
  };
  return {auth,emit(event:string){
    for(const listener of listeners)listener(event,{access_token:"PRIVATE_DO_NOT_PRINT"});
  },get listenerCount(){return listeners.size;},
  get unsubscribeCount(){return unsubscribes;}};
}
const deferred=()=>{
  let resolve!: (payload:{status:number,json:()=>Promise<unknown>})=>void;
  const promise=new Promise<{status:number,json:()=>Promise<unknown>}>(
    done=>{resolve=done;},
  );
  return {promise,resolve};
};

describe("MOB-AUTH-01 Auth provider integration clears staged roster",()=>{
  test("any Auth event clears previously read rows and no token enters state",async()=>{
    const events=fakeProvider();
    const ctrl=createCoverageSessionController(config());
    const unbind=bindCoverageAuthEvents(ctrl,events.auth);
    expect(events.listenerCount).toBe(1);
    const states=["INITIAL_SESSION","SIGNED_IN","TOKEN_REFRESHED",
      "USER_UPDATED","SIGNED_OUT","UNKNOWN_FUTURE_EVENT"];
    for(const event of states){
      expect(await ctrl.refresh()).toBe(true);
      expect(ctrl.getSnapshot().state).toBe("ready");
      events.emit(event);
      expect(ctrl.getSnapshot()).toMatchObject({state:"idle",rows:[]});
      expect(JSON.stringify(ctrl.getSnapshot())).not.toMatch(/PRIVATE_DO_NOT_PRINT|Bearer/);
    }
    unbind();unbind();
    expect(events.unsubscribeCount).toBe(1);
    expect(events.listenerCount).toBe(0);
    expect(await ctrl.refresh()).toBe(true);
    events.emit("SIGNED_OUT");
    expect(ctrl.getSnapshot().state).toBe("ready"); // unbound listener cannot mutate.
    ctrl.dispose();
  });

  test("signout event cancels pending Edge work and ignores late response",async()=>{
    const gate=deferred(),events=fakeProvider();
    const ctrl=createCoverageSessionController(config(async()=>gate.promise));
    const unbind=bindCoverageAuthEvents(ctrl,events.auth);
    const pending=ctrl.refresh();
    await Promise.resolve();await Promise.resolve();
    expect(ctrl.getSnapshot().state).toBe("loading");
    events.emit("SIGNED_OUT");
    expect(ctrl.getSnapshot().state).toBe("idle");
    gate.resolve({status:200,json:async()=>({ok:true,result:[row()]})});
    expect(await pending).toBe(false);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    unbind();
  });

  test("invalid provider or bad subscription fails closed and clears roster",async()=>{
    const ctrl=createCoverageSessionController(config());
    expect(await ctrl.refresh()).toBe(true);
    expect(()=>bindCoverageAuthEvents(ctrl,undefined as never))
      .toThrow(CoverageAuthBindingError);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(await ctrl.refresh()).toBe(true);
    const broken={onAuthStateChange:()=>({data:{subscription:{}}})};
    expect(()=>bindCoverageAuthEvents(ctrl,broken as never))
      .toThrow("ROSTER_AUTH_EVENTS_UNAVAILABLE");
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(()=>bindCoverageAuthEvents(ctrl,{
      onAuthStateChange(){throw Error("PRIVATE TOKEN");},
    } as never)).toThrow("ROSTER_AUTH_EVENTS_UNAVAILABLE");
  });

  test("staging screen is wired to Auth changes and unsubscribes on unmount",async()=>{
    const events=fakeProvider(),ctrl=createCoverageSessionController(config());
    const view=render(<StagingOwnRosterPreview controller={ctrl} authEvents={events.auth}/>);
    expect(events.listenerCount).toBe(1);
    expect(screen.getByTestId("staging-roster-idle")).toBeTruthy();
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar mis coberturas de prueba"}));
    });
    expect(screen.getByTestId("staging-roster-list")).toBeTruthy();
    act(()=>events.emit("TOKEN_REFRESHED"));
    expect(screen.getByTestId("staging-roster-idle")).toBeTruthy();
    expect(screen.queryByTestId("staging-roster-list")).toBeNull();
    view.unmount();
    expect(events.unsubscribeCount).toBe(1);
    expect(events.listenerCount).toBe(0);
    expect(ctrl.getSnapshot().rows).toEqual([]);
  });
});
