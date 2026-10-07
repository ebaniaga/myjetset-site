// Cloudflare Pages Function — POST /api/group-inquiry
// Validates a team-trip / hotel-block inquiry from /group-travel, emails it to
// the owner via Resend (reply-to the organizer), then sends the organizer a
// short confirmation. Same env vars as /api/inquiry: RESEND_API_KEY,
// FROM_EMAIL, OWNER_EMAIL.

import { validateGroupInquiry, summaryRows } from "../../src/lib/group-inquiry.js";
import { OWNER_FALLBACK, send, renderOwnerEmail, renderConfirmation, json } from "../../src/lib/mail.js";

const CONFIRMATION =
  "I'll review your team's plans and get in touch by email. Nothing is reserved or committed yet. If anything changes in the meantime — dates, room count, destinations — just reply to this email.";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Honeypot — real visitors never fill this field.
  if (body && typeof body === "object" && body.website) return json({ ok: true });

  const result = validateGroupInquiry(body);
  if (result.malformed) return json({ error: "Invalid request." }, 400);
  if (!result.ok) {
    return json({ error: "Please check the highlighted fields.", errors: result.errors }, 400);
  }
  const v = result.value;

  const owner = env.OWNER_EMAIL || OWNER_FALLBACK;
  const sent = await send(env, {
    to: [owner],
    reply_to: v.email,
    subject: `Group inquiry: ${v.company.slice(0, 60)} — ${v.destination.slice(0, 60)}`,
    html: renderOwnerEmail("New group travel inquiry", summaryRows(v)),
  });
  if (!sent) return json({ error: "Your inquiry couldn't be sent." }, 502);

  // Best-effort confirmation to the organizer; the inquiry already reached the owner.
  await send(env, {
    to: [v.email],
    reply_to: owner,
    subject: "Your team trip details reached My Jet Set Life",
    html: renderConfirmation(v.name, owner, CONFIRMATION),
  });

  return json({ ok: true });
}
