// MUISTIVIHKO (formerly Piirtotaulu)
// ═══════════════════════════════════════

const PT_KEY = "opintotracker.piirtotaulu.v2";

const NOTE_COLORS = [
  "#fef08a","#fdba74","#fca5a5","#86efac",
  "#93c5fd","#c4b5fd","#f9a8d4","#d9f99d","#ffffff"
];

let pt = null;
let ptActiveTool = "select";
let ptDrawing = false;
let ptLastX = 0, ptLastY = 0;
let ptSelectedEl = null; // currently selected note or image element
let ptHistory = [];      // undo stack — array of JSON snapshots
let ptFuture  = [];      // redo stack

// ── State ──
function ptDefaultState() {
  const id = uid();
  return { pages:[{id, name:"Sivu 1", notes:[], images:[], drawing:null}],
           activePage:id, gridMode:"dot", penColor:"#e040fb", penSize:4 };
}

function ptNormNote(n) {
  return { id:n.id||uid(), x:+(n.x)||40, y:+(n.y)||40,
           w:Math.max(160,+(n.w)||220), h:Math.max(100,+(n.h)||160),
           color:n.color||"#fef08a", title:n.title||"", body:n.body||"",
           fontSize: n.fontSize || "13px" };
}

function ptNormImg(img) {
  return {
    id: img.id||uid(),
    x: +(img.x)||60, y: +(img.y)||60,
    w: Math.max(60,+(img.w)||240), h: Math.max(40,+(img.h)||180),
    src: img.src||"",
    // crop: {x,y,w,h} in 0-1 fractions of original image
    crop: img.crop || null,
    // overlay: {color, opacity}
    overlay: img.overlay || null
  };
}

function ptNormalize(p) {
  const pages = (p.pages||[]).map(pg => ({
    id: pg.id||uid(), name: pg.name||"Sivu",
    notes: (pg.notes||[]).map(ptNormNote),
    images: (pg.images||[]).map(ptNormImg),
    drawing: pg.drawing||null
  }));
  if (!pages.length) return ptDefaultState();
  const activePage = pages.find(p2=>p2.id===p.activePage) ? p.activePage : pages[0].id;
  const gridMode = ["dot","line","none"].includes(p.gridMode) ? p.gridMode : "dot";
  return { pages, activePage, gridMode, penColor:p.penColor||"#e040fb", penSize:+(p.penSize)||4 };
}

function ptLoad() {
  try {
    const raw = localStorage.getItem(PT_KEY);
    if (raw) { const p=JSON.parse(raw); if (p?.pages?.length) return ptNormalize(p); }
    const oldRaw = localStorage.getItem("opintotracker.piirtotaulu.v1");
    if (oldRaw) { const op=JSON.parse(oldRaw); if (op?.pages?.length) return ptNormalize(op); }
  } catch {}
  return ptDefaultState();
}

function ptSave() { localStorage.setItem(PT_KEY, JSON.stringify(pt)); }
function ptCurrentPage() { return pt.pages.find(p=>p.id===pt.activePage)||pt.pages[0]; }

// ── History (undo/redo) ──
// Call ptSnapshot() BEFORE any destructive action.
function ptSnapshot() {
  // Deep-clone current page state (notes+images+drawing)
  ptHistory.push(JSON.stringify(pt.pages));
  if (ptHistory.length > 50) ptHistory.shift(); // cap at 50 steps
  ptFuture = []; // clear redo on new action
  ptUpdateUndoButtons();
}

function ptUndo() {
  if (!ptHistory.length) return;
  ptFuture.push(JSON.stringify(pt.pages));
  pt.pages = JSON.parse(ptHistory.pop());
  // Ensure activePage still exists
  if (!pt.pages.find(p=>p.id===pt.activePage)) pt.activePage=pt.pages[0].id;
  ptSave(); ptRenderTabs(); ptRenderNotes();
  setTimeout(()=>{ ptResizeCanvas(); ptLoadDrawing(); ptUpdateUndoButtons(); },0);
}

function ptRedo() {
  if (!ptFuture.length) return;
  ptHistory.push(JSON.stringify(pt.pages));
  pt.pages = JSON.parse(ptFuture.pop());
  if (!pt.pages.find(p=>p.id===pt.activePage)) pt.activePage=pt.pages[0].id;
  ptSave(); ptRenderTabs(); ptRenderNotes();
  setTimeout(()=>{ ptResizeCanvas(); ptLoadDrawing(); ptUpdateUndoButtons(); },0);
}

