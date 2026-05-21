// Cloudflare Pages Function — POST /api/search
// Validates a traveler's request, searches seats.aero for award availability
// they can afford, and emails the options via Resend.

const PROGRAM_NAMES = {
  aeroplan: "Air Canada Aeroplan",
  aeromexico: "Aeroméxico Club Premier",
  alaska: "Alaska Mileage Plan",
  american: "American AAdvantage",
  azul: "Azul TudoAzul",
  british: "British Airways Club",
  delta: "Delta SkyMiles",
  etihad: "Etihad Guest",
  finnair: "Finnair Plus",
  flyingblue: "Air France-KLM Flying Blue",
  jetblue: "JetBlue TrueBlue",
  qantas: "Qantas Frequent Flyer",
  qatar: "Qatar Privilege Club",
  saudia: "Saudia AlFursan",
  smiles: "GOL Smiles",
  united: "United MileagePlus",
  velocity: "Virgin Australia Velocity",
  virginatlantic: "Virgin Atlantic Flying Club",
};

// seats.aero encodes cabins as Y / W / J / F
const CABIN_KEYS = { economy: "Y", premium: "W", business: "J", first: "F" };
const CABIN_LABEL = { Y: "Economy", W: "Premium economy", J: "Business", F: "First" };

const MAX_RANGE_DAYS = 90;
const MAX_RESULTS_IN_EMAIL = 15;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  // Honeypot — bots fill the hidden "company" field. Pretend success, do nothing.
  if (body.company) return json({ ok: true, count: 0 });

  const program = String(body.program || "").trim();
  const balance = parseInt(body.balance, 10);
  const origin = String(body.origin || "").toUpperCase().replace(/\s+/g, "");
  const destination = String(body.destination || "").toUpperCase().replace(/\s+/g, "");
  const startDate = String(body.startDate || "").trim();
  const endDate = String(body.endDate || "").trim();
  const cabin = String(body.cabin || "any").trim();
  const email = String(body.email || "").trim();

  const errors = [];
  const airportRe = /^[A-Z]{3}(,[A-Z]{3})*$/;
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  if (!PROGRAM_NAMES[program]) errors.push("Choose a valid mileage program.");
  if (!Number.isFinite(balance) || balance < 1000)
    errors.push("Enter a points balance of at least 1,000.");
  if (!airportRe.test(origin))
    errors.push("Origin must be a 3-letter airport code (e.g. JFK).");
  if (!airportRe.test(destination))
    errors.push("Destination must be a 3-letter airport code (e.g. LHR).");
  if (!dateRe.test(startDate) || !dateRe.test(endDate))
    errors.push("Enter valid departure dates.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.push("Enter a valid email address.");
  if (cabin !== "any" && !CABIN_KEYS[cabin]) errors.push("Choose a valid cabin.");
  if (errors.length) return json({ error: errors.join(" ") }, 400);

  if (endDate < startDate)
    return json({ error: "Latest departure must be on or after the earliest." }, 400);
  const rangeDays = (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
  if (rangeDays > MAX_RANGE_DAYS)
    return json({ error: `Keep the date range within ${MAX_RANGE_DAYS} days.` }, 400);

  const cabinKeys = cabin === "any" ? ["Y", "W", "J", "F"] : [CABIN_KEYS[cabin]];

  // --- Search seats.aero ---------------------------------------------------
  const searchUrl = new URL("https://seats.aero/partnerapi/search");
  searchUrl.searchParams.set("origin_airport", origin);
  searchUrl.searchParams.set("destination_airport", destination);
  searchUrl.searchParams.set("start_date", startDate);
  searchUrl.searchParams.set("end_date", endDate);
  searchUrl.searchParams.set("sources", program);
  searchUrl.searchParams.set("take", "1000");
  searchUrl.searchParams.set("order_by", "lowest_mileage");

  let searchData;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        "Partner-Authorization": env.SEATS_AERO_KEY,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      return json(
        { error: "Award search is temporarily unavailable. Please try again shortly." },
        502
      );
    }
    searchData = await res.json();
  } catch {
    return json(
      { error: "Award search is temporarily unavailable. Please try again shortly." },
      502
    );
  }

  // --- Filter to options the traveler can afford ---------------------------
  const options = [];
  for (const item of searchData.data || []) {
    if (item.Source !== program) continue;
    for (const key of cabinKeys) {
      if (!item[key + "Available"]) continue;
      const miles = item[key + "MileageCostRaw"];
      if (!miles || miles > balance) continue;
      options.push({
        date: item.Date,
        origin: item.Route ? item.Route.OriginAirport : origin,
        destination: item.Route ? item.Route.DestinationAirport : destination,
        cabin: CABIN_LABEL[key],
        miles,
        taxes: item[key + "TotalTaxesRaw"] || 0,
        currency: item.TaxesCurrency || "USD",
        airlines: item[key + "Airlines"] || "",
        direct: !!item[key + "Direct"],
      });
    }
  }
  options.sort((a, b) => a.miles - b.miles);
  const shown = options.slice(0, MAX_RESULTS_IN_EMAIL);

  // --- Email the traveler --------------------------------------------------
  const programName = PROGRAM_NAMES[program];
  const subject =
    options.length > 0
      ? `${options.length} award option${options.length > 1 ? "s" : ""}: ${origin} → ${destination}`
      : `No award space yet: ${origin} → ${destination}`;

  const html = renderEmail({
    programName,
    balance,
    origin,
    destination,
    startDate,
    endDate,
    cabin,
    options,
    shown,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [email],
        bcc: env.OWNER_EMAIL ? [env.OWNER_EMAIL] : undefined,
        reply_to: env.OWNER_EMAIL || undefined,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      return json(
        { error: "We found options but couldn't email them. Please try again." },
        502
      );
    }
  } catch {
    return json(
      { error: "We found options but couldn't email them. Please try again." },
      502
    );
  }

  return json({ ok: true, count: options.length });
}

