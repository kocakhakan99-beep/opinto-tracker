// RENDER ALL + INIT
// ═══════════════════════════════════════

function render() {
  renderStats();
  renderPeriods();
  renderDeadlines();
}

let state = loadState();
applyTheme(state.theme);
applyScheme(state.colorScheme || "default");
mountIcons();
bindEvents();
render();

// ═══════════════════════════════════════