function ptUpdateUndoButtons() {
  const u=document.getElementById("ptBtnUndo"); if(u) u.disabled=!ptHistory.length;
  const r=document.getElementById("ptBtnRedo"); if(r) r.disabled=!ptFuture.length;
}

// ── Canvas ──
function ptGetCanvas() { return document.getElementById("ptDrawCanvas"); }

function ptResizeCanvas() {
  const wrap = document.getElementById("ptCanvas");
  const c = ptGetCanvas();
  if (!wrap||!c) return;
  const w = wrap.clientWidth, h = Math.max(wrap.clientHeight, 620);
  if (c.width===w && c.height===h) return;
  const img = c.width>0 ? c.toDataURL() : null;
  c.width=w; c.height=h;
  if (img) { const i=new Image(); i.onload=()=>c.getContext("2d").drawImage(i,0,0); i.src=img; }
}

function ptLoadDrawing() {
  const c=ptGetCanvas(); if (!c) return;
  const ctx=c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  const page=ptCurrentPage();
  if (page.drawing) { const img=new Image(); img.onload=()=>ctx.drawImage(img,0,0); img.src=page.drawing; }
}

function ptSaveDrawing() {
  const c=ptGetCanvas(); if (!c) return;
  const page=ptCurrentPage();
  page.drawing=(c.width>0&&c.height>0)?c.toDataURL():null;
  ptSave();
}

// ── Toolbar sync ──
function ptSyncToolbar() {
  document.querySelectorAll("[data-tool]").forEach(b=>b.classList.toggle("active",b.dataset.tool===ptActiveTool));
  const wrap=document.getElementById("ptCanvas");
  if (wrap) {
    wrap.classList.remove("pt-cursor-pen","pt-cursor-eraser","pt-cursor-select");
    wrap.classList.add("pt-cursor-"+ptActiveTool);
  }
  const dc=ptGetCanvas();
  if (dc) {
    dc.style.pointerEvents = (ptActiveTool==="pen"||ptActiveTool==="eraser") ? "auto" : "none";
    // Also set cursor directly on canvas element
    if (ptActiveTool==="pen")    dc.style.cursor="crosshair";
    else if (ptActiveTool==="eraser") dc.style.cursor="cell";
    else dc.style.cursor="default";
  }
  const pc=document.getElementById("ptPenColor");
  if (pc) pc.value=pt.penColor;
  const ps=document.getElementById("ptPenSize");
  if (ps) { ps.value=pt.penSize; document.getElementById("ptPenSizeLabel").textContent=pt.penSize; }
}

// ── Page tabs ──
function ptRenderTabs() {
  const el=document.getElementById("ptPages"); if (!el) return;
  el.innerHTML=pt.pages.map(pg=>`
    <div class="pt-page-tab-wrap">
      <button class="pt-page-tab${pg.id===pt.activePage?" active":""}" data-pt-page="${pg.id}">
        <span class="pt-tab-name" data-pt-rename="${pg.id}" contenteditable="true" spellcheck="false"
          style="outline:none;min-width:20px;cursor:text">${escapeHtml(pg.name)}</span>
      </button>
      <button class="pt-tab-del-btn${pg.id===pt.activePage?" visible":""}" data-pt-del-page="${pg.id}" title="Poista sivu">×</button>
    </div>
  `).join("")+`<button class="pt-add-page" id="ptAddPage" title="Lisää sivu">＋</button>`;
}

// ── Render page contents ──
function ptRenderNotes() {
  const canvas=document.getElementById("ptCanvas"); if (!canvas) return;
  canvas.querySelectorAll(".sn,.pt-img,.pt-img-editor").forEach(el=>el.remove());
  const page=ptCurrentPage(); if (!page) return;
  page.notes.forEach(n=>ptMountNote(n,canvas));
  page.images.forEach(img=>ptMountImage(img,canvas));
}

