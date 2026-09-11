import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as search } from "../functions/api/search.js";
import { onRequestPost as inquiry } from "../functions/api/inquiry.js";

afterEach(() => mock.restoreAll());
const env = { SEATS_AERO_KEY: "mock", RESEND_API_KEY: "mock", FROM_EMAIL: "site@example.invalid", OWNER_EMAIL: "owner@example.invalid" };
const base = { programs: ["aeroplan"], balanceMin: 50000, balanceMax: 80000, origin: "JFK", destination: "LHR", startDate: "2099-12-01", endDate: "2099-12-02", cabins: ["business"], email: "traveler@example.invalid", name: "Traveler" };
const context = (body) => ({ env, request: new Request("https://example.invalid/api/search", { method: "POST", body: JSON.stringify(body) }) });
const trip = (overrides = {}) => ({ Cabin: "business", MileageCost: 70000, TotalTaxes: 1234, TaxesCurrency: "CAD", Stops: 1, TotalDuration: 650, Carriers: "AC", FlightNumbers: "AC 100", Connections: ["YYZ"], DepartsAt: "2099-12-01T15:00:00Z", ArrivesAt: "2099-12-02T03:00:00Z", ...overrides });
const availability = (overrides = {}) => ({ ID: "first", Source: "aeroplan", Date: "2099-12-01", Route: { OriginAirport: "JFK", DestinationAirport: "LHR" }, JAvailable: true, JMileageCostRaw: 70000, JTotalTaxesRaw: 560, TaxesCurrency: "USD", AvailabilityTrips: [trip()], ...overrides });

function services(pages = [{ data: [availability()], hasMore: false }]) {
  const requests = [], emails = [];
  mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).startsWith("https://seats.aero/partnerapi/search")) {
      requests.push(new URL(url));
      const page = typeof pages === "function" ? pages(requests.length) : pages[requests.length - 1];
      if (page instanceof Error) throw page;
      if (page instanceof Response) return page;
      assert.ok(page, "Unexpected extra provider request");
      return Response.json(page);
    }
    assert.equal(String(url), "https://api.resend.com/emails", "Unexpected network destination");
    emails.push(JSON.parse(init.body));
    return Response.json({ id: "mock-email" });
  });
  return { requests, emails };
}

test("flight details, price and taxes come from the affordable itinerary", async () => {
  const { emails } = services([{ data: [availability({ AvailabilityTrips: [trip(), trip({ MileageCost: 150000, Stops: 0, TotalDuration: 420, FlightNumbers: "AC 200" })] })] }]);
  const res = await search(context(base));
  assert.equal(res.status, 200);
  assert.match(emails[0].html, /70,000 mi/);
  assert.match(emails[0].html, /AC 100/);
  assert.doesNotMatch(emails[0].html, /AC 200|USD 5\.60/);
  assert.match(emails[0].html, /CAD 12\.34/);
});

test("an affordable trip survives when the summary minimum is below the budget", async () => {
  const { emails } = services([{ data: [availability({ JMileageCostRaw: 30000, AvailabilityTrips: [trip({ MileageCost: 30000 }), trip({ MileageCost: 65000, Stops: 0 })] })] }]);
  assert.equal((await search(context(base))).status, 200);
  assert.match(emails[0].html, /65,000 mi/);
});

test("known over-budget trips do not fall back to a cheaper summary", async () => {
  const { emails } = services([{ data: [availability({ AvailabilityTrips: [trip({ MileageCost: 150000 })] })] }]);
  const res = await search(context(base));
  assert.equal((await res.json()).count, 0);
  assert.doesNotMatch(emails[0].html, /70,000 mi|AC 100/);
});

test("summary-only availability avoids invented flight details and unknown taxes", async () => {
  const { emails } = services([{ data: [availability({ AvailabilityTrips: null, JTotalTaxesRaw: null, JDirect: true })] }]);
  assert.equal((await search(context(base))).status, 200);
  assert.match(emails[0].html, /Flight details unavailable/);
  assert.match(emails[0].html, /Taxes not provided/);
  assert.doesNotMatch(emails[0].html, / · Direct|USD 0\.00/);
});

test("airport-local times retain their wall-clock values and next-day marker", async () => {
  const { emails } = services();
  await search(context(base));
  assert.match(emails[0].html, /JFK 15:00/);
  assert.match(emails[0].html, /LHR 03:00/);
  assert.match(emails[0].html, /\+1d/);
  assert.doesNotMatch(emails[0].html, /JFK 10:00/);
});

test("date-line crossings can show a previous-day arrival", async () => {
  const { emails } = services([{ data: [availability({ AvailabilityTrips: [trip({ ArrivesAt: "2099-11-30T23:30:00Z" })] })] }]);
  await search(context(base));
  assert.match(emails[0].html, /-1d/);
});

