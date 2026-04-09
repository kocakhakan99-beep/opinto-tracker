// EVENTS
// ═══════════════════════════════════════

function bindEvents() {

  // — PDF Print —
  // Snapshot the whiteboard canvas to an <img> before printing so it appears in print output
  window.addEventListener("beforeprint", () => {
    const isPiirto = document.getElementById("tab-piirtotaulu")?.classList.contains("active");
    if (!isPiirto) return;
    const c = document.getElementById("ptDrawCanvas");
    const wrap = document.getElementById("ptCanvas");
    if (!c || !wrap) return;
    const img = document.createElement("img");
    img.id = "ptPrintImg";
    img.src = c.toDataURL("image/png");
    img.style.cssText = "position:absolute;top:0;left:0;width:100%;height:auto;z-index:200;pointer-events:none";
    wrap.appendChild(img);
  });
  window.addEventListener("afterprint", () => {
    document.getElementById("ptPrintImg")?.remove();
  });

  $("#btnPrintPdf")?.addEventListener("click", () => window.print());

  // — Lukujaksot collapse toggle —
  $("#btnToggleOpinnot")?.addEventListener("click", () => {
    const bd = $("#cardOpinnotBd");
    const ch = $("#chevronOpinnot");
    if (!bd) return;
    const open = bd.style.display !== "none";
    bd.style.display = open ? "none" : "";
    ch?.classList.toggle("open", !open);
  });

  // — Theme toggle —
  $("#btnTheme").addEventListener("click", () => {
    const next = state.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    saveState(false);
  });

  // — Color scheme popup —
  const btnCS = $("#btnColorScheme");
  const schemePopup = $("#schemePopup");
  const schemeWrap = btnCS?.closest(".scheme-btn-wrap");
  if (btnCS && schemePopup && schemeWrap) {
    // Mark the active scheme
    function updateSchemePopup() {
      schemePopup.querySelectorAll(".scheme-popup-item").forEach(item => {
        item.classList.toggle("active", item.dataset.schemeVal === (state.colorScheme || "default"));
      });
    }
    updateSchemePopup();
    btnCS.addEventListener("click", e => {
      e.stopPropagation();
      schemePopup.hidden = !schemePopup.hidden;
      if (!schemePopup.hidden) updateSchemePopup();
    });
    schemePopup.addEventListener("click", e => {
      const item = e.target.closest("[data-scheme-val]");
      if (!item) return;
      applyScheme(item.dataset.schemeVal);
      saveState(false);
      updateSchemePopup();
      schemePopup.hidden = true;
    });
    document.addEventListener("click", e => {
      if (!schemeWrap.contains(e.target)) schemePopup.hidden = true;
    });
  }

  // — Tabs —
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById("tab-" + btn.dataset.tab);
      if (panel) panel.classList.add("active");
    });
  });

  // — Ctrl+S —
  window.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveState(true);
    }
  });

  // — Stats: only-completed toggle —
  $("#stats").addEventListener("change", e => {
    if (e.target.id === "toggleOnlyCompleted") {
      state.onlyCompleted = e.target.checked;
      saveState(false);
      renderStats();
      for (const p of state.periods) updatePeriodHeader(p.id);
    }
  });

  // — Add period —
  $("#btnAddPeriod").addEventListener("click", () => {
    state.periods.push({ id: uid(), name: `Lukujakso ${state.periods.length + 1}`, courses: [] });
    saveState();
    renderPeriods();
    renderStats();
  });

  // — Collapse All —
  $("#btnCollapseAll")?.addEventListener("click", () => {
    for (const p of state.periods) {
      collapsedPeriods.add(p.id);
      for (const c of p.courses) collapsedCourses.add(c.id);
    }
    document.querySelectorAll("[data-period-body]").forEach(body => { body.style.display = "none"; });
    document.querySelectorAll(".period-hd .chevron").forEach(ch => ch.classList.remove("open"));
    document.querySelectorAll("[data-course-body]").forEach(body => { body.style.display = "none"; });
    document.querySelectorAll(".course-hd .chevron").forEach(ch => ch.classList.remove("open"));
  });

  // — Export CSV —
  $("#btnExport").addEventListener("click", () => {
    const rows = [["type","periodName","courseName","courseCredits","courseDisplay","courseTarget","moduleName","moduleWeight","moduleGradeMode","moduleGrade"]];
    for (const p of state.periods) {
      rows.push(["period", csvEsc2(p.name), "", "", "", "", "", "", "", ""]);
      for (const c of p.courses) {
        const mods = c.modules || [];
        if (!mods.length) {
          rows.push(["course", csvEsc2(p.name), csvEsc2(c.name), c.credits ?? "", c.display ? "true" : "false", c.target ?? "", "", "", "", ""]);
        } else {
          mods.forEach((m, i) => rows.push([
            "module", csvEsc2(p.name),
            i === 0 ? csvEsc2(c.name) : "",
            i === 0 ? (c.credits ?? "") : "",
            i === 0 ? (c.display ? "true" : "false") : "",
            i === 0 ? (c.target ?? "") : "",
            csvEsc2(m.name), m.weight ?? "", m.gradeMode, m.grade ?? ""
          ]));
        }
      }
    }
    const csv = rows.map(r => r.join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `opinto-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast("Viety CSV-tiedostona");
  });

  // — Import CSV —
  $("#btnImport").addEventListener("click", () => { $("#fileInput").value = ""; $("#fileInput").click(); });
  $("#fileInput").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      state = normalizeState(parseCsv(text));
      applyTheme(state.theme);
      saveState();
      render();
      toast("Tuotu onnistuneesti");
    } catch (err) {
      toast("Tuonti epäonnistui: " + (err.message || "virheellinen tiedosto"));
    }
  });

  // — Periods: delegated clicks —
  $("#periods").addEventListener("click", e => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const periodEl = e.target.closest("[data-period-id]");
    const periodId = periodEl?.dataset.periodId;
    const courseEl = e.target.closest("[data-course-id]");
    const courseId = courseEl?.dataset.courseId;
    const modEl = e.target.closest("[data-module-id]");
    const modId = modEl?.dataset.moduleId;

    if (action === "toggle-period") {
      const body = periodEl?.querySelector("[data-period-body]");
      if (!body) return;
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "";
      btn.querySelector(".chevron")?.classList.toggle("open", !open);
      if (open) collapsedPeriods.add(periodId);
      else collapsedPeriods.delete(periodId);
      return;
    }
    if (action === "toggle-course") {
      const body = courseEl?.querySelector("[data-course-body]");
      if (!body) return;
      const open = body.style.display !== "none";
      body.style.display = open ? "none" : "";
      btn.querySelector(".chevron")?.classList.toggle("open", !open);
      if (open) collapsedCourses.add(courseId);
      else collapsedCourses.delete(courseId);
      return;
    }
    if (action === "add-course") {
      openCoursePicker(periodId);
      return;
    }
    if (action === "delete-period") {
      const p = state.periods.find(x => x.id === periodId);
      if (!p || !confirm(`Poistetaanko lukujakso "${p.name}" ja kaikki sen kurssit?`)) return;
      state.periods = state.periods.filter(x => x.id !== periodId);
      saveState(); renderPeriods(); renderStats();
      return;
    }
    if (action === "delete-course") {
      const p = state.periods.find(x => x.id === periodId);
      const c = p?.courses.find(x => x.id === courseId);
      if (!c || !confirm(`Poistetaanko kurssi "${c.name || "(nimetön)"}"?`)) return;
      p.courses = p.courses.filter(x => x.id !== courseId);
      saveState(); renderPeriods(); renderStats();
      return;
    }
    if (action === "toggle-modules") {
      const body = courseEl?.querySelector("[data-mod-body]");
      if (!body) return;
      const open = body.style.display === "block";
      body.style.display = open ? "none" : "block";
      btn.querySelector(".chevron")?.classList.toggle("open", !open);
      return;
    }
    if (action === "add-module") {
      const p = state.periods.find(x => x.id === periodId);
      const c = p?.courses.find(x => x.id === courseId);
      if (!c) return;
      c.modules.push({ id: uid(), name: "", weight: 0, gradeMode: "numeric", grade: null });
      saveState(false);
      rerenderCourseCard(periodId, courseId);
      renderStats(); updatePeriodHeader(periodId);
      setTimeout(() => {
        const card = document.querySelector(`[data-course-id="${cssEsc(courseId)}"]`);
        const body = card?.querySelector("[data-mod-body]");
        if (body) body.style.display = "block";
        card?.querySelector(".mod-list .mod-row:last-child input[data-mod-field='name']")?.focus();
      }, 0);
      return;
    }
    if (action === "delete-module") {
      const p = state.periods.find(x => x.id === periodId);
      const c = p?.courses.find(x => x.id === courseId);
      const m = c?.modules.find(x => x.id === modId);
      if (!m || !confirm(`Poistetaanko moduuli "${m.name || "(nimetön)"}"?`)) return;
      c.modules = c.modules.filter(x => x.id !== modId);
      saveState(false);
      rerenderCourseCard(periodId, courseId);
      renderStats(); updatePeriodHeader(periodId);
      return;
    }
  });

  // — Periods: delegated input —
  $("#periods").addEventListener("input", e => {
    const t = e.target;
    if (t.matches("[data-action='edit-period-name']")) {
      const periodEl = t.closest("[data-period-id]");
      const p = state.periods.find(x => x.id === periodEl?.dataset.periodId);
      if (p) { p.name = t.value; saveState(false); }
      return;
    }
    if (t.matches("input[data-field], select[data-field]")) {
      const periodId = t.closest("[data-period-id]")?.dataset.periodId;
      const courseId = t.closest("[data-course-id]")?.dataset.courseId;
      const field = t.dataset.field;
      const p = state.periods.find(x => x.id === periodId);
      const c = p?.courses.find(x => x.id === courseId);
      if (!c) return;
      if (field === "name")    { c.name = t.value; }
      else if (field === "credits") { c.credits = asNumber(t.value) ?? 0; }
      else if (field === "display") { c.display = t.value === "true"; }
      else if (field === "target") {
        c.target = asNumber(t.value);
        saveState(false);
        rerenderCourseCard(periodId, courseId);
        const body = document.querySelector(`[data-course-id="${cssEsc(courseId)}"] [data-mod-body]`);
        if (body) body.style.display = "block";
        renderStats(); updatePeriodHeader(periodId);
        return;
      }
      saveState(false); renderStats(); updatePeriodHeader(periodId);
      const card = t.closest(".course-card");
      const pp = state.periods.find(x => x.id === periodId);
      const cc = pp?.courses.find(x => x.id === courseId);
      if (card && cc) updateCourseStyles(card, cc);
      return;
    }
    if (t.matches("[data-mod-field]")) {
      const periodId = t.closest("[data-period-id]")?.dataset.periodId;
      const courseId = t.closest("[data-course-id]")?.dataset.courseId;
      const modId    = t.closest("[data-module-id]")?.dataset.moduleId;
      const field = t.dataset.modField;
      const p = state.periods.find(x => x.id === periodId);
      const c = p?.courses.find(x => x.id === courseId);
      const m = c?.modules.find(x => x.id === modId);
      if (!m) return;
      if (field === "name") { m.name = t.value; saveState(false); return; }
      else if (field === "weight")    { m.weight = clamp(asNumber(t.value) ?? 0, 0, 100); }
      else if (field === "gradeMode") { m.gradeMode = t.value; m.grade = null; }
      else if (field === "grade") {
        m.grade = m.gradeMode === "hyvhyl"
          ? (t.value === "" ? null : t.value)
          : asNumber(t.value);
      }
      saveState(false);
      rerenderCourseCard(periodId, courseId);
      const body = document.querySelector(`[data-course-id="${cssEsc(courseId)}"] [data-mod-body]`);
      if (body) body.style.display = "block";
      renderStats(); updatePeriodHeader(periodId);
      return;
    }
  });

  // — Periods: change → toast —
  $("#periods").addEventListener("change", e => {
    const t = e.target;
    if (t.matches("input[data-field], select[data-field], [data-action='edit-period-name'], [data-mod-field]")) {
      saveState(true);
    }
  });

  // — Deadlines: add —
  $("#btnAddDeadline").addEventListener("click", () => {
    const name = $("#dlName").value.trim();
    const date = $("#dlDate").value;
    const type = $("#dlType").value;
    const courseId = $("#dlCourse").value;
    if (!name) { toast("Anna deadline nimi"); return; }
    state.deadlines.push({ id: uid(), name, date, type, done: false, courseId });
    saveState(false);
    renderDeadlines();
    $("#dlName").value = "";
    $("#dlDate").value = "";
  });

  // — Deadlines: refresh course selector when deadlines tab opens —
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "deadlinet") {
        const sel = $("#dlCourse");
        if (!sel) return;
        const cur = sel.value;
        const all = getAllCourses();
        sel.innerHTML = `<option value="">Muu</option>` +
          all.map(c => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${escapeHtml(c.name || "(nimetön)")}</option>`).join("");
      }
      if (btn.dataset.tab === "kalenteri") {
        calRender();
      }
    });
  });

  // — Deadline dot tooltips (fixed position to avoid clipping) —
  document.addEventListener("mouseover", e => {
    const dot = e.target.closest(".course-dl-dot");
    if (!dot) return;
    let tip = dot.querySelector(".course-dl-tip");
    if (!tip) return;
    document.querySelectorAll(".course-dl-tip.visible").forEach(t => t.classList.remove("visible"));
    document.body.appendChild(tip); // move to body to escape overflow clipping
    const rect = dot.getBoundingClientRect();
    tip.style.left = (rect.left + rect.width/2 - 80) + "px";
    tip.style.top  = (rect.top - tip.offsetHeight - 8 + window.scrollY) + "px";
    tip.classList.add("visible");
    dot._tip = tip;
  });
  document.addEventListener("mouseout", e => {
    const dot = e.target.closest(".course-dl-dot");
    if (!dot || !dot._tip) return;
    if (!dot.contains(e.relatedTarget)) {
      dot._tip.classList.remove("visible");
      // return tip to dot
      setTimeout(() => { if (dot._tip && !dot._tip.classList.contains("visible")) dot.appendChild(dot._tip); }, 150);
    }
  });

  // — Deadlines: done toggle & delete —
  $("#deadlineList").addEventListener("change", e => {
    const cb = e.target.closest("[data-dl-done]");
    if (!cb) return;
    const id = cb.dataset.dlDone;
    const dl = state.deadlines.find(x => x.id === id);
    if (dl) { dl.done = cb.checked; saveState(false); renderDeadlines(); }
  });

  $("#deadlineList").addEventListener("click", e => {
    const btn = e.target.closest("[data-action='delete-deadline']");
    if (!btn) return;
    const item = e.target.closest("[data-dl-id]");
    const id = item?.dataset.dlId;
    if (!id) return;
    const dl = state.deadlines.find(x => x.id === id);
    if (!dl || !confirm(`Poistetaanko "${dl.name || "(nimetön)"}"?`)) return;
    state.deadlines = state.deadlines.filter(x => x.id !== id);
    saveState(false);
    renderDeadlines();
  });
}

// ═══════════════════════════════════════
