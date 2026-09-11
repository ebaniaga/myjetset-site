// Cloudflare Pages Function — POST /api/inquiry
// Validates a trip inquiry, emails it to the owner via Resend (reply-to the
// traveler), then sends the traveler a short confirmation. Same env vars as
// /api/search: RESEND_API_KEY, FROM_EMAIL, OWNER_EMAIL.

import { isRecord, escapeHtml as esc } from "../../src/lib/validation.js";

const OWNER_FALLBACK = "hello@myjetset.life";
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
    html: renderOwnerEmail(rows),
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
    html: renderConfirmation(name, owner),
  });

  return json({ ok: true });
}

async function send(env, msg) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.FROM_EMAIL, ...msg }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function renderOwnerEmail(rows) {
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#8a8275;font-size:11px;letter-spacing:.14em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${esc(k)}</td>` +
        `<td style="padding:8px 12px;color:#1B1A17;font-size:15px;line-height:1.5;">${esc(v).replace(/\n/g, "<br/>")}</td></tr>`
    )
    .join("");
  return `<div style="font-family:'Hanken Grotesk',system-ui,sans-serif;background:#F1EEE4;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#FBFAF6;border-radius:10px;padding:28px;">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8a8275;margin-bottom:10px;">New trip inquiry</div>
      <table style="border-collapse:collapse;width:100%;">${trs}</table>
      <div style="margin-top:20px;font-size:12px;color:#6E7C72;">Reply to this email to respond to the traveler directly.</div>
    </div></div>`;
}

function renderConfirmation(name, owner) {
  const first = esc(name.split(/\s+/)[0]);
  return `<div style="font-family:'Hanken Grotesk',system-ui,sans-serif;background:#F1EEE4;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#FBFAF6;border-radius:10px;padding:28px;color:#1B1A17;">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8a8275;margin-bottom:10px;">My Jet Set Life</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#16463A;margin-bottom:12px;">Thanks, ${first} — I've got your inquiry.</div>
      <p style="font-size:15px;line-height:1.65;color:#4A463D;margin:0 0 12px;">I'll read through the details and follow up within a day or two with next steps. If anything comes to mind in the meantime, just reply to this email.</p>
      <p style="font-size:15px;line-height:1.65;color:#4A463D;margin:0;">— Erickson<br/><span style="font-size:12px;color:#6E7C72;">Fora Travel Advisor · ${esc(owner)}</span></p>
    </div></div>`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
