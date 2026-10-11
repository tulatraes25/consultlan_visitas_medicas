/**
 * HC-READ-02B — dormant, bounded, read-only Edge keyset page client.
 * Does NOT connect to App, store patient data, persist JWT or deploy Supabase.
 * Actor and tenant are NEVER request fields: Auth+live session+SQL authorize.
 */
import {
  createReadOnlyCoverageClient,parseCoverage,strictInstant,
  compareCoverageInstants,compareCoverageChronology,
  CoverageReadError,type PublicCoverage,type ReadOnlyCoverageConfig,
} from "./readonlyCoverageClient";

export type CoverageWindow=Readonly<{startUtc:string;endUtc:string}>;
export type CoverageCursor=Readonly<{scheduledStart:string;id:string}>;
export type CoveragePage=Readonly<{
  rows:readonly PublicCoverage[];
  hasMore:boolean;
  nextCursor:CoverageCursor|null;
}>;

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
const DAY_MS=24*60*60*1000;
const HEADER={accept:"application/json","content-type":"application/json"} as const;

function fail(code:string):never{throw new CoverageReadError(code);}

export function isCoverageWindow(input:unknown):input is CoverageWindow{
  if(!input||typeof input!=="object"||Array.isArray(input))return false;
  const window=input as Record<string,unknown>;
  if(Object.keys(window).sort().join(",")!=="endUtc,startUtc")return false;
  const {startUtc,endUtc}=window;
  if(typeof startUtc!=="string"||typeof endUtc!=="string"||
    !UTC.test(startUtc)||!UTC.test(endUtc))return false;
  const start=strictInstant(startUtc),end=strictInstant(endUtc);
  return start!==null&&end!==null &&
    compareCoverageInstants(startUtc,endUtc)<0 &&
    start>=Date.parse("2000-01-01T00:00:00Z") &&
    end<=Date.parse("2100-01-01T00:00:00Z") &&
    end-start<=32*DAY_MS;
}

function isCursor(cursor:unknown):cursor is CoverageCursor{
  if(!cursor||typeof cursor!=="object"||Array.isArray(cursor))return false;
  const c=cursor as Record<string,unknown>;
  return Object.keys(c).sort().join(",")==="id,scheduledStart" &&
    typeof c.id==="string" && UUID.test(c.id) &&
    typeof c.scheduledStart==="string" &&
    strictInstant(c.scheduledStart)!==null;
}
/** SQL returns a snake_case keyset. Translate to the mobile cursor shape
 * only AFTER strict validation; reject camelCase from an upstream payload.
 */
function parseServerCursor(value:unknown):CoverageCursor|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const c=value as Record<string,unknown>;
  if(Object.keys(c).sort().join(",")!=="id,scheduled_start"||
    typeof c.id!=="string"||!UUID.test(c.id)||
    typeof c.scheduled_start!=="string"||
    strictInstant(c.scheduled_start)===null)return null;
  return {id:c.id,scheduledStart:c.scheduled_start};
}
function safeResult(data:unknown,window:CoverageWindow,prior:CoverageCursor|null):CoveragePage{
  if(!data||typeof data!=="object"||Array.isArray(data))fail("ROSTER_PAGE_UNEXPECTED_SHAPE");
  const obj=data as Record<string,unknown>;
  if(Object.keys(obj).sort().join(",")!=="hasMore,nextCursor,rows" ||
    typeof obj.hasMore!=="boolean"||
    !Array.isArray(obj.rows)||obj.rows.length>100)
    fail("ROSTER_PAGE_UNEXPECTED_SHAPE");
  const rows:PublicCoverage[]=obj.rows.map(parseCoverage);
  const seen=new Set<string>();
  for(let i=0;i<rows.length;i++){
    const row=rows[i],id=row.id.toLowerCase();
    if(seen.has(id))fail("ROSTER_DUPLICATE_COVERAGE_ID");
    seen.add(id);
    if(compareCoverageInstants(row.scheduledEnd,window.startUtc)<=0||
      compareCoverageInstants(row.scheduledStart,window.endUtc)>=0)
      fail("ROSTER_PAGE_OUTSIDE_WINDOW");
    if(i>0&&compareCoverageChronology(rows[i-1],row)>=0)
      fail("ROSTER_NOT_CHRONOLOGICAL");
  }
  if(prior&&rows.length>0&&compareCoverageChronology({
    id:prior.id,scheduledStart:prior.scheduledStart,
  },rows[0])>=0)fail("ROSTER_PAGE_REPLAY");
  const next=obj.hasMore?parseServerCursor(obj.nextCursor):null;
  if(obj.hasMore){
    if(rows.length!==100||!next)fail("ROSTER_PAGE_CURSOR_INVALID");
    const last=rows[rows.length-1];
    if(next.id.toLowerCase()!==last.id.toLowerCase()||
      next.scheduledStart!==last.scheduledStart)
      fail("ROSTER_PAGE_CURSOR_INVALID");
  }else if(obj.nextCursor!==null)fail("ROSTER_PAGE_CURSOR_INVALID");
  return Object.freeze({
    rows:Object.freeze(rows.map(row=>Object.freeze({...row}))),
    hasMore:obj.hasMore,
    nextCursor:next?Object.freeze({...next}):null,
  });
}