// ── Sticky notes ──
function ptMountNote(note, canvas) {
  const el=document.createElement("div");
  el.className="sn"; el.dataset.noteId=note.id;
  el.style.cssText=`left:${note.x}px;top:${note.y}px;width:${note.w}px;height:${note.h}px;background:${note.color};z-index:2`;
  el.innerHTML=`
    <div class="sn-header" data-drag-handle>
      <div class="sn-color-dot" style="background:${note.color}" data-color-btn title="Muuta väri"></div>
      <input class="sn-title" value="${escapeHtml(note.title)}" placeholder="Otsikko..." spellcheck="false"/>
      <button class="sn-del" data-del-note title="Poista">×</button>
    </div>
    <div class="sn-fmt-bar">
      <button class="sn-fmt-btn" data-fmt="bold" title="Lihavointi"><b>B</b></button>
      <button class="sn-fmt-btn" data-fmt="italic" title="Kursiivi"><i>I</i></button>
      <button class="sn-fmt-btn" data-fmt="underline" title="Alleviivaus"><u>U</u></button>
      <div class="sn-fmt-sep"></div>
      <input type="color" class="sn-fmt-color" title="Tekstin väri" value="#333333" />
      <div class="sn-fmt-sep"></div>
      <select class="sn-fmt-size" title="Tekstikoko">
        <option value="8px">8</option>
        <option value="10px">10</option>
        <option value="12px">12</option>
        <option value="13px">13</option>
        <option value="14px">14</option>
        <option value="16px">16</option>
        <option value="18px">18</option>
        <option value="20px">20</option>
        <option value="24px">24</option>
      </select>
    </div>
    <div class="sn-body-rich" contenteditable="true" spellcheck="true" data-sn-body style="font-size:${note.fontSize||"13px"}">${note.body||""}</div>
    <div class="sn-resize" data-resize-handle title="Muuta kokoa">
      <svg viewBox="0 0 10 10"><path d="M2 8 L8 2M5 8 L8 5"/></svg>
    </div>`;
  canvas.appendChild(el);
  ptBindNote(el,note);
}

