
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


// CLICK HANDLER
document.addEventListener("click", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;

  /* ---- CHIUSURA FULLSCREEN ---- */
  if (el.dataset.closeMicro === "true") {
    state.ui.viewingMicro = null;
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- PRIMO CLICK: macro → apri micro ---- */
  if (el.closest(".macro-cell") && state.ui.viewingMicro === null) {
    const idx = Number(el.closest(".macro-cell").dataset.micro);

    // deve essere giocabile
    if (isMicroPlayable(state, idx)) {
      state.ui.viewingMicro = idx;
      renderStatus(state);
      renderBoard(state);
    }
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
