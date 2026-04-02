// KALENTERI — calendar.js
// ═══════════════════════════════════════

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based

const FI_DAYS   = ["Ma", "Ti", "Ke", "To", "Pe", "La", "Su"];
const FI_MONTHS = [
  "Tammikuu","Helmikuu","Maaliskuu","Huhtikuu","Toukokuu","Kesäkuu",
  "Heinäkuu","Elokuu","Syyskuu","Lokakuu","Marraskuu","Joulukuu"
];

// Category display config
const CAL_CAT = {
  kurssi:   { label: "Kurssi",   cls: "cal-cat-kurssi"   },
  muu:      { label: "Muu",      cls: "cal-cat-muu"      },
  personal: { label: "Personal", cls: "cal-cat-personal"  },
  deadline: { label: "Deadline", cls: "cal-cat-deadline"  }
};

// Gather all events for a given YYYY-MM-DD date string
function calEventsForDate(dateStr) {
  const evts = [];

  // Course deadlines
  for (const dl of (state.deadlines || [])) {
    if (dl.date === dateStr) {
      const course = getAllCourses().find(c => c.id === dl.courseId);
      evts.push({
        id: "dl_" + dl.id,
        title: dl.name || "(nimetön)",
        sub: course ? course.name : "",
        category: "deadline",
        done: dl.done
      });
    }
  }

  // Manual calendar events
  for (const e of (state.calendarEvents || [])) {
    if (e.date === dateStr) {
      const course = e.category === "kurssi" ? getAllCourses().find(c => c.id === e.courseId) : null;
      evts.push({
        id: "ce_" + e.id,
        title: e.title || "(nimetön)",
        sub: course ? course.name : "",
        category: e.category,
        isManual: true,
        rawId: e.id
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
      const cfg = CAL_CAT[ev.category] || CAL_CAT.muu;
      const doneStyle = ev.done ? "opacity:.5;text-decoration:line-through;" : "";
      return `<div class="cal-evt ${cfg.cls}" style="${doneStyle}" title="${escapeHtml(ev.title)}${ev.sub ? " · " + escapeHtml(ev.sub) : ""}">${escapeHtml(ev.title)}</div>`;
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

  // Delete manual events on right-click (context menu)
  grid.querySelectorAll(".cal-cell[data-cal-date]").forEach(cell => {
    cell.addEventListener("contextmenu", e => {
      const evtEl = e.target.closest(".cal-evt");
      if (!evtEl) return;
      // Find the event from the cell's date
      const dateStr2 = cell.dataset.calDate;
      const allEvts = calEventsForDate(dateStr2);
      // Try to find by title match (manual events only)
      const title = evtEl.title.split(" · ")[0];
      const manual = (state.calendarEvents || []).find(ev => ev.date === dateStr2 && ev.title === title);
      if (!manual) return; // don't allow deleting deadlines from here
      e.preventDefault();
      if (confirm(`Poistetaanko tapahtuma "${manual.title}"?`)) {
        state.calendarEvents = state.calendarEvents.filter(ev => ev.id !== manual.id);
        saveState(false);
        calRender();
      }
    });
  });
}

// Refresh the course selector in the add-event form
function calRefreshCourseSelect() {
  const sel = document.getElementById("calEvtCourse");
  if (!sel) return;
  const all = getAllCourses();
  sel.innerHTML = `<option value="">Valitse kurssi…</option>` +
    all.map(c => `<option value="${c.id}">${escapeHtml(c.name || "(nimetön)")}</option>`).join("");
}

// Bind calendar events
function calBindEvents() {
  const prevBtn  = document.getElementById("calPrev");
  const nextBtn  = document.getElementById("calNext");
  const todayBtn = document.getElementById("calToday");
  const addBtn   = document.getElementById("calBtnAdd");
  const catSel   = document.getElementById("calEvtCategory");
  const courseSel = document.getElementById("calEvtCourse");

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

  // Show/hide course selector based on category
  if (catSel && courseSel) {
    catSel.addEventListener("change", () => {
      courseSel.style.display = catSel.value === "kurssi" ? "" : "none";
    });
  }

  if (addBtn) addBtn.addEventListener("click", () => {
    const title = (document.getElementById("calEvtTitle")?.value || "").trim();
    const date  = document.getElementById("calEvtDate")?.value || "";
    const category = document.getElementById("calEvtCategory")?.value || "muu";
    const courseId = category === "kurssi" ? (document.getElementById("calEvtCourse")?.value || "") : "";

    if (!title) { toast("Anna tapahtumalle otsikko"); return; }
    if (!date)  { toast("Valitse päivämäärä"); return; }
    if (category === "kurssi" && !courseId) { toast("Valitse kurssi"); return; }

    if (!state.calendarEvents) state.calendarEvents = [];
    state.calendarEvents.push({ id: uid(), title, category, courseId, date });
    saveState(false);
    calRender();

    // Clear form
    document.getElementById("calEvtTitle").value = "";
    document.getElementById("calEvtDate").value = "";
    document.getElementById("calEvtCategory").value = "muu";
    if (courseSel) { courseSel.value = ""; courseSel.style.display = "none"; }
  });

  // Populate course select
  calRefreshCourseSelect();
}

// Initialize when tab becomes active
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.dataset.tab === "kalenteri") {
      calRefreshCourseSelect();
      calRender();
    }
  });
});

// Run once to set initial state (for first paint if tab is opened directly)
(function calInit() {
  calRefreshCourseSelect();
  calBindEvents();
})();
