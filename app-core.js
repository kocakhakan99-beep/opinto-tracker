// Opinto-tracker — app.js
// v4: rebrand, tabs, dark/light, deadlinet, piirtotaulu placeholder

const MAX_CREDITS = 210;
const STORAGE_KEY = "opintotracker.v4";

const $ = (sel, root = document) => root.querySelector(sel);

function uid() {
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function asNumber(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(n) { return Math.round(n * 100) / 100; }
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function cssEsc(s) { return String(s).replaceAll('"', '\\"'); }

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════

function defaultState() {
  return {
    version: 4,
    theme: "dark",
    onlyCompleted: false,
    colorScheme: "default",
    periods: [
      {
        id: uid(), name: "Lukujakso 1",
        courses: [{
          id: uid(), name: "Esimerkkikurssi", credits: 5, display: false, target: 4, status: "tuleva",
          modules: [
            { id: uid(), name: "Moduuli 1", weight: 40, gradeMode: "numeric", grade: null },
            { id: uid(), name: "Moduuli 2", weight: 60, gradeMode: "numeric", grade: null }
          ]
        }]
      }
    ],
    deadlines: []
  };
}

function normalizeModule(m) {
  return {
    id: m.id || uid(),
    name: (m.name ?? "Moduuli").toString(),
    weight: clamp(asNumber(m.weight) ?? 0, 0, 100),
    gradeMode: m.gradeMode === "hyvhyl" ? "hyvhyl" : "numeric",
    grade: m.gradeMode === "hyvhyl"
      ? (m.grade === "hyvaksytty" || m.grade === "hylatty" ? m.grade : null)
      : asNumber(m.grade)
  };
}

function normalizeDeadline(d) {
  return {
    id: d.id || uid(),
    name: (d.name ?? "").toString(),
    date: (d.date ?? "").toString(),
    type: ["tehtava", "ryhmatyo", "koe"].includes(d.type) ? d.type : "tehtava",
    done: !!(d.done ?? false),
    courseId: (d.courseId ?? "").toString()
  };
}

function normalizeState(s) {
  const out = {
    version: 4,
    theme: ["dark", "light"].includes(s.theme) ? s.theme : "dark",
    onlyCompleted: !!(s.onlyCompleted),
    colorScheme: typeof s.colorScheme === "string" ? s.colorScheme : "default",
    periods: [],
    deadlines: Array.isArray(s.deadlines) ? s.deadlines.map(normalizeDeadline) : []
  };
  for (const p of (s.periods || [])) {
    out.periods.push({
      id: p.id || uid(),
      name: (p.name ?? "Lukujakso").toString(),
      courses: (p.courses || []).map(c => ({
        id: c.id || uid(),
        name: (c.name ?? "Kurssi").toString(),
        credits: asNumber(c.credits) ?? 0,
        display: !!(c.display ?? false),
        target: asNumber(c.target),
        modules: Array.isArray(c.modules) ? c.modules.map(normalizeModule) : [],
        status: ["tuleva","kaynnissa","suoritettu"].includes(c.status) ? c.status : "tuleva"
      }))
    });
  }
  if (out.periods.length === 0) out.periods = defaultState().periods;
  return out;
}

function loadState() {
  const oldKeys = ["vibecodata.schoolprogress.v3", "vibecodata.schoolprogress.v2", "vibecodata.schoolprogress.v1"];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.periods)) return normalizeState(p);
    }
    for (const key of oldKeys) {
      const r = localStorage.getItem(key);
      if (r) {
        const p = JSON.parse(r);
        if (p && Array.isArray(p.periods)) {
          const m = normalizeState(p);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
          return m;
        }
      }
    }
  } catch { /* fall through */ }
  return defaultState();
}

function saveState(showToast = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (showToast) toast("Tallennettu");
}

// ═══════════════════════════════════════
// MODULE / COURSE METRICS
// ═══════════════════════════════════════

function moduleWeightSum(modules) {
  return round2(modules.reduce((a, m) => a + (asNumber(m.weight) ?? 0), 0));
}

function moduleIsGraded(m) {
  if (m.gradeMode === "hyvhyl") return m.grade === "hyvaksytty" || m.grade === "hylatty";
  return asNumber(m.grade) !== null;
}

function courseCompletion(course) {
  if (!course.modules || course.modules.length === 0) return 0;
  const graded = course.modules.filter(m => moduleIsGraded(m))
    .reduce((a, m) => a + (asNumber(m.weight) ?? 0), 0);
  return clamp(round2(graded), 0, 100);
}