export function createPagedCoverageClient(config:ReadOnlyCoverageConfig){
  // Offline, fail-closed config validation shared with MOB-DATA-01.
  const locked:ReadOnlyCoverageConfig=Object.freeze({
    ...config,
    forbiddenProjectRefs:Object.freeze([...(config?.forbiddenProjectRefs??[])]),
  });
  createReadOnlyCoverageClient(locked);
  const url="https://"+locked.projectRef+".supabase.co/functions/v1/visits";
  return Object.freeze({
    async read(window:CoverageWindow,cursor:CoverageCursor|null=null,
      signal?:AbortSignal):Promise<CoveragePage>{
      if(!isCoverageWindow(window))fail("ROSTER_PAGE_WINDOW_INVALID");
      if(cursor!==null&&(!isCursor(cursor)||
        compareCoverageInstants(cursor.scheduledStart,window.endUtc)>=0))
        fail("ROSTER_PAGE_CURSOR_INVALID");

      let token:string|null;
      try{token=await locked.getAccessToken();}
      catch{return fail("ROSTER_AUTH_UNAVAILABLE");}
      if(!token||token.length>8192||
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
        fail("ROSTER_USER_SESSION_REQUIRED");

      const body=cursor===null ? {
        action:"listMyHomecareCoveragesPage",windowStart:window.startUtc,
        windowEnd:window.endUtc,
      } : {
        action:"listMyHomecareCoveragesNextPage",
        windowStart:window.startUtc,windowEnd:window.endUtc,
        cursorStart:cursor.scheduledStart,cursorId:cursor.id,
      };
      let response:Pick<Response,"status"|"json">;
      try{response=await locked.fetcher(url,{
        method:"POST",headers:{...HEADER,apikey:locked.publishableKey,
          authorization:"Bearer "+token},
        body:JSON.stringify(body),redirect:"error",cache:"no-store",signal,
      });}catch{return fail("ROSTER_TRANSPORT_FAILED");}
      if(response.status===401||response.status===403)fail("ROSTER_ACCESS_DENIED");
      if(response.status===422)fail("ROSTER_OPERATION_REJECTED");
      if(response.status!==200)fail("ROSTER_SERVICE_UNAVAILABLE");
      let payload:unknown;
      try{payload=await response.json();}catch{return fail("ROSTER_PAGE_UNEXPECTED_SHAPE");}
      if(!payload||typeof payload!=="object"||Array.isArray(payload)||
        Object.keys(payload).sort().join(",")!=="ok,result")
        fail("ROSTER_PAGE_UNEXPECTED_SHAPE");
      const envelope=payload as Record<string,unknown>;
      if(envelope.ok!==true)fail("ROSTER_PAGE_UNEXPECTED_SHAPE");
      return safeResult(envelope.result,window,cursor);
    },
  });
}
