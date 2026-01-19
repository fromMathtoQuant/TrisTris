
// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState } from "../app/gameState.js";
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

// Click su una micro-cella: prova a giocare la mossa e rerender
document.addEventListener("click", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;
  if (!el.classList.contains("micro-cell")) return;

  const micro = Number(el.dataset.micro);
  const row = Number(el.dataset.row);
  const col = Number(el.dataset.col);

  const moved = playMove(state, micro, row, col);
  if (moved) {
    renderStatus(state);
    renderBoard(state);
  }
});

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js")
      .catch(err => console.error("SW registration failed", err));
  });
}
