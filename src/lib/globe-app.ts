// The interactive globe. Deliberately a separate module: globe.gl + three are
// ~2 MB uncompressed, so the page imports this on demand (see globe.astro)
// instead of shipping it with the HTML.
import Globe from "globe.gl";
import { ShaderMaterial, TextureLoader, SRGBColorSpace, Vector3 } from "three";
import { PLACES, markerType, GLOBE_STYLE } from "../data/places.js";

export function initGlobe() {

  const GOLD = "#E3C36E";
  const CREAM = "#F1EEE4";
  const PINE = "#0E3329";

  const stage = document.getElementById("globe-stage")!;
  const el = document.getElementById("globe")!;
  const spinBtn = document.getElementById("spin") as HTMLButtonElement;
  const hint = document.getElementById("hint")!;
  const panel = document.getElementById("panel")!;
  const panelClose = document.getElementById("panel-close")!;
  const strip = document.getElementById("strip")!;
  const stripHint = document.getElementById("strip-hint")!;
  const kicker = document.getElementById("place-kicker")!;
  const nameEl = document.getElementById("place-name")!;
  const blurb = document.getElementById("place-blurb")!;
  const blogLink = document.getElementById("place-blog") as HTMLAnchorElement;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const IDLE_SPIN = !reduceMotion;
  const home = PLACES.find((p) => p.home) ?? PLACES[0];
  const stories = PLACES.filter((p) => markerType(p) === "story");
  // Phones: fewer DOM markers and static arcs — 159 animated stars + arcs is too much for a handset.
  const lite = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const special = PLACES.filter((p) => markerType(p) !== "visit" && markerType(p) !== "story");
  const starStories = lite ? [...stories].sort((a, b) => (b.photos?.length || 0) - (a.photos?.length || 0)).slice(0, 40) : stories;
  const starIds = new Set(starStories.map((p) => p.id));
  const pinned = [...special, ...starStories]; // gold + cream stars (DOM markers)
  const visits = PLACES.filter((p) => markerType(p) === "visit");  // dots, drawn in WebGL
  const dotStories = stories.filter((p) => !starIds.has(p.id));   // on phones: story pins drawn as gold dots
  // Each dot is two tiny discs: a rim underneath and a dark core on top.
  const dotData = [
    ...visits.flatMap((p) => [
      { place: p, lat: p.lat, lng: p.lng, r: 0.3, alt: 0.006, color: "rgba(241,238,228,.8)" },
      { place: p, lat: p.lat, lng: p.lng, r: 0.19, alt: 0.008, color: PINE },
    ]),
    ...dotStories.flatMap((p) => [
      { place: p, lat: p.lat, lng: p.lng, r: 0.42, alt: 0.007, color: "rgba(227,195,110,.95)" },
      { place: p, lat: p.lat, lng: p.lng, r: 0.2, alt: 0.009, color: PINE },
    ]),
  ];
  const visited = new Set(PLACES.map((p) => p.country));
  // Only a handful of flight arcs at once (all 159 was a cobweb). A random subset,
  // each with its own dash offset so they leave NYC at different moments.
  const ARC_COUNT = lite ? 8 : 14;
  const pickArcs = () =>
    [...stories]
      .sort(() => Math.random() - 0.5)
      .slice(0, ARC_COUNT)
      .map((p) => ({ startLat: home.lat, startLng: home.lng, endLat: p.lat, endLng: p.lng, gap: Math.random() }));
  const byId = new Map(PLACES.map((p) => [p.id, p]));

  let current: any = null;
  let spinning = false;
  let spinFlick = false; // true only during the free momentum spin

  // ── Globe ────────────────────────────────────────────────────────────────
  const STYLES = ["hex", "solid", "outline", "dark", "night", "sun"];
  const param = new URLSearchParams(location.search).get("style") || "";
  const style = STYLES.includes(param) ? param : STYLES.includes(GLOBE_STYLE) ? GLOBE_STYLE : "hex";

  const world = Globe({ animateIn: IDLE_SPIN && !reduceMotion })(el)
    .backgroundColor("rgba(0,0,0,0)")
    .showAtmosphere(true)
    .atmosphereColor(GOLD)
    .atmosphereAltitude(0.16)
    .showGraticules(false)
    // Countries as a stylised dot pattern; visited ones glow gold.
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.4)
    .hexPolygonUseDots(true)
    .hexPolygonAltitude(0.004)
    .hexPolygonColor((f: any) => (visited.has(f.properties.iso) ? "rgba(227,195,110,.95)" : "rgba(241,238,228,.42)"))
    // A rotating handful of flight arcs, staggered departures.
    .arcsData(pickArcs())
    .arcColor(() => ["rgba(227,195,110,.05)", "rgba(227,195,110,.7)"])
    .arcAltitudeAutoScale(0.35)
    .arcStroke(0.32)
    .arcDashLength(0.4)
    .arcDashGap(0.9)
    .arcDashInitialGap((d: any) => d.gap)
    .arcDashAnimateTime(reduceMotion || lite || !IDLE_SPIN ? 0 : 4200)
    // "Been there" dots live in the WebGL scene so they stay locked to the globe.
    .pointsData(dotData)
    .pointLat("lat").pointLng("lng")
    .pointAltitude("alt")
    .pointRadius("r")
    .pointColor("color")
    .pointResolution(10)
    .pointsMerge(false)
    .pointLabel((d: any) => `<span class="dot-tip">${d.place.name}</span>`)
    .onPointHover((d: any) => { el.style.cursor = d ? "pointer" : "grab"; })
    .onPointClick((d: any) => goTo(d.place, true))
    // Gold + cream stars as DOM markers so they're crisp and can pulse.
    .htmlElementsData(pinned)
    .htmlLat("lat")
    .htmlLng("lng")
    .htmlAltitude(0.01)
    // Let the renderer position visible pins and hide those behind the globe.
    // Checking their transform here hides new pins before their first render.
    .htmlElement((p: any) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pin pin--${markerType(p)}` + (current?.id === p.id ? " is-active" : "");
      b.dataset.id = p.id;
      b.title = p.name;
      b.setAttribute("aria-label", p.name);
      b.innerHTML =
        `<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 2 L17.4 12.6 L28 15 L17.4 17.4 L15 28 L12.6 17.4 L2 15 L12.6 12.6 Z"/></svg>` +
        `<span class="pin__label">${p.name}</span>`;
      b.addEventListener("click", (e) => { e.stopPropagation(); goTo(p, true); });
      return b;
    });

  // Phones render at 3× density; 1.5× is indistinguishable on the globe and far cheaper.
  world.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));

  if (style === "sun") {
    // Live day/night. World-space normals vs. the sub-solar direction decide
    // how much of the day photo vs. the night lights each pixel shows.
    const loader = new TextureLoader();
    Promise.all([loader.loadAsync("/globe/earth-day.jpg"), loader.loadAsync("/globe/earth-night.jpg")]).then(([day, night]) => {
      day.colorSpace = SRGBColorSpace; night.colorSpace = SRGBColorSpace;
      const mat = new ShaderMaterial({
        uniforms: { dayTexture: { value: day }, nightTexture: { value: night }, sunDir: { value: new Vector3(1, 0, 0) } },
        vertexShader: `
          varying vec3 vNormal; varying vec2 vUv;
          void main() {
            vUv = uv;
            vNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform sampler2D dayTexture; uniform sampler2D nightTexture; uniform vec3 sunDir;
          varying vec3 vNormal; varying vec2 vUv;
          void main() {
            float i = dot(normalize(vNormal), normalize(sunDir));
            vec3 day = texture2D(dayTexture, vUv).rgb * (0.6 + 0.4 * max(i, 0.0));
            vec3 night = texture2D(nightTexture, vUv).rgb;
            float f = smoothstep(-0.12, 0.12, i);   // soft terminator
            gl_FragColor = vec4(mix(night, day, f), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      });
      world.globeMaterial(mat);
      const aim = () => {
        const { lat, lng } = subsolarPoint(new Date());
        const c = world.getCoords(lat, lng, 0);
        mat.uniforms.sunDir.value.set(c.x, c.y, c.z).normalize();
      };
      aim();
      setInterval(aim, 60_000);
    });
  } else if (style === "dark" || style === "night") {
    // Photo textures. globe.gl swaps the material in when the image loads,
    // so the emerald lift is applied in onGlobeReady, not up front.
    world.globeImageUrl(style === "dark" ? "/globe/earth-dark.jpg" : "/globe/earth-night.jpg");
    if (style === "dark") world.bumpImageUrl("/globe/earth-topology.png");
    world.onGlobeReady(() => {
      const m: any = world.globeMaterial();
      m.emissive.set(style === "dark" ? "#16463A" : PINE);
      m.emissiveIntensity = style === "dark" ? 0.55 : 0.35;
      if (style === "dark") m.bumpScale = 14;
    });
  } else {
    // Deep emerald sphere with a faint gold rim light.
    const mat: any = world.globeMaterial();
    mat.color.set(PINE);
    mat.emissive.set("#0b2a21");
    mat.emissiveIntensity = 0.35;
    mat.shininess = 6;
  }

  const isVisited = (f: any) => visited.has(f.properties.iso);
  fetch("/globe/countries.geojson")
    .then((r) => r.json())
    .then((geo) => {
      if (style === "hex") { world.hexPolygonsData(geo.features); return; }
      if (style === "dark" || style === "night" || style === "sun") {
        // Only the visited countries, as gold dots over the photo.
        world.hexPolygonsData(geo.features.filter(isVisited))
             .hexPolygonMargin(style === "night" ? 0.55 : 0.4)
             .hexPolygonAltitude(0.006)
             .hexPolygonColor(() => (style === "dark" ? "rgba(227,195,110,.95)" : "rgba(227,195,110,.8)"));
        return;
      }
      world.polygonsData(geo.features).polygonAltitude(0.004).polygonSideColor(() => "rgba(0,0,0,0)");
      if (style === "solid") {
        world.polygonCapColor((f: any) => (isVisited(f) ? "rgba(227,195,110,.95)" : "rgba(241,238,228,.28)"))
             .polygonStrokeColor(() => "rgba(14,51,41,.8)");
      } else {
        world.polygonCapColor((f: any) => (isVisited(f) ? "rgba(227,195,110,.85)" : "rgba(0,0,0,0)"))
             .polygonStrokeColor((f: any) => (isVisited(f) ? GOLD : "rgba(241,238,228,.55)"));
      }
    })
    .catch(() => { /* the globe still works without country dots */ });

  const controls: any = world.controls();
  controls.autoRotate = IDLE_SPIN;
  controls.autoRotateSpeed = 0.9;
  controls.enableDamping = IDLE_SPIN;
  controls.enablePan = false;
  controls.minDistance = 140;
  controls.maxDistance = 520;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
    // Grabbing the globe mid-flick stops it dead, like a hand on a spinning globe.
    if (spinFlick) { spinFlick = false; spinning = false; spinBtn.disabled = false; hint.textContent = "Drag to rotate · scroll to zoom"; }
  });

  // Narrow (phone) canvases need the camera further back to fit the sphere,
  // and the landed pin nudged up so the bottom-sheet panel doesn't cover it.
  const narrow = () => el.clientWidth < el.clientHeight;
  const fit = (alt: number) => alt * (narrow() ? Math.min(1.9, el.clientHeight / el.clientWidth) : 1);
  // Landing = a close-up of the region, with the pin kept clear of the panel:
  // on desktop the panel sits right, so the camera looks a little east of the
  // pin (pushing it left); on phones the panel is a bottom sheet, so the
  // camera looks a little south (pushing the pin up).
  const landView = (p: any) => narrow()
    ? { lat: p.lat - 22, lng: p.lng, altitude: 1.2 }
    : { lat: p.lat, lng: p.lng + 16, altitude: 1.05 };

  world.pointOfView({ lat: home.lat + 8, lng: home.lng + 10, altitude: fit(2.1) }, 0);

  // Keep the canvas sized to its container.
  const size = () => world.width(el.clientWidth).height(el.clientHeight);
  size();
  new ResizeObserver(size).observe(el);

  // Pause rendering while the globe is off-screen (saves battery on the list).
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; e.isIntersecting ? world.resumeAnimation() : world.pauseAnimation(); }, { threshold: 0.05 }).observe(el);
  // Swap the visible routes every several seconds so they vary over time.
  if (!reduceMotion && IDLE_SPIN) setInterval(() => { if (onScreen && !document.hidden) world.arcsData(pickArcs()); }, 7000);

  // ── Place panel ──────────────────────────────────────────────────────────
  function showPanel(p: any) {
    current = p;
    document.querySelectorAll(".pin.is-active").forEach((n) => n.classList.remove("is-active"));
    document.querySelector(`.pin[data-id="${CSS.escape(p.id)}"]`)?.classList.add("is-active");
    // Dots have no DOM marker: highlight the active one in the scene instead.
    world.pointColor((d: any) => (d.place.id === p.id ? GOLD : d.color));

    kicker.textContent = p.place + (p.when ? ` · ${p.when}` : "");
    nameEl.textContent = p.name;
    blurb.textContent = p.blurb || "";
    if (p.blog) { blogLink.href = p.blog; blogLink.hidden = false; } else { blogLink.hidden = true; }

    // Photos as a filmstrip: fixed height, each at its natural width, swipe to browse. Portraits stay whole.
    strip.innerHTML = "";
    strip.scrollLeft = 0;
    if (p.photos?.length) {
      strip.hidden = false;
      p.photos.forEach((ph: any, i: number) => {
        const f = document.createElement("figure");
        f.className = "slide";
        f.innerHTML = `<img src="${ph.src}" alt="${String(ph.alt || "").replace(/"/g, "")}" loading="${i < 2 ? "eager" : "lazy"}" />`;
        strip.appendChild(f);
      });
      stripHint.hidden = p.photos.length < 2;
    } else {
      strip.hidden = true;
      stripHint.hidden = true;
    }
    panel.hidden = false;
    stage.classList.add("has-panel");
  }


  function hidePanel() {
    panel.hidden = true;
    stage.classList.remove("has-panel");
    document.querySelectorAll(".pin.is-active").forEach((n) => n.classList.remove("is-active"));
    current = null;
    world.pointColor("color");
    controls.autoRotate = IDLE_SPIN;
  }

  // Fly the camera to a place and open its panel.
  function goTo(p: any, fromPin = false) {
    controls.autoRotate = false;
    const ms = reduceMotion ? 0 : fromPin ? 900 : 0;
    world.pointOfView(landView(p), ms);
    setTimeout(() => showPanel(p), ms);
  }

  /** Where the sun is directly overhead right now (declination + equation of time). */
  function subsolarPoint(d: Date) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const doy = (d.getTime() - start) / 86_400_000;
    const rad = Math.PI / 180;
    const decl = -23.44 * Math.cos(rad * (360 / 365) * (doy + 10));
    const b = rad * (360 / 365) * (doy - 81);
    const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b); // minutes
    const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    let lng = 15 * (12 - (utcHours + eot / 60));
    lng = ((lng + 540) % 360) - 180;
    return { lat: decl, lng };
  }

  // ── Spin the globe ───────────────────────────────────────────────────────
  function spin() {
    if (spinning || !stories.length) return;
    spinning = true;
    spinBtn.disabled = true;
    hidePanel();
    controls.autoRotate = false;
    if (!reduceMotion) world.arcsData(pickArcs());
    hint.textContent = "Spinning…";

    if (reduceMotion) {
      const pick = stories[Math.floor(Math.random() * stories.length)];
      world.pointOfView(landView(pick), 0);
      land(pick);
      return;
    }

    // A globe on a table: pull back to the whole sphere, flick it hard, then let
    // friction bleed the momentum off over a few turns until it rolls to a stop.
    const start = world.pointOfView();
    const spinLat = Math.max(-28, Math.min(28, start.lat));
    const spinAlt = fit(2.2);
    world.pointOfView({ lat: spinLat, lng: start.lng, altitude: spinAlt }, 260);

    setTimeout(() => {
      let lng = start.lng;
      let vel = 780 + Math.random() * 340;             // degrees/second — the flick
      const k = 1.15 + Math.random() * 0.35;           // friction rate (per second)
      let last = performance.now();
      spinFlick = true;
      // Time-based so the feel is identical whatever the frame rate (the globe
      // renders well under 60fps). ~2.5-3.5 turns, rolling to a stop in ~4s.
      const step = (now: number) => {
        if (!spinFlick) return;                        // user grabbed it → stop
        const dt = Math.min(0.08, (now - last) / 1000); last = now;
        lng += vel * dt;
        vel *= Math.exp(-k * dt);
        world.pointOfView({ lat: spinLat, lng, altitude: spinAlt }, 0);
        if (vel < 12) { spinFlick = false; settle(lng, spinLat); return; }
        requestAnimationFrame(step);
      };
      requestAnimationFrame((t) => { last = t; step(t); });
    }, 280);
  }

  // Roll to a stop on the story pin nearest the front, then dive in and open it.
  function settle(lng: number, lat: number) {
    const norm = (a: number) => ((a % 360) + 360) % 360;
    const front = norm(lng);
    let best = stories[0], bd = Infinity;
    for (const p of stories) {
      const dl = Math.abs(((norm(p.lng) - front + 540) % 360) - 180); // 0..180 lng gap
      const d = dl + Math.abs(p.lat - lat) * 0.7;
      if (d < bd) { bd = d; best = p; }
    }
    const cur = world.pointOfView();
    const t = landView(best);
    const delta = ((t.lng - cur.lng + 540) % 360) - 180; // shortest way round, no backspin
    world.pointOfView({ lat: t.lat, lng: cur.lng + delta, altitude: t.altitude }, 700);
    setTimeout(() => land(best), 720);
  }

  function land(p: any) {
    world.pointOfView(landView(p), 0);
    showPanel(p);
    spinning = false;
    spinBtn.disabled = false;
    hint.textContent = "Drag to rotate · scroll to zoom";
  }


  panelClose.addEventListener("click", hidePanel);
  // A tap on the globe (not a drag) or the space around it closes the card.
  world.onGlobeClick(() => { if (!panel.hidden && !spinning) hidePanel(); });
  stage.addEventListener("click", (e) => {
    if (panel.hidden || spinning) return;
    const t = e.target as HTMLElement;
    if (panel.contains(t) || t.closest(".spin-btn") || t.closest(".pin")) return;
    hidePanel();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) hidePanel(); });

  return {
    spin,
    /** Fly to a place by id (used by the list below the globe). */
    goTo(id: string) { const p = byId.get(id); if (p) goTo(p, true); },
  };
}
