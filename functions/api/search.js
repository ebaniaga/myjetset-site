// Cloudflare Pages Function — POST /api/search
// Validates a traveler's request, searches seats.aero for award availability
// they can afford, and emails the options via Resend.

import { isRecord, isCalendarDate, escapeHtml as esc } from "../../src/lib/validation.js";

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

// Shorter labels for the email table column.
const PROGRAM_SHORT = {
  aeroplan: "Aeroplan",
  aeromexico: "Aeroméxico",
  alaska: "Alaska",
  american: "American",
  azul: "Azul",
  british: "British Airways",
  delta: "Delta",
  etihad: "Etihad",
  finnair: "Finnair",
  flyingblue: "Flying Blue",
  jetblue: "JetBlue",
  qantas: "Qantas",
  qatar: "Qatar",
  saudia: "Saudia",
  smiles: "Smiles",
  united: "United",
  velocity: "Velocity",
  virginatlantic: "Virgin Atlantic",
};

// Transferable credit-card currencies → the supported airline programs each
// one can transfer to (usually ~1:1). Approximate and easy to edit as
// transfer partners change; only lists partners we actually search.
const CARD_NAMES = {
  amex: "Amex Membership Rewards",
  chase: "Chase Ultimate Rewards",
  capitalone: "Capital One Miles",
  citi: "Citi ThankYou Points",
  bilt: "Bilt Rewards",
};
const CARD_TRANSFER_PARTNERS = {
  amex: ["aeroplan", "aeromexico", "british", "delta", "etihad", "flyingblue", "jetblue", "qantas", "virginatlantic"],
  chase: ["aeroplan", "british", "flyingblue", "jetblue", "united", "virginatlantic"],
  capitalone: ["aeroplan", "aeromexico", "british", "etihad", "finnair", "flyingblue", "qantas"],
  citi: ["aeromexico", "etihad", "flyingblue", "jetblue", "qantas", "qatar", "virginatlantic"],
  // Verified 2026-09-11 against Bilt's list, restricted to programs this app searches:
  // https://support.biltrewards.com/hc/en-us/articles/19086448638989-Bilt-s-Transfer-Partners
  bilt: ["aeroplan", "alaska", "british", "etihad", "flyingblue", "qatar", "united", "virginatlantic"],
};

// seats.aero encodes cabins as Y / W / J / F
const CABIN_KEYS = { economy: "Y", premium: "W", business: "J", first: "F" };
const CABIN_LABEL = { Y: "Economy", W: "Premium economy", J: "Business", F: "First" };

// Booking-help add-ons the traveler can ask for.
const HELP_OPTIONS = {
  hotel: "Hotel",
  car: "Car rental",
  activities: "Activities",
  insurance: "Travel insurance",
};

// "Surprise me" — curated destinations grouped by tier so we can prioritize
// major hubs first in the emailed results.
const SURPRISE_DESTINATIONS = {
  tier1: [
    "JFK","LAX","ORD","ATL","DFW","MIA","SFO","SEA","BOS","IAH","DEN","YYZ","YVR","MEX",
    "LHR","CDG","AMS","FRA","MAD","BCN","FCO","MUC","ZRH","IST","VIE","DUB","CPH","BRU",
    "NRT","HND","ICN","PEK","PVG","HKG","SIN","BKK","KUL","DEL","BOM","TPE",
    "DXB","DOH","AUH","TLV",
    "SYD","MEL","AKL",
    "GRU","EZE","SCL","BOG","LIM",
    "JNB","NBO","CAI","CPT",
  ],
  tier2: [
    "PHX","MSP","DTW","EWR","LGA","MCO","LAS","IAD","FLL","TPA","AUS","SAN","PDX","SLC","PHL","CLT","HNL","OGG","MEM","MCI",
    "ORY","LGW","MAN","EDI","OPO","MXP","LIN","VCE","NCE","PMI","AGP","IBZ","HEL","ARN","OSL","ATH","LIS","PRG","BUD","WAW",
    "KIX","FUK","CTS","OKA","MNL","CGK","HKT","DPS","SGN","HAN","MAA","BLR",
    "CUN","NAS","PUJ","AUA","SJU","MBJ","LIR","SJO","PTY","GUA",
    "BNE","PER","ADL","CHC",
    "GIG","CWB","MVD","CCS","UIO","REC",
    "RAK","CMN","JED","BEY","ALG","MRU","ZNZ","DAR",
  ],
};
const SURPRISE_ALL = [...SURPRISE_DESTINATIONS.tier1, ...SURPRISE_DESTINATIONS.tier2];
const SURPRISE_TIER = new Map();
SURPRISE_DESTINATIONS.tier1.forEach((c) => SURPRISE_TIER.set(c, 1));
SURPRISE_DESTINATIONS.tier2.forEach((c) => SURPRISE_TIER.set(c, 2));

const MAX_RANGE_DAYS = 28; // 4 weeks
const MAX_RESULTS_IN_EMAIL = 10;
const SEARCH_PAGE_SIZE = 1000;
const MAX_SEARCH_PAGES = 10;