function fmt(n) {
  return n.toLocaleString("en-US");
}

function renderEmail(d) {
  const accent = "#caa24a";
  const ink = "#0b1d2a";

  const intro =
    d.options.length > 0
      ? `Here ${d.options.length === 1 ? "is an option" : "are some options"} you can book with your <strong>${fmt(d.balance)} ${d.programName}</strong> points.`
      : `We searched <strong>${d.programName}</strong> for ${d.origin} → ${d.destination} but didn't find award space within your ${fmt(d.balance)}-point budget for those dates. Award seats open up constantly — it's worth trying a wider date range or a nearby airport.`;

  let rows = "";
  for (const o of d.shown) {
    rows += `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e3eef5;">${o.date}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e3eef5;">${o.origin} → ${o.destination}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e3eef5;">${o.cabin}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e3eef5;">${o.airlines || "—"}${o.direct ? "" : " <span style=\"color:#888;\">(connection)</span>"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e3eef5;text-align:right;white-space:nowrap;"><strong>${fmt(o.miles)}</strong> + ${o.currency} ${fmt(o.taxes)}</td>
      </tr>`;
  }

  const table =
    d.options.length > 0
      ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">
           <thead>
             <tr style="text-align:left;color:#5d7a8c;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">
               <th style="padding:8px 12px;">Date</th>
               <th style="padding:8px 12px;">Route</th>
               <th style="padding:8px 12px;">Cabin</th>
               <th style="padding:8px 12px;">Airline</th>
               <th style="padding:8px 12px;text-align:right;">Cost</th>
             </tr>
           </thead>
           <tbody>${rows}</tbody>
         </table>
         ${d.options.length > d.shown.length ? `<p style="font-size:13px;color:#5d7a8c;">Showing the ${d.shown.length} lowest-cost of ${d.options.length} matches.</p>` : ""}`
      : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#eef5fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ink};">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:24px;margin:0 0 4px;">myjetset<span style="color:${accent};">.</span>life</h1>
    <p style="color:#5d7a8c;font-size:13px;margin:0 0 24px;">Award flight options</p>

    <p style="font-size:15px;line-height:1.5;">${intro}</p>

    ${table}

    <div style="margin-top:24px;padding:14px 16px;background:#fff;border-radius:10px;font-size:13px;color:#5d7a8c;line-height:1.5;">
      <strong style="color:${ink};">Your search</strong><br/>
      ${d.programName} · ${fmt(d.balance)} points · ${d.origin} → ${d.destination}<br/>
      Departing ${d.startDate} to ${d.endDate} · ${d.cabin === "any" ? "Any cabin" : d.cabin}
    </div>

    <p style="font-size:13px;color:#5d7a8c;line-height:1.5;margin-top:24px;">
      Costs and taxes are estimates from cached award data (via seats.aero) and can
      change before you book. Reply to this email if you'd like help.
    </p>
    <p style="font-size:12px;color:#9bb0bd;margin-top:20px;">© myjetset.life</p>
  </div>
</body>
</html>`;
}
