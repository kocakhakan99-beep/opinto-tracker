// BETA GATE
// ═══════════════════════════════════════

const BETA_KEYS = [
  "BETA-C9CG-P1SZ-PCZI","BETA-FVOS-QZ44-LINL","BETA-RCXU-MVON-POUX",
  "BETA-3AQM-GLW7-SPD9","BETA-X3K0-19S7-34ON","BETA-S3CH-O91Z-JQDE",
  "BETA-E9LE-8MZY-W2J2","BETA-XAOH-GBA3-VTLL","BETA-UCRH-SEZC-DXOP",
  "BETA-8B8A-P7MB-5T01","BETA-GVW1-3ESY-JO6L","BETA-IJYK-UAPG-KYEZ",
  "BETA-KGG7-4758-MJR5","BETA-8XU1-HT3D-5PDX","BETA-GHMH-OP4T-BZED",
  "BETA-2U97-LY4J-W0HP","BETA-JF55-IF16-A08M","BETA-MS0J-9IQ9-Y2IT",
  "BETA-CW2X-2HK2-LTT8","BETA-VS6C-N84M-66HM","BETA-LJ6W-GBLB-AD0E",
  "BETA-81ME-V70F-VMMU","BETA-Q8NV-HSV8-7RLZ","BETA-F25B-NU80-TK3C",
  "BETA-ICOH-VQTP-PECO","BETA-3VO1-XXZZ-YLQ7","BETA-WUF7-JXL9-ND6L",
  "BETA-I30G-8CQW-MLCN","BETA-WMHS-FIHE-90HC","BETA-KW0H-OARB-PFM3",
  "BETA-54RJ-5GUR-OEDO","BETA-Q23F-Y0C5-89W6","BETA-MSSG-YBA4-26F1",
  "BETA-GZL6-G53F-7GJY","BETA-W9JG-MBIW-10G5","BETA-GZFL-ZOGZ-GP1F",
  "BETA-TCO0-YRK1-RATX","BETA-9CVA-X9KD-RQKN","BETA-W5AU-JOO7-D983",
  "BETA-UBPA-SL5B-CLAT","BETA-A3SG-NZZW-Y2RZ","BETA-DQER-069Z-0OJ8",
  "BETA-7A1O-1MWS-9R9F","BETA-6OC0-N85P-MS1Z","BETA-X3SS-QCNR-XEEG",
  "BETA-12F3-JD7G-ELN6","BETA-C4SZ-5C7Q-UBZF","BETA-DH7O-BVUQ-WHA1",
  "BETA-DEBU-21T1-W683","BETA-ZMN0-5SXH-NTEZ"
];

(function initBetaGate() {
  const gate = document.getElementById("betaGate");
  if (!gate) return;

  // Already unlocked — inline script already hid the gate; just remove the node.
  if (localStorage.getItem("betaUnlocked") === "1") {
    gate.remove();
    return;
  }

  const input = document.getElementById("betaKeyInput");
  const btn   = document.getElementById("betaKeySubmit");
  const err   = document.getElementById("betaKeyErr");

  function reveal() {
    // 1. Show the app underneath while panels still cover it
    document.body.classList.remove("beta-locked");
    // 2. Trigger panel slide-away animation
    gate.classList.add("revealing");
    // 3. Remove gate node after animation finishes (0.65s transition)
    setTimeout(() => gate.remove(), 700);
  }

  function tryUnlock() {
    const val = input.value.trim().toUpperCase();
    if (BETA_KEYS.includes(val)) {
      localStorage.setItem("betaUnlocked", "1");
      // Fade form out first (0.25s), then reveal
      setTimeout(reveal, 280);
    } else {
      err.textContent = "virheellinen koodi";
      input.select();
      setTimeout(() => { err.textContent = ""; }, 2200);
    }
  }

  btn.addEventListener("click", tryUnlock);
  input.addEventListener("keydown", e => { if (e.key === "Enter") tryUnlock(); });
  input.focus();
})();

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