function courseGradeRaw(course) {
  if (!course.modules || course.modules.length === 0) return null;
  const allNumeric = course.modules.filter(m => m.gradeMode === "numeric");
  if (allNumeric.length === 0) return null;
  const graded = allNumeric.filter(m => asNumber(m.grade) !== null);
  if (graded.length === 0) return null;
  const gradedWeight = graded.reduce((a, m) => a + (asNumber(m.weight) ?? 0), 0);
  if (gradedWeight === 0) return null;
  const wSum = graded.reduce((a, m) => a + asNumber(m.grade) * (asNumber(m.weight) ?? 0), 0);
  return round2(wSum / gradedWeight);
}

function courseGrade(course) {
  const raw = courseGradeRaw(course);
  return raw === null ? null : Math.round(raw);
}

function courseGradeDisplay(course) {
  const raw = courseGradeRaw(course);
  if (raw === null) return "—";
  const rounded = Math.round(raw);
  if (raw === rounded) return String(rounded);
  return `${rounded} (${String(raw).replace(".", ",")})`;
}

function deriveCourseStatus(course) {
  const completion = courseCompletion(course);
  if (completion >= 100) return "suoritettu";
  const modules = course.modules || [];
  if (modules.length === 0) return "tuleva";
  const anyGraded = modules.some(m => moduleIsGraded(m));
  return anyGraded ? "kaynnissa" : "tuleva";
}

function requiredGradeForModule(course, moduleId) {
  const target = asNumber(course.target);
  if (target === null) return null;
  const modules = course.modules || [];
  const mod = modules.find(m => m.id === moduleId);
  if (!mod || mod.gradeMode !== "numeric" || moduleIsGraded(mod)) return null;
  const allNumeric = modules.filter(m => m.gradeMode === "numeric");
  const totalW = allNumeric.reduce((a, m) => a + (asNumber(m.weight) ?? 0), 0);
  if (totalW === 0) return null;
  const gradedNumeric = allNumeric.filter(m => moduleIsGraded(m));
  const gradedWSum = gradedNumeric.reduce((a, m) => a + asNumber(m.grade) * (asNumber(m.weight) ?? 0), 0);
  const ungradedW = allNumeric.filter(m => !moduleIsGraded(m))
    .reduce((a, m) => a + (asNumber(m.weight) ?? 0), 0);
  if (ungradedW === 0) return null;
  const needed = ((target - 0.5) * totalW - gradedWSum) / ungradedW;
  return round2(needed);
}

// ═══════════════════════════════════════
// GLOBAL METRICS
// ═══════════════════════════════════════

function getAllCourses() {
  return state.periods.flatMap(p => p.courses.map(c => ({ ...c, periodId: p.id })));
}

function completedCredits() {
  return round2(getAllCourses()
    .filter(c => courseCompletion(c) >= 100)
    .reduce((a, c) => a + (asNumber(c.credits) ?? 0), 0));
}

function plannedCredits() {
  return round2(getAllCourses().reduce((a, c) => a + (asNumber(c.credits) ?? 0), 0));
}

function remainingCredits() { return round2(Math.max(0, MAX_CREDITS - completedCredits())); }
function progressPct() { return clamp((completedCredits() / MAX_CREDITS) * 100, 0, 100); }

function averageGrade() {
  const grades = getAllCourses()
    .filter(c => !state.onlyCompleted || courseCompletion(c) >= 100)
    .map(c => courseGrade(c)).filter(n => n !== null);
  if (!grades.length) return null;
  return round2(grades.reduce((a, b) => a + b, 0) / grades.length);
}

