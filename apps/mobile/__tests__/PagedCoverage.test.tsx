import React from "react";
import {act,fireEvent,render,screen} from "@testing-library/react-native";
import {
  isCoverageWindow,createPagedCoverageClient,
  type CoverageWindow,
} from "../src/pagedCoverageClient";
import {createPagedCoverageController} from "../src/pagedCoverageController";
import {bindCoverageAuthEvents} from "../src/coverageAuthEvents";
import {StagingPagedRosterPreview} from "../src/StagingPagedRosterPreview";
import type {ReadOnlyCoverageConfig} from "../src/readonlyCoverageClient";

const WINDOW:CoverageWindow={
  startUtc:"2026-11-02T00:00:00Z",
  endUtc:"2026-11-05T00:00:00Z",
};
const PROJECT="a".repeat(20),FORBIDDEN="b".repeat(20);
const JWT="synthetic.header.signature";
function row(i:number){
  const start=new Date(Date.UTC(2026,10,2)+i*15*60*1000);
  const end=new Date(start.getTime()+5*60*1000);
  const offset=(date:Date)=>date.toISOString().replace(".000Z","+00:00");
  return {
    id:"c"+String(i).padStart(7,"0")+"-0000-4000-8000-"+
      String(i).padStart(12,"0"),
    episode_id:"e1000000-0000-4000-8000-000000000001",
    service_kind:"VISIT",coverage_state:"ASSIGNED",
    scheduled_start:offset(start),scheduled_end:offset(end),
  };
}
const firstRows=Array.from({length:100},(_,i)=>row(i));
const finalRows=Array.from({length:5},(_,i)=>row(i+100));
const cursor=(rows:ReturnType<typeof row>[])=>({
  scheduled_start:rows[rows.length-1].scheduled_start,
  id:rows[rows.length-1].id,
});
const firstPage=()=>({rows:firstRows,hasMore:true,nextCursor:cursor(firstRows)});
const finalPage=()=>({rows:finalRows,hasMore:false,nextCursor:null});
const success=(data:unknown)=>({
  status:200,json:async()=>({ok:true,result:data}),
});
function config(
  fetcher:ReadOnlyCoverageConfig["fetcher"]=async()=>success(firstPage()),
  getAccessToken:ReadOnlyCoverageConfig["getAccessToken"]=async()=>JWT,
):ReadOnlyCoverageConfig{
  return {
    projectRef:PROJECT,forbiddenProjectRefs:[FORBIDDEN],
    publishableKey:"sb_publishable_"+"x".repeat(32),
    stagingReadAuthorized:true,getAccessToken,fetcher,
  };
}
function authProvider(){
  const listeners=new Set<(event:string,session:unknown)=>void>();
  let unsubscribed=0;
  const auth={
    onAuthStateChange(listener:(event:string,session:unknown)=>void){
      listeners.add(listener);
      return {data:{subscription:{unsubscribe(){
        unsubscribed++;listeners.delete(listener);
      }}}};
    },
  };
  return {auth,emit(event:string){
    for(const fn of listeners)fn(event,{access_token:"DO_NOT_PRINT_TOKEN"});
  },get count(){return listeners.size;},
  get unsubscribed(){return unsubscribed;}};
}
function deferred<T>(){
  let resolve!:(v:T)=>void;
  const promise=new Promise<T>(res=>{resolve=res;});
  return {promise,resolve};
}