// Valid IATA airport codes (OpenFlights dataset) — used to reject codes that
// have the right shape but aren't real airports.
const AIRPORT_CODES = new Set("AAA AAC AAE AAF AAH AAK AAL AAM AAN AAO AAP AAQ AAR AAT AAV AAX AAY AAZ ABA ABB ABC ABD ABE ABF ABH ABI ABJ ABK ABL ABM ABN ABQ ABR ABS ABT ABV ABX ABY ABZ ACA ACC ACD ACE ACF ACH ACI ACJ ACK ACN ACP ACR ACS ACT ACV ACX ACY ACZ ADA ADB ADD ADE ADF ADH ADI ADJ ADK ADL ADM ADP ADQ ADS ADT ADU ADW ADX ADY ADZ AEA AEB AEG AEH AEI AEO AEP AER AES AET AEU AEX AEY AFA AFL AFS AFT AFW AFY AFZ AGA AGB AGC AGE AGF AGH AGI AGJ AGN AGP AGQ AGR AGS AGT AGU AGV AGX AGZ AHB AHE AHJ AHN AHO AHS AHU AIA AID AIK AIN AIP AIR AIS AIT AIU AIZ AJA AJF AJI AJK AJL AJN AJR AJU AJY AKA AKB AKC AKD AKF AKH AKI AKJ AKK AKL AKN AKO AKP AKR AKS AKT AKU AKV AKW AKX AKY ALA ALB ALC ALE ALF ALG ALH ALI ALJ ALL ALM ALN ALO ALP ALR ALS ALU ALW ALX ALY AMA AMB AMC AMD AMH AMI AMM AMN AMQ AMS AMT AMV AMZ ANB ANC AND ANE ANF ANG ANI ANK ANM ANN ANP ANQ ANR ANS ANU ANV ANX AOC AOE AOG AOH AOI AOJ AOK AOL AOO AOP AOR AOT AOU APA APC APF APG API APK APL APN APO APQ APT APW APZ AQA AQB AQG AQI AQJ AQP ARA ARB ARC ARD ARE ARH ARI ARK ARM ARN ARR ART ARU ARV ARW ARY ASA ASB ASD ASE ASF ASH ASI ASJ ASK ASM ASN ASO ASP ASR ASS AST ASU ASV ASW ATA ATB ATC ATD ATF ATG ATH ATI ATJ ATK ATL ATM ATO ATQ ATR ATW ATY ATZ AUA AUC AUF AUG AUH AUK AUO AUQ AUR AUS AUU AUW AUX AUY AVA AVB AVI AVK AVL AVN AVO AVP AVR AVV AVW AVX AWA AWD AWK AWZ AXA AXD AXF AXJ AXK AXM AXN AXP AXR AXT AXU AYK AYO AYP AYQ AYS AYT AYW AZA AZD AZI AZN AZO AZR AZS BAB BAD BAF BAG BAH BAI BAL BAQ BAR BAS BAT BAU BAV BAX BAY BAZ BBA BBC BBD BBG BBH BBI BBJ BBK BBL BBM BBN BBO BBP BBQ BBR BBS BBT BBU BBX BCA BCD BCE BCH BCI BCL BCM BCN BCO BCT BCU BDA BDB BDD BDE BDH BDI BDJ BDL BDM BDN BDO BDP BDQ BDR BDS BDT BDU BEB BEC BED BEF BEG BEI BEJ BEK BEL BEM BEN BEO BEP BEQ BES BET BEU BEV BEW BEX BEY BEZ BFD BFE BFF BFH BFI BFJ BFK BFL BFM BFN BFO BFP BFS BFT BFU BFV BFW BFX BGA BGC BGD BGE BGF BGG BGI BGL BGM BGN BGO BGR BGW BGX BGY BGZ BHB BHD BHE BHG BHH BHI BHJ BHK BHM BHN BHO BHP BHQ BHR BHS BHU BHV BHW BHX BHY BIA BIB BID BIF BIG BIH BIK BIL BIM BIN BIO BIQ BIR BIS BIU BIX BIY BJA BJB BJC BJF BJH BJI BJL BJM BJO BJP BJR BJU BJV BJW BJX BJY BJZ BKA BKB BKC BKD BKE BKG BKH BKI BKK BKL BKM BKO BKQ BKS BKW BKY BKZ BLA BLB BLE BLF BLG BLH BLI BLJ BLK BLL BLN BLQ BLR BLT BLV BLZ BMA BMB BMC BMD BME BMG BMI BMK BMM BMO BMP BMR BMT BMU BMV BMW BMX BMY BNA BNB BNC BND BNE BNG BNI BNJ BNK BNM BNN BNO BNP BNS BNU BNX BOA BOB BOC BOD BOG BOH BOI BOJ BOM BON BOO BOR BOS BOU BOW BOX BOY BPC BPE BPF BPG BPH BPI BPL BPM BPN BPS BPT BPX BPY BQA BQB BQE BQG BQH BQJ BQK BQL BQN BQS BQT BQU BRA BRC BRD BRE BRI BRK BRL BRM BRN BRO BRQ BRR BRS BRT BRU BRV BRW BRX BSA BSB BSC BSD BSF BSG BSJ BSK BSL BSO BSR BST BSU BSX BTC BTE BTH BTI BTJ BTK BTL BTM BTR BTS BTT BTU BTV BTW BTZ BUA BUC BUD BUF BUG BUI BUJ BUL BUN BUO BUP BUQ BUR BUS BUT BUU BUW BUX BUY BUZ BVA BVB BVC BVE BVG BVH BVI BVS BVY BWA BWB BWE BWF BWG BWH BWI BWK BWN BWO BWQ BWT BWU BWW BWX BXB BXE BXG BXH BXK BXN BXO BXP BXR BXU BXY BYC BYF BYH BYI BYJ BYK BYM BYN BYO BYP BYQ BYR BYS BYT BYU BZA BZC BZD BZE BZG BZH BZI BZK BZL BZN BZO BZR BZU BZV BZY BZZ CAB CAC CAE CAF CAG CAH CAI CAJ CAK CAL CAN CAP CAQ CAR CAT CAU CAW CAX CAY CAZ CBB CBD CBE CBF CBG CBH CBJ CBL CBM CBN CBO CBQ CBR CBT CBU CBV CCA CCB CCC CCF CCH CCI CCJ CCK CCL CCM CCN CCP CCR CCS CCU CCV CCX CCY CCZ CDA CDB CDC CDE CDG CDJ CDN CDP CDR CDS CDT CDU CDV CDW CEB CEC CED CEE CEF CEG CEI CEJ CEK CEM CEN CEQ CER CES CET CEU CEW CEZ CFB CFC CFD CFE CFG CFK CFN CFO CFR CFS CFU CFV CGB CGD CGF CGH CGI CGJ CGK CGM CGN CGO CGP CGQ CGR CGX CGY CGZ CHA CHC CHF CHG CHH CHM CHN CHO CHQ CHR CHS CHT CHU CHX CHY CIA CIC CID CIF CIH CIJ CIK CIO CIP CIS CIT CIU CIW CIX CIY CIZ CJA CJB CJC CJF CJJ CJL CJM CJN CJS CJU CKB CKC CKG CKH CKI CKL CKS CKT CKV CKY CKZ CLD CLE CLJ CLL CLM CLN CLO CLP CLQ CLS CLT CLU CLV CLW CLY CLZ CMA CMB CMD CME CMF CMG CMH CMI CMJ CMK CMN CMP CMQ CMR CMU CMW CMX CNB CNC CND CNF CNG CNI CNJ CNL CNM CNN CNO CNP CNQ CNR CNS CNU CNW CNX CNY COC COD COE COF COG COH COJ COK CON COO COQ COR COS COT COU COX COZ CPA CPB CPC CPD CPE CPH CPO CPQ CPR CPT CPV CPX CQA CQD CQF CQM CQS CRA CRC CRD CRE CRG CRI CRK CRL CRM CRP CRQ CRV CRW CRZ CSA CSB CSF CSG CSH CSK CSM CSO CSV CSX CSY CSZ CTA CTB CTC CTD CTG CTH CTL CTM CTN CTS CTT CTU CTY CUA CUB CUC CUD CUE CUF CUH CUL CUM CUN CUP CUQ CUR CUT CUU CUZ CVC CVE CVF CVG CVJ CVM CVN CVO CVQ CVS CVT CVU CWA CWB CWC CWE CWI CWJ CWL CWT CWW CXA CXB CXH CXI CXJ CXL CXO CXP CXR CYA CYB CYF CYG CYI CYO CYP CYR CYS CYT CYU CYW CYX CYZ CZA CZE CZF CZL CZM CZS CZU CZX DAA DAB DAC DAD DAG DAL DAM DAN DAR DAT DAU DAV DAX DAY DBA DBB DBC DBD DBM DBN DBO DBQ DBT DBV DCA DCF DCI DCM DCN DCT DCU DCY DDC DDG DEA DEB DEC DED DEE DEF DEL DEM DEN DES DET DEX DEZ DFW DGE DGL DGO DGP DGT DHA DHF DHI DHM DHN DHR DHT DIA DIB DIE DIG DIJ DIK DIL DIN DIQ DIR DIS DIU DIY DJB DJE DJG DJJ DJO DKI DKK DKR DKS DKV DLA DLC DLD DLE DLF DLG DLH DLI DLK DLM DLS DLU DLY DLZ DMA DMB DMD DME DMK DMM DMN DMT DMU DNA DND DNH DNK DNL DNN DNP DNQ DNR DNV DNZ DOB DOD DOG DOH DOK DOL DOM DOP DOU DOV DOY DPA DPL DPO DPS DQA DQM DRA DRB DRE DRG DRI DRJ DRK DRN DRO DRS DRT DRV DRW DSA DSD DSE DSI DSK DSM DSN DSO DSS DTA DTB DTD DTE DTI DTM DTN DTU DTW DUB DUC DUD DUE DUG DUJ DUM DUR DUS DUT DVL DVO DVT DWA DWB DWC DWD DWH DXB DXR DYA DYG DYL DYR DYS DYU DZA DZN DZO EAA EAE EAM EAS EAT EAU EBA EBB EBD EBG EBH EBJ EBL EBM EBU ECA ECG ECH ECI ECN ECP ECV EDD EDF EDI EDL EDM EDO EDR EDW EED EEK EEN EFD EFG EFL EGC EGE EGH EGI EGM EGN EGO EGS EGV EGX EHL EHM EIB EIE EIK EIL EIN EIS EIY EJA EJH EJN EKA EKB EKI EKN EKO EKS EKT ELB ELC ELD ELF ELG ELH ELI ELM ELO ELP ELQ ELS ELT ELU ELV ELY EMA EMD EME EMK EML EMN EMP EMT ENA ENC END ENE ENF ENH ENK ENN ENO ENS ENT ENU ENV ENW ENY EOH EOI EOK EOR EOZ EPA EPL EPR EPU EQS ERC ERD ERF ERG ERH ERI ERL ERM ERN ERS ERV ERZ ESB ESC ESD ESE ESF ESG ESH ESK ESL ESM ESN ESR ESS ESU ETB ETH ETM ETR ETS ETZ EUA EUF EUG EUM EUN EUQ EUX EVE EVG EVN EVV EVW EVX EWB EWK EWN EWR EXT EYK EYP EYW EZE EZS EZV FAA FAB FAC FAE FAF FAH FAI FAJ FAN FAO FAR FAT FAV FAY FAZ FBA FBD FBE FBG FBK FBM FBR FBU FCA FCB FCM FCN FCO FCS FDF FDH FDO FDU FDY FEG FEL FEN FET FEZ FFA FFD FFO FFT FFU FGI FGU FHU FIE FIG FIH FIK FIZ FJR FKB FKI FKJ FKL FKQ FKS FLA FLB FLD FLF FLG FLL FLN FLO FLP FLR FLS FLV FLW FLZ FMA FME FMH FMI FMM FMN FMO FMY FNA FNB FNC FNI FNJ FNL FNR FNT FNU FOC FOD FOE FOG FOK FOM FON FOR FOS FPO FPR FRA FRB FRC FRD FRE FRG FRI FRJ FRL FRN FRO FRS FRU FRW FRY FRZ FSC FSD FSI FSM FSP FSS FST FTA FTE FTI FTK FTU FTW FTX FTY FUE FUG FUJ FUK FUL FUN FUO FUT FWA FWH FXE FXO FYJ FYN FYT FYU FYV FZO GAD GAE GAF GAH GAI GAJ GAL GAM GAN GAO GAQ GAS GAU GAY GBA GBB GBD GBE GBG GBJ GBK GBT GBZ GCC GCH GCI GCJ GCK GCM GCN GDC GDE GDL GDN GDO GDQ GDT GDV GDW GDX GDZ GEA GEC GED GEG GEL GEO GER GES GET GEV GEX GFF GFK GFL GFN GFO GFR GFY GGE GGG GGM GGS GGT GGW GHA GHB GHC GHF GHT GHU GIB GIC GID GIF GIG GII GIL GIR GIS GIT GIU GIZ GJA GJL GJM GJR GJT GKA GKE GKK GKL GKN GLA GLD GLF GLH GLI GLK GLO GLR GLS GLT GLU GLV GLW GLZ GMA GMB GMD GME GML GMO GMP GMQ GMR GMU GMV GMZ GNA GNB GND GNI GNM GNR GNS GNT GNV GNY GNZ GOA GOB GOH GOI GOJ GOM GON GOO GOP GOQ GOR GOT GOU GOV GOZ GPA GPB GPI GPL GPN GPO GPS GPT GPZ GQQ GRB GRF GRI GRJ GRK GRM GRO GRP GRQ GRR GRS GRU GRW GRX GRY GRZ GSB GSE GSI GSJ GSO GSP GSQ GST GTE GTF GTI GTN GTO GTR GUA GUB GUC GUF GUH GUI GUJ GUL GUM GUP GUQ GUR GUS GUT GUU GUW GUX GUY GUZ GVA GVL GVN GVR GVT GVX GWD GWE GWL GWO GWT GWY GXF GXG GXH GXQ GXY GYA GYD GYE GYG GYI GYL GYM GYN GYR GYS GYU GYY GZA GZI GZM GZO GZP GZT GZW HAA HAC HAD HAF HAH HAJ HAK HAM HAN HAO HAQ HAR HAS HAU HAV HAW HBA HBE HBG HBR HBX HCJ HCN HCQ HCR HCW HDD HDE HDF HDG HDH HDI HDM HDN HDR HDS HDY HEA HEH HEI HEK HEL HEM HER HET HEW HEX HFA HFD HFE HFN HFS HFT HGA HGD HGE HGH HGI HGL HGN HGO HGR HGS HGU HHE HHH HHI HHN HHP HHQ HHR HHZ HIA HIB HID HIF HII HIJ HIM HIN HIO HIR HIW HJJ HJR HKD HKG HKK HKN HKT HKY HLA HLD HLE HLF HLG HLH HLI HLJ HLN HLP HLR HLT HLZ HMA HMB HME HMG HMI HMJ HMN HMO HMR HMV HMY HNA HND HNH HNL HNM HNS HNY HOA HOB HOD HOE HOF HOG HOH HOI HOK HOM HON HOP HOQ HOR HOS HOT HOU HOV HOX HPA HPB HPG HPH HPN HQM HRB HRE HRG HRI HRK HRL HRM HRO HRS HRT HSG HSH HSK HSL HSM HSN HSS HST HSV HSZ HTA HTG HTI HTL HTN HTR HTS HTT HTU HTV HTY HUA HUE HUF HUH HUI HUL HUN HUO HUQ HUS HUT HUU HUV HUW HUX HUY HUZ HVA HVB HVD HVG HVN HVR HVS HWD HWN HWO HXD HXX HYA HYC HYD HYG HYN HYR HYS HYV HZB HZG HZH HZK HZL HZP IAA IAB IAD IAG IAH IAM IAN IAO IAR IAS IBA IBB IBE IBP IBR IBZ ICC ICI ICK ICN ICT IDA IDP IDR IDY IEG IEJ IES IEV IFH IFJ IFL IFN IFO IFU IGA IGB IGD IGG IGL IGR IGS IGT IGU IHC IHR IIA IIL IJK IKA IKB IKI IKK IKL IKO IKS IKT IKU ILA ILD ILF ILG ILI ILM ILN ILO ILP ILQ ILR ILU ILY ILZ IMB IMF IMK IMM IMP IMT INA IND ING INH INI INK INL INN INO INQ INS INT INU INV INW INZ IOA IOM ION IOR IOS IOW IPA IPC IPH IPI IPL IPN IPT IQA IQM IQN IQQ IQT IRA IRB IRC IRD IRG IRI IRJ IRK IRP IRZ ISA ISB ISC ISE ISG ISJ ISK ISL ISM ISN ISO ISP IST ISU ISW ITA ITB ITH ITM ITO ITP ITR IUE IVA IVC IVL IVR IWA IWJ IWK IWO IWS IXA IXB IXC IXD IXE IXG IXH IXI IXJ IXK IXL IXM IXP IXR IXS IXT IXU IXV IXW IXY IXZ IYK IZA IZO IZT JAA JAB JAC JAD JAE JAF JAG JAI JAK JAL JAM JAN JAP JAR JAS JAU JAV JAX JBQ JBR JCB JCH JCI JCK JCR JCT JDF JDG JDH JDO JDZ JED JEE JEF JEG JER JFK JFR JGA JGD JGN JGO JGS JHB JHG JHM JHQ JHS JHW JIA JIB JIC JIJ JIK JIM JIQ JIU JIW JJG JJI JJM JJN JJU JKG JKH JKL JKR JLN JLR JMJ JMK JMO JMS JMU JNB JNG JNI JNN JNS JNU JNX JNZ JOE JOG JOH JOI JOJ JOK JOL JON JOS JOT JPA JPR JQA JQE JRA JRB JRF JRH JRN JRO JSA JSH JSI JSJ JSK JSM JSR JST JSU JSY JTC JTR JTY JUA JUB JUH JUI JUJ JUL JUM JUV JUZ JVA JVL JWA JWN JXA JXN JYR JYV JZH KAA KAB KAC KAD KAG KAI KAJ KAL KAN KAO KAR KAT KAU KAW KAX KAZ KBL KBN KBP KBQ KBR KBS KBV KBZ KCA KCF KCH KCK KCM KCO KCS KCT KCZ KDA KDC KDD KDH KDI KDL KDM KDO KDT KDU KDV KDX KDY KED KEF KEJ KEL KEM KEN KEO KEP KER KES KET KEV KEW KEY KFA KFE KFG KFP KFS KGA KGC KGD KGE KGF KGG KGI KGJ KGK KGL KGO KGP KGS KGT KGW KGY KHC KHD KHE KHG KHH KHI KHJ KHK KHM KHN KHS KHT KHV KHW KHY KHZ KID KIF KIH KIJ KIK KIM KIN KIO KIR KIS KIT KIV KIW KIX KIY KJA KJH KJI KJK KJP KKA KKC KKE KKH KKJ KKN KKR KKS KKW KKX KLC KLD KLF KLG KLH KLI KLJ KLM KLN KLO KLR KLS KLU KLV KLW KLX KLZ KMA KMC KME KMG KMH KMI KMJ KMN KMO KMP KMQ KMS KMU KMV KMW KMX KNA KND KNF KNG KNH KNO KNP KNQ KNR KNS KNU KNW KNX KOA KOC KOE KOI KOJ KOK KOO KOP KOQ KOS KOT KOU KOV KOW KOX KPC KPN KPO KPS KPV KQA KQH KQT KRA KRB KRC KRF KRH KRI KRK KRL KRN KRO KRP KRQ KRR KRS KRT KRW KRY KRZ KSA KSC KSD KSE KSF KSH KSI KSJ KSK KSL KSM KSN KSO KSQ KSS KSU KSY KSZ KTA KTD KTE KTF KTG KTI KTL KTM KTN KTP KTQ KTR KTS KTT KTU KTW KUA KUC KUD KUF KUG KUH KUK KUL KUM KUN KUO KUT KUU KUV KVA KVB KVC KVD KVG KVK KVL KVM KVR KVX KWA KWB KWE KWG KWI KWJ KWK KWL KWM KWN KWT KWZ KXE KXF KXK KYA KYD KYE KYI KYK KYP KYS KYU KYZ KZC KZF KZG KZI KZN KZO KZR KZS LAA LAD LAE LAF LAI LAJ LAK LAL LAM LAN LAO LAP LAQ LAR LAS LAU LAW LAX LAY LAZ LBA LBB LBC LBD LBE LBF LBG LBI LBJ LBL LBQ LBR LBS LBT LBU LBV LBW LBX LBY LBZ LCA LCC LCE LCG LCH LCJ LCK LCL LCQ LCX LCY LDB LDE LDG LDH LDI LDJ LDK LDM LDN LDS LDU LDV LDX LDY LEA LEB LEC LED LEE LEH LEI LEJ LEK LEL LEN LEQ LER LET LEU LEV LEW LEX LEY LFB LFI LFK LFM LFQ LFR LFT LFW LGA LGB LGC LGD LGG LGH LGI LGK LGL LGO LGP LGS LGU LGW LHA LHE LHG LHK LHR LHS LHV LHW LID LIF LIG LIH LII LIL LIM LIN LIO LIP LIQ LIR LIS LIT LIW LIX LIY LJA LJG LJN LJU LKB LKG LKH LKL LKN LKO LKP LKV LKY LKZ LLA LLB LLE LLF LLI LLK LLU LLV LLW LLY LMA LME LMM LMN LMO LMP LMQ LMR LMT LNA LNB LND LNE LNJ LNK LNL LNN LNO LNR LNS LNX LNY LNZ LOD LOE LOH LOK LOL LOO LOP LOS LOT LOU LOV LOZ LPA LPB LPC LPD LPF LPG LPI LPK LPL LPM LPP LPQ LPS LPT LPU LPX LPY LQM LRA LRD LRE LRF LRH LRL LRM LRR LRS LRT LRU LRV LSC LSE LSF LSH LSI LSL LSP LSQ LSS LST LSV LSW LSX LSY LSZ LTA LTD LTI LTK LTM LTN LTO LTQ LTS LTT LTX LUA LUC LUD LUF LUG LUH LUK LUM LUN LUO LUP LUQ LUR LUV LUW LUX LUZ LVA LVI LVK LVM LVO LVP LVS LWB LWC LWK LWM LWN LWO LWR LWS LWT LWY LXA LXG LXN LXR LXS LYA LYB LYC LYE LYG LYH LYI LYM LYN LYP LYR LYS LYU LYX LZC LZH LZN LZO LZR LZU LZY MAA MAB MAD MAE MAF MAG MAH MAI MAJ MAK MAM MAN MAO MAQ MAR MAS MAT MAU MAX MAY MAZ MBA MBD MBE MBG MBH MBI MBJ MBL MBO MBS MBT MBU MBW MBX MBZ MCB MCC MCE MCF MCG MCH MCI MCJ MCK MCL MCN MCO MCP MCS MCT MCU MCV MCW MCX MCY MCZ MDC MDE MDG MDH MDI MDK MDL MDQ MDS MDT MDU MDW MDY MDZ MEA MEB MEC MED MEE MEG MEH MEI MEK MEL MEM MEN MEO MEQ MER MES MEU MEX MEY MFA MFD MFE MFG MFI MFJ MFK MFM MFN MFQ MFR MFU MFX MGA MGB MGC MGE MGF MGH MGJ MGL MGM MGN MGQ MGS MGT MGW MGY MGZ MHA MHC MHD MHE MHG MHH MHK MHP MHQ MHR MHT MHU MHV MHX MHZ MIA MIB MID MIE MIG MII MIJ MIK MIM MIP MIR MIS MIU MIV MJA MJC MJD MJF MJI MJK MJL MJM MJN MJT MJV MJZ MKC MKE MKG MKK MKL MKM MKP MKQ MKR MKS MKU MKW MKY MKZ MLA MLB MLC MLE MLG MLI MLL MLM MLN MLO MLS MLU MLW MLX MLY MLZ MMB MMD MME MMG MMH MMI MMJ MMK MMO MMT MMU MMX MMY MMZ MNA MNB MNC MNF MNG MNH MNI MNJ MNK MNL MNM MNR MNS MNU MNX MNY MNZ MOA MOB MOC MOD MOE MOF MOG MOI MOJ MOL MON MOO MOQ MOT MOU MOV MOZ MPA MPH MPK MPL MPM MPN MPO MPV MPW MPY MQC MQF MQH MQJ MQL MQM MQN MQP MQQ MQS MQT MQU MQX MQY MRB MRD MRE MRF MRG MRI MRK MRN MRO MRQ MRR MRS MRU MRV MRW MRX MRY MRZ MSA MSC MSE MSH MSJ MSL MSN MSO MSP MSQ MSR MSS MST MSU MSW MSY MSZ MTC MTF MTG MTH MTJ MTK MTL MTM MTN MTP MTR MTS MTT MTV MTY MTZ MUA MUB MUC MUD MUE MUH MUI MUK MUN MUO MUR MUS MUW MUX MUZ MVA MVB MVD MVF MVL MVP MVQ MVR MVS MVT MVV MVW MVY MVZ MWA MWC MWD MWE MWF MWH MWK MWL MWQ MWX MWZ MXB MXF MXH MXI MXJ MXL MXM MXN MXP MXS MXT MXV MXX MXZ MYA MYB MYC MYD MYE MYG MYI MYJ MYL MYP MYQ MYR MYT MYU MYV MYW MYY MYZ MZB MZG MZH MZI MZJ MZK MZL MZM MZO MZP MZQ MZR MZT MZU MZV MZW NAA NAC NAG NAH NAI NAJ NAK NAL NAM NAN NAO NAP NAQ NAS NAT NAU NAV NAW NAY NBC NBE NBG NBN NBO NBS NBW NBX NCA NCE NCG NCJ NCL NCN NCO NCR NCS NCU NCY NDB NDC NDD NDG NDJ NDN NDR NDU NDY NEC NEG NEL NER NEU NEV NEW NFG NFL NFO NGA NGB NGD NGE NGF NGI NGK NGO NGQ NGS NGU NGX NGZ NHA NHD NHK NHT NHV NHZ NIB NIG NIM NIO NIP NIS NIT NIU NJA NJC NJF NJK NKB NKC NKG NKM NKT NKW NKX NLA NLC NLD NLF NLG NLH NLI NLK NLO NLP NLT NLV NMA NMB NMC NME NMS NMT NNA NNB NNG NNL NNM NNR NNT NNX NNY NOA NOB NOC NOD NOG NOJ NON NOP NOR NOS NOT NOU NOV NOZ NPA NPE NPL NPO NPR NQA NQI NQN NQT NQU NQX NQY NRA NRB NRD NRE NRK NRL NRN NRR NRT NSE NSH NSI NSK NSN NSO NST NSY NTB NTD NTE NTI NTL NTN NTQ NTR NTT NTU NTX NTY NUE NUI NUK NUL NUQ NUS NUW NUX NVA NVI NVK NVP NVS NVT NWA NWI NXX NYA NYE NYI NYK NYM NYO NYR NYT NYU NYW NZA NZC NZE NZH NZJ NZL NZY OAA OAG OAH OAI OAJ OAK OAL OAM OAR OAS OAX OAZ OBC OBE OBF OBL OBN OBO OBS OBU OBY OCA OCC OCF OCJ OCM OCN OCV OCW ODB ODE ODH ODN ODO ODS ODY OEL OEM OER OES OFF OFK OGB OGD OGG OGL OGN OGS OGU OGX OGZ OHA OHD OHE OHO OHS OIA OIM OIR OIT OJC OKA OKC OKD OKE OKF OKI OKJ OKK OKL OKM OKN OKO OKR OKU OKY OLA OLB OLC OLF OLJ OLL OLM OLP OLS OLV OLZ OMA OMB OMC OMD OME OMF OMH OMI OMO OMR OMS OND ONG ONJ ONK ONO ONP ONQ ONS ONT ONX OOK OOL OOM OPF OPO OPS OPU ORA ORB ORD ORE ORF ORG ORH ORJ ORK ORL ORN ORP ORT ORU ORV ORW ORX ORY OSC OSD OSF OSH OSI OSK OSL OSM OSN OSP OSR OSS OST OSU OSW OSY OTH OTI OTJ OTK OTM OTP OTR OTU OTZ OUA OUD OUE OUH OUK OUL OUZ OVA OVB OVD OVG OVR OVS OWB OWD OXB OXC OXF OXR OYA OYE OYK OYL OYO OYP OZA OZC OZG OZH OZP OZR OZZ PAA PAB PAC PAD PAE PAG PAH PAJ PAL PAM PAN PAO PAP PAQ PAS PAT PAV PAX PAZ PBC PBD PBF PBG PBH PBI PBJ PBL PBM PBN PBO PBP PBQ PBR PBU PBZ PCB PCD PCF PCL PCN PCP PCQ PCR PCS PDA PDG PDK PDL PDO PDP PDS PDT PDU PDV PDX PEA PED PEE PEF PEG PEH PEI PEK PEM PEN PEQ PER PES PET PEU PEV PEW PEX PEZ PFB PFJ PFN PFO PFQ PFR PGA PGD PGF PGH PGK PGU PGV PGX PGZ PHA PHB PHC PHD PHE PHF PHK PHL PHN PHS PHW PHX PHY PIA PIB PID PIE PIF PIH PIK PIL PIM PIN PIO PIP PIR PIS PIT PIU PIW PIX PIZ PJA PJC PJG PJM PKA PKB PKC PKE PKG PKH PKK PKN PKO PKP PKR PKT PKU PKV PKW PKX PKY PKZ PLD PLH PLL PLM PLN PLO PLP PLQ PLS PLU PLV PLW PLX PLZ PMA PMB PMC PMD PMF PMG PMH PMI PMK PML PMO PMQ PMR PMS PMV PMW PMY PMZ PNA PNB PNC PNE PNH PNI PNK PNL PNP PNQ PNR PNS PNT PNV PNY PNZ POA POB POC POE POF POG POI POJ POL POM POO POP POR POS POT POU POW POX POZ PPA PPB PPC PPE PPF PPG PPI PPK PPL PPM PPN PPP PPQ PPR PPS PPT PPW PPY PQC PQI PQM PQQ PRA PRB PRC PRG PRH PRI PRM PRN PRP PRQ PRU PRV PRX PRY PRZ PSA PSC PSD PSE PSG PSH PSI PSJ PSL PSM PSO PSP PSR PSS PSU PSX PSY PSZ PTA PTB PTF PTG PTH PTJ PTK PTM PTP PTT PTU PTX PTY PTZ PUB PUC PUD PUE PUF PUG PUJ PUK PUQ PUR PUS PUT PUU PUW PUY PUZ PVA PVC PVD PVG PVH PVK PVL PVO PVR PVS PVU PWA PWE PWK PWM PWQ PWT PWY PXH PXM PXO PXR PXU PYB PYE PYH PYJ PYK PYM PYR PYY PZA PZB PZE PZH PZI PZL PZO PZS PZU PZY QBC QCJ QCY QDJ QEF QFG QFO QGQ QGU QHP QHR QIG QJB QJE QJI QKX QLA QLD QLF QLP QLR QLS QLT QNC QND QNJ QNV QOW QPA QPD QPG QPS QPW QQT QRA QRC QRM QRO QRR QRW QRY QSA QSC QSF QSI QSN QSR QSZ QUG QUO QUY QXH QYD RAB RAC RAE RAH RAI RAJ RAK RAL RAM RAO RAP RAQ RAR RAS RAT RAZ RBA RBB RBD RBE RBK RBL RBM RBQ RBR RBV RBX RBY RCA RCB RCH RCL RCM RCO RCQ RCS RCU RCY RDB RDC RDD RDG RDM RDN RDO RDP RDR RDS RDU RDZ REA REB REC REG REL REN REP RER RES RET REU REX REY REZ RFD RFP RFS RGA RGI RGK RGL RGN RGO RGS RGT RHD RHE RHI RHO RHP RHT RHV RIA RIB RIC RIH RIJ RIL RIN RIS RIV RIW RIX RIY RIZ RJA RJB RJH RJK RJL RJN RKD RKE RKH RKO RKP RKS RKT RKV RKZ RLG RLK RMA RME RMF RMG RMI RMK RML RMQ RMS RMT RMU RMY RNA RNB RND RNE RNI RNJ RNL RNN RNO RNS RNT RNZ ROA ROB ROC ROD ROI ROK ROO ROP ROR ROS ROT ROV ROW ROZ RPB RPM RPN RPR RQW RRG RRK RRR RRS RSA RSD RSH RSL RSS RST RSU RSW RTA RTB RTC RTG RTM RTN RTS RTW RUA RUD RUG RUH RUI RUK RUM RUN RUR RUS RUT RUV RVA RVD RVE RVK RVN RVS RVT RVV RVY RWF RWI RWL RWN RXS RYB RYG RYK RYN RZA RZE RZP RZR RZS SAA SAB SAC SAD SAF SAG SAH SAK SAL SAN SAP SAQ SAT SAV SAW SAY SBA SBB SBD SBG SBH SBK SBL SBM SBN SBP SBR SBS SBT SBU SBW SBY SBZ SCC SCE SCF SCH SCI SCK SCL SCM SCN SCO SCQ SCS SCT SCU SCV SCW SCY SCZ SDB SDD SDE SDF SDG SDJ SDK SDL SDM SDN SDP SDQ SDR SDS SDT SDU SDV SDX SDY SEA SEB SEE SEF SEH SEK SEM SEN SEP SEU SEY SEZ SFA SFB SFC SFD SFE SFF SFG SFH SFJ SFK SFL SFN SFO SFQ SFS SFT SFZ SGC SGD SGE SGF SGH SGI SGN SGO SGQ SGR SGU SGV SGX SGY SGZ SHA SHB SHD SHE SHG SHH SHI SHJ SHL SHM SHN SHO SHP SHR SHT SHV SHW SHX SHY SIA SID SIF SIG SIJ SIK SIN SIO SIP SIQ SIR SIS SIT SIU SJC SJD SJE SJI SJJ SJK SJL SJO SJP SJT SJU SJW SJY SJZ SKA SKB SKD SKE SKF SKG SKH SKK SKN SKO SKP SKS SKT SKU SKV SKX SKY SKZ SLA SLC SLD SLE SLF SLH SLJ SLK SLL SLM SLN SLP SLQ SLU SLV SLW SLX SLY SLZ SMA SMD SME SMF SMI SMK SML SMN SMO SMQ SMR SMS SMT SMV SMW SMX SMZ SNA SNB SNC SNE SNF SNJ SNN SNO SNP SNR SNS SNU SNV SNW SNY SNZ SOB SOC SOD SOF SOG SOJ SOM SON SOO SOP SOQ SOT SOU SOV SOW SOY SOZ SPA SPB SPC SPD SPF SPG SPI SPJ SPM SPN SPP SPR SPS SPU SPW SPY SQA SQD SQG SQH SQJ SQL SQN SQO SQQ SQR SQW SQX SQZ SRA SRE SRG SRH SRI SRJ SRN SRP SRQ SRT SRX SRY SRZ SSA SSC SSE SSF SSG SSH SSI SSJ SSN SSR SST SSY SSZ STA STB STC STD STE STG STI STJ STK STL STM STN STP STR STS STT STV STW STX STY STZ SUA SUB SUF SUG SUI SUJ SUK SUL SUN SUP SUR SUS SUU SUV SUX SUY SVA SVB SVD SVG SVH SVI SVJ SVL SVN SVO SVP SVQ SVU SVW SVX SVZ SWA SWC SWD SWF SWH SWJ SWO SWP SWQ SWS SWT SWU SWX SXB SXE SXF SXI SXJ SXK SXL SXM SXN SXO SXQ SXR SXV SXX SXZ SYA SYD SYH SYJ SYM SYO SYP SYQ SYR SYS SYT SYU SYW SYX SYY SYZ SZA SZB SZF SZG SZJ SZK SZL SZR SZS SZT SZV SZW SZX SZY SZZ TAB TAC TAE TAF TAG TAH TAI TAK TAM TAO TAP TAR TAS TAT TAY TAZ TBB TBF TBG TBH TBI TBJ TBN TBO TBP TBR TBS TBT TBU TBW TBZ TCA TCB TCC TCE TCG TCH TCL TCM TCN TCO TCP TCQ TCS TCX TCZ TDD TDG TDJ TDL TDR TDS TDX TEA TEB TEC TED TEE TEF TEI TEM TEN TEQ TER TET TEU TEV TEX TEZ TFF TFL TFN TFS TGA TGD TGG TGH TGI TGJ TGK TGM TGN TGO TGP TGQ TGR TGT TGU TGZ THE THF THG THL THN THO THQ THR THS THU THX THZ TIA TID TIE TIF TIH TII TIJ TIK TIM TIN TIP TIQ TIR TIU TIV TIW TIX TIY TIZ TJA TJB TJG TJH TJI TJK TJL TJM TJQ TJS TJU TJV TKA TKC TKD TKF TKG TKH TKJ TKK TKN TKP TKQ TKS TKT TKU TKV TKX TLA TLC TLD TLE TLH TLI TLJ TLK TLL TLM TLN TLQ TLS TLU TLV TLX TMA TMB TMC TME TMF TMG TMH TMI TMJ TML TMM TMN TMO TMP TMR TMS TMT TMU TMW TMX TNA TNC TND TNE TNF TNG TNH TNI TNJ TNM TNN TNR TNT TNW TNX TOA TOB TOC TOD TOE TOF TOG TOH TOI TOJ TOL TOM TOO TOP TOQ TOS TOT TOU TOW TOY TPA TPC TPE TPF TPH TPJ TPL TPN TPP TPQ TPS TQD TQL TQQ TQS TRA TRC TRD TRE TRF TRG TRI TRK TRM TRN TRO TRQ TRR TRS TRU TRV TRW TRZ TSA TSB TSE TSF TSH TSJ TSL TSM TSN TSR TST TSU TSV TSX TSY TTA TTB TTC TTD TTE TTG TTH TTI TTJ TTL TTN TTQ TTR TTT TTU TUA TUB TUC TUD TUF TUG TUI TUK TUL TUM TUN TUO TUP TUR TUS TUU TUV TVA TVC TVF TVI TVL TVU TVY TWB TWF TWT TWU TWZ TXF TXG TXK TXL TXN TYB TYF TYL TYM TYN TYR TYS TZL TZR TZX UAB UAH UAI UAK UAM UAP UAQ UAR UAS UBA UBB UBJ UBP UBT UCB UCK UCT UDD UDI UDJ UDR UEL UEO UET UFA UGA UGC UGN UGO UGU UHE UIB UIH UII UIK UIN UIO UIP UJE UKA UKB UKG UKI UKK UKS UKT UKX ULA ULB ULD ULG ULH ULK ULN ULO ULP ULQ ULU ULV ULY ULZ UMD UME UMR UMS UMU UNA UND UNG UNI UNK UNN UNT UOL UOS UOX UPB UPG UPL UPN UPP URA URC URD URE URG URJ URO URS URT URY USA USH USI USK USM USN USQ USR USS UST USU UTA UTC UTH UTI UTK UTM UTN UTO UTP UTS UTT UTW UUA UUD UUK UUN UUS UVA UVE UVF UYL UYN UYU UZR UZU VAA VAD VAF VAG VAI VAK VAL VAM VAN VAO VAR VAS VAV VAW VBA VBG VBP VBS VBV VBY VCA VCD VCE VCL VCP VCR VCS VCT VCV VDA VDB VDC VDE VDH VDI VDM VDP VDR VDS VDY VDZ VEE VEL VER VEY VFA VGA VGD VGO VGT VGZ VHC VHM VHV VHY VHZ VIC VIE VIG VII VIJ VIL VIN VIR VIS VIT VIX VIY VKG VKO VKT VLC VLD VLG VLI VLK VLL VLM VLN VLP VLR VLS VLU VLV VLY VME VMU VNA VNC VNE VNO VNS VNT VNX VNY VOD VOG VOH VOK VOL VOZ VPE VPN VPS VPY VPZ VQQ VQS VRA VRB VRC VRE VRK VRL VRN VRO VRU VRY VSA VSE VSG VST VTB VTE VTM VTN VTU VTZ VUP VUS VVC VVI VVO VVZ VXC VXE VXO VYI VYS WAA WAE WAF WAG WAI WAL WAM WAQ WAR WAT WAW WBG WBM WBQ WBU WBW WCH WDH WDR WDS WEF WEH WEI WFI WFK WGA WGE WGN WGP WGT WHF WHK WHP WHU WIC WIE WIK WIL WIN WIO WIR WJF WJR WJU WKA WKB WKF WKI WKJ WKK WKL WKR WLD WLG WLH WLK WLS WMA WMB WMC WME WMH WMI WMN WMO WMP WMR WMT WMX WNA WNN WNP WNR WNS WNZ WOE WOL WOS WOT WPB WPC WPR WPU WRB WRE WRG WRI WRL WRO WRT WRY WRZ WSD WSN WSO WSP WSR WST WSY WSZ WTA WTB WTK WTN WTS WTZ WUA WUH WUN WUS WUT WUU WUX WUZ WVB WVI WVK WVN WWA WWD WWK WWR WWY WXN WYA WYE WYN WYS XAB XAP XAU XBE XBJ XCH XCR XCZ XEN XFN XFW XGN XGR XIC XIJ XIL XIQ XIY XJD XJM XKH XKS XLB XLS XMC XME XMH XMN XMS XMW XMY XNA XNN XOG XPK XPL XPP XQC XQP XRH XRR XRY XSB XSC XSD XSI XSP XTG XTL XTO XUZ XVS XXN XYA XYE YAA YAB YAC YAG YAH YAI YAK YAL YAM YAO YAP YAS YAT YAX YAY YAZ YBA YBB YBC YBE YBG YBI YBK YBL YBO YBP YBR YBS YBT YBV YBW YBX YBY YCB YCC YCD YCE YCG YCH YCK YCL YCM YCN YCO YCQ YCR YCS YCT YCU YCW YCY YDA YDB YDF YDG YDL YDN YDO YDP YDQ YDT YEC YEG YEI YEK YEL YEM YEN YEO YER YES YET YEU YEV YEY YFA YFB YFC YFE YFH YFJ YFO YFR YFS YFX YGB YGG YGH YGJ YGK YGL YGM YGO YGP YGQ YGR YGT YGV YGW YGX YGZ YHA YHB YHD YHE YHF YHI YHK YHM YHN YHO YHP YHR YHT YHU YHY YHZ YIB YIC YIE YIF YIH YIK YIN YIO YIP YIV YIW YJF YJN YJP YJT YKA YKF YKG YKH YKJ YKL YKM YKN YKO YKQ YKS YKU YKX YKY YKZ YLC YLD YLE YLH YLI YLJ YLK YLL YLR YLT YLW YLY YMA YME YMG YMH YMJ YML YMM YMN YMO YMS YMT YMW YMX YNA YNB YNC YND YNE YNG YNJ YNL YNM YNO YNP YNS YNT YNY YNZ YOA YOC YOD YOG YOH YOJ YOL YOO YOP YOS YOW YPA YPC YPD YPE YPG YPH YPJ YPL YPM YPN YPO YPQ YPR YPS YPW YPX YPY YQA YQB YQC YQD YQF YQG YQH YQI YQK YQL YQM YQN YQQ YQR YQS YQT YQU YQV YQW YQX YQY YQZ YRA YRB YRF YRG YRI YRJ YRL YRM YRO YRQ YRS YRT YRV YSB YSC YSD YSE YSF YSG YSH YSJ YSK YSL YSM YSN YSO YSP YSQ YSR YST YSU YSY YTA YTD YTE YTF YTH YTL YTM YTQ YTR YTS YTY YTZ YUA YUB YUD YUE YUL YUM YUS YUT YUX YUY YVA YVB YVC YVE YVG YVM YVO YVP YVQ YVR YVT YVV YVZ YWA YWB YWG YWH YWJ YWK YWL YWM YWP YWS YWY YXC YXD YXE YXH YXJ YXK YXL YXN YXP YXQ YXR YXS YXT YXU YXX YXY YXZ YYB YYC YYD YYE YYF YYG YYH YYJ YYL YYN YYQ YYR YYT YYU YYW YYY YYZ YZD YZE YZF YZG YZH YZP YZR YZS YZT YZU YZV YZW YZX YZY YZZ ZAC ZAD ZAG ZAH ZAJ ZAL ZAM ZAO ZAR ZAT ZAZ ZBF ZBM ZBO ZBR ZBY ZCL ZCN ZCO ZEC ZEM ZER ZFA ZFD ZFM ZFN ZGF ZGI ZGR ZGS ZGU ZHA ZHI ZHY ZIA ZIC ZIG ZIH ZIN ZIS ZIX ZJG ZJI ZJN ZKB ZKE ZKG ZKP ZLO ZLT ZMG ZMH ZMM ZMT ZNA ZND ZNE ZNF ZNZ ZOS ZPB ZPC ZPH ZQL ZQN ZQW ZQZ ZRH ZRJ ZSA ZSE ZSJ ZST ZSW ZTA ZTB ZTH ZTM ZTR ZTU ZUC ZUH ZUM ZVA ZVK ZWA ZWL ZXT ZYI ZYL ZZU ZZV".split(" "));