function periodMetrics(periodId) {
  const p = state.periods.find(x => x.id === periodId);
  if (!p) return { planned: 0, completed: 0, avg: null };
  const planned = round2(p.courses.reduce((a, c) => a + (asNumber(c.credits) ?? 0), 0));
  const completed = round2(p.courses.filter(c => courseCompletion(c) >= 100)
    .reduce((a, c) => a + (asNumber(c.credits) ?? 0), 0));
  const grades = p.courses
    .filter(c => !state.onlyCompleted || courseCompletion(c) >= 100)
    .map(c => courseGrade(c)).filter(n => n !== null);
  const avg = grades.length ? round2(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
  return { planned, completed, avg };
}

// ═══════════════════════════════════════
// ICONS
// ═══════════════════════════════════════

const ICONS = {
  plus:     `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  trash:    `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  pencil:   `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  check:    `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
  layers:   `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 6-10 6L2 8l10-6Z"/><path d="m2 12 10 6 10-6"/><path d="m2 16 10 6 10-6"/></svg>`,
  download: `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>`,
  upload:   `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>`,
  chevron:  `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  calendar: `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>`,
  book:     `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  edit2:    `<svg class="iconSvg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>`
};

function mountIcons() {
  $("#icoPlus").innerHTML    = ICONS.plus;
  $("#icoPlus2").innerHTML   = ICONS.plus;
  $("#icoCheck").innerHTML   = ICONS.check;
  $("#icoLayers").innerHTML  = ICONS.layers;
  $("#icoDownload").innerHTML = ICONS.download;
  $("#icoUpload").innerHTML  = ICONS.upload;
  $("#icoTabOpinnot").innerHTML = ICONS.book;
  $("#icoTabDl").innerHTML   = ICONS.calendar;
  $("#icoTabPiirto").innerHTML = ICONS.edit2;
  $("#icoDeadline").innerHTML = ICONS.calendar;
}

// ═══════════════════════════════════════

// THEME
// ═══════════════════════════════════════

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  state.theme = theme;
}

// ═══════════════════════════════════════
// CSV HELPERS
// ═══════════════════════════════════════

function csvEsc2(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

function parseCsvLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQ = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQ = true; }
      else if (ch === ',') { result.push(cur); cur = ""; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter(l => l.trim() !== "");
  if (lines.length < 2) throw new Error("Tyhjä tai virheellinen CSV");
  const header = parseCsvLine(lines[0]);
  if (header[0] !== "type") throw new Error("Tuntematon CSV-muoto");
  const periods = []; let curPeriod = null; let curCourse = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const type = cols[0];
    if (type === "period") {
      curCourse = null;
      curPeriod = { id: uid(), name: cols[1] || "Lukujakso", courses: [] };
      periods.push(curPeriod);
    } else if (type === "course") {
      if (!curPeriod) { curPeriod = { id: uid(), name: cols[1] || "Lukujakso", courses: [] }; periods.push(curPeriod); }
      curCourse = { id: uid(), name: cols[2] || "", credits: asNumber(cols[3]) ?? 0, display: cols[4] === "true", target: asNumber(cols[5]), modules: [] };
      curPeriod.courses.push(curCourse);
    } else if (type === "module") {
      if (cols[2] !== "") {
        if (!curPeriod) { curPeriod = { id: uid(), name: cols[1] || "Lukujakso", courses: [] }; periods.push(curPeriod); }
        curCourse = { id: uid(), name: cols[2] || "", credits: asNumber(cols[3]) ?? 0, display: cols[4] === "true", target: asNumber(cols[5]), modules: [] };
        curPeriod.courses.push(curCourse);
      }
      if (!curCourse) throw new Error(`Rivi ${i + 1}: moduuli ilman kurssia`);
      const gm = cols[8] === "hyvhyl" ? "hyvhyl" : "numeric";
      const grade = gm === "hyvhyl"
        ? (cols[9] === "hyvaksytty" || cols[9] === "hylatty" ? cols[9] : null)
        : asNumber(cols[9]);
      curCourse.modules.push({ id: uid(), name: cols[6] || "", weight: clamp(asNumber(cols[7]) ?? 0, 0, 100), gradeMode: gm, grade });
    }
  }
  if (!periods.length) throw new Error("Ei lukujaksoja");
  return { version: 4, theme: state.theme, onlyCompleted: state.onlyCompleted, periods, deadlines: state.deadlines || [] };
}

// ── Deadline helpers ──
function getDeadlinesForCourse(courseId) {
  return (state.deadlines || []).filter(d => d.courseId === courseId && !d.done);
}

function deadlineUrgencyClass(dateStr) {
  if (!dateStr) return "dl-u-blue";
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return "dl-u-red";
  if (days < 7) return "dl-u-red";
  if (days < 14) return "dl-u-yellow";
  return "dl-u-blue";
}

// ═══════════════════════════════════════

// TOAST
// ═══════════════════════════════════════

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  $("#toastText").textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
}

// ═══════════════════════════════════════

// ═══════════════════════════════════════
// COURSE CATALOG
// ═══════════════════════════════════════