function ptBindNote(el, note) {
  el.addEventListener("mousedown",()=>{
    document.querySelectorAll(".sn,.pt-img").forEach(s=>s.style.zIndex=2);
    el.style.zIndex=10;
    ptSelectedEl = el;
  });
  el.querySelector("[data-drag-handle]").addEventListener("mousedown",e=>{
    if (e.target.closest("[data-color-btn],[data-del-note],input,textarea")) return;
    e.preventDefault();
    const ox=e.clientX-note.x, oy=e.clientY-note.y;
    const mv=ev=>{note.x=Math.max(0,ev.clientX-ox);note.y=Math.max(0,ev.clientY-oy);el.style.left=note.x+"px";el.style.top=note.y+"px"};
    const up=()=>{ptSave();window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  });
  el.querySelector("[data-resize-handle]").addEventListener("mousedown",e=>{
    e.preventDefault(); e.stopPropagation();
    const sx=e.clientX,sy=e.clientY,sw=note.w,sh=note.h;
    const mv=ev=>{note.w=Math.max(160,sw+ev.clientX-sx);note.h=Math.max(100,sh+ev.clientY-sy);el.style.width=note.w+"px";el.style.height=note.h+"px"};
    const up=()=>{ptSave();window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  });
  el.querySelector("[data-del-note]").addEventListener("click",e=>{
    e.stopPropagation();
    ptCurrentPage().notes=ptCurrentPage().notes.filter(n=>n.id!==note.id);
    ptSave(); el.remove();
  });
  const ti=el.querySelector(".sn-title"); ti.addEventListener("input",()=>{note.title=ti.value;ptSave()});
  const body=el.querySelector("[data-sn-body]");
  if(body) body.addEventListener("input",()=>{note.body=body.innerHTML;ptSave()});

  // ── Formatting toolbar ──
  const fmtBtns = el.querySelectorAll(".sn-fmt-btn[data-fmt]");
  fmtBtns.forEach(btn=>{
    btn.addEventListener("mousedown",e=>{
      e.preventDefault(); e.stopPropagation();
      document.execCommand(btn.dataset.fmt, false, null);
      // update active state
      fmtBtns.forEach(b=>{
        if(["bold","italic","underline"].includes(b.dataset.fmt))
          b.classList.toggle("active", document.queryCommandState(b.dataset.fmt));
      });
      note.body = body?.innerHTML || note.body;
      ptSave();
    });
  });

  const colorPicker = el.querySelector(".sn-fmt-color");
  if(colorPicker) colorPicker.addEventListener("input", ()=>{
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, colorPicker.value);
    note.body = body?.innerHTML || note.body;
    ptSave();
  });

  const sizeSelect = el.querySelector(".sn-fmt-size");
  if(sizeSelect) {
    // Sync select to note's stored font size
    sizeSelect.value = note.fontSize || "13px";
    sizeSelect.addEventListener("change", ()=>{
      const sz = sizeSelect.value;
      note.fontSize = sz;
      // Always update the body element's base font size
      if(body) body.style.fontSize = sz;
      // Also apply to any selected text
      const sel = window.getSelection();
      if(sel && sel.rangeCount && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        span.style.fontSize = sz;
        try { range.surroundContents(span); } catch(e) {
          document.execCommand("styleWithCSS", false, true);
          document.execCommand("fontSize", false, "7");
          if(body) body.querySelectorAll("font[size='7']").forEach(f=>{
            f.removeAttribute("size");
            f.style.fontSize = sz;
          });
        }
        sel.removeAllRanges();
      }
      note.body = body?.innerHTML || note.body;
      ptSave();
    });
  }
  const cb=el.querySelector("[data-color-btn]");
  cb.addEventListener("click",e=>{
    e.stopPropagation();
    document.querySelectorAll(".sn-color-picker").forEach(p=>p.remove());
    const picker=document.createElement("div"); picker.className="sn-color-picker";
    picker.innerHTML=NOTE_COLORS.map(c=>`<div class="sn-color-swatch${c===note.color?" selected":""}" style="background:${c}" data-pick="${c}"></div>`).join("");
    el.querySelector(".sn-header").appendChild(picker);
    picker.querySelectorAll("[data-pick]").forEach(sw=>{
      sw.addEventListener("click",ev=>{
        ev.stopPropagation();
        note.color=sw.dataset.pick; el.style.background=note.color; cb.style.background=note.color;
        ptSave(); picker.remove();
      });
    });
    setTimeout(()=>{
      const close=ev=>{if(!picker.contains(ev.target)){picker.remove();document.removeEventListener("mousedown",close)}};
      document.addEventListener("mousedown",close);
    },0);
  });
}

// ── Images ──
function ptMountImage(imgData, canvas) {
  const el=document.createElement("div");
  el.className="pt-img"; el.dataset.imgId=imgData.id;
  el.style.cssText=`left:${imgData.x}px;top:${imgData.y}px;width:${imgData.w}px;height:${imgData.h}px;z-index:2`;

  // Build CSS for crop using object-fit + object-position
  const cropStyle = imgData.crop
    ? `object-fit:none;object-position:${-imgData.crop.x*100/(imgData.crop.w||1)}% ${-imgData.crop.y*100/(imgData.crop.h||1)}%;width:${100/imgData.crop.w}%;height:${100/imgData.crop.h}%`
    : `object-fit:contain;width:100%;height:100%`;

  const tintStyle = imgData.overlay && imgData.overlay.opacity > 0
    ? `background:${imgData.overlay.color};opacity:${imgData.overlay.opacity};`
    : "opacity:0;";

  el.innerHTML=`
    <div style="position:relative;width:100%;height:100%;overflow:hidden;border-radius:8px">
      <img class="pt-img-inner" src="${imgData.src}" draggable="false" style="${cropStyle}" />
      <div class="pt-img-tint" style="${tintStyle}"></div>
    </div>
    <div class="pt-img-resize" data-img-resize title="Muuta kokoa"></div>
    <div class="pt-img-del" data-img-del title="Poista">×</div>
    <button class="pt-img-edit-btn" data-img-edit title="Muokkaa">✦</button>`;

  canvas.appendChild(el);
  ptBindImage(el,imgData);
}

function ptBindImage(el, imgData) {
  el.addEventListener("mousedown",()=>{
    document.querySelectorAll(".sn,.pt-img").forEach(s=>s.style.zIndex=2);
    el.style.zIndex=10; el.classList.add("pt-img-active");
    ptSelectedEl = el;
  });
  el.addEventListener("mousedown",e=>{
    if (ptActiveTool!=="select") return;
    if (e.target.closest("[data-img-resize],[data-img-del],[data-img-edit]")) return;
    e.preventDefault();
    const ox=e.clientX-imgData.x, oy=e.clientY-imgData.y;
    const mv=ev=>{imgData.x=Math.max(0,ev.clientX-ox);imgData.y=Math.max(0,ev.clientY-oy);el.style.left=imgData.x+"px";el.style.top=imgData.y+"px"};
    const up=()=>{ptSave();window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  });
  el.querySelector("[data-img-resize]").addEventListener("mousedown",e=>{
    e.preventDefault(); e.stopPropagation();
    const sx=e.clientX,sy=e.clientY,sw=imgData.w,sh=imgData.h;
    const mv=ev=>{imgData.w=Math.max(60,sw+ev.clientX-sx);imgData.h=Math.max(40,sh+ev.clientY-sy);el.style.width=imgData.w+"px";el.style.height=imgData.h+"px"};
    const up=()=>{ptSave();window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)};
    window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up);
  });
  el.querySelector("[data-img-del]").addEventListener("click",e=>{
    e.stopPropagation();
    ptCurrentPage().images=ptCurrentPage().images.filter(i=>i.id!==imgData.id);
    ptSave(); el.remove();
    document.querySelectorAll(".pt-img-editor").forEach(ed=>ed.remove());
  });
  el.querySelector("[data-img-edit]").addEventListener("click",e=>{
    e.stopPropagation();
    ptOpenImageEditor(imgData, el);
  });
  document.addEventListener("mousedown",e=>{
    if (!el.contains(e.target)&&!e.target.closest(".pt-img-editor")) el.classList.remove("pt-img-active");
  });
}

