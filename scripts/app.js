
// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState } from "../app/gameState.js";
import { isMicroPlayable } from "../app/gameRules.js";
import { playMove } from "../app/engine.js";

// Anno footer
document.getElementById("year").textContent = new Date().getFullYear();

// Install prompt
let deferredPrompt = null;
const installBtn = document.getElementById("install-btn");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});
installBtn?.addEventListener("click", async () => {
  deferredPrompt?.prompt();
  await deferredPrompt?.userChoice;
  installBtn.hidden = true;
  deferredPrompt = null;
});

// Stato iniziale
const state = initGameState();

// Primo render
renderStatus(state);
renderBoard(state);


// ==========================================
// CLICK HANDLER PRINCIPALE
// ==========================================

document.addEventListener("click", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;

  /* ---- CHIUSURA FULLSCREEN ---- */
  if (el.dataset.closeMicro === "true") {
    const microIndex = state.ui.viewingMicro;
  
    animateMicroZoomOut(microIndex, () => {
      state.ui.viewingMicro = null;
      renderStatus(state);
      renderBoard(state);
    });
  
    return;
  }

  /* ---- PRIMO CLICK: macro → APRI MICRO con animazione ---- */
  if (el.closest(".macro-cell") && state.ui.viewingMicro === null) {
    const cell = el.closest(".macro-cell");
    const idx = Number(cell.dataset.micro);
  
    if (!isMicroPlayable(state, idx)) return;
  
    animateMicroZoomIn(cell, idx);
    return;
  }


  /* ---- SECONDO CLICK: micro fullscreen → mossa ---- */
  if (el.classList.contains("micro-cell") && state.ui.viewingMicro !== null) {
    const micro = Number(el.dataset.micro);
    const row   = Number(el.dataset.row);
    const col   = Number(el.dataset.col);

    const moved = playMove(state, micro, row, col);

    if (moved) {
      // chiudi modal e torna alla macro
      state.ui.viewingMicro = null;
      renderStatus(state);
      renderBoard(state);
    }

    return;
  }
});


// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .catch(err => console.error("SW registration failed", err));
  });
}


/* =============================
   ANIMAZIONE ZOOM-IN
============================= */
function animateMicroZoomIn(macroCellEl, microIndex) {

  // 1. Prepariamo overlay fade
  const fade = document.createElement("div");
  fade.className = "fade-overlay";
  document.body.appendChild(fade);

  // 2. Cloniamo la microgrid di preview
  const preview = macroCellEl.querySelector(".micro-grid");
  const clone = preview.cloneNode(true);
  clone.classList.add("micro-zoom-clone");
  document.body.appendChild(clone);

  // 3. Posizioniamo il clone sulla stessa posizione del preview
  const rect = preview.getBoundingClientRect();
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";

  // 4. Forziamo reflow prima del transform
  clone.getBoundingClientRect();

  // 5. Calcoliamo lo scale verso fullscreen
  const scaleX = window.innerWidth / rect.width;
  const scaleY = window.innerHeight / rect.height;

  fade.classList.add("active");
  clone.style.transform = `scale(${scaleX}, ${scaleY})`;

  // 6. Dopo animazione → attiviamo la true fullscreen view
  setTimeout(() => {
    state.ui.viewingMicro = microIndex;
    renderStatus(state);
    renderBoard(state);

    // cleanup animazione
    clone.remove();
    fade.remove();
  }, 350);
}

/* =============================
   ANIMAZIONE ZOOM-OUT
============================= */
function animateMicroZoomOut(targetMicroIndex, onComplete) {
  const fullscreen = document.querySelector(".fullscreen-micro");
  if (!fullscreen) {
    onComplete();
    return;
  }

  const rectStart = fullscreen.getBoundingClientRect();

  // Troviamo la posizione nella macro
  const macroCell = document.querySelector(`.macro-cell[data-micro="${targetMicroIndex}"]`);
  const preview = macroCell.querySelector(".micro-grid");

  const rectEnd = preview.getBoundingClientRect();

  // overlay fade
  const fade = document.createElement("div");
  fade.className = "fade-overlay active";
  document.body.appendChild(fade);

  // clone
  const clone = fullscreen.cloneNode(true);
  clone.classList.add("micro-zoom-clone", "micro-zoom-out");

  clone.style.left = rectStart.left + "px";
  clone.style.top = rectStart.top + "px";
  clone.style.width = rectStart.width + "px";
  clone.style.height = rectStart.height + "px";
  document.body.appendChild(clone);

  clone.getBoundingClientRect(); // reflow

  // Calcolo scala per tornare nella posizione della macro
  const scaleX = rectEnd.width / rectStart.width;
  const scaleY = rectEnd.height / rectStart.height;

  // Muovere clone verso la cella macro
  const dx = rectEnd.left - rectStart.left;
  const dy = rectEnd.top - rectStart.top;

  clone.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
  fade.classList.remove("active");

  setTimeout(() => {
    clone.remove();
    fade.remove();
    onComplete();
  }, 350);
}


