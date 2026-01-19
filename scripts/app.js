import { renderBoard } from "./ui.js";
import { initGameState } from "../app/gameState.js";

// install button logic
let deferredPrompt = null;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn?.addEventListener("click", async () => {
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  installBtn.hidden = true;
});

// render UI placeholder
document.getElementById("year").textContent = new Date().getFullYear();

// init state (no logic yet)
const gameState = initGameState();

// render initial placeholder
renderBoard(gameState);


// click sulle micro celle
document.addEventListener("click", (e) => {
  if (!e.target.classList.contains("micro-cell")) return;

  const micro = Number(e.target.dataset.micro);
  const row = Number(e.target.dataset.row);
  const col = Number(e.target.dataset.col);

  console.log("CLICK su:", { micro, row, col });

  // Qui aggiungeremo:
  // playMove(...)
  // rerender UI
});


// register service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