// ── Image editor panel ──
function ptOpenImageEditor(imgData, imgEl) {
  // Close any existing editor
  document.querySelectorAll(".pt-img-editor").forEach(ed=>ed.remove());

  const canvas = document.getElementById("ptCanvas");
  const editor = document.createElement("div");
  editor.className = "pt-img-editor";

  const crop = imgData.crop || {x:0,y:0,w:1,h:1};
  const overlay = imgData.overlay || {color:"#ff0000",opacity:0};

  editor.innerHTML = `
    <div class="pt-img-editor-hd">
      <span>Muokkaa kuvaa</span>
      <button class="pt-img-ed-close" title="Sulje">×</button>
    </div>
    <div class="pt-img-editor-body">
      <div class="pt-ed-section">
        <div class="pt-ed-label">Rajaus (0–1, osuus alkuperäisestä)</div>
        <div class="pt-ed-row">
          <label>X <input type="number" id="ptCropX" step="0.01" min="0" max="1" value="${crop.x.toFixed(2)}" /></label>
          <label>Y <input type="number" id="ptCropY" step="0.01" min="0" max="1" value="${crop.y.toFixed(2)}" /></label>
          <label>L <input type="number" id="ptCropW" step="0.01" min="0.05" max="1" value="${crop.w.toFixed(2)}" /></label>
          <label>K <input type="number" id="ptCropH" step="0.01" min="0.05" max="1" value="${crop.h.toFixed(2)}" /></label>
        </div>
        <button class="pt-ed-btn" id="ptResetCrop">Nollaa rajaus</button>
      </div>
      <div class="pt-ed-section">
        <div class="pt-ed-label">Värisuodatin</div>
        <div class="pt-ed-row" style="align-items:center;gap:10px">
          <label>Väri <input type="color" id="ptOverlayColor" value="${overlay.color||"#ff0000"}" /></label>
          <label style="flex:1">Voimakkuus
            <input type="range" id="ptOverlayOpacity" min="0" max="1" step="0.01" value="${overlay.opacity||0}" style="width:100%;accent-color:var(--accent)" />
          </label>
          <span id="ptOverlayOpacityVal" style="font-family:var(--font-mono);font-size:11px;min-width:28px">${Math.round((overlay.opacity||0)*100)}%</span>
        </div>
        <button class="pt-ed-btn" id="ptResetOverlay">Poista suodatin</button>
      </div>
    </div>`;

  // Position editor near the image
  const rect = imgEl.getBoundingClientRect();
  const cRect = canvas.getBoundingClientRect();
  const ex = Math.min(imgData.x + imgData.w + 10, cRect.width - 300);
  const ey = Math.max(0, imgData.y);
  editor.style.cssText = `left:${ex}px;top:${ey}px`;

  canvas.appendChild(editor);

  // Live crop update
  function applyCrop() {
    const x = parseFloat(document.getElementById("ptCropX").value)||0;
    const y = parseFloat(document.getElementById("ptCropY").value)||0;
    const w = parseFloat(document.getElementById("ptCropW").value)||1;
    const h = parseFloat(document.getElementById("ptCropH").value)||1;
    imgData.crop = { x: clamp(x,0,0.95), y: clamp(y,0,0.95), w: clamp(w,0.05,1), h: clamp(h,0.05,1) };
    refreshImgElement();
    ptSave();
  }

  ["ptCropX","ptCropY","ptCropW","ptCropH"].forEach(id => {
    document.getElementById(id).addEventListener("input", applyCrop);
  });

  document.getElementById("ptResetCrop").addEventListener("click", () => {
    imgData.crop = null;
    refreshImgElement();
    ptSave();
    document.getElementById("ptCropX").value = "0";
    document.getElementById("ptCropY").value = "0";
    document.getElementById("ptCropW").value = "1";
    document.getElementById("ptCropH").value = "1";
  });

  // Live overlay update
  function applyOverlay() {
    const color = document.getElementById("ptOverlayColor").value;
    const opacity = parseFloat(document.getElementById("ptOverlayOpacity").value)||0;
    document.getElementById("ptOverlayOpacityVal").textContent = Math.round(opacity*100)+"%";
    imgData.overlay = opacity > 0 ? {color, opacity} : null;
    refreshImgElement();
    ptSave();
  }

  document.getElementById("ptOverlayColor").addEventListener("input", applyOverlay);
  document.getElementById("ptOverlayOpacity").addEventListener("input", applyOverlay);

  document.getElementById("ptResetOverlay").addEventListener("click", () => {
    imgData.overlay = null;
    document.getElementById("ptOverlayOpacity").value = "0";
    document.getElementById("ptOverlayOpacityVal").textContent = "0%";
    refreshImgElement();
    ptSave();
  });

  editor.querySelector(".pt-img-ed-close").addEventListener("click", () => editor.remove());

  function refreshImgElement() {
    const inner = imgEl.querySelector(".pt-img-inner");
    if (inner) {
      if (imgData.crop) {
        const c = imgData.crop;
        inner.style.objectFit = "none";
        inner.style.width = (100/c.w)+"%";
        inner.style.height = (100/c.h)+"%";
        inner.style.objectPosition = `${(-c.x/c.w*100)}% ${(-c.y/c.h*100)}%`;
      } else {
        inner.style.objectFit = "contain";
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.objectPosition = "";
      }
    }
    const tintEl = imgEl.querySelector(".pt-img-tint");
    if(tintEl) {
      if(imgData.overlay && imgData.overlay.opacity > 0) {
        tintEl.style.background = imgData.overlay.color;
        tintEl.style.opacity = imgData.overlay.opacity;
      } else {
        tintEl.style.opacity = "0";
      }
    }
  }
}

