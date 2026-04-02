// RENDERING — DEADLINES
// ═══════════════════════════════════════

function deadlineDaysInfo(dateStr) {
  if (!dateStr) return { days: null, cls: "dl-u-blue", label: "" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  if (days < 0)  return { days, cls: "dl-u-red",    label: `${Math.abs(days)}pv myöhässä` };
  if (days < 7)  return { days, cls: "dl-u-red",    label: days === 0 ? "Tänään!" : `${days}pv jäljellä` };
  if (days < 14) return { days, cls: "dl-u-yellow",  label: `${days}pv jäljellä` };
  return { days, cls: "dl-u-blue", label: `${days}pv` };
}

function typeLabel(type) {
  return { tehtava: "Tehtävä", ryhmatyo: "Ryhmätyö", koe: "Koe" }[type] || type;
}
function typeBadgeClass(type) {
  return { tehtava: "type-tehtava", ryhmatyo: "type-ryhmatyo", koe: "type-koe" }[type] || "";
}
function doneLabel(type) {
  return type === "koe" ? "Valmistautunut?" : "Tehty?";
}

function courseLabelForDeadline(courseId) {
  if (!courseId) return "Muu";
  const c = getAllCourses().find(c => c.id === courseId);
  return c ? (c.name || "(nimetön kurssi)") : "Muu";
}

function renderDeadlines() {
  const root = $("#deadlineList");
  const deadlines = state.deadlines || [];

  const sorted = [...deadlines].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (a.date || "").localeCompare(b.date || "");
  });

  if (sorted.length === 0) {
    root.innerHTML = `<div class="muted mini" style="padding:8px 0">Ei deadlineja vielä — lisää alta.</div>`;
  } else {
    root.innerHTML = sorted.map(dl => {
      const { cls, label } = deadlineDaysInfo(dl.date);
      const urgCls = dl.done ? "dl-u-green" : cls;
      const fmtDate = dl.date ? new Date(dl.date).toLocaleDateString("fi-FI") : "—";
      const courseLabel = courseLabelForDeadline(dl.courseId);
      return `
        <div class="dl-item ${urgCls}" data-dl-id="${dl.id}">
          <div class="dl-name">${escapeHtml(dl.name) || "<em class='muted'>Nimetön</em>"}</div>
          <span class="type-badge ${typeBadgeClass(dl.type)}">${typeLabel(dl.type)}</span>
          <span class="dl-course-tag" title="Kurssi">${escapeHtml(courseLabel)}</span>
          <span class="dl-date">${fmtDate}</span>
          <span class="dl-days ${urgCls}">${label}</span>
          <label class="done-lbl">
            <input type="checkbox" data-dl-done="${dl.id}" ${dl.done ? "checked" : ""} />
            ${doneLabel(dl.type)}
          </label>
          <button class="btn btn-danger btn-icon" data-action="delete-deadline">${ICONS.trash}</button>
        </div>`;
    }).join("");
  }

  renderCourseDeadlineDots();
}

function renderCourseDeadlineDots() {
  document.querySelectorAll("[data-course-id]").forEach(card => {
    const courseId = card.dataset.courseId;
    const dls = getDeadlinesForCourse(courseId);
    card.querySelectorAll(".course-dl-dots").forEach(el => el.remove());
    if (!dls.length) return;
    const hd = card.querySelector(".course-hd");
    if (!hd) return;
    const wrap = document.createElement("div");
    wrap.className = "course-dl-dots";
    wrap.innerHTML = dls.map(dl => {
      const { cls, label } = deadlineDaysInfo(dl.date);
      const urgCls = dl.done ? "dl-u-green" : cls;
      const fmtDate = dl.date ? new Date(dl.date).toLocaleDateString("fi-FI") : "—";
      return `<span class="course-dl-dot ${urgCls}" tabindex="0" title="${escapeHtml(dl.name)}">
        <span class="course-dl-tip">
          <span class="tip-name">${escapeHtml(dl.name)}</span>
          <span class="tip-meta">${typeLabel(dl.type)} · ${fmtDate}</span>
          <span class="tip-days">${label}</span>
        </span>
      </span>`;
    }).join("");
    hd.appendChild(wrap);
  });
}

// ═══════════════════════════════════════
