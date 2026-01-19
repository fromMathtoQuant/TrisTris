// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState, resetGame } from "../app/gameState.js";
import { isMicroPlayable } from "../app/gameRules.js";
import { playMove } from "../app/engine.js";

// Anno footer
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

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

  /* ---- BOTTONE INIZIA PARTITA ---- */
  if (el.dataset.action === "start-game") {
    resetGame(state);
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- BOTTONE TORNA AL MENU ---- */
  if (el.dataset.action === "back-to-menu") {
    const confirm = window.confirm("Sei sicuro di voler tornare al menu? La partita corrente sarà persa.");
    if (confirm) {
      state.ui.screen = "menu";
      renderStatus(state);
      renderBoard(state);
    }
    return;
  }

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

    const result = playMove(state, micro, row, col);

    if (result.moved) {
      // Chiudi modal e torna alla macro
      state.ui.viewingMicro = null;
      renderStatus(state);
      renderBoard(state);

      // Controlla fine partita
      if (result.gameEnd) {
        setTimeout(() => {
          showGameEndDialog(result.gameEnd.winner);
        }, 500);
      }
    }

    return;
  }
});

// ==========================================
// DIALOG FINE PARTITA
// ==========================================

function showGameEndDialog(winner) {
  let message;
  if (winner === "draw") {
    message = "Partita terminata in PAREGGIO!\n\nNessun giocatore ha vinto.";
  } else {
    message = `🎉 VITTORIA GIOCATORE ${winner}! 🎉\n\nComplimenti per la vittoria!`;
  }
  
  alert(message);
  
  // Torna al menu
  state.ui.screen = "menu";
  renderStatus(state);
  renderBoard(state);
}

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(err => console.error("SW registration failed", err));
  });
}

/* =============================
   ANIMAZIONE ZOOM-IN
============================= */
function animateMicroZoomIn(macroCellEl, microIndex) {
  const fade = document.createElement("div");
  fade.className = "fade-overlay";
  document.body.appendChild(fade);

  const preview = macroCellEl.querySelector(".micro-grid");
  const clone = preview.cloneNode(true);
  clone.classList.add("micro-zoom-clone");
  document.body.appendChild(clone);

  const rect = preview.getBoundingClientRect();
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";

  clone.getBoundingClientRect();

  const scaleX = window.innerWidth / rect.width;
  const scaleY = window.innerHeight / rect.height;

  fade.classList.add("active");
  clone.style.transform = `scale(${scaleX}, ${scaleY})`;

  setTimeout(() => {
    state.ui.viewingMicro = microIndex;
    renderStatus(state);
    renderBoard(state);
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
  const macroCell = document.querySelector(`.macro-cell[data-micro="${targetMicroIndex}"]`);
  const preview = macroCell.querySelector(".micro-grid");
  const rectEnd = preview.getBoundingClientRect();

  const fade = document.createElement("div");
  fade.className = "fade-overlay active";
  document.body.appendChild(fade);

  const clone = fullscreen.cloneNode(true);
  clone.classList.add("micro-zoom-clone", "micro-zoom-out");

  clone.style.left = rectStart.left + "px";
  clone.style.top = rectStart.top + "px";
  clone.style.width = rectStart.width + "px";
  clone.style.height = rectStart.height + "px";
  document.body.appendChild(clone);

  clone.getBoundingClientRect();

  const scaleX = rectEnd.width / rectStart.width;
  const scaleY = rectEnd.height / rectStart.height;
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