// ── Add image from file ──
function ptAddImageFromFile(file, dropX, dropY) {
  if (!file||!file.type.startsWith("image/")) return;
  const reader=new FileReader();
  reader.onload=e=>{
    const src=e.target.result;
    const probe=new Image();
    probe.onload=()=>{
      ptSnapshot();
      let w=probe.naturalWidth, h=probe.naturalHeight;
      if (w>500) { h=Math.round(h*500/w); w=500; }
      const imgData={id:uid(),x:dropX||60,y:dropY||60,w,h,src,crop:null,overlay:null};
      ptCurrentPage().images.push(imgData);
      ptSave();
      const canvas=document.getElementById("ptCanvas");
      if (canvas) ptMountImage(imgData,canvas);
      ptActiveTool="select"; ptSyncToolbar();
    };
    probe.src=src;
  };
  reader.readAsDataURL(file);
}

// ── Drawing ──
function ptStartDraw(e) {
  if (ptActiveTool!=="pen"&&ptActiveTool!=="eraser") return;
  ptSaveDrawing(); // Save current canvas state before snapshotting
  ptSnapshot();
  ptDrawing=true;
  const c=ptGetCanvas(); const rect=c.getBoundingClientRect();
  ptLastX=e.clientX-rect.left; ptLastY=e.clientY-rect.top;
}

function ptDoDraw(e) {
  if (!ptDrawing) return;
  const c=ptGetCanvas(); const ctx=c.getContext("2d");
  const rect=c.getBoundingClientRect();
  const x=e.clientX-rect.left, y=e.clientY-rect.top;
  ctx.beginPath(); ctx.moveTo(ptLastX,ptLastY); ctx.lineTo(x,y);
  if (ptActiveTool==="eraser") {
    ctx.globalCompositeOperation="destination-out";
    ctx.strokeStyle="rgba(0,0,0,1)";
    ctx.lineWidth=pt.penSize*4;
  } else {
    ctx.globalCompositeOperation="source-over";
    ctx.strokeStyle=pt.penColor;
    ctx.lineWidth=pt.penSize;
  }
  ctx.lineCap="round"; ctx.lineJoin="round"; ctx.stroke();
  ptLastX=x; ptLastY=y;
}

function ptEndDraw() {
  if (!ptDrawing) return;
  ptDrawing=false;
  ptSaveDrawing();
}

// ── Grid ──
function ptSetGrid(mode) {
  pt.gridMode=mode;
  const canvas=document.getElementById("ptCanvas"); if (!canvas) return;
  canvas.classList.remove("pt-grid-dot","pt-grid-line","pt-grid-none");
  canvas.classList.add("pt-grid-"+mode);
  document.querySelectorAll("[data-grid]").forEach(b=>b.classList.toggle("active",b.dataset.grid===mode));
  ptSave();
}

// ── Add note ──
function ptAddNote() {
  ptSnapshot();
  const page=ptCurrentPage();
  const off=(page.notes.length%8)*20;
  const note={id:uid(),x:40+off,y:40+off,w:220,h:160,color:"#fef08a",title:"",body:"",fontSize:"13px"};
  page.notes.push(note); ptSave();
  const canvas=document.getElementById("ptCanvas"); if (canvas) ptMountNote(note,canvas);
  ptActiveTool="select"; ptSyncToolbar();
}