test("missing flight timestamps do not crash the results email", async () => {
  const { emails } = services([{ data: [availability({ AvailabilityTrips: [trip({ DepartsAt: null, ArrivesAt: "invalid" })] })] }]);
  assert.equal((await search(context(base))).status, 200);
  assert.match(emails[0].html, /Time unavailable/);
});

test("user and provider HTML is escaped in the search email", async () => {
  const name = '<a href="https://example.invalid">Injected link</a>';
  const { emails } = services([{ data: [availability({ AvailabilityTrips: [trip({ FlightNumbers: '<img src="x">', Carriers: 'AC"><img src=x>' })] })] }]);
  await search(context({ ...base, name }));
  assert.doesNotMatch(emails[0].html, /<a href="https:\/\/example\.invalid">|<img src="x">|AC"><img/);
  assert.match(emails[0].html, /&lt;a href=&quot;https:\/\/example\.invalid&quot;/);
  assert.match(emails[0].html, /&lt;img src=&quot;x&quot;&gt;/);
});

test("Bilt searches current supported partners; direct American miles still work", async () => {
  const { requests } = services([{ data: [] }, { data: [] }]);
  await search(context({ ...base, programs: [], cardPoints: ["bilt"] }));
  const sources = requests[0].searchParams.get("sources").split(",");
  assert.equal(sources.includes("american"), false);
  for (const partner of ["united", "qatar", "etihad", "aeroplan", "alaska"]) assert.ok(sources.includes(partner));
  await search(context({ ...base, programs: ["american"], cardPoints: ["bilt"] }));
  assert.ok(requests[1].searchParams.get("sources").split(",").includes("american"));
});

test("pagination retains the first cursor, advances by raw rows and deduplicates", async () => {
  const first = availability();
  const second = availability({ ID: "second", Date: "2099-12-02" });
  const { requests } = services([
    { data: [first], hasMore: true, cursor: 123 },
    { data: [first, second], hasMore: true, cursor: 999 },
    { data: [], hasMore: false },
  ]);
  const res = await search(context(base));
  assert.equal((await res.json()).count, 2);
  assert.equal(requests.length, 3);
  assert.equal(requests[0].searchParams.get("cabins"), "business");
  assert.equal(requests[1].searchParams.get("cursor"), "123");
  assert.equal(requests[1].searchParams.get("skip"), "1");
  assert.equal(requests[2].searchParams.get("cursor"), "123");
  assert.equal(requests[2].searchParams.get("skip"), "3");
});

test("a later-page failure does not send incomplete results", async () => {
  const { emails } = services([{ data: [availability()], hasMore: true, cursor: 123 }, new Response("Unavailable", { status: 503 })]);
  assert.equal((await search(context(base))).status, 502);
  assert.equal(emails.length, 0);
});

test("exceeding the search cap asks for narrower criteria without sending email", async () => {
  const { requests, emails } = services((n) => ({ data: [availability({ ID: String(n) })], hasMore: true, cursor: 123 }));
  const res = await search(context(base));
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /narrow/);
  assert.equal(requests.length, 10);
  assert.equal(emails.length, 0);
});

for (const body of [null, [], "text", 42]) {
  test(`both endpoints reject a non-object body: ${JSON.stringify(body)}`, async () => {
    const { requests, emails } = services();
    assert.equal((await search(context(body))).status, 400);
    assert.equal((await inquiry(context(body))).status, 400);
    assert.equal(requests.length + emails.length, 0);
  });
}

for (const invalid of [
  { startDate: "2099-13-01", endDate: "2099-13-02" },
  { startDate: "2099-02-29", endDate: "2099-03-01" },
  { startDate: "2099-04-31", endDate: "2099-05-01" },
  { balanceMin: "50000junk" }, { balanceMin: 50000.5 },
  { programs: ["toString"] }, { cardPoints: ["__proto__"] },
  { cabins: "business" }, { name: { nested: "value" } },
]) {
  test(`search rejects invalid fields: ${JSON.stringify(invalid)}`, async () => {
    const { requests, emails } = services();
    assert.equal((await search(context({ ...base, ...invalid }))).status, 400);
    assert.equal(requests.length + emails.length, 0);
  });
}

test("a real leap-day date is accepted", async () => {
  const { requests } = services([{ data: [] }]);
  assert.equal((await search(context({ ...base, startDate: "2104-02-29", endDate: "2104-03-01" }))).status, 200);
  assert.equal(requests.length, 1);
});

test("inquiry escapes text and retains owner-first delivery and reply-to", async () => {
  const { emails } = services();
  const res = await inquiry(context({ name: '<b>Traveler</b>', email: 'traveler@example.invalid', notes: '<img src=x>' }));
  assert.equal(res.status, 200);
  assert.deepEqual(emails[0].to, [env.OWNER_EMAIL]);
  assert.equal(emails[0].reply_to, 'traveler@example.invalid');
  assert.match(emails[0].html, /&lt;img src=x&gt;/);
  assert.deepEqual(emails[1].to, ['traveler@example.invalid']);
  assert.doesNotMatch(emails[1].html, /<b>Traveler<\/b>/);
});
