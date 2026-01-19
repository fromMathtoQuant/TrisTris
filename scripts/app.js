// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState, resetGame } from "../app/gameState.js";
import { isMicroPlayable } from "../app/gameRules.js";
import { playMove } from "../app/engine.js";
import { getAIMove } from "../app/ai.js";

// Previeni zoom e selezione su iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

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

document.addEventListener("click", async (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;

  /* ---- BOTTONE PVP ---- */
  if (el.dataset.action === "start-pvp") {
    resetGame(state, "pvp");
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- BOTTONE AI ---- */
  if (el.dataset.action === "start-ai") {
    state.ui.screen = "difficulty";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- SELEZIONE DIFFICOLTÀ ---- */
  if (el.dataset.difficulty) {
    const difficulty = el.dataset.difficulty;
    resetGame(state, "ai", difficulty);
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- ANNULLA SELEZIONE DIFFICOLTÀ ---- */
  if (el.dataset.action === "cancel-difficulty") {
    state.ui.screen = "menu";
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
  if (el.dataset.action === "close-micro") {
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

    await handleMove(micro, row, col);
    return;
  }
});

// ==========================================
// GESTIONE MOSSA E AI
// ==========================================

async function handleMove(micro, row, col) {
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
      return;
    }

    // Se è il turno dell'AI, falla giocare
    if (state.gameMode === "ai" && state.turn === 1) {
      await playAITurn();
    }
  }
}

async function playAITurn() {
  // Delay per rendere più naturale
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const aiMove = getAIMove(state);
  
  if (!aiMove) {
    console.error("AI non ha trovato mosse valide");
    return;
  }
  
  const result = playMove(state, aiMove.micro, aiMove.row, aiMove.col);
  
  if (result.moved) {
    renderStatus(state);
    renderBoard(state);
    
    if (result.gameEnd) {
      setTimeout(() => {
        showGameEndDialog(result.gameEnd.winner);
      }, 500);
    }
  }
}

// ==========================================
// DIALOG FINE PARTITA
// ==========================================

function showGameEndDialog(winner) {
  let message;
  if (winner === "draw") {
    message = "Partita terminata in PAREGGIO!\n\nNessun giocatore ha vinto.";
  } else if (state.gameMode === "ai") {
    if (winner === "X") {
      message = "🎉 HAI VINTO! 🎉\n\nComplimenti, hai battuto l'AI!";
    } else {
      message = "😔 L'AI HA VINTO\n\nRiprova con una difficoltà diversa!";
    }
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

  // Force reflow
  clone.getBoundingClientRect();

  const targetSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.9);
  const centerX = (window.innerWidth - targetSize) / 2;
  const centerY = (window.innerHeight - targetSize) / 2;

  const scaleX = targetSize / rect.width;
  const scaleY = targetSize / rect.height;
  const translateX = centerX - rect.left;
  const translateY = centerY - rect.top;

  fade.classList.add("active");
  clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;

  setTimeout(() => {
    state.ui.viewingMicro = microIndex;
    renderStatus(state);
    renderBoard(state);
    clone.remove();
    fade.remove();
  }, 400);
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
  
  // Prima chiudi la modal per poter vedere la macro cell
  state.ui.viewingMicro = null;
  renderStatus(state);
  renderBoard(state);
  
  // Ora trova la macro cell di destinazione
  setTimeout(() => {
    const macroCell = document.querySelector(`.macro-cell[data-micro="${targetMicroIndex}"]`);
    if (!macroCell) {
      onComplete();
      return;
    }
    
    const preview = macroCell.querySelector(".micro-grid");
    if (!preview) {
      onComplete();
      return;
    }
    
    const rectEnd = preview.getBoundingClientRect();

    const fade = document.createElement("div");
    fade.className = "fade-overlay active";
    document.body.appendChild(fade);

    const clone = fullscreen.cloneNode(true);
    clone.classList.add("micro-zoom-clone");

    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";
    clone.style.width = rectStart.width + "px";
    clone.style.height = rectStart.height + "px";
    document.body.appendChild(clone);

    // Force reflow
    clone.getBoundingClientRect();

    const scaleX = rectEnd.width / rectStart.width;
    const scaleY = rectEnd.height / rectStart.height;
    const translateX = rectEnd.left - rectStart.left;
    const translateY = rectEnd.top - rectStart.top;

    clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
    fade.classList.remove("active");

    setTimeout(() => {
      clone.remove();
      fade.remove();
      onComplete();
    }, 400);
  }, 50);
}