// ── Pages ──
function ptAddPage() {
  const n=pt.pages.length+1;
  const page={id:uid(),name:`Sivu ${n}`,notes:[],images:[],drawing:null};
  pt.pages.push(page); pt.activePage=page.id; ptSave();
  ptRenderTabs(); ptRenderNotes(); ptLoadDrawing();
}

function ptDeletePage(pageId) {
  if (pt.pages.length===1) { toast("Et voi poistaa viimeistä sivua"); return; }
  if (!confirm("Poistetaanko tämä sivu ja kaikki sen sisältö?")) return;
  pt.pages=pt.pages.filter(p=>p.id!==pageId);
  if (pt.activePage===pageId) pt.activePage=pt.pages[0].id;
  ptSave(); ptRenderTabs(); ptRenderNotes(); ptLoadDrawing();
}

function ptSwitchPage(pageId) {
  ptSaveDrawing();
  pt.activePage=pageId; ptSave();
  ptRenderTabs(); ptRenderNotes();
  setTimeout(()=>{ ptResizeCanvas(); ptLoadDrawing(); },0);
}

// ── Bind events ──
function ptBindEvents() {
  document.querySelectorAll("[data-tool]").forEach(btn=>{
    btn.addEventListener("click",()=>{ ptActiveTool=btn.dataset.tool; ptSyncToolbar(); });
  });

  const pc=document.getElementById("ptPenColor");
  if (pc) pc.addEventListener("input",()=>{ pt.penColor=pc.value; ptSave(); });

  const ps=document.getElementById("ptPenSize");
  if (ps) ps.addEventListener("input",()=>{
    pt.penSize=+ps.value;
    document.getElementById("ptPenSizeLabel").textContent=ps.value;
    ptSave();
  });

  const nb=document.getElementById("ptBtnAddNote"); if (nb) nb.addEventListener("click",ptAddNote);

  const ib=document.getElementById("ptBtnAddImg");
  const fi=document.getElementById("ptImgInput");
  if (ib&&fi) {
    ib.addEventListener("click",()=>{ fi.value=""; fi.click(); });
    fi.addEventListener("change",e=>{ const f=e.target.files?.[0]; if (f) ptAddImageFromFile(f,80,80); });
  }

  const cb=document.getElementById("ptBtnClearDraw");
  if (cb) cb.addEventListener("click",()=>{
    if (!confirm("Tyhjennetäänkö koko sivu? (piirros, muistilaput ja kuvat)")) return;
    ptSnapshot();
    const page=ptCurrentPage();
    page.notes=[]; page.images=[]; page.drawing=null;
    const c=ptGetCanvas();
    if(c) c.getContext("2d").clearRect(0,0,c.width,c.height);
    ptSave(); ptRenderNotes();
  });

  document.querySelectorAll("[data-grid]").forEach(btn=>{
    btn.addEventListener("click",()=>ptSetGrid(btn.dataset.grid));
  });

  const pagesEl=document.getElementById("ptPages");
  if (pagesEl) {
    pagesEl.addEventListener("click",e=>{
      if (e.target.id==="ptAddPage") { ptAddPage(); return; }
      const del=e.target.closest("[data-pt-del-page]");
      if (del) { e.stopPropagation(); ptDeletePage(del.dataset.ptDelPage); return; }
      const tab=e.target.closest("[data-pt-page]");
      if (tab&&!e.target.closest("[contenteditable]")) ptSwitchPage(tab.dataset.ptPage);
    });
    pagesEl.addEventListener("blur",e=>{
      const ne=e.target.closest("[data-pt-rename]"); if (!ne) return;
      const page=pt.pages.find(p=>p.id===ne.dataset.ptRename);
      if (page) { page.name=ne.textContent.trim()||"Sivu"; ptSave(); }
    },true);
    pagesEl.addEventListener("keydown",e=>{
      if (e.key==="Enter"&&e.target.closest("[data-pt-rename]")) { e.preventDefault(); e.target.blur(); }
    });
  }

  // Drawing: events on the CANVAS element (always on top, pointer-events toggled by tool)
  const dc=ptGetCanvas();
  if (dc) {
    dc.addEventListener("mousedown",ptStartDraw);
    dc.addEventListener("mousemove",ptDoDraw);
    dc.addEventListener("mouseup",ptEndDraw);
    dc.addEventListener("mouseleave",ptEndDraw);
    dc.addEventListener("touchstart",e=>{ e.preventDefault(); ptStartDraw(e.touches[0]); },{passive:false});
    dc.addEventListener("touchmove",e=>{ e.preventDefault(); ptDoDraw(e.touches[0]); },{passive:false});
    dc.addEventListener("touchend",()=>ptEndDraw(),{passive:false});
  }

  // Drag-and-drop
  const wrap=document.getElementById("ptCanvas");
  if (wrap) {
    wrap.addEventListener("dragover",e=>{ if(ptDrawing) return; e.preventDefault(); wrap.classList.add("pt-drag-over"); });
    wrap.addEventListener("dragleave",()=>{ if(ptDrawing) return; wrap.classList.remove("pt-drag-over"); });
    wrap.addEventListener("drop",e=>{
      if(ptDrawing) return;
      e.preventDefault(); wrap.classList.remove("pt-drag-over");
      const rect=wrap.getBoundingClientRect();
      const dropX=e.clientX-rect.left, dropY=e.clientY-rect.top;
      const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/"));
      if (files.length) { ptAddImageFromFile(files[0],dropX,dropY); return; }
      const imgSrc=e.dataTransfer.getData("text/uri-list")||e.dataTransfer.getData("text/plain");
      if (imgSrc&&/^https?:/.test(imgSrc)) {
        fetch(imgSrc).then(r=>r.blob()).then(blob=>{
          ptAddImageFromFile(new File([blob],"image",{type:blob.type}),dropX,dropY);
        }).catch(()=>toast("Kuvan lataus epäonnistui (CORS-rajoitus)"));
      }
    });
  }

  // Paste
  document.addEventListener("paste",e=>{
    if (document.getElementById("tab-piirtotaulu")?.classList.contains("active")) {
      const items=[...(e.clipboardData?.items||[])];
      const imgItem=items.find(i=>i.type.startsWith("image/"));
      if (imgItem) { e.preventDefault(); ptAddImageFromFile(imgItem.getAsFile(),80,80); }
    }
  });

  window.addEventListener("resize",()=>{ ptResizeCanvas(); ptLoadDrawing(); });

  // Undo / Redo buttons
  const undoBtn=document.getElementById("ptBtnUndo");
  const redoBtn=document.getElementById("ptBtnRedo");
  if(undoBtn) undoBtn.addEventListener("click",ptUndo);
  if(redoBtn) redoBtn.addEventListener("click",ptRedo);

  // Keyboard shortcuts
  window.addEventListener("keydown", e=>{
    const isWhiteboard = document.getElementById("tab-piirtotaulu")?.classList.contains("active");
    if(!isWhiteboard) return;

    // Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
    if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==="z") {
      e.preventDefault(); ptUndo(); return;
    }
    if((e.ctrlKey||e.metaKey) && (e.key.toLowerCase()==="y" || (e.shiftKey&&e.key.toLowerCase()==="z"))) {
      e.preventDefault(); ptRedo(); return;
    }

    // DEL / Backspace = delete selected note or image
    if((e.key==="Delete"||e.key==="Backspace") && ptSelectedEl) {
      // Don't fire if focus is in an input/contenteditable
      const tag=document.activeElement?.tagName?.toLowerCase();
      if(tag==="input"||tag==="textarea"||document.activeElement?.isContentEditable) return;
      e.preventDefault();
      ptSnapshot();
      const noteId=ptSelectedEl.dataset.noteId;
      const imgId=ptSelectedEl.dataset.imgId;
      const page=ptCurrentPage();
      if(noteId) page.notes=page.notes.filter(n=>n.id!==noteId);
      if(imgId)  page.images=page.images.filter(i=>i.id!==imgId);
      ptSave();
      ptSelectedEl.remove();
      ptSelectedEl=null;
    }
  });

  // Clear selection on canvas background click (only in select mode)
  document.getElementById("ptCanvas")?.addEventListener("mousedown",e=>{
    if(ptActiveTool==="select" && (e.target.id==="ptCanvas"||e.target.id==="ptDrawCanvas")) ptSelectedEl=null;
  });
}

// ── Init ──
let ptInitialized=false;
function ptInit() {
  if (ptInitialized) return;
  ptInitialized=true;
  pt=ptLoad();
  ptSyncToolbar();
  ptSetGrid(pt.gridMode);
  ptRenderTabs();
  ptRenderNotes();
  setTimeout(()=>{ ptResizeCanvas(); ptLoadDrawing(); },50);
  ptBindEvents();
}

document.querySelectorAll(".tab-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if (btn.dataset.tab==="piirtotaulu") setTimeout(ptInit,0);
  });
});
