// KALENTERI — calendar.js
// ═══════════════════════════════════════

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

const FI_DAYS   = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"];
const FI_MONTHS = [
  "Tammikuu","Helmikuu","Maaliskuu","Huhtikuu","Toukokuu","Kesäkuu",
  "Heinäkuu","Elokuu","Syyskuu","Lokakuu","Marraskuu","Joulukuu"
];

// Map deadline urgency class to readable background color with opacity
function calDeadlineStyle(dl) {
  const { cls } = deadlineDaysInfo(dl.date);
  const done = dl.done;
  if (done) return { bg: "rgba(43,207,160,.15)", border: "rgba(43,207,160,.3)", color: "var(--success)" };
  switch (cls) {
    case "dl-u-red":    return { bg: "rgba(240,80,112,.15)",  border: "rgba(240,80,112,.3)",  color: "var(--danger)" };
    case "dl-u-yellow": return { bg: "rgba(240,192,64,.15)",  border: "rgba(240,192,64,.3)",  color: "var(--warn)" };
    case "dl-u-green":  return { bg: "rgba(43,207,160,.15)",  border: "rgba(43,207,160,.3)",  color: "var(--success)" };
    default:            return { bg: "rgba(109,84,245,.12)",  border: "rgba(109,84,245,.25)", color: "var(--accent)" };
  }
}

// Gather all events for a given YYYY-MM-DD date string
function calEventsForDate(dateStr) {
  const evts = [];

  // Course deadlines — urgency-colored
  for (const dl of (state.deadlines || [])) {
    if (dl.date === dateStr) {
      evts.push({
        isDeadline: true,
        title: dl.name || "(nimetön)",
        style: calDeadlineStyle(dl),
        done: dl.done
      });
    }
  }

  // Manual calendar events — custom color
  for (const e of (state.calendarEvents || [])) {
    if (e.date === dateStr) {
      evts.push({
        isManual: true,
        rawId: e.id,
        title: e.title || "(nimetön)",
        color: e.color || "#6d54f5"
      });
    }
  }

  return evts;
}

// Render the calendar grid
function calRender() {
  const grid = document.getElementById("calGrid");
  const label = document.getElementById("calMonthLabel");
  if (!grid || !label) return;

  label.textContent = `${FI_MONTHS[calMonth]} ${calYear}`;

  // First day of month (0=Sun..6=Sat), convert to Mon-based (0=Mon..6=Sun)
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startOffset = (firstDay + 6) % 7; // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayStr = today.toISOString().slice(0, 10);

  let html = "";

  // Day-of-week headers
  FI_DAYS.forEach(d => {
    html += `<div class="cal-cell cal-cell-hd">${d}</div>`;
  });

  // Empty leading cells
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-cell cal-cell-empty"></div>`;
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(calMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${calYear}-${mm}-${dd}`;
    const isToday = dateStr === todayStr;
    const evts = calEventsForDate(dateStr);
    const MAX_VISIBLE = 3;
    const overflow = evts.length - MAX_VISIBLE;

    const evtHtml = evts.slice(0, MAX_VISIBLE).map(ev => {
      if (ev.isDeadline) {
        const s = ev.style;
        const doneStyle = ev.done ? "text-decoration:line-through;opacity:.6;" : "";
        return `<div class="cal-evt" style="background:${s.bg};border:1px solid ${s.border};color:${s.color};${doneStyle}" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</div>`;
      } else {
        // Manual event — use custom color
        const hex = ev.color || "#6d54f5";
        const manualAttr = `data-cal-evt-id="${escapeHtml(ev.rawId)}"`;
        return `<div class="cal-evt" ${manualAttr} style="background:${hex}22;border:1px solid ${hex}55;color:${hex}" title="${escapeHtml(ev.title)}">${escapeHtml(ev.title)}</div>`;
      }
    }).join("");

    const moreHtml = overflow > 0 ? `<div class="cal-evt-more">+${overflow} lisää</div>` : "";

    html += `
      <div class="cal-cell${isToday ? " cal-today" : ""}" data-cal-date="${dateStr}">
        <div class="cal-day-num">${day}</div>
        ${evtHtml}${moreHtml}
      </div>`;
  }

  // Trailing empty cells to complete the last row
  const totalCells = startOffset + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder > 0) {
    for (let i = remainder; i < 7; i++) {
      html += `<div class="cal-cell cal-cell-empty"></div>`;
    }
  }

  grid.innerHTML = html;
}

// Bind calendar events — called once after state is ready (from app-init.js or tab open)
function calBindEvents() {
  const prevBtn  = document.getElementById("calPrev");
  const nextBtn  = document.getElementById("calNext");
  const todayBtn = document.getElementById("calToday");
  const addBtn   = document.getElementById("calBtnAdd");

  if (prevBtn) prevBtn.addEventListener("click", () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    calRender();
  });
  if (nextBtn) nextBtn.addEventListener("click", () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    calRender();
  });
  if (todayBtn) todayBtn.addEventListener("click", () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    calRender();
  });

  // Delete manual events on right-click (bound once, uses event delegation on static #calGrid)
  const gridEl = document.getElementById("calGrid");
  if (gridEl) gridEl.addEventListener("contextmenu", e => {
    const evtEl = e.target.closest("[data-cal-evt-id]");
    if (!evtEl) return;
    e.preventDefault();
    const evtId = evtEl.dataset.calEvtId;
    const manual = (state.calendarEvents || []).find(ev => ev.id === evtId);
    if (!manual) return;
    if (confirm(`Poistetaanko tapahtuma "${manual.title}"?`)) {
      state.calendarEvents = state.calendarEvents.filter(ev => ev.id !== manual.id);
      saveState(false);
      calRender();
    }
  });

  if (addBtn) addBtn.addEventListener("click", () => {
    const title = (document.getElementById("calEvtTitle")?.value || "").trim();
    const date  = document.getElementById("calEvtDate")?.value || "";
    const color = document.getElementById("calEvtColor")?.value || "#6d54f5";

    if (!title) { toast("Anna tapahtumalle otsikko"); return; }
    if (!date)  { toast("Valitse päivämäärä"); return; }

    if (!state.calendarEvents) state.calendarEvents = [];
    state.calendarEvents.push({ id: uid(), title, color, date });
    saveState(false);
    calRender();

    // Clear form
    document.getElementById("calEvtTitle").value = "";
    document.getElementById("calEvtDate").value = "";
  });
}

// Initialize when tab becomes active
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "kalenteri") calRender();
  });
});

// Bind button events immediately (safe — only adds listeners, doesn't read state)
calBindEvents();
