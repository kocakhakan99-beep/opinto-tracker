// RENDERING — STATS
// ═══════════════════════════════════════

function renderStats() {
  const avg = averageGrade();
  const completed = completedCredits();
  const planned = plannedCredits();
  const pct = progressPct();
  const onlyCompleted = state.onlyCompleted;
  const avgLabel = onlyCompleted ? "Keskiarvo (vain valmiit)" : "Keskiarvo (kaikki arvioidut)";

  $("#stats").innerHTML = `
    <div class="stat">
      <div class="stat-k">Suoritetut opintopisteet</div>
      <div class="stat-v">${completed} <span style="font-size:15px;font-weight:400;color:var(--text2)">/ ${MAX_CREDITS} op</span></div>
      <div class="stat-s">Jäljellä ${remainingCredits()} op · suunniteltu ${planned} op</div>
      <div class="bar-track"><div class="bar-fill" style="width:${round2(pct)}%"></div></div>
      <div class="mini" style="margin-top:5px">${round2(pct)}%</div>
    </div>
    <div class="stat">
      <div class="stat-k">${avgLabel}</div>
      <div class="stat-v">${avg === null ? "—" : avg}</div>
      <div class="stat-s" style="margin-top:10px">
        <label style="display:inline-flex;align-items:center;gap:7px;cursor:pointer;user-select:none">
          <input type="checkbox" id="toggleOnlyCompleted" ${onlyCompleted ? "checked" : ""}
            style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer" />
          Näytä vain valmiit kurssit?
        </label>
      </div>
    </div>
    <div class="stat">
      <div class="stat-k">Yhteenveto</div>
      <div class="stat-v">${getAllCourses().length} kurssia</div>
      <div class="stat-s">${state.periods.length} lukujaksoa</div>
    </div>
  `;
}

// ═══════════════════════════════════════
// RENDERING — PERIODS & COURSES
// ═══════════════════════════════════════

function renderPeriods() {
  const root = $("#periods");
  root.innerHTML = "";

  if (state.periods.length === 0) {
    root.innerHTML = `<div class="muted">Ei lukujaksoja vielä — klikkaa <b>Lisää lukujakso</b>.</div>`;
    return;
  }

  for (const period of state.periods) {
    const el = document.createElement("div");
    el.className = "period-card";
    el.dataset.periodId = period.id;
    const m = periodMetrics(period.id);

    el.innerHTML = `
      <div class="period-hd">
        <button class="btn btn-ghost btn-icon" data-action="toggle-period" title="Pienennä/laajenna">
          <span class="chevron open">${ICONS.chevron}</span>
        </button>
        <input class="input period-name-input" data-action="edit-period-name" value="${escapeHtml(period.name)}" />
        <span class="pill" data-pill="credits">${m.completed} / ${m.planned} op</span>
        <span class="pill" data-pill="avg">KA: ${m.avg === null ? "—" : m.avg}</span>
        <div class="period-actions">
          <button class="btn" data-action="add-course" title="Lisää kurssi listasta tai omana">${ICONS.plus} Kurssi</button>
          <button class="btn btn-danger btn-icon" data-action="delete-period">${ICONS.trash}</button>
        </div>
      </div>
      <div class="period-bd" data-period-body>
        <div class="c-grid head">
          <div>Kurssi</div><div>Op</div><div>Suor%</div><div>Näyttö</div><div>Arvosana</div><div></div>
        </div>
        <div class="course-list">
          ${period.courses.map(courseCardHtml).join("")}
        </div>
        <div class="mini" style="margin-top:9px">Suoritus% ja arvosana lasketaan moduuleista automaattisesti.</div>
      </div>
    `;
    root.appendChild(el);
  }

  // apply incomplete styles
  for (const card of root.querySelectorAll(".course-card")) {
    const pId = card.closest("[data-period-id]")?.dataset.periodId;
    const cId = card.dataset.courseId;
    const p = state.periods.find(x => x.id === pId);
    const c = p?.courses.find(x => x.id === cId);
    if (c) updateCourseStyles(card, c);
  }
}

const COURSE_STATUS = {
  tuleva:      { label: "Tuleva",     cls: "cs-tuleva" },
  kaynnissa:   { label: "Käynnissä",  cls: "cs-kaynnissa" },
  suoritettu:  { label: "Suoritettu", cls: "cs-suoritettu" }
};