describe("HC-READ-02B strict paginated mobile contract",()=>{
  test("rejects invalid calendar/window before making a network call",async()=>{
    for(const window of [
      {startUtc:"2026-02-30T00:00:00Z",endUtc:WINDOW.endUtc},
      {startUtc:"2026-11-02T00:00:00-03:00",endUtc:WINDOW.endUtc},
      {startUtc:WINDOW.endUtc,endUtc:WINDOW.startUtc},
      {startUtc:WINDOW.startUtc,endUtc:"2027-01-15T00:00:00Z"},
      {startUtc:WINDOW.startUtc,endUtc:"2026-11-02T00:00:00Z"},
      {startUtc:"2026-11-02T24:00:00Z",endUtc:WINDOW.endUtc},
      {startUtc:WINDOW.startUtc,endUtc:WINDOW.endUtc,actorId:"forbidden"},
    ]){
      expect(isCoverageWindow(window)).toBe(false);
    }
    expect(isCoverageWindow(WINDOW)).toBe(true);
    let calls=0;
    const client=createPagedCoverageClient(config(async()=>{
      calls++;return success(firstPage());
    }));
    await expect(client.read({
      startUtc:WINDOW.endUtc,endUtc:WINDOW.startUtc,
    })).rejects.toMatchObject({code:"ROSTER_PAGE_WINDOW_INVALID"});
    expect(calls).toBe(0);
  });

  test("first and next page return 100+5 with fixed Edge actions, JWT and cursor",async()=>{
    const calls:Array<{url:string,init:RequestInit,body:Record<string,unknown>}>=[];
    const client=createPagedCoverageClient(config(async(url,init)=>{
      const body=JSON.parse(String(init.body)) as Record<string,unknown>;
      calls.push({url,init,body});
      return success(body.action==="listMyHomecareCoveragesPage" ?
        firstPage():finalPage());
    }));
    const first=await client.read(WINDOW);
    expect(first.rows).toHaveLength(100);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toEqual({
      scheduledStart:firstRows[99].scheduled_start,id:firstRows[99].id,
    });
    const next=await client.read(WINDOW,first.nextCursor);
    expect(next.rows).toHaveLength(5);
    expect(next.hasMore).toBe(false);
    expect(next.nextCursor).toBeNull();
    expect(calls).toHaveLength(2);
    for(const {url,init,body} of calls){
      expect(url).toBe(`https://${PROJECT}.supabase.co/functions/v1/visits`);
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("error");
      expect(init.cache).toBe("no-store");
      expect(init.headers).toMatchObject({
        authorization:"Bearer "+JWT,apikey:config().publishableKey,
      });
      expect(JSON.stringify(body)).not.toMatch(/actor|organization|patient|clinical|service_role/i);
    }
    expect(calls[0].body).toEqual({
      action:"listMyHomecareCoveragesPage",windowStart:WINDOW.startUtc,
      windowEnd:WINDOW.endUtc,
    });
    expect(calls[1].body).toEqual({
      action:"listMyHomecareCoveragesNextPage",
      windowStart:WINDOW.startUtc,windowEnd:WINDOW.endUtc,
      cursorStart:firstRows[99].scheduled_start,cursorId:firstRows[99].id,
    });
  });

  test("fails closed on altered schema, unordered times, window leaks and bad cursors",async()=>{
    const make=async(payload:unknown)=>createPagedCoverageClient(config(async()=>
      success(payload))).read(WINDOW);
    const reversed=[row(1),row(0)];
    const invalid=[
      {rows:reversed,hasMore:false,nextCursor:null},
      {rows:[row(0),row(0)],hasMore:false,nextCursor:null},
      {rows:[{...row(0),diagnosis:"NEVER"}],hasMore:false,nextCursor:null},
      {rows:[{...row(0),scheduled_start:"2026-12-02T00:00:00Z"}],
        hasMore:false,nextCursor:null},
      {rows:[row(0)],hasMore:true,nextCursor:cursor([row(0)])},
      {rows:firstRows,hasMore:true,nextCursor:null},
      {rows:firstRows,hasMore:true,nextCursor:{
        ...cursor(firstRows),id:row(0).id,
      }},
      {rows:[],hasMore:false,nextCursor:{id:row(0).id,scheduled_start:row(0).scheduled_start}},
      {rows:[],hasMore:"false",nextCursor:null},
      {rows:[],hasMore:false,nextCursor:null,patient_id:"FORBIDDEN"},
    ];
    for(const payload of invalid){
      await expect(make(payload)).rejects.toMatchObject({
        name:"CoverageReadError",
      });
    }
  });

  test("a cursor at/after window end is rejected without network",async()=>{
    let network=0;
    const client=createPagedCoverageClient(config(async()=>{
      network++;return success(firstPage());
    }));
    await expect(client.read(WINDOW,{
      id:row(100).id,scheduledStart:WINDOW.endUtc,
    })).rejects.toMatchObject({code:"ROSTER_PAGE_CURSOR_INVALID"});
    expect(network).toBe(0);
  });
});

