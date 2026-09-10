// ── Where I've been ──────────────────────────────────────────────────────────
// This one file drives the /globe page. Every entry becomes a marker, its
// country is highlighted, and "Spin the globe" picks from the places that
// have something to show.
//
// Three kinds of marker, decided per entry:
//   • dark dot   — somewhere I've been. Just name + coordinates; use `visit()`.
//   • gold pin   — has content: photos and/or a blog link. Spin-the-globe
//                  picks from these.
//   • cream pin  — places that matter to me (home base, where I grew up).
//                  Set `type: "special"`.
// The kind is derived automatically (photos/blog → gold, otherwise dot) unless
// `type` is set explicitly. Set `home: true` on exactly one entry: the flight
// arcs fan out from it.
//
// To add a place: lat/lng from Google Maps (right-click → copy coordinates),
// the ISO-3 country code (EGY, FRA, JPN…; ATA = Antarctica), photos dropped
// into public/images/, and optionally a blog post URL in `blog`. Leave `when`
// as "" to hide the date.

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** One-liner for a cream "lived here" pin. */
export const lived = (name, place, country, continent, lat, lng, blurb = "Lived here.") =>
  ({ ...visit(name, place, country, continent, lat, lng), type: "special", blurb });

/** One-liner for a plain "I've been here" dot. */
export const visit = (name, place, country, continent, lat, lng, when = "") =>
  ({ id: slug(name), name, place, country, continent, lat, lng, when, blurb: "", photos: [], blog: null });