// Common Finnish university course catalog (user can extend)
const COURSE_CATALOG = [
  { name: "Liiketoimintaosaaminen", credits: 10 },
  { name: "Yritysjuridiikka", credits: 5 },
  { name: "Markkinoinnin perusteet", credits: 10 },
  { name: "Svenska för tradenomer", credits: 5 },
  { name: "Liiketoiminnan suunnittelu", credits: 10 },
  { name: "Laskentatoimi", credits: 10 },
  { name: "Johtaminen ja johtajuus", credits: 5 },
  { name: "Professional Communication in English", credits: 5 },
  { name: "Service Design", credits: 10 },
  { name: "Corporate Social Responsibility", credits: 5 },
  { name: "Digital Marketing and Sales", credits: 10 },
  { name: "Data-driven Decision Making", credits: 5 },
  { name: "Harjoittelu 1", credits: 15 },
  { name: "Harjoittelu 2", credits: 15 },
  { name: "Projektinhallinta ja viestintä", credits: 5 },
  { name: "Tutkimuksellisen kehitystyön menetelmät", credits: 5 },
  { name: "Opinnäytetyö", credits: 15 },
  { name: "Osaamisidentiteettiä rakentamassa", credits: 2 },
  { name: "Osaajana kehittyminen", credits: 2 },
  { name: "Tulevaisuusorientoitunut työelämäosaaja", credits: 1 },
  { name: "Strateginen henkilöstöjohtaminen", credits: 5 },
  { name: "Uudistumisen ja osaamisen johtaminen", credits: 5 },
  { name: "Työnantajakuva ja moderni rekrytointi", credits: 5 },
  { name: "Organisaatiokulttuuri ja työntekijäkokemus", credits: 5 },
  { name: "Fasilitointi ja osallistaminen", credits: 5 },
  { name: "Johtajuus tänään", credits: 5 },
  { name: "Motivaatio ja suorituksen johtaminen", credits: 5 },
  { name: "Monimuotoisuuden johtaminen", credits: 5 },
  { name: "Haasteelliset lähijohtamisen tilanteet", credits: 5 },
  { name: "Työoikeus", credits: 5 },
  { name: "Henkilöstöjohtamisen kehittämisen projekti", credits: 15 },
  { name: "Työnantajamielikuvan ja työntekijäkokemuksen kehittämisen projekti", credits: 15 },
  { name: "Henkilöstöjohtamisen uudistamisen projekti", credits: 15 },
  { name: "Content Marketing", credits: 5 },
  { name: "Digital Analytics and Consumer Insight", credits: 5 },
  { name: "Building Webpages with Online Shop Functionality", credits: 5 },
  { name: "Sosiaalisen median ja markkinoinnin automatisoinnin viimeisimmät trendit", credits: 5 },
  { name: "Exporting Services", credits: 5 },
  { name: "Myynti ja asiakkuuksien johtaminen", credits: 10 },
  { name: "Asiantuntijamyynti", credits: 5 },
  { name: "Asiantuntijamyynti 2", credits: 5 },
  { name: "Brändin johtaminen ja kehittäminen", credits: 5 },
  { name: "Monikanavainen markkinointiviestintä", credits: 10 },
  { name: "Kestävä liiketoiminta 1", credits: 5 },
  { name: "Kestävän liiketoiminnan kehittäminen palvelumuotoilun keinoin 2", credits: 10 },
  { name: "Tuloslaskenta", credits: 5 },
  { name: "Tilinpäätösanalyysi", credits: 5 },
  { name: "Yritysrahoitus", credits: 5 },
  { name: "Talouden tietojärjestelmät", credits: 5 },
  { name: "Talousohjaus", credits: 10 },
  { name: "Palkanlaskenta", credits: 5 },
  { name: "Konsernitilinpäätös", credits: 5 },
  { name: "Verotus", credits: 5 },
  { name: "Talouden tarkastus", credits: 5 },
  { name: "Rahoitus- ja arvopaperimarkkinat", credits: 5 },
  { name: "Sijoitustoiminta käytännössä", credits: 5 },
  { name: "Sijoitustoiminta käytännössä 2", credits: 5 },
  { name: "Rahoitusalan ajankohtaiset ilmiöt", credits: 5 },
  { name: "Sijoitus- ja finanssikirjallisuus", credits: 5 },
  { name: "Pankki- ja vakuutusalan yritysyhteistyö", credits: 5 },
  { name: "IT-palveluiden hallinta ja arkkitehtuuri", credits: 5 },
  { name: "Business Control", credits: 5 },
  { name: "Strategic Management Accounting", credits: 5 },
  { name: "Capital Budgeting", credits: 5 },
  { name: "Cost Accounting", credits: 5 },
  { name: "Corporate Finance and International Economics", credits: 5 },
  { name: "International Accounting", credits: 5 },
  { name: "Hallinto- ja kunnallisoikeus", credits: 5 },
  { name: "Valtiosääntö- ja EU-oikeus", credits: 10 },
  { name: "Rikosoikeus ja prosessioikeus", credits: 10 },
  { name: "Svenska för juridisk expertis", credits: 5 },
  { name: "Yhtiö- ja rahoitusoikeus", credits: 5 },
  { name: "Insolvenssioikeus", credits: 5 },
  { name: "Perhe- ja jäämistöoikeus", credits: 5 },
  { name: "Sopimus- ja velvoiteoikeus", credits: 5 },
  { name: "Oikeus tutkimuskohteena", credits: 5 },
  { name: "Projektipäällikkönä toimiminen", credits: 10 },
  { name: "Projektipäällikkövalmennus", credits: 10 },
  { name: "Projektijohtajan menetelmät ja työkalut", credits: 5 },
  { name: "Projektiviestinnnän asiantuntija", credits: 5 },
  { name: "Kansainvälisen projektitiimin johtaminen", credits: 5 },
  { name: "Projektin talousohjaus ja budjetointi", credits: 5 },
  { name: "Innostu yrittämään", credits: 1 },
  { name: "Oman yritystoiminnan kehittäminen", credits: 15 },
  { name: "Yrittäjyys osana uraa", credits: 5 },
  { name: "Osakkuus osana uraa", credits: 5 },
];