// seats.aero returns airport-local wall-clock times with a Z suffix. Preserve
// the supplied date/time instead of applying another timezone conversion.
// https://developers.seats.aero/reference/concepts-copy#availability-trips
const CABIN_TRIP_KEY = { Y: "economy", W: "premium", J: "business", F: "first" };

function localParts(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?Z$/.exec(value);
  return match && isCalendarDate(match[1])
    ? { date: match[1], time: `${match[2]}:${match[3]}` } : null;
}

function formatTime(value) {
  return localParts(value)?.time || "Time unavailable";
}

function getLocalDate(value) {
  return localParts(value)?.date || null;
}

function dayDiff(dateA, dateB) {
  if (!dateA || !dateB) return 0;
  return Math.round((Date.parse(dateB) - Date.parse(dateA)) / 86400000);
}

function formatDuration(minutes) {
  const m = Math.max(0, minutes | 0);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

function pickBestTrip(trips, min, max) {
  const match = trips.filter((t) => {
    const miles = Number(t.MileageCost);
    return Number.isFinite(miles) && miles > 0 && miles >= min && miles <= max;
  });
  if (!match.length) return null;
  match.sort((a, b) => {
    if ((a.Stops || 0) !== (b.Stops || 0)) return (a.Stops || 0) - (b.Stops || 0);
    if ((a.TotalDuration || 0) !== (b.TotalDuration || 0))
      return (a.TotalDuration || 0) - (b.TotalDuration || 0);
    return (a.MileageCost || 0) - (b.MileageCost || 0);
  });
  return match[0];
}

// Validate one or more comma-separated airport codes. Returns an error
// message, or null when every code is a real 3-letter IATA code.
function checkAirports(value, label) {
  if (!/^[A-Z]{3}(,[A-Z]{3})*$/.test(value))
    return `${label} must be a 3-letter airport code (e.g. JFK).`;
  for (const code of value.split(",")) {
    if (!AIRPORT_CODES.has(code))
      return `${label}: "${code}" is not a recognized airport code.`;
  }
  return null;
}

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
  if (!isRecord(body)) return json({ error: "Invalid request." }, 400);
  const textFields = ["origin", "destination", "startDate", "endDate", "email", "name", "company"];
  const listFields = { programs: PROGRAM_NAMES, cardPoints: CARD_TRANSFER_PARTNERS, cabins: CABIN_KEYS, helpWith: HELP_OPTIONS };
  if (textFields.some((key) => body[key] != null && typeof body[key] !== "string") ||
      ["maxOpen", "surprise"].some((key) => body[key] != null && typeof body[key] !== "boolean") ||
      Object.entries(listFields).some(([key, allowed]) => body[key] != null &&
        (!Array.isArray(body[key]) || body[key].some((value) => typeof value !== "string" || !Object.hasOwn(allowed, value))))) {
    return json({ error: "Invalid search fields." }, 400);
  }

  // Honeypot — bots fill the hidden "company" field. Pretend success, do nothing.
  if (body.company) return json({ ok: true, count: 0 });

  const programs = Array.isArray(body.programs)
    ? [...new Set(body.programs)]
    : [];
  const cardPoints = Array.isArray(body.cardPoints)
    ? [...new Set(body.cardPoints)]
    : [];
  // Expand each selected card currency into its airline transfer partners,
  // then union with directly-picked airline programs (deduped).
  const sourceSet = new Set(programs.filter((p) => PROGRAM_NAMES[p]));
  for (const c of cardPoints) {
    for (const p of CARD_TRANSFER_PARTNERS[c]) sourceSet.add(p);
  }
  const allSources = [...sourceSet];
  const balanceMin = body.balanceMin;
  const balanceMax = body.balanceMax;
  const maxOpen = body.maxOpen === true; // slider at ceiling = no upper limit
  const effectiveMax = maxOpen ? Infinity : balanceMax;
  const MAX_POINTS = 500000;
  const origin = String(body.origin || "").toUpperCase().replace(/\s+/g, "");
  const surprise = body.surprise === true;
  const destination = surprise
    ? ""
    : String(body.destination || "").toUpperCase().replace(/\s+/g, "");
  const startDate = String(body.startDate || "").trim();
  const endDate = String(body.endDate || "").trim();
  const cabins = Array.isArray(body.cabins)
    ? [...new Set(body.cabins)]
    : [];
  const helpWith = Array.isArray(body.helpWith)
    ? [...new Set(body.helpWith)]
    : [];
  const email = String(body.email || "").trim();
  const name = String(body.name || "").trim().slice(0, 80);

  const errors = [];

  if (programs.length > 3)
    errors.push("Pick at most 3 airline programs directly.");
  if (allSources.length < 1)
    errors.push("Pick at least one credit card or airline program.");
  if (!Number.isSafeInteger(balanceMin) || !Number.isSafeInteger(balanceMax))
    errors.push("Enter both min and max points budget.");
  else if (balanceMin < 0 || balanceMax > MAX_POINTS)
    errors.push(`Points budget must be between 0 and ${MAX_POINTS.toLocaleString("en-US")}.`);
  else if (balanceMin >= balanceMax)
    errors.push("Min points budget must be less than max.");
  const originErr = checkAirports(origin, "Origin");
  if (originErr) errors.push(originErr);
  if (!surprise) {
    const destErr = checkAirports(destination, "Destination");
    if (destErr) errors.push(destErr);
  }
  if (!isCalendarDate(startDate) || !isCalendarDate(endDate))
    errors.push("Enter valid departure dates.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    errors.push("Enter a valid email address.");
  if (!name) errors.push("Enter your name.");
  if (origin.length > 23 || destination.length > 23) errors.push("Enter at most six airports per field.");
  if (email.length > 254) errors.push("Email address is too long.");
  if (cabins.length === 0) {
    errors.push("Pick at least one cabin.");
  } else {
    for (const c of cabins) {
      if (!CABIN_KEYS[c]) { errors.push(`Unknown cabin: ${c}.`); break; }
    }
  }
  if (errors.length) return json({ error: errors.join(" ") }, 400);

  if (endDate < startDate)
    return json({ error: "Latest departure must be on or after the earliest." }, 400);
  // Reject past dates (1-day grace so timezone offsets don't reject a valid "today")
  const earliestAllowed = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (startDate < earliestAllowed)
    return json({ error: "Departure dates must be in the future." }, 400);
  const rangeDays = (Date.parse(endDate) - Date.parse(startDate)) / 86400000;
  if (rangeDays > MAX_RANGE_DAYS)
    return json({ error: `Keep the date range within ${MAX_RANGE_DAYS} days (4 weeks).` }, 400);

  const cabinKeys = cabins.map((c) => CABIN_KEYS[c]);
  const cabinLabels = cabinKeys.map((k) => CABIN_LABEL[k]);
  const cabinsText = cabinLabels.length === 4 ? "Any cabin" : cabinLabels.join(", ");

  // --- Search seats.aero ---------------------------------------------------
  const searchUrl = new URL("https://seats.aero/partnerapi/search");
  searchUrl.searchParams.set("origin_airport", origin);
  searchUrl.searchParams.set(
    "destination_airport",
    surprise ? SURPRISE_ALL.join(",") : destination
  );
  searchUrl.searchParams.set("start_date", startDate);
  searchUrl.searchParams.set("end_date", endDate);
  searchUrl.searchParams.set("sources", allSources.join(","));
  searchUrl.searchParams.set("take", String(SEARCH_PAGE_SIZE));
  searchUrl.searchParams.set("cabins", cabins.join(","));
  searchUrl.searchParams.set("order_by", "lowest_mileage");
  searchUrl.searchParams.set("include_trips", "true");

  let items = [];
  try {
    const signal = AbortSignal.timeout(30000);
    const seen = new Set();
    let skip = 0;
    for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
      const res = await fetch(searchUrl, {
        headers: { "Partner-Authorization": env.SEATS_AERO_KEY, Accept: "application/json" },
        signal,
      });
      if (!res.ok) throw new Error("Search provider error");
      const data = await res.json();
      if (!isRecord(data) || !Array.isArray(data.data)) throw new Error("Invalid provider response");
      for (const item of data.data) {
        if (!isRecord(item)) throw new Error("Invalid availability");
        const id = item.ID || `${item.Source}:${item.Date}:${item.Route?.OriginAirport}:${item.Route?.DestinationAirport}`;
        if (!seen.has(id)) { seen.add(id); items.push(item); }
      }
      const hasMore = data.hasMore ?? (data.data.length === SEARCH_PAGE_SIZE);
      if (!hasMore) break;
      if (page === MAX_SEARCH_PAGES - 1) {
        return json({ error: "This search is too broad to finish. Please narrow your dates or airports and try again." }, 422);
      }
      if (!data.data.length) throw new Error("Empty continuation page");
      if (page === 0) {
        if (!Number.isSafeInteger(data.cursor)) throw new Error("Missing search cursor");
        searchUrl.searchParams.set("cursor", String(data.cursor));
      }
      skip += data.data.length;
      searchUrl.searchParams.set("skip", String(skip));
    }
  } catch {
    return json(
      { error: "Award search is temporarily unavailable. Please try again shortly." },
      502
    );
  }

  // --- Filter to options the traveler can afford ---------------------------
  const options = [];
  for (const item of items) {
    if (!allSources.includes(item.Source)) continue;
    for (const key of cabinKeys) {
      if (!item[key + "Available"]) continue;
      const trips = Array.isArray(item.AvailabilityTrips)
        ? item.AvailabilityTrips.filter((t) => isRecord(t) && t.Cabin === CABIN_TRIP_KEY[key]) : [];
      const trip = pickBestTrip(trips, balanceMin, effectiveMax);
      // Known itineraries outside the budget must not fall back to a cheap summary price.
      if (trips.length && !trip) continue;
      const miles = Number(trip ? trip.MileageCost : item[key + "MileageCostRaw"]);
      if (!Number.isFinite(miles) || miles <= 0 || miles < balanceMin || miles > effectiveMax) continue;
      const rawTax = trip ? trip.TotalTaxes : item[key + "TotalTaxesRaw"];
      const taxesCents = rawTax != null && rawTax !== "" && Number.isFinite(Number(rawTax)) && Number(rawTax) >= 0 && item.Source !== "qatar"
        ? Number(rawTax) : null;
      options.push({
        date: item.Date,
        programShort: PROGRAM_SHORT[item.Source] || item.Source,
        programName: PROGRAM_NAMES[item.Source] || item.Source,
        origin: item.Route ? item.Route.OriginAirport : origin,
        destination: item.Route ? item.Route.DestinationAirport : destination,
        cabin: CABIN_LABEL[key],
        miles,
        taxesCents,
        currency: (trip ? trip.TaxesCurrency : item.TaxesCurrency) || "",
        airlines: item[key + "Airlines"] || "",
        direct: trip ? trip.Stops === 0 : false,
        trip,
      });
    }
  }
  options.sort((a, b) => {
    if (surprise) {
      const ta = SURPRISE_TIER.get(a.destination) || 99;
      const tb = SURPRISE_TIER.get(b.destination) || 99;
      if (ta !== tb) return ta - tb;
    }
    return a.miles - b.miles;
  });
  const shown = options.slice(0, MAX_RESULTS_IN_EMAIL);

  // --- Email the traveler --------------------------------------------------
  const programNames = allSources.map((p) => PROGRAM_NAMES[p]);
  const cardNames = cardPoints.map((c) => CARD_NAMES[c]);
  const destinationText = surprise ? "Anywhere ✨" : destination;
  const subject =
    options.length > 0
      ? `${options.length} award option${options.length > 1 ? "s" : ""}: ${origin} → ${destinationText}`
      : `No award space yet: ${origin} → ${destinationText}`;

  const html = renderEmail({
    name,
    programNames,
    cardNames,
    balanceMin,
    balanceMax,
    maxOpen,
    origin,
    destinationText,
    surprise,
    startDate,
    endDate,
    cabinsText,
    helpWith,
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

function buildTeaser(rest) {
  if (!rest.length) return "";
  const byCabin = {};
  for (const o of rest) {
    if (!byCabin[o.cabin]) byCabin[o.cabin] = { count: 0, minMiles: Infinity };
    byCabin[o.cabin].count++;
    if (o.miles < byCabin[o.cabin].minMiles) byCabin[o.cabin].minMiles = o.miles;
  }
  const parts = Object.entries(byCabin)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([cabin, info]) =>
      `${info.count} ${cabin.toLowerCase()} from ${fmt(info.minMiles)} mi`
    );
  return `
    <div style="margin-top:6px;padding:14px 16px;background:#eef5fa;border:1px dashed #b9d6e8;border-radius:10px;font-size:13px;color:#5d7a8c;line-height:1.5;">
      <strong style="color:#0b1d2a;">+ ${rest.length} more option${rest.length > 1 ? "s" : ""}</strong> — ${parts.join(" · ")}.<br/>
      Reply to this email and we'll send you the full list.
    </div>`;
}

function formatDateLabel(isoDate) {
  try {
    const d = new Date(isoDate + "T00:00:00Z");
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return isoDate;
  }
}

function renderOption(o) {
  const taxesText = o.taxesCents == null ? "Taxes not provided"
    : `+ ${o.currency ? esc(o.currency) + " " : ""}${(o.taxesCents / 100).toFixed(2)}${o.currency ? "" : " (currency not provided)"}`;
  const trip = o.trip;
  const carrierCodes = String((trip && trip.Carriers) || o.airlines || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z0-9]{2}$/.test(c));
  const primaryAirline = carrierCodes[0] || "";
  const logoImg = primaryAirline
    ? `<img src="https://images.kiwi.com/airlines/64x64/${primaryAirline}.png" alt="" width="28" height="28" style="display:inline-block;vertical-align:middle;border-radius:4px;background:#fff;margin-right:8px;" />`
    : "";
  let routeBlock;
  if (trip) {
    const depTime = formatTime(trip.DepartsAt);
    const arrTime = formatTime(trip.ArrivesAt);
    const depDate = getLocalDate(trip.DepartsAt);
    const arrDate = getLocalDate(trip.ArrivesAt);
    const daysOffset = dayDiff(depDate, arrDate);
    const arrSuffix = daysOffset !== 0
      ? ` <span style="color:#94a3b8;font-weight:400;">${daysOffset > 0 ? "+" : ""}${daysOffset}d</span>`
      : "";
    const stops = trip.Stops || 0;
    const stopsLabel = stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`;
    const viaLabel = stops > 0 && Array.isArray(trip.Connections) && trip.Connections.length
      ? ` via ${trip.Connections.map(esc).join(" · ")}`
      : "";
    const duration = formatDuration(trip.TotalDuration || 0);
    const flights = trip.FlightNumbers ? esc(String(trip.FlightNumbers).replace(/, /g, " + ")) : "";
    routeBlock = `
      <div style="margin-top:10px;font-size:14px;color:#0b1d2a;">
        <strong>${esc(o.origin)} ${depTime}</strong>
        <span style="color:#94a3b8;"> → </span>
        <strong>${esc(o.destination)} ${arrTime}</strong>${arrSuffix}
      </div>
      <div style="margin-top:4px;font-size:12px;color:#5d7a8c;">
        ${esc(stopsLabel)}${viaLabel} · ${duration}${flights ? ` · ${flights}` : ""} · Airport-local times
      </div>`;
  } else {
    routeBlock = `<div style="margin-top:8px;font-size:13px;color:#5d7a8c;">${esc(o.origin)} → ${esc(o.destination)} · Flight details unavailable; confirm the itinerary with the airline.</div>`;
  }

  return `
    <div style="border:1px solid #e3eef5;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#fff;">
      <table role="presentation" style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-weight:600;font-size:14px;color:#0b1d2a;vertical-align:top;">
            ${logoImg}<span style="vertical-align:middle;">${esc(formatDateLabel(o.date))} · ${esc(o.cabin)}</span>
            <div style="font-weight:400;font-size:12px;color:#5d7a8c;margin-top:2px;${logoImg ? "padding-left:36px;" : ""}">${esc(o.programShort)}${primaryAirline && o.programShort.toUpperCase() !== primaryAirline ? ` · operated by ${primaryAirline}` : ""}</div>
          </td>
          <td style="font-weight:600;font-size:14px;color:#0b1d2a;text-align:right;white-space:nowrap;vertical-align:top;">
            ${fmt(o.miles)} mi
            <div style="font-weight:400;font-size:12px;color:#5d7a8c;margin-top:2px;">${taxesText}</div>
          </td>
        </tr>
      </table>
      ${routeBlock}
    </div>`;
}

function renderEmail(d) {
  const accent = "#caa24a";
  const ink = "#0b1d2a";

  const programsText = d.programNames.join(", ");
  const budgetText = `${fmt(d.balanceMin)}–${fmt(d.balanceMax)}${d.maxOpen ? "+" : ""} points`;
  const routeText = `${d.origin} → ${d.destinationText}`;
  const surpriseSuffix = d.surprise
    ? " Major hubs are listed first, then smaller destinations."
    : "";
  const greeting = d.name ? `Hi ${esc(d.name)},<br/><br/>` : "";
  const intro =
    d.options.length > 0
      ? `${greeting}Here ${d.options.length === 1 ? "is an option" : "are some options"} we found between <strong>${budgetText}</strong> across <strong>${programsText}</strong>.${surpriseSuffix}`
      : `${greeting}We searched <strong>${programsText}</strong> for ${routeText} but didn't find award space in the <strong>${budgetText}</strong> range for those dates. Award seats open up constantly — it's worth trying a wider date range or a nearby airport.`;

  const cards = d.options.length > 0
    ? d.shown.map((o) => renderOption(o)).join("")
    : "";

  const rest = d.options.slice(d.shown.length);
  const teaser = rest.length ? buildTeaser(rest) : "";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#eef5fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${ink};">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <h1 style="font-size:24px;margin:0 0 4px;">myjetset<span style="color:${accent};">.</span>life</h1>
    <p style="color:#5d7a8c;font-size:13px;margin:0 0 24px;">Award flight options</p>

    <p style="font-size:15px;line-height:1.5;">${intro}</p>

    ${cards}
    ${teaser}

    ${(d.helpWith && d.helpWith.length > 0)
      ? `<div style="margin-top:18px;padding:14px 16px;background:#fff6dc;border:1px solid #f1d98f;border-radius:10px;font-size:13px;color:#5b4400;line-height:1.5;">
          <strong style="color:#2a1b00;">We can also help with:</strong>
          ${d.helpWith.map((h) => ({hotel:"Hotel",car:"Car rental",activities:"Activities",insurance:"Travel insurance"}[h])).join(", ")}.<br/>
          We'll follow up with options shortly.
        </div>`
      : ""}

    <div style="margin-top:24px;padding:14px 16px;background:#fff;border-radius:10px;font-size:13px;color:#5d7a8c;line-height:1.5;">
      <strong style="color:${ink};">Your search</strong><br/>
      ${(d.cardNames && d.cardNames.length) ? `${d.cardNames.join(", ")} · ` : ""}${fmt(d.balanceMin)}–${fmt(d.balanceMax)}${d.maxOpen ? "+" : ""} points · ${d.origin} → ${d.destinationText}<br/>
      Searched: ${d.programNames.join(", ")}<br/>
      Departing ${d.startDate} to ${d.endDate} · ${d.cabinsText}
    </div>

    <p style="font-size:13px;color:#5d7a8c;line-height:1.5;margin-top:24px;">
      Costs and taxes are estimates from cached award data and can change
      before you book. Reply to this email if you'd like help.
    </p>
    <p style="font-size:12px;color:#9bb0bd;margin-top:20px;">© myjetset.life</p>
  </div>
</body>
</html>`;
}
