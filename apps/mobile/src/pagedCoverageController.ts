/**
 * HC-READ-02B — memory-only paginated roster controller.
 * No automatically started network, no JWT persistence, no clinical writes.
 * Every page obtains/revalidates the current Auth token; Auth events and app
 * background MUST invoke clear() via the staging-only preview's binding.
 */
import {
  CoverageReadError,createReadOnlyCoverageClient,compareCoverageChronology,
  type PublicCoverage,type ReadOnlyCoverageConfig,
} from "./readonlyCoverageClient";
import {
  createPagedCoverageClient,type CoverageWindow,type CoverageCursor,
} from "./pagedCoverageClient";

export type PagedRosterSnapshot=Readonly<{
  state:"idle"|"loading"|"ready"|"error";
  rows:readonly PublicCoverage[];
  hasMore:boolean;
  errorCode:string|null;
}>;
const NO_ROWS:readonly PublicCoverage[]=Object.freeze([]);
const IDLE:PagedRosterSnapshot=Object.freeze({
  state:"idle",rows:NO_ROWS,hasMore:false,errorCode:null,
});
const ALLOWED_ERRORS=new Set([
  "ROSTER_PAGE_WINDOW_INVALID","ROSTER_PAGE_CURSOR_INVALID",
  "ROSTER_PAGE_UNEXPECTED_SHAPE","ROSTER_PAGE_OUTSIDE_WINDOW",
  "ROSTER_PAGE_REPLAY","ROSTER_PAGE_DUPLICATE",
  "ROSTER_DUPLICATE_COVERAGE_ID","ROSTER_NOT_CHRONOLOGICAL",
  "ROSTER_INVALID_WINDOW","ROSTER_AUTH_UNAVAILABLE",
  "ROSTER_USER_SESSION_REQUIRED","ROSTER_ACCESS_DENIED",
  "ROSTER_OPERATION_REJECTED","ROSTER_SERVICE_UNAVAILABLE",
  "ROSTER_TRANSPORT_FAILED",
]);
const MAX_MEMORY_ROWS=2000;
type Subscriber=(value:PagedRosterSnapshot)=>void;

export function createPagedCoverageController(config:ReadOnlyCoverageConfig){
  const locked:ReadOnlyCoverageConfig=Object.freeze({
    ...config,forbiddenProjectRefs:Object.freeze([...(config?.forbiddenProjectRefs??[])]),
  });
  createReadOnlyCoverageClient(locked); // offline identity/config verification
  let snapshot:PagedRosterSnapshot=IDLE;
  let window:CoverageWindow|null=null;
  let nextCursor:CoverageCursor|null=null;
  let epoch=0,disposed=false;
  let pending:AbortController|null=null;
  const subscribers=new Set<Subscriber>();
  const publish=(v:PagedRosterSnapshot)=>{
    snapshot=v;
    for(const listener of [...subscribers]){
      try{listener(v);}catch{/* never let a UI listener modify security state */}
    }
  };
  const clear=()=>{
    epoch++;
    pending?.abort();pending=null;
    window=null;nextCursor=null;
    publish(IDLE);
  };
  async function run(requestWindow:CoverageWindow,
    cursor:CoverageCursor|null, prior:readonly PublicCoverage[]):Promise<boolean>{
    if(disposed)return false;
    const requestId=++epoch;
    pending?.abort();
    const abort=new AbortController();
    pending=abort;
    publish(Object.freeze({state:"loading",rows:NO_ROWS,
      hasMore:false,errorCode:null}));
    const current=()=>!disposed&&epoch===requestId&&!abort.signal.aborted;
    let token:string|null=null;
    try{
      token=await locked.getAccessToken();
      if(!current())return false;
      const reader=createPagedCoverageClient({
        ...locked,getAccessToken:async()=>token,
      });
      const page=await reader.read(requestWindow,cursor,abort.signal);
      if(!current())return false;
      const after=await locked.getAccessToken();
      if(!current())return false;
      if(!token||token!==after){
        throw new CoverageReadError("ROSTER_SESSION_CHANGED");
      }
      if(prior.length>0&&page.rows.length>0&&
        compareCoverageChronology(prior[prior.length-1],page.rows[0])>=0)
        throw new CoverageReadError("ROSTER_PAGE_REPLAY");
      const ids=new Set(prior.map(r=>r.id.toLowerCase()));
      for(const row of page.rows){
        if(ids.has(row.id.toLowerCase()))
          throw new CoverageReadError("ROSTER_PAGE_DUPLICATE");
        ids.add(row.id.toLowerCase());
      }
      if(prior.length+page.rows.length>MAX_MEMORY_ROWS)
        throw new CoverageReadError("ROSTER_PAGE_MEMORY_LIMIT");
      window=Object.freeze({...requestWindow});
      nextCursor=page.nextCursor;
      publish(Object.freeze({
        state:"ready",
        rows:Object.freeze([...prior,...page.rows].map(r=>Object.freeze({...r}))),
        hasMore:page.hasMore,errorCode:null,
      }));
      return true;
    }catch(error){
      if(!current())return false;
      window=null;nextCursor=null;
      const code=error instanceof CoverageReadError&&
        (ALLOWED_ERRORS.has(error.code)||
          ["ROSTER_SESSION_CHANGED","ROSTER_PAGE_MEMORY_LIMIT"].includes(error.code))
        ? error.code:"ROSTER_AUTH_UNAVAILABLE";
      publish(Object.freeze({state:"error",rows:NO_ROWS,
        hasMore:false,errorCode:code}));
      return false;
    }finally{
      token=null;
      if(epoch===requestId&&pending===abort)pending=null;
    }
  }
  return Object.freeze({
    getSnapshot:():PagedRosterSnapshot=>snapshot,
    subscribe(listener:Subscriber):()=>void{
      if(disposed)return ()=>{};
      subscribers.add(listener);
      listener(snapshot);
      return ()=>{subscribers.delete(listener);};
    },
    clear():void{if(!disposed)clear();},
    dispose():void{
      if(disposed)return;
      clear();disposed=true;subscribers.clear();
    },
    loadWindow(requestWindow:CoverageWindow):Promise<boolean>{
      if(disposed)return Promise.resolve(false);
      // Always discard prior context before starting a newly chosen window.
      clear();
      return run(requestWindow,null,NO_ROWS);
    },
    loadNext():Promise<boolean>{
      if(disposed||snapshot.state!=="ready"||!snapshot.hasMore||
        window===null||nextCursor===null||
        snapshot.rows.length>=MAX_MEMORY_ROWS)return Promise.resolve(false);
      return run(window,nextCursor,snapshot.rows);
    },
  });
}