function courseStatusBadge(status) {
  const s = COURSE_STATUS[status] || COURSE_STATUS.tuleva;
  return `<span class="course-status-badge ${s.cls}">${s.label}</span>`;
}

function courseCardHtml(c) {
  const credits = asNumber(c.credits) ?? "";
  const target  = asNumber(c.target) ?? "";
  const completion = courseCompletion(c);
  const gradeDisplay = courseGradeDisplay(c);
  const display = !!c.display;
  const status = c.status || "tuleva";
  const modules = c.modules || [];
  const wSum = moduleWeightSum(modules);
  const wOk  = modules.length === 0 || Math.abs(wSum - 100) < 0.01;

  const wtBanner = modules.length > 0
    ? `<div class="wt-banner ${wOk ? "wt-ok" : "wt-warn"}">${wOk ? `✓ Painot: ${wSum}%` : `⚠ Painot: ${wSum}% — täytyy olla 100%`}</div>`
    : "";

  return `
    <div class="course-card${completion < 100 ? " incomplete" : ""}" data-course-id="${c.id}">
      <div class="course-hd" style="display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap">
        <button class="btn btn-ghost btn-icon" data-action="toggle-course" title="Pienennä/laajenna">
          <span class="chevron open">${ICONS.chevron}</span>
        </button>
        <input class="input" data-field="name" placeholder="Kurssin nimi" value="${escapeHtml(c.name)}" style="flex:1;min-width:120px" />
        ${courseStatusBadge(status)}
        <span class="pill" style="flex-shrink:0">${completion}%</span>
        <span class="pill" style="flex-shrink:0">${gradeDisplay}</span>
        <button class="btn btn-danger btn-icon" data-action="delete-course" style="flex-shrink:0">${ICONS.trash}</button>
      </div>
      <div class="course-body" data-course-body>
        <div class="c-grid" style="margin-top:9px">
          <div style="display:flex;gap:7px;align-items:center;min-width:0">
            <button class="btn btn-ghost btn-icon" data-action="focus-course-name">${ICONS.pencil}</button>
            <select class="input" data-field="status" style="max-width:130px">
              <option value="tuleva"     ${status==="tuleva"     ? "selected":""}>Tuleva</option>
              <option value="kaynnissa"  ${status==="kaynnissa"  ? "selected":""}>Käynnissä</option>
              <option value="suoritettu" ${status==="suoritettu" ? "selected":""}>Suoritettu</option>
            </select>
          </div>
          <div><input class="input" data-field="credits" type="number" step="0.5" min="0" placeholder="0" value="${credits}" /></div>
          <div><input class="input grade-ro" data-field="completion" type="text" readonly value="${completion}%" title="Laskettu moduuleista" /></div>
          <div>
            <select class="input" data-field="display">
              <option value="false" ${display ? "" : "selected"}>Ei</option>
              <option value="true"  ${display ? "selected" : ""}>Kyllä</option>
            </select>
          </div>
          <div>
            <input class="input grade-ro" data-field="grade" type="text" readonly value="${gradeDisplay}" title="Laskettu moduuleista" />
            <div class="mini" style="margin-top:4px">Tavoite: ${target === "" ? "—" : target}</div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:7px;align-items:center">
            <input class="input" style="max-width:100px" data-field="target" type="number" step="0.1" min="0" max="5" placeholder="Tavoite" value="${target}" />
          </div>
        </div>
        <div class="mod-wrap">
          <button class="btn btn-ghost mod-toggle" data-action="toggle-modules">
            <span class="chevron">${ICONS.chevron}</span>
            Moduulit <span class="pill" style="margin-left:2px">${modules.length}</span>
          </button>
          <div class="mod-body" data-mod-body>
            ${wtBanner}
            <div class="mod-list">${modules.map(m => moduleRowHtml(c, m)).join("")}</div>
            <button class="btn btn-ghost" data-action="add-module" style="margin-top:8px;font-size:12.5px">${ICONS.plus} Lisää moduuli</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function moduleRowHtml(course, m) {
  const graded = moduleIsGraded(m);
  const req = requiredGradeForModule(course, m.id);

  let reqHtml = "";
  if (!graded && m.gradeMode === "numeric" && asNumber(course.target) !== null) {
    if (req === null) {
      reqHtml = "";
    } else if (req <= 0) {
      reqHtml = `<div class="req-hint req-ok">Tavoite jo saavutettu</div>`;
    } else if (req > 5) {
      reqHtml = `<div class="req-hint req-impossible">Tavoite saavuttamaton (tarvittaisiin ${String(req).replace(".", ",")})</div>`;
    } else {
      reqHtml = `<div class="req-hint req-needed">Tarvitset vähintään ${String(req).replace(".", ",")}</div>`;
    }
  }

  const gradeField = m.gradeMode === "numeric"
    ? `<input class="input input-sm" data-mod-field="grade" type="number" step="any" min="0" max="5" placeholder="—" value="${asNumber(m.grade) !== null ? m.grade : ""}" />`
    : `<select class="input input-sm" data-mod-field="grade">
        <option value="" ${m.grade === null ? "selected" : ""}>—</option>
        <option value="hyvaksytty" ${m.grade === "hyvaksytty" ? "selected" : ""}>Hyväksytty</option>
        <option value="hylatty"    ${m.grade === "hylatty"    ? "selected" : ""}>Hylätty</option>
       </select>`;

  return `
    <div class="mod-row${graded ? " graded" : ""}" data-module-id="${m.id}">
      <div><input class="input input-sm" data-mod-field="name" placeholder="Moduulin nimi" value="${escapeHtml(m.name)}" /></div>
      <div style="display:flex;align-items:center;gap:4px">
        <input class="input input-sm" data-mod-field="weight" type="number" step="1" min="0" max="100" placeholder="%" value="${asNumber(m.weight) !== null ? m.weight : ""}" />
        <span class="mini">%</span>
      </div>
      <div>
        <select class="input input-sm" data-mod-field="gradeMode">
          <option value="numeric" ${m.gradeMode === "numeric" ? "selected" : ""}>Numeerinen</option>
          <option value="hyvhyl"  ${m.gradeMode === "hyvhyl"  ? "selected" : ""}>Hyv/Hyl</option>
        </select>
      </div>
      <div>${gradeField}${reqHtml}</div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn btn-danger btn-icon" data-action="delete-module">${ICONS.trash}</button>
      </div>
    </div>
  `;
}

function updatePeriodHeader(periodId) {
  const el = document.querySelector(`[data-period-id="${cssEsc(periodId)}"]`);
  if (!el) return;
  const m = periodMetrics(periodId);
  const cp = el.querySelector('[data-pill="credits"]');
  const ap = el.querySelector('[data-pill="avg"]');
  if (cp) cp.textContent = `${m.completed} / ${m.planned} op`;
  if (ap) ap.textContent = `KA: ${m.avg === null ? "—" : m.avg}`;
}

function updateCourseStyles(cardEl, course) {
  cardEl.classList.toggle("incomplete", courseCompletion(course) < 100);
}

function rerenderCourseCard(periodId, courseId) {
  const periodEl = document.querySelector(`[data-period-id="${cssEsc(periodId)}"]`);
  if (!periodEl) return;
  const list = periodEl.querySelector(".course-list");
  if (!list) return;
  const p = state.periods.find(x => x.id === periodId);
  const c = p?.courses.find(x => x.id === courseId);
  if (!c) return;
  const existing = list.querySelector(`[data-course-id="${cssEsc(courseId)}"]`);
  if (!existing) return;
  const wasModOpen = existing.querySelector("[data-mod-body]")?.style.display !== "none";
  const wasCourseOpen = existing.querySelector("[data-course-body]")?.style.display !== "none";
  const tmp = document.createElement("div");
  tmp.innerHTML = courseCardHtml(c);
  const newCard = tmp.firstElementChild;
  existing.replaceWith(newCard);
  if (!wasCourseOpen) {
    const body = newCard.querySelector("[data-course-body]");
    if (body) body.style.display = "none";
    newCard.querySelector(".course-hd .chevron")?.classList.remove("open");
  }
  if (wasModOpen) {
    const body = newCard.querySelector("[data-mod-body]");
    if (body) body.style.display = "block";
  }
  updateCourseStyles(newCard, c);
}

// ═══════════════════════════════════════
