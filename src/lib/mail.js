// Shared helpers for the inquiry endpoints: Resend delivery, the owner's
// summary email, the traveler's confirmation, and JSON responses.

import { escapeHtml as esc } from "./validation.js";

export const OWNER_FALLBACK = "hello@myjetset.life";

export async function send(env, msg) {
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

export function renderOwnerEmail(heading, rows) {
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 12px;color:#8a8275;font-size:11px;letter-spacing:.14em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${esc(k)}</td>` +
        `<td style="padding:8px 12px;color:#1B1A17;font-size:15px;line-height:1.5;">${esc(v).replace(/\n/g, "<br/>")}</td></tr>`
    )
    .join("");
  return `<div style="font-family:'Hanken Grotesk',system-ui,sans-serif;background:#F1EEE4;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#FBFAF6;border-radius:10px;padding:28px;">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8a8275;margin-bottom:10px;">${esc(heading)}</div>
      <table style="border-collapse:collapse;width:100%;">${trs}</table>
      <div style="margin-top:20px;font-size:12px;color:#6E7C72;">Reply to this email to respond to the traveler directly.</div>
    </div></div>`;
}

/** `paragraph` is trusted copy written in this repo, not visitor input. */
export function renderConfirmation(name, owner, paragraph) {
  const first = esc(name.split(/\s+/)[0]);
  return `<div style="font-family:'Hanken Grotesk',system-ui,sans-serif;background:#F1EEE4;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#FBFAF6;border-radius:10px;padding:28px;color:#1B1A17;">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8a8275;margin-bottom:10px;">My Jet Set Life</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;color:#16463A;margin-bottom:12px;">Thanks, ${first} — I've got your inquiry.</div>
      <p style="font-size:15px;line-height:1.65;color:#4A463D;margin:0 0 12px;">${paragraph}</p>
      <p style="font-size:15px;line-height:1.65;color:#4A463D;margin:0;">— Erickson<br/><span style="font-size:12px;color:#6E7C72;">Fora Travel Advisor · ${esc(owner)}</span></p>
    </div></div>`;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