export const PLACES = [
  {
    id: "nyc",
    home: true,
    name: "New York City",
    place: "New York, USA",
    country: "USA",
    continent: "North America",
    lat: 40.7128, lng: -74.006,
    when: "",
    blurb: "Home base, 2014–2020 and 2026 onward. Every trip on this globe starts and ends here.",
    photos: [],
    blog: null,
  },
  {
    id: "ewa-beach",
    type: "special",
    name: "Ewa Beach",
    place: "Oʻahu, Hawaiʻi",
    country: "USA",
    continent: "North America",
    lat: 21.3156, lng: -158.0072,
    when: "",
    blurb: "Where I grew up. The reason I'll always say yes to a beach and a plate lunch.",
    photos: [],
    blog: null,
  },
  {
    id: "giza",
    name: "Pyramids of Giza",
    place: "Giza, Egypt",
    country: "EGY",
    continent: "Africa",
    lat: 29.9792, lng: 31.1342,
    when: "",
    blurb: "Camel-back at the edge of the Giza plateau, with the Great Pyramid over one shoulder and Cairo over the other.",
    photos: [
      { src: "/images/travel-camel.jpg", alt: "Erickson on a camel at the Pyramids of Giza" },
    ],
    blog: null,
  },
  {
    id: "taj-mahal",
    name: "Taj Mahal",
    place: "Agra, India",
    country: "IND",
    continent: "Asia",
    lat: 27.1751, lng: 78.0421,
    when: "",
    blurb: "Sunrise at the Taj, before the crowds and the heat — worth every minute of the early alarm.",
    photos: [
      { src: "/images/travel-taj-mahal.jpg", alt: "Erickson in front of the Taj Mahal" },
    ],
    blog: null,
  },
  {
    id: "doha",
    name: "Doha",
    place: "Doha, Qatar",
    country: "QAT",
    continent: "Asia",
    lat: 25.2854, lng: 51.531,
    when: "",
    blurb: "The skyline at night, framed by the stone arches of the old souq. A layover that turned into a stay.",
    photos: [
      { src: "/images/travel-view.jpg", alt: "Doha skyline at night, framed by stone arches" },
    ],
    blog: null,
  },
  {
    id: "rio",
    name: "Sugarloaf Mountain",
    place: "Rio de Janeiro, Brazil",
    country: "BRA",
    continent: "South America",
    lat: -22.9492, lng: -43.1545,
    when: "",
    blurb: "Golden hour from the top of Sugarloaf — the whole bay, Christ the Redeemer, and the city going amber below.",
    photos: [
      { src: "/images/travel-sunset-mountains.jpg", alt: "Sunset over Rio de Janeiro from Sugarloaf Mountain" },
    ],
    blog: null,
  },
  {
    id: "antarctica",
    name: "Antarctica",
    place: "Antarctic Peninsula",
    country: "ATA",
    continent: "Antarctica",
    lat: -64.8, lng: -63.0,
    when: "",
    blurb: "The seventh continent. Ice, silence, and penguins who are entirely unbothered by you.",
    photos: [
      { src: "/images/travel-snow.jpg", alt: "Erickson in Antarctica" },
    ],
    blog: null,
  },

  // ── Everywhere I've lived: cream pins ────────────────────────────────────
  lived("Regina", "Regina, Saskatchewan, Canada", "CAN", "North America", 50.4452, -104.6189, "Lived here."),
  lived("Washington, DC", "Washington, DC, USA", "USA", "North America", 38.9072, -77.0369, "Georgetown, class of 2013."),
  lived("Austin", "Austin, Texas, USA", "USA", "North America", 30.2672, -97.7431, "Lived here."),
  lived("Melbourne", "Melbourne, Australia", "AUS", "Oceania", -37.8136, 144.9631, "Lived here, 2024–2025."),

  // ── Everywhere else: one line per place ──────────────────────────────────
  // Airport-only layovers don't count; every dot is a real visit.
  //     name                place                              ISO    continent         lat        lng
  // North America
  visit("Toronto",           "Toronto, Canada",                 "CAN", "North America",  43.6532,  -79.3832),
  visit("Vancouver",         "Vancouver, Canada",               "CAN", "North America",  49.2827, -123.1207),
  visit("Calgary",           "Calgary, Canada",                 "CAN", "North America",  51.0447, -114.0719),
  visit("Banff",             "Banff, Canada",                   "CAN", "North America",  51.1784, -115.5708),
  visit("Mexico City",       "Mexico City, Mexico",             "MEX", "North America",  19.4326,  -99.1332),
  visit("Oaxaca City",       "Oaxaca, Mexico",                  "MEX", "North America",  17.0732,  -96.7266),
  visit("Puerto Escondido",  "Puerto Escondido, Mexico",        "MEX", "North America",  15.8593,  -97.0729),
  visit("Cancún",            "Cancún & Riviera Maya, Mexico",   "MEX", "North America",  21.1619,  -86.8515),
  visit("Cabo San Lucas",    "Cabo San Lucas, Mexico",          "MEX", "North America",  22.8905, -109.9167),
  visit("Puerto Vallarta",   "Puerto Vallarta, Mexico",         "MEX", "North America",  20.6534, -105.2253),
  // Caribbean & Central America
  visit("Havana",            "Havana, Cuba",                    "CUB", "North America",  23.1136,  -82.3666),
  visit("Nassau",            "Nassau, Bahamas",                 "BHS", "North America",  25.0480,  -77.3554),
  visit("Guatemala City",    "Guatemala City, Guatemala",       "GTM", "North America",  14.6349,  -90.5069),
  visit("Antigua",           "Antigua, Guatemala",              "GTM", "North America",  14.5586,  -90.7295),
  visit("Lake Atitlán",      "Lake Atitlán, Guatemala",         "GTM", "North America",  14.7407,  -91.1583),
  visit("Tikal & Flores",    "Tikal, Guatemala",                "GTM", "North America",  16.9258,  -89.8922),
  visit("Managua",           "Managua, Nicaragua",              "NIC", "North America",  12.1150,  -86.2362),
  visit("Granada",           "Granada, Nicaragua",              "NIC", "North America",  11.9344,  -85.9560),
  visit("San Salvador",      "San Salvador, El Salvador",       "SLV", "North America",  13.6929,  -89.2182),
  visit("Santa Ana",         "Santa Ana, El Salvador",          "SLV", "North America",  13.9942,  -89.5597),
  visit("San Juan",          "San Juan, Puerto Rico",           "PRI", "North America",  18.4655,  -66.1057),
  // United States
  visit("Honolulu",          "Honolulu & Waikīkī, Hawaiʻi, USA","USA", "North America",  21.3099, -157.8581),
  visit("Waipahu",           "Waipahu, Hawaiʻi, USA",           "USA", "North America",  21.3867, -158.0092),
  visit("Hilo",              "Hilo, Hawaiʻi Island, USA",       "USA", "North America",  19.7241, -155.0868),
  visit("Kahului",           "Kahului, Maui, USA",              "USA", "North America",  20.8893, -156.4729),
  visit("Līhuʻe",            "Līhuʻe, Kauaʻi, USA",             "USA", "North America",  21.9811, -159.3711),
  visit("San Francisco",     "San Francisco, California, USA",  "USA", "North America",  37.7749, -122.4194),
  visit("Las Vegas",         "Las Vegas, Nevada, USA",          "USA", "North America",  36.1699, -115.1398),
  visit("Portland",          "Portland, Oregon, USA",           "USA", "North America",  45.5152, -122.6784),
  visit("Seattle",           "Seattle, Washington, USA",        "USA", "North America",  47.6062, -122.3321),
  visit("Phoenix",           "Phoenix, Arizona, USA",           "USA", "North America",  33.4484, -112.0740),
  visit("Oklahoma City",     "Oklahoma City, Oklahoma, USA",    "USA", "North America",  35.4676,  -97.5164),
  visit("Miami",             "Miami, Florida, USA",             "USA", "North America",  25.7617,  -80.1918),
  visit("Key West",          "Key West, Florida, USA",          "USA", "North America",  24.5551,  -81.7800),
  visit("Boston",            "Boston, Massachusetts, USA",      "USA", "North America",  42.3601,  -71.0589),
  visit("Providence",        "Providence, Rhode Island, USA",   "USA", "North America",  41.8240,  -71.4128),
  visit("Philadelphia",      "Philadelphia, Pennsylvania, USA", "USA", "North America",  39.9526,  -75.1652),
  visit("Jersey City",       "Jersey City & Hoboken, New Jersey, USA", "USA", "North America", 40.7178, -74.0431),
  visit("Atlantic City",     "Atlantic City, New Jersey, USA",  "USA", "North America",  39.3643,  -74.4229),
  visit("New Haven",         "New Haven, Connecticut, USA",     "USA", "North America",  41.3083,  -72.9279),
  visit("Atlanta",           "Atlanta, Georgia, USA",           "USA", "North America",  33.7490,  -84.3880),
  visit("Birmingham",        "Birmingham, Alabama, USA",        "USA", "North America",  33.5186,  -86.8104),
  visit("Baltimore",         "Baltimore, Maryland, USA",        "USA", "North America",  39.2904,  -76.6122),
  visit("Virginia Beach",    "Virginia Beach, Virginia, USA",   "USA", "North America",  36.8529,  -75.9780),
  // South America
  visit("Bogotá",            "Bogotá, Colombia",                "COL", "South America",   4.7110,  -74.0721),
  visit("Medellín",          "Medellín, Colombia",              "COL", "South America",   6.2476,  -75.5658),
  visit("Cartagena",         "Cartagena, Colombia",             "COL", "South America",  10.3910,  -75.4794),
  visit("Quito",             "Quito, Ecuador",                  "ECU", "South America",  -0.1807,  -78.4678),
  visit("Guayaquil",         "Guayaquil, Ecuador",              "ECU", "South America",  -2.1710,  -79.9224),
  visit("Cuenca",            "Cuenca, Ecuador",                 "ECU", "South America",  -2.9001,  -79.0059),
  visit("São Paulo",         "São Paulo, Brazil",               "BRA", "South America", -23.5505,  -46.6333),
  visit("Iguaçu Falls",      "Iguaçu Falls, Brazil",            "BRA", "South America", -25.6953,  -54.4367),
  visit("Ilha Grande",       "Ilha Grande, Brazil",             "BRA", "South America", -23.1487,  -44.2300),
  visit("Lima",              "Lima, Peru",                      "PER", "South America", -12.0464,  -77.0428),
  visit("La Paz",            "La Paz, Bolivia",                 "BOL", "South America", -16.4897,  -68.1193),
  visit("Uyuni salt flats",  "Salar de Uyuni, Bolivia",         "BOL", "South America", -20.1338,  -67.4891),
  visit("Copacabana",        "Copacabana & Lake Titicaca, Bolivia", "BOL", "South America", -16.1667, -69.0861),
  visit("Santiago",          "Santiago, Chile",                 "CHL", "South America", -33.4489,  -70.6693),
  visit("Valparaíso",        "Valparaíso, Chile",               "CHL", "South America", -33.0472,  -71.6127),
  visit("Atacama",           "San Pedro de Atacama, Chile",     "CHL", "South America", -22.9087,  -68.1997),
  visit("Buenos Aires",      "Buenos Aires, Argentina",         "ARG", "South America", -34.6037,  -58.3816),
  visit("Ushuaia",           "Ushuaia, Argentina",              "ARG", "South America", -54.8019,  -68.3030),
  visit("Montevideo",        "Montevideo, Uruguay",             "URY", "South America", -34.9011,  -56.1645),
  visit("Punta del Este",    "Punta del Este, Uruguay",         "URY", "South America", -34.9667,  -54.9500),
  // Europe
  visit("Reykjavík",         "Reykjavík, Iceland",              "ISL", "Europe",         64.1466,  -21.9426),
  visit("Oslo",              "Oslo, Norway",                    "NOR", "Europe",         59.9139,   10.7522),
  visit("London",            "London, United Kingdom",          "GBR", "Europe",         51.5074,   -0.1278),
  visit("Dublin",            "Dublin, Ireland",                 "IRL", "Europe",         53.3498,   -6.2603),
  visit("Paris",             "Paris, France",                   "FRA", "Europe",         48.8566,    2.3522),
  visit("Reims",             "Reims, Champagne, France",        "FRA", "Europe",         49.2583,    4.0317),
  visit("Amsterdam",         "Amsterdam, Netherlands",          "NLD", "Europe",         52.3676,    4.9041),
  visit("Berlin",            "Berlin, Germany",                 "DEU", "Europe",         52.5200,   13.4050),
  visit("Munich",            "Munich, Germany",                 "DEU", "Europe",         48.1351,   11.5820),
  visit("Frankfurt",         "Frankfurt, Germany",              "DEU", "Europe",         50.1109,    8.6821),
  visit("Düsseldorf",        "Düsseldorf, Germany",             "DEU", "Europe",         51.2277,    6.7735),
  visit("Copenhagen",        "Copenhagen, Denmark",             "DNK", "Europe",         55.6761,   12.5683, "June 2026"),
  visit("Helsinki",          "Helsinki, Finland",               "FIN", "Europe",         60.1699,   24.9384),
  visit("Zurich",            "Zurich, Switzerland",             "CHE", "Europe",         47.3769,    8.5417),
  visit("Vienna",            "Vienna, Austria",                 "AUT", "Europe",         48.2082,   16.3738),
  visit("Prague",            "Prague, Czech Republic",          "CZE", "Europe",         50.0755,   14.4378),
  visit("Budapest",          "Budapest, Hungary",               "HUN", "Europe",         47.4979,   19.0402),
  visit("Rome",              "Rome, Italy",                     "ITA", "Europe",         41.9028,   12.4964),
  visit("Milan",             "Milan, Italy",                    "ITA", "Europe",         45.4642,    9.1900),
  visit("Barcelona",         "Barcelona, Spain",                "ESP", "Europe",         41.3874,    2.1686),
  visit("Madrid",            "Madrid, Spain",                   "ESP", "Europe",         40.4168,   -3.7038),
  visit("Porto",             "Porto, Portugal",                 "PRT", "Europe",         41.1579,   -8.6291),
  visit("Vila Nova de Gaia", "Vila Nova de Gaia, Portugal",     "PRT", "Europe",         41.1239,   -8.6118),
  visit("Pinhão",            "Pinhão, Douro Valley, Portugal",  "PRT", "Europe",         41.1893,   -7.5453, "June 2026"),
  visit("Istanbul",          "Istanbul, Turkey",                "TUR", "Europe",         41.0082,   28.9784),
  // Middle East & Africa
  visit("Dubai",             "Dubai, UAE",                      "ARE", "Asia",           25.2048,   55.2708),
  visit("Abu Dhabi",         "Abu Dhabi, UAE",                  "ARE", "Asia",           24.4539,   54.3773),
  visit("Kuwait City",       "Kuwait City, Kuwait",             "KWT", "Asia",           29.3759,   47.9774),
  visit("Cairo",             "Cairo, Egypt",                    "EGY", "Africa",         30.0444,   31.2357),
  visit("Hurghada",          "Hurghada, Egypt",                 "EGY", "Africa",         27.2579,   33.8116),
  visit("Marrakech",         "Marrakech, Morocco",              "MAR", "Africa",         31.6295,   -7.9811),
  visit("Casablanca",        "Casablanca, Morocco",             "MAR", "Africa",         33.5731,   -7.5898),
  // Asia
  visit("Tokyo",             "Tokyo, Japan",                    "JPN", "Asia",           35.6762,  139.6503),
  visit("Kyoto",             "Kyoto, Japan",                    "JPN", "Asia",           35.0116,  135.7681),
  visit("Osaka",             "Osaka, Japan",                    "JPN", "Asia",           34.6937,  135.5023),
  visit("Kamakura",          "Kamakura, Japan",                 "JPN", "Asia",           35.3192,  139.5467),
  visit("Sapporo",           "Sapporo, Hokkaido, Japan",        "JPN", "Asia",           43.0618,  141.3545),
  visit("Otaru",             "Otaru, Hokkaido, Japan",          "JPN", "Asia",           43.1907,  140.9947),
  visit("Iwanai",            "Iwanai, Hokkaido, Japan",         "JPN", "Asia",           42.9797,  140.5094),
  visit("Niseko",            "Niseko, Hokkaido, Japan",         "JPN", "Asia",           42.8048,  140.6874),
  visit("Seoul",             "Seoul, South Korea",              "KOR", "Asia",           37.5665,  126.9780),
  visit("Beijing",           "Beijing, China",                  "CHN", "Asia",           39.9042,  116.4074),
  visit("Shanghai",          "Shanghai, China",                 "CHN", "Asia",           31.2304,  121.4737),
  visit("Baojing",           "Baojing, Hunan, China",           "CHN", "Asia",           28.6997,  109.6604),
  visit("Hong Kong",         "Hong Kong",                       "HKG", "Asia",           22.3193,  114.1694),
  visit("Manila",            "Manila, Philippines",             "PHL", "Asia",           14.5995,  120.9842),
  visit("Cebu",              "Cebu, Philippines",               "PHL", "Asia",           10.3157,  123.8854),
  visit("Baguio",            "Baguio, Philippines",             "PHL", "Asia",           16.4023,  120.5960),
  visit("Hanoi",             "Hanoi, Vietnam",                  "VNM", "Asia",           21.0278,  105.8342),
  visit("Ho Chi Minh City",  "Ho Chi Minh City, Vietnam",       "VNM", "Asia",           10.8231,  106.6297),
  visit("Da Nang & Hoi An",  "Da Nang, Vietnam",                "VNM", "Asia",           16.0544,  108.2022),
  visit("Ha Long Bay",       "Ha Long Bay, Vietnam",            "VNM", "Asia",           20.9101,  107.1839),
  visit("Bangkok",           "Bangkok, Thailand",               "THA", "Asia",           13.7563,  100.5018),
  visit("Phuket",            "Phuket, Thailand",                "THA", "Asia",            7.8804,   98.3923),
  visit("Kuala Lumpur",      "Kuala Lumpur, Malaysia",          "MYS", "Asia",            3.1390,  101.6869),
  visit("Penang",            "Penang, Malaysia",                "MYS", "Asia",            5.4141,  100.3288),
  visit("Singapore",         "Singapore",                       "SGP", "Asia",            1.3521,  103.8198),
  visit("Bali",              "Bali, Indonesia",                 "IDN", "Asia",           -8.6705,  115.2126),
  visit("Malé",              "Malé, Maldives",                  "MDV", "Asia",            4.1755,   73.5093),
  visit("Delhi",             "Delhi, India",                    "IND", "Asia",           28.6139,   77.2090),
  visit("Mumbai",            "Mumbai, India",                   "IND", "Asia",           19.0760,   72.8777),
  visit("Leh",               "Leh, Ladakh, India",              "IND", "Asia",           34.1526,   77.5771),
  // Oceania
  visit("Sydney",            "Sydney, Australia",               "AUS", "Oceania",       -33.8688,  151.2093),
  visit("Great Ocean Road",  "Great Ocean Road, Australia",     "AUS", "Oceania",       -38.6662,  143.1044),
  visit("Gold Coast",        "Gold Coast, Australia",           "AUS", "Oceania",       -28.0167,  153.4000),
  visit("Cairns",            "Cairns, Australia",               "AUS", "Oceania",       -16.9186,  145.7781),
  visit("Uluru",             "Uluru, Australia",                "AUS", "Oceania",       -25.3444,  131.0369),
  visit("Hobart",            "Hobart, Tasmania, Australia",     "AUS", "Oceania",       -42.8821,  147.3272),
  visit("Auckland",          "Auckland, New Zealand",           "NZL", "Oceania",       -36.8509,  174.7645),
  visit("Rangitoto Island",  "Rangitoto Island, New Zealand",   "NZL", "Oceania",       -36.7867,  174.8600),
  visit("Waiheke Island",    "Waiheke Island, New Zealand",     "NZL", "Oceania",       -36.8000,  175.1000),
  visit("Rotorua",           "Rotorua, New Zealand",            "NZL", "Oceania",       -38.1368,  176.2497),
  visit("Wellington",        "Wellington, New Zealand",         "NZL", "Oceania",       -41.2924,  174.7787),
  visit("Christchurch",      "Christchurch, New Zealand",       "NZL", "Oceania",       -43.5321,  172.6362),
  visit("Queenstown",        "Queenstown, New Zealand",         "NZL", "Oceania",       -45.0312,  168.6626),
  visit("Invercargill",      "Invercargill, New Zealand",       "NZL", "Oceania",       -46.4132,  168.3538),
];

/** "special" (cream pin) · "story" (gold pin, has photos/blog) · "visit" (dot) */
export function markerType(p) {
  if (p.type) return p.type;
  return p.photos?.length || p.blog ? "story" : "visit";
}

/** Derived stats for the page header. */
// Counted as places, not countries: Antarctica and US territories.
const NOT_COUNTRIES = new Set(["ATA", "PRI"]);
export function placeStats(places = PLACES) {
  return {
    places: places.length,
    countries: new Set(places.map((p) => p.country).filter((c) => !NOT_COUNTRIES.has(c))).size,
    continents: new Set(places.map((p) => p.continent)).size,
  };
}
