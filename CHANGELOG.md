# Changelog

How myjetset.life has evolved, newest first. Each entry is a day's worth of
changes with the commits behind it. Dates are when the work shipped, not when
it was planned.

## 2026-09-10 — Globe, new nav, full Astro rebuild goes live

**Photos from my own library** (`0a5cb97`)
- Went through my Photos library for the site instead of relying on the five
  shots from my Fora profile. Every favorite (629) plus the top-scored
  non-favorites (1,795) was matched to a globe pin by GPS, ranked by Apple's
  own aesthetic score, and 305 of them reviewed by hand across 24 places.
- 43 photos made the cut and live in `public/images/`: 34 scenery with no one in
  frame, 9 of me. All web-sized to 1800 px with EXIF and location data stripped.
- New places with photos: Budapest, Abu Dhabi, Paris, Kyoto, Rotorua, El Tunco
  (a new coastal pin — the sunsets were 35 km from the San Salvador pin), Punta
  del Este, Leh, Singapore, Queenstown, Mexico City, Oʻahu, Hilo, Phuket,
  Hurghada and Reims — plus stronger shots for Antarctica, Doha, Rio, the Taj
  Mahal and Giza. The Antarctica iceberg is the best photo in the whole library.
- A "Website picks" album in Photos holds the 43 originals.
- Next: wire them into `src/data/places.js` so those pins turn into gold story
  pins, and consider the iceberg as the home-page hero.

**The globe** (`696f465`, `1a4336a`, `f50b95d`, `f9d5882`)
- New `/globe` page: a 3D globe (globe.gl / three.js) in the brand emerald with a
  gold atmosphere. Every place I've been is on it: 166 places, 58 countries, 7
  continents, loaded from my visited-cities list. Airport-only layovers don't count.
- Three kinds of marker: small dark dots for places I've been, gold stars for
  places with photos or a story, cream stars for places that shaped me (New York
  home base, Ewa Beach where I grew up, and everywhere I've lived: Regina, DC,
  Austin, Melbourne, Sydney). Visited countries light up gold. Flight arcs fan
  out from home to every story pin.
- Tap a pin for a card with photos, a blurb, and a "Read the story" link when a
  blog post exists. The camera zooms into the region. Tap the globe to close.
- "Spin the globe" does two turns and lands on a random story pin.
- Header stats count up from zero on load.
- A by-continent index below the globe doubles as the no-JavaScript fallback and
  the future blog index.
- Six globe styles, switchable with one line (`GLOBE_STYLE` in
  `src/data/places.js`) or previewed with `?style=` on the URL: `hex` (default),
  `solid`, `outline`, `dark`, `night`, and `sun`, a live day/night globe whose
  terminator follows the real sun by UTC time.
- The globe page has its own link-preview card, rendered from the globe itself.
- All places live in one editable file, `src/data/places.js`.

**Navigation and brand** (`f9d5882`)
- Menu is now Home · About · Globe · Travel reports. Award search, Plan a trip
  and Book a call are buttons on the right.
- The star mark gained a single tilted orbit with a bright spark and faint tail
  travelling around it, echoing the globe's flight arcs.
- `/travel-reports` placeholder with newsletter signup until the blog exists.

**Platform** (`5e9f88d`, `9da1d22`, `bf755e8`)
- Site rebuilt on Astro (static output) with shared layout, header and footer.
  Pages: home, about, inquiry (new "Plan a trip" form that emails me and confirms
  to the traveler), award search carried over unchanged, plus a branded 404.
- The apex domain myjetset.life moved from GitHub Pages to Cloudflare Pages, so
  the whole site including the search backend now lives in one place.
- Site constants (booking link, Fora profile, email) centralised in
  `src/lib/site.js`.

## 2026-07-03 to 07-04 — Award search restyle and smarter inputs

(`012e511`, `d69f6cc`, `0d57a68`, `638a131`, `5d9964d`)
- Search page restyled to the My Jet Set Life design system: emerald and gold,
  Cormorant Garamond and Hanken Grotesk, the gold star mark, inset hairline frames.
- Airline programs became a searchable dropdown (still max three).
- Transferable credit-card points (Amex, Chase, Capital One, Citi, Bilt) added as
  a search source, expanded to their partner airlines.
- Points budget became a dual-range slider.
- Submitting routes to a "we're working on your trip" confirmation page.

## 2026-05-23 — Award search grows up

(`408b0ab` through `736cc0f`)
- Instant inline airport-code validation.
- Search up to three mileage programs at once.
- Points budget, multi-cabin selection, booking-help checkboxes.
- "Surprise me": search a curated list of 136 destinations from your origin.
- Traveler's name collected and used in the email.
- Results email rebuilt as per-option cards with flights, times and layovers,
  airline logos, top 10 plus a cabin-grouped teaser of the rest.
- seats.aero attribution removed from user-facing surfaces.

## 2026-05-20 to 05-21 — Award search MVP

(`f4531e3` through `fe93c3a`)
- First version of the award flight search: a form for points balance, program,
  dates and route; a Cloudflare Pages Function queries seats.aero and emails the
  options via Resend.
- Dates constrained to the future, in order, within four weeks; then replaced
  with a flexible single-date picker (±1/3/7/14 days).
- Airport codes validated against the real IATA list.
- Homepage got a link to the search tool.

## 2026-05-19 — Coming soon

(`e6a70d7` through `61f8d39`)
- Static "coming soon" page on GitHub Pages with the custom domain and a
  Buttondown newsletter signup.