describe("HC-READ-02B paginated in-memory controller",()=>{
  test("explicit 100+5 page sequence, no eager fetch or missing page",async()=>{
    let calls=0,authCalls=0;
    const ctrl=createPagedCoverageController(config(async(url,init)=>{
      calls++;const body=JSON.parse(String(init.body));
      return success(body.action==="listMyHomecareCoveragesPage"?
        firstPage():finalPage());
    },async()=>{authCalls++;return JWT;}));
    expect(calls).toBe(0);
    expect(authCalls).toBe(0);
    expect(await ctrl.loadNext()).toBe(false);
    expect(await ctrl.loadWindow(WINDOW)).toBe(true);
    expect(ctrl.getSnapshot()).toMatchObject({state:"ready",hasMore:true});
    expect(ctrl.getSnapshot().rows).toHaveLength(100);
    expect(await ctrl.loadNext()).toBe(true);
    expect(ctrl.getSnapshot().rows).toHaveLength(105);
    expect(ctrl.getSnapshot()).toMatchObject({state:"ready",hasMore:false});
    expect(await ctrl.loadNext()).toBe(false);
    expect(calls).toBe(2);
    expect(authCalls).toBe(4);
    ctrl.dispose();
    expect(await ctrl.loadWindow(WINDOW)).toBe(false);
  });

  test("duplicated/replayed next page atomically clears the first 100",async()=>{
    const ctrl=createPagedCoverageController(config(async(url,init)=>{
      const body=JSON.parse(String(init.body));
      return success(body.action==="listMyHomecareCoveragesPage"
        ?firstPage():{rows:[row(99)],hasMore:false,nextCursor:null});
    }));
    expect(await ctrl.loadWindow(WINDOW)).toBe(true);
    expect(await ctrl.loadNext()).toBe(false);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(ctrl.getSnapshot().errorCode).toMatch(/ROSTER_PAGE_REPLAY/);
  });

  test("auth replacement/revocation cancels inflight response and clears memory",async()=>{
    const delay=deferred<ReturnType<typeof success>>();
    let count=0;
    const ctrl=createPagedCoverageController(config(async()=>{
      count++;return delay.promise;
    }));
    const events=authProvider();
    const off=bindCoverageAuthEvents(ctrl,events.auth);
    const pending=ctrl.loadWindow(WINDOW);
    await Promise.resolve();await Promise.resolve();await Promise.resolve();
    events.emit("SIGNED_OUT");
    expect(ctrl.getSnapshot()).toMatchObject({state:"idle",rows:[]});
    delay.resolve(success(firstPage()));
    expect(await pending).toBe(false);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    off();
    expect(events.unsubscribed).toBe(1);
    expect(count).toBeLessThanOrEqual(1);
  });

  test("token change after first 100-page network call cannot publish rows",async()=>{
    let token=JWT;
    const ctrl=createPagedCoverageController(config(async()=>
      success(firstPage()),async()=>token));
    const request=ctrl.loadWindow(WINDOW);
    token="rotated.header.signature";
    expect(await request).toBe(false);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(ctrl.getSnapshot().state).not.toBe("ready");
  });
});

describe("HC-READ-02B staging-only rendered manual paging",()=>{
  test("renders only bounded sample metadata, loads more on click and clears on zone switch",async()=>{
    const provider=authProvider();
    let fetches=0;
    const ctrl=createPagedCoverageController(config(async(url,init)=>{
      fetches++;
      const body=JSON.parse(String(init.body));
      return success(body.action==="listMyHomecareCoveragesPage"?
        firstPage():finalPage());
    }));
    const view=render(<StagingPagedRosterPreview controller={ctrl}
      authEvents={provider.auth} serviceTimeZone="America/Argentina/Buenos_Aires"
      windowStart={WINDOW.startUtc} windowEnd={WINDOW.endUtc}/>);
    expect(fetches).toBe(0);
    expect(screen.getByTestId("paged-idle")).toBeTruthy();
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{name:"Consultar ventana de prueba"}));
    });
    expect(screen.getByTestId("paged-roster-list")).toBeTruthy();
    expect(screen.getByTestId("paged-incomplete")).toBeTruthy();
    expect(screen.getAllByTestId(/paged-roster-row-/)).toHaveLength(100);
    await act(async()=>{
      fireEvent.press(screen.getByRole("button",{
        name:"Cargar siguiente página de prueba",
      }));
    });
    expect(screen.getAllByTestId(/paged-roster-row-/)).toHaveLength(105);
    expect(screen.getByTestId("paged-last-page")).toBeTruthy();
    expect(fetches).toBe(2);
    const visible=JSON.stringify(view.toJSON());
    expect(visible).not.toMatch(/c0000000-0000-4000|e1000000|Bearer|DO_NOT_PRINT_TOKEN|patient_id/i);
    view.rerender(<StagingPagedRosterPreview controller={ctrl}
      authEvents={provider.auth} serviceTimeZone="Mars/Olympus"
      windowStart={WINDOW.startUtc} windowEnd={WINDOW.endUtc}/>);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    expect(screen.getByTestId("paged-auth-blocked")).toBeTruthy();
    view.unmount();
    expect(provider.count).toBe(0);
  });

  test("different window or broken Auth cannot reveal prefetched roster",async()=>{
    const valid=authProvider();
    const ctrl=createPagedCoverageController(config(async()=>success(firstPage())));
    expect(await ctrl.loadWindow(WINDOW)).toBe(true);
    const bad={onAuthStateChange:()=>({data:{subscription:{}}})};
    const view=render(<StagingPagedRosterPreview controller={ctrl}
      authEvents={bad as never} serviceTimeZone="America/Argentina/Buenos_Aires"
      windowStart={WINDOW.startUtc} windowEnd={WINDOW.endUtc}/>);
    expect(ctrl.getSnapshot().rows).toEqual([]);
    expect(screen.getByTestId("paged-auth-blocked")).toBeTruthy();
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    view.rerender(<StagingPagedRosterPreview controller={ctrl}
      authEvents={valid.auth} serviceTimeZone="America/Argentina/Buenos_Aires"
      windowStart={WINDOW.startUtc} windowEnd="2026-11-04T00:00:00Z"/>);
    expect(screen.queryByTestId("paged-roster-list")).toBeNull();
    expect(ctrl.getSnapshot().rows).toEqual([]);
    view.unmount();
  });
});