function openCoursePicker(periodId) {
  // Remove existing picker
  document.querySelectorAll(".course-picker-modal").forEach(el => el.remove());

  const modal = document.createElement("div");
  modal.className = "course-picker-modal";

  const p = state.periods.find(x => x.id === periodId);

  function render(filter) {
    const filtered = COURSE_CATALOG.filter(c =>
      !filter || c.name.toLowerCase().includes(filter.toLowerCase())
    );
    return filtered.map(c => `
      <div class="cp-item" data-pick-course="${escapeHtml(c.name)}" data-pick-credits="${c.credits}">
        <span class="cp-item-name">${escapeHtml(c.name)}</span>
        <span class="cp-item-credits">${c.credits} op</span>
      </div>`).join("") +
      `<div class="cp-item-custom" data-pick-custom>+ Lisää oma kurssi${filter ? `: "${escapeHtml(filter)}"` : ""}</div>`;
  }

  modal.innerHTML = `
    <div class="course-picker-box">
      <div class="course-picker-hd">
        <span>Valitse kurssi</span>
        <button class="btn btn-ghost btn-icon" id="cpClose" style="font-size:16px">×</button>
      </div>
      <div class="course-picker-search">
        <input class="input" id="cpSearch" placeholder="Hae kurssia..." autocomplete="off" />
      </div>
      <div class="course-picker-list" id="cpList">${render("")}</div>
    </div>`;

  document.body.appendChild(modal);

  const searchEl = modal.querySelector("#cpSearch");
  const listEl   = modal.querySelector("#cpList");

  searchEl.focus();
  searchEl.addEventListener("input", () => {
    listEl.innerHTML = render(searchEl.value);
  });

  modal.addEventListener("click", e => {
    const item = e.target.closest("[data-pick-course]");
    const custom = e.target.closest("[data-pick-custom]");
    const close = e.target.closest("#cpClose");

    if (close || e.target === modal) { modal.remove(); return; }

    if (item) {
      const name = item.dataset.pickCourse;
      const credits = parseFloat(item.dataset.pickCredits) || 5;
      if (!p) { modal.remove(); return; }
      p.courses.push({ id: uid(), name, credits, display: false, target: null, status: "tuleva", modules: [] });
      saveState(); renderPeriods(); renderStats();
      modal.remove();
      return;
    }

    if (custom) {
      const name = searchEl.value.trim() || "";
      if (!p) { modal.remove(); return; }
      p.courses.push({ id: uid(), name, credits: 5, display: false, target: null, status: "tuleva", modules: [] });
      saveState(); renderPeriods(); renderStats();
      modal.remove();
      return;
    }
  });

  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { modal.remove(); document.removeEventListener("keydown", esc); }
  });
}

// ═══════════════════════════════════════
// COLOR SCHEMES
// ═══════════════════════════════════════

const COLOR_SCHEMES = ["default","pink","baby-blue","olive","brown","pastel"];

function applyScheme(scheme) {
  state.colorScheme = scheme || "default";
  if (!scheme || scheme === "default") {
    document.documentElement.removeAttribute("data-scheme");
  } else {
    document.documentElement.setAttribute("data-scheme", scheme);
  }
}

