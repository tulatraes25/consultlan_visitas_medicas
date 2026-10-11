import {
  createReadOnlyCoverageClient, CoverageReadError, type ReadOnlyCoverageConfig,
} from "../src/readonlyCoverageClient";

const PROJECT = "a".repeat(20);
const EXCLUDED = "b".repeat(20);
const USER_JWT = "synthetic.header.signature";
const START = "2026-10-15T09:00:00Z";
const END = "2026-10-15T10:00:00Z";

const safeRow = () => ({
  id: "11111111-1111-4111-8111-111111111111",
  episode_id: "22222222-2222-4222-8222-222222222222",
  service_kind: "VISIT",
  coverage_state: "ASSIGNED",
  scheduled_start: START,
  scheduled_end: END,
});
function good(fetcher: ReadOnlyCoverageConfig["fetcher"] = async () =>
  ({ status: 200, json: async () => ({ok:true,result:[safeRow()]}) })) {
  return {
    projectRef: PROJECT,
    forbiddenProjectRefs: [EXCLUDED],
    publishableKey: "sb_publishable_" + "x".repeat(32),
    getAccessToken: async () => USER_JWT,
    fetcher,
    stagingReadAuthorized: true as const,
  };
}

describe("MOB-DATA-01 dormant staging-only coverage client", () => {
  test("prepares exactly one authenticated Edge request and NEVER queries PostgREST", async () => {
    const calls: Array<{url: string; options: RequestInit}> = [];
    const client = createReadOnlyCoverageClient(good(async (url, options) => {
      calls.push({url, options});
      return {status: 200, json: async () => ({ok:true,result:[safeRow()]})};
    }));
    const controller = new AbortController();
    const result = await client.list(controller.signal);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      id: safeRow().id, episodeId: safeRow().episode_id,
      serviceKind: "VISIT", coverageState: "ASSIGNED",
      scheduledStart: START, scheduledEnd: END,
    });
    expect(result.possiblyTruncated).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://${PROJECT}.supabase.co/functions/v1/visits`);
    expect(calls[0].url).not.toContain("/rest/v1/");
    expect(calls[0].options.method).toBe("POST");
    expect(calls[0].options.redirect).toBe("error");
    expect(calls[0].options.cache).toBe("no-store");
    expect(calls[0].options.signal).toBe(controller.signal);
    expect(calls[0].options.body).toBe('{"action":"listMyHomecareCoverages"}');
    expect(calls[0].options.body).not.toMatch(/patient|signature|service_role|actor/i);
    expect(calls[0].url).not.toMatch(/patient_id|patient_name|notes|narrative|signature/i);
    expect(calls[0].options.headers).toEqual({
      apikey: good().publishableKey,
      authorization: "Bearer " + USER_JWT,
      accept: "application/json",
      "content-type": "application/json",
    });
  });

  test("refuses production, missing approval, secret credentials and unsafe project refs", () => {
    let network = 0;
    const fetched = async () => {
      network++;
      return { status: 200, json: async () => ({ok:true,result:[safeRow()]}) };
    };
    const base = good(fetched);
    for (const bad of [
      { ...base, stagingReadAuthorized: false },
      { ...base, projectRef: EXCLUDED },
      { ...base, projectRef: "localhost" },
      { ...base, forbiddenProjectRefs: [] },
      { ...base, forbiddenProjectRefs: ["invalid"] },
      { ...base, publishableKey: "sb_secret_" + "x".repeat(32) },
      { ...base, publishableKey: "service_role" },
      { ...base, getAccessToken: null },
      { ...base, fetcher: null },
    ]) {
      expect(() => createReadOnlyCoverageClient(bad as never)).toThrow(CoverageReadError);
      expect(() => createReadOnlyCoverageClient(bad as never)).toThrow("ROSTER_STAGING_CONFIG_REJECTED");
    }
    expect(network).toBe(0);
  });

  test("without a real user JWT it does not execute HTTP", async () => {
    let network = 0;
    for (const token of [null, "", "sb_secret_bad", "sb_publishable_bad", "not-a-jwt"]) {
      const client = createReadOnlyCoverageClient({
        ...good(async () => { network++; return { status: 200, json: async () => [] }; }),
        getAccessToken: async () => token,
      });
      await expect(client.list()).rejects.toMatchObject({ code: "ROSTER_USER_SESSION_REQUIRED" });
    }
    expect(network).toBe(0);
  });

  test("translates denial, outages, malformed and extra clinical fields into safe failures", async () => {
    for (const status of [401, 403]) {
      const client = createReadOnlyCoverageClient(good(async () => ({
        status, json: async () => ({ upstream: "never print patient details" }),
      })));
      await expect(client.list()).rejects.toMatchObject({ code: "ROSTER_ACCESS_DENIED" });
    }
    const badRows = [
      { ...safeRow(), patient_id: "not-allowed" },
      { ...safeRow(), episode_id: "other-episode" },
      { ...safeRow(), service_kind: "PRESCRIPTION" },
      { ...safeRow(), coverage_state: "MEDICALLY_APPROVED" },
      { ...safeRow(), scheduled_start: "tomorrow" },
      { ...safeRow(), scheduled_end: START },
    ];
    for (const row of badRows) {
      const client = createReadOnlyCoverageClient(good(async () => ({
        status: 200, json: async () => ({ok:true,result:[row]}),
      })));
      await expect(client.list()).rejects.toBeInstanceOf(CoverageReadError);
    }
    await expect(createReadOnlyCoverageClient(good(async () =>
      ({ status: 200, json: async () => ({ error: "wrong content" }) }))).list()
    ).rejects.toMatchObject({ code: "ROSTER_UNEXPECTED_SHAPE" });
    await expect(createReadOnlyCoverageClient(good(async () => {
      throw Error("Upstream incident; do not leak");
    })).list()).rejects.toMatchObject({ code: "ROSTER_TRANSPORT_FAILED" });
  });


  test("rejected Edge roster requests fail closed without claiming an empty agenda", async () => {
    const client = createReadOnlyCoverageClient(good(async (url, options) => {
      expect(url).toBe(`https://${PROJECT}.supabase.co/functions/v1/visits`);
      expect(options.method).toBe("POST");
      return { status: 422, json: async () => ({error: "INVALID_OPERATION_OR_FIELDS"}) };
    }));
    await expect(client.list()).rejects.toMatchObject({code:"ROSTER_OPERATION_REJECTED"});
  });

  test("rejects successful HTTP responses without the exact Edge envelope", async () => {
    for(const data of [
      [safeRow()],
      { ok:true, result:[safeRow()], patient:"forbidden" },
      { ok:false, result:[safeRow()] },
      { ok:true, result:{message:"not an array"} },
    ]) {
      const client=createReadOnlyCoverageClient(good(async()=>({status:200,json:async()=>data})));
      await expect(client.list()).rejects.toMatchObject({code:"ROSTER_UNEXPECTED_SHAPE"});
    }
  });

  test("MOB-DATA-03 rejects duplicated UUIDs, including case-variant duplicates", async () => {
    const b = { ...safeRow(), id: safeRow().id, coverage_state:"ACTIVE" };
    const c = { ...safeRow(), id:"abcdefab-abcd-4abc-8abc-abcdefabcdef" };
    const d = { ...c, id:c.id.toUpperCase() };
    for(const rows of [[safeRow(),b],[c,d]]) {
      const reader = createReadOnlyCoverageClient(good(async()=>({
        status:200,json:async()=>({ok:true,result:rows}),
      })));
      await expect(reader.list()).rejects.toMatchObject({
        code:"ROSTER_DUPLICATE_COVERAGE_ID",
      });
    }
  });

  test("MOB-DATA-03 rejects nonexistent dates, clock overflow and ISO offset abuse", async () => {
    for(const invalidDate of [
      "2026-02-30T09:00:00Z", "2025-02-29T09:00:00Z",
      "1900-02-29T09:00:00Z", "2026-04-31T09:00:00Z",
      "2026-13-15T09:00:00Z", "2026-00-15T09:00:00Z",
      "2026-10-00T09:00:00Z", "0000-10-15T09:00:00Z",
      "2026-10-15T24:00:00Z", "2026-10-15T09:60:00Z",
      "2026-10-15T09:00:60Z", "2026-10-15T09:00:00+15:00",
      "2026-10-15T09:00:00-14:01", "2026-10-15T09:00:00+14:30",
      "2026-10-15T09:00:00+05:60", "2026-10-15T09:00:00",
      "2026-10-15T09:00:00.1234567Z",
    ]) {
      const bad = {...safeRow(),scheduled_start:invalidDate};
      const reader = createReadOnlyCoverageClient(good(async()=>({
        status:200,json:async()=>({ok:true,result:[bad]}),
      })));
      await expect(reader.list()).rejects.toMatchObject({
        code:"ROSTER_INVALID_WINDOW",
      });
    }
  });

  test("MOB-DATA-03 supports leap years and explicit timezone offsets", async () => {
    for(const [start,end] of [
      ["2028-02-29T09:00:00Z","2028-02-29T10:00:00Z"],
      ["2000-02-29T09:00:00.123456Z","2000-02-29T10:00:00.123456Z"],
      ["2026-10-15T09:00:00+05:45","2026-10-15T10:00:00+05:45"],
      ["2026-10-15T09:00:00-03:00","2026-10-15T10:00:00-03:00"],
      ["2026-10-15T09:00:00+14:00","2026-10-15T10:00:00+14:00"],
    ]) {
      const row={...safeRow(),scheduled_start:start,scheduled_end:end};
      const reader=createReadOnlyCoverageClient(good(async()=>({
        status:200,json:async()=>({ok:true,result:[row]}),
      })));
      await expect(reader.list()).resolves.toMatchObject({
        rows:[{scheduledStart:start,scheduledEnd:end}],
      });
    }
  });

  test("caps the response and flags possible truncation without inventing remaining rows", async () => {
    const uniqueRows = Array.from({ length: 100 }, (_,i) => ({
      ...safeRow(), id:"11111111-1111-4111-8111-"+String(i).padStart(12,"0"),
    }));
    const client = createReadOnlyCoverageClient(good(async () => ({
      status: 200, json: async () => ({ok:true,result:uniqueRows}),
    })));
    const result = await client.list();
    expect(result.rows).toHaveLength(100);
    expect(result.possiblyTruncated).toBe(true);
    const invalid = createReadOnlyCoverageClient(good(async () => ({
      status: 200, json: async () => ({ok:true,result:Array.from({ length: 101 }, () => safeRow())}),
    })));
    await expect(invalid.list()).rejects.toMatchObject({ code: "ROSTER_UNEXPECTED_SHAPE" });
  });

  test("MOB-DATA-04 rejects reversed server order without reordering entries",async()=>{
    const first={...safeRow(),id:"ffffffff-ffff-4fff-8fff-ffffffffffff"};
    const next={...safeRow(),id:"22222222-2222-4222-8222-222222222222",
      scheduled_start:"2026-10-15T10:00:00Z",scheduled_end:"2026-10-15T11:00:00Z"};
    const make=(rows:unknown[])=>createReadOnlyCoverageClient(good(async()=>({
      status:200,json:async()=>({ok:true,result:rows}),
    }))).list();
    await expect(make([first,next])).resolves.toMatchObject({
      rows:[{id:first.id},{id:next.id}],
    });
    await expect(make([next,first])).rejects.toMatchObject({
      code:"ROSTER_NOT_CHRONOLOGICAL",
    });
  });

  test("MOB-DATA-04 honors microseconds and equal instants with timezone offsets",async()=>{
    const early={...safeRow(),id:"ffffffff-ffff-4fff-8fff-ffffffffffff",
      scheduled_start:"2026-10-15T09:00:00.123456Z"};
    const late={...safeRow(),id:"22222222-2222-4222-8222-222222222222",
      scheduled_start:"2026-10-15T09:00:00.123457Z"};
    const first={...safeRow(),id:"11111111-1111-4111-8111-111111111111",
      scheduled_start:"2026-10-15T09:00:00Z"};
    const equalInstant={...safeRow(),id:"33333333-3333-4333-8333-333333333333",
      scheduled_start:"2026-10-15T06:00:00-03:00"};
    const make=(rows:unknown[])=>createReadOnlyCoverageClient(good(async()=>({
      status:200,json:async()=>({ok:true,result:rows}),
    }))).list();
    // UUID decreases, but microseconds increase: this is correctly ordered.
    await expect(make([early,late])).resolves.toMatchObject({
      rows:[{id:early.id},{id:late.id}],
    });
    await expect(make([late,early])).rejects.toMatchObject({
      code:"ROSTER_NOT_CHRONOLOGICAL",
    });
    await expect(make([first,equalInstant])).resolves.toHaveProperty("rows");
    await expect(make([equalInstant,first])).rejects.toMatchObject({
      code:"ROSTER_NOT_CHRONOLOGICAL",
    });
  });
});
