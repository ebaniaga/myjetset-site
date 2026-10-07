// Cloudflare Pages Function — POST /api/inquiry
// Validates a trip inquiry, emails it to the owner via Resend (reply-to the
// traveler), then sends the traveler a short confirmation. Same env vars as
// /api/search: RESEND_API_KEY, FROM_EMAIL, OWNER_EMAIL.

import { isRecord } from "../../src/lib/validation.js";
import { OWNER_FALLBACK, send, renderOwnerEmail, renderConfirmation, json } from "../../src/lib/mail.js";

const CONFIRMATION =
  "I'll read through the details and follow up within a day or two with next steps. If anything comes to mind in the meantime, just reply to this email.";
const LIMITS = { name: 120, email: 200, phone: 40, short: 200, long: 2000 };

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!isRecord(body)) return json({ error: "Invalid request." }, 400);
  const fields = ["name", "email", "phone", "help", "destinations", "dates", "travelers", "budget", "notes", "website"];
  if (fields.some((key) => body[key] != null && typeof body[key] !== "string")) {
    return json({ error: "Inquiry fields must be text." }, 400);
  }

  // Honeypot — real visitors never fill this field.
  if (body.website) return json({ ok: true });

  const s = (v, max) => String(v ?? "").trim().slice(0, max);
  const name = s(body.name, LIMITS.name);
  const email = s(body.email, LIMITS.email);
  const phone = s(body.phone, LIMITS.phone);
  const help = s(body.help, LIMITS.short);
  const destinations = s(body.destinations, LIMITS.short);
  const dates = s(body.dates, LIMITS.short);
  const travelers = s(body.travelers, 20);
  const budget = s(body.budget, LIMITS.short);
  const notes = s(body.notes, LIMITS.long);

  const errors = [];
  if (!name) errors.push("Please tell me your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Please enter a valid email.");
  if (errors.length) return json({ error: errors.join(" ") }, 400);

  const owner = env.OWNER_EMAIL || OWNER_FALLBACK;
  const subject = `Trip inquiry from ${name}${destinations ? ` — ${destinations.slice(0, 60)}` : ""}`;
  const rows = [
    ["Name", name],
    ["Email", email],
    ["Phone", phone],
    ["Help with", help],
    ["Destinations", destinations],
    ["Dates", dates],
    ["Travelers", travelers],
    ["Budget", budget],
    ["Notes", notes],
  ].filter(([, v]) => v);

  const sent = await send(env, {
    to: [owner],
    reply_to: email,
    subject,
    html: renderOwnerEmail("New trip inquiry", rows),
  });
  if (!sent) {
    return json(
      { error: `Couldn't send your inquiry just now. Please try again, or email ${owner} directly.` },
      502
    );
  }

  // Best-effort confirmation to the traveler; the inquiry already reached the owner.
  await send(env, {
    to: [email],
    reply_to: owner,
    subject: "Got it — I'll be in touch shortly",
    html: renderConfirmation(name, owner, CONFIRMATION),
  });

  return json({ ok: true });
}
