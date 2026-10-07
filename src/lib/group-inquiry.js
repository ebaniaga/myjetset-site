// Group-travel inquiry rules, shared by the /group-travel form (for inline
// errors) and /api/group-inquiry (the authority). Keys of `errors` are the
// form's field names; messages are written to sit beside that field.

import { isCalendarDate } from "./validation.js";

export const DATE_MODES = ["known", "deciding"];
export const FLEXIBILITY = ["Fixed", "A few days either way", "Flexible"];
export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "JPY"];
export const BUDGET_BASES = ["Per room, per night", "Total accommodation budget"];
export const STAGES = ["Exploring", "Comparing hotels", "Hotel selected, not booked", "Already booked or contracted"];

const TEXT = ["name", "email", "company", "destination", "dateMode", "arrival", "departure", "flexibility", "timeframe",
  "nights", "rooms", "budgetAmount", "budgetCurrency", "budgetBasis", "stage", "notes", "website"];
const FLAGS = ["nightsUnsure", "roomsUnsure", "budgetGuidance"];
const LIMITS = { name: 120, email: 200, company: 160, destination: 200, timeframe: 120, notes: 2000 };
const MAX_ROOMS = 2000;
const MAX_NIGHTS = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whole nights between two YYYY-MM-DD dates (UTC, so DST never shifts it). */
export function nightsBetween(arrival, departure) {
  return Math.round((Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86400000);
}

/**
 * Returns { ok: true, value } with trimmed, normalized fields, or
 * { ok: false, errors } where `errors` maps field name → message.
 * Returns { ok: false, malformed: true } when the body isn't the expected shape.
 */
export function validateGroupInquiry(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return { ok: false, malformed: true };
  if (TEXT.some((k) => body[k] != null && typeof body[k] !== "string")) return { ok: false, malformed: true };
  if (FLAGS.some((k) => body[k] != null && typeof body[k] !== "boolean")) return { ok: false, malformed: true };

  const s = (k) => String(body[k] ?? "").trim();
  const v = {
    name: s("name"), email: s("email"), company: s("company"), destination: s("destination"),
    dateMode: s("dateMode"), arrival: "", departure: "", flexibility: "", timeframe: "", nights: null, nightsUnsure: false,
    rooms: null, roomsUnsure: body.roomsUnsure === true,
    budgetGuidance: body.budgetGuidance === true, budgetAmount: null, budgetCurrency: "", budgetBasis: "",
    stage: s("stage"), notes: s("notes"),
  };
  const errors = {};
  const tooLong = (k, label) => { if (v[k].length > LIMITS[k]) errors[k] = `${label} is too long — please shorten it.`; };

  if (!v.name) errors.name = "Please add your name.";
  else tooLong("name", "Name");
  if (!EMAIL.test(v.email)) errors.email = "Please enter an email address like name@company.com.";
  else tooLong("email", "Email");
  if (!v.company) errors.company = "Please add your company or group name.";
  else tooLong("company", "Company or group");
  if (!v.destination) errors.destination = "Please add a destination, a few ideas, or “still deciding.”";
  else tooLong("destination", "Destination");

  if (v.dateMode === "known") {
    v.arrival = s("arrival");
    v.departure = s("departure");
    if (!isCalendarDate(v.arrival)) errors.arrival = "Please choose an arrival date.";
    if (!isCalendarDate(v.departure)) errors.departure = "Please choose a departure date.";
    else if (!errors.arrival && v.departure <= v.arrival) errors.departure = "Departure must be after arrival.";
    if (!errors.arrival && !errors.departure) {
      v.nights = nightsBetween(v.arrival, v.departure);
      if (v.nights > MAX_NIGHTS) errors.departure = `That's more than ${MAX_NIGHTS} nights — please check the dates.`;
    }
    v.flexibility = s("flexibility");
    if (v.flexibility && !FLEXIBILITY.includes(v.flexibility)) errors.flexibility = "Please choose an option.";
  } else if (v.dateMode === "deciding") {
    v.timeframe = s("timeframe");
    tooLong("timeframe", "Timeframe");
    v.nightsUnsure = body.nightsUnsure === true;
    if (!v.nightsUnsure) {
      const n = positiveInt(s("nights"));
      if (n === null || n > MAX_NIGHTS) errors.nights = `Enter a number of nights from 1 to ${MAX_NIGHTS}, or choose “Not sure yet.”`;
      else v.nights = n;
    }
  } else {
    errors.dateMode = "Please choose whether you have dates yet.";
  }

  if (!v.roomsUnsure) {
    const n = positiveInt(s("rooms"));
    if (n === null || n > MAX_ROOMS) errors.rooms = "Enter a room count of 1 or more, or choose “Not sure yet.”";
    else v.rooms = n;
  }

  if (!v.budgetGuidance && s("budgetAmount")) {
    const amount = Number(s("budgetAmount").replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) errors.budgetAmount = "Enter a budget amount above zero, or leave it blank.";
    else v.budgetAmount = amount;
    v.budgetCurrency = s("budgetCurrency");
    if (!CURRENCIES.includes(v.budgetCurrency)) errors.budgetCurrency = "Please choose a currency.";
    v.budgetBasis = s("budgetBasis");
    if (!BUDGET_BASES.includes(v.budgetBasis)) errors.budgetBasis = "Please choose whether this is per room, per night or a total.";
  }

  if (!STAGES.includes(v.stage)) errors.stage = "Please choose where you are in planning.";
  tooLong("notes", "This note");

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: v };
}

function positiveInt(text) {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 ? n : null;
}

/** Label/value rows for the owner's email; empty fields are left out. */
export function summaryRows(v) {
  const dates = v.dateMode === "known"
    ? `${v.arrival} → ${v.departure} (${v.nights} night${v.nights === 1 ? "" : "s"})`
    : `Still deciding${v.timeframe ? ` — ${v.timeframe}` : ""}`;
  const nights = v.dateMode === "deciding" ? (v.nightsUnsure ? "Not sure yet" : String(v.nights)) : "";
  const budget = v.budgetGuidance
    ? "Would like guidance"
    : v.budgetAmount != null
      ? `${v.budgetCurrency} ${v.budgetAmount.toLocaleString("en-US")} — ${v.budgetBasis.toLowerCase()}`
      : "";
  return [
    ["Name", v.name],
    ["Email", v.email],
    ["Company / group", v.company],
    ["Destination", v.destination],
    ["Dates", dates],
    ["Flexibility", v.flexibility],
    ["Nights", nights],
    ["Rooms", v.roomsUnsure ? "Not sure yet" : String(v.rooms)],
    ["Hotel budget", budget],
    ["Planning stage", v.stage],
    ["Anything else", v.notes],
  ].filter(([, value]) => value);
}
