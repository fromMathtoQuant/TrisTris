// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState, resetGame } from "../app/gameState.js";
import { isMicroPlayable } from "../app/gameRules.js";
import { playMove } from "../app/engine.js";
import { getAIMove } from "../app/ai.js";
import { createOnlineGame, joinOnlineGame, saveGameState, loadGameState, startPolling, stopPolling, finishGame } from "../app/online.js";

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
if (installBtn) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    deferredPrompt?.prompt();
    await deferredPrompt?.userChoice;
    installBtn.hidden = true;
    deferredPrompt = null;
  });
}

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

  /* ---- BOTTONE ONLINE ---- */
  if (el.dataset.action === "start-online") {
    // Controlla se storage è disponibile
    if (typeof window.storage === 'undefined') {
      alert("La modalità online non è disponibile in questo ambiente.\n\nProva ad usare l'app da claude.ai");
      return;
    }
    state.ui.screen = "online";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- CREA PARTITA ONLINE ---- */
  if (el.dataset.action === "create-online") {
    const result = await createOnlineGame();
    if (result.success) {
      state.onlineGameCode = result.gameCode;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.playerId;
      state.onlineWaiting = true;
      renderStatus(state);
      renderBoard(state);
      
      waitForOpponent(result.gameCode);
    } else {
      alert(`Errore nella creazione della partita:\n${result.error}\n\nLa modalità online richiede window.storage che potrebbe non essere disponibile.`);
    }
    return;
  }

  /* ---- UNISCITI A PARTITA ONLINE ---- */
  if (el.dataset.action === "join-online") {
    const input = document.getElementById("join-code-input");
    const code = input?.value?.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
      alert("Inserisci un codice valido di 6 caratteri");
      return;
    }
    
    const result = await joinOnlineGame(code);
    if (result.success) {
      resetGame(state, "online");
      state.onlineGameCode = result.gameCode;
      state.onlinePlayerId = result.playerId;
      
      const savedState = await loadGameState(result.gameCode);
      if (savedState) {
        Object.assign(state, savedState);
      }
      
      try {
        const gameResult = await window.storage.get(`game:${result.gameCode}`, true);
        if (gameResult) {
          const gameData = JSON.parse(gameResult.value);
          state.onlinePlayer1Id = gameData.player1;
        }
      } catch (e) {
        console.error("Errore caricamento game data:", e);
      }
      
      renderStatus(state);
      renderBoard(state);
      
      startOnlinePolling(result.gameCode);
    } else {
      alert(result.error || "Errore nell'unione alla partita");
    }
    return;
  }

  /* ---- ANNULLA ONLINE ---- */
  if (el.dataset.action === "cancel-online") {
    if (state.onlinePollingId) {
      stopPolling(state.onlinePollingId);
    }
    state.ui.screen = "menu";
    state.onlineWaiting = false;
    state.onlineGameCode = null;
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
      if (state.onlinePollingId) {
        stopPolling(state.onlinePollingId);
      }
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

  /* ---- PRIMO CLICK: macro → APRI MICRO ---- */
  if (el.closest(".macro-cell") && state.ui.viewingMicro === null) {
    const cell = el.closest(".macro-cell");
    const idx = Number(cell.dataset.micro);
  
    if (!isMicroPlayable(state, idx)) return;
  
    if (state.gameMode === "online") {
      const isMyTurn = (state.turn === 0 && state.onlinePlayerId === state.onlinePlayer1Id) ||
                       (state.turn === 1 && state.onlinePlayerId !== state.onlinePlayer1Id);
      if (!isMyTurn) return;
    }
  
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
// GESTIONE MOSSA
// ==========================================

async function handleMove(micro, row, col) {
  if (state.gameMode === "online") {
    const isMyTurn = (state.turn === 0 && state.onlinePlayerId === state.onlinePlayer1Id) ||
                     (state.turn === 1 && state.onlinePlayerId !== state.onlinePlayer1Id);
    if (!isMyTurn) return;
  }

  const result = playMove(state, micro, row, col);

  if (result.moved) {
    state.ui.viewingMicro = null;
    renderStatus(state);
    renderBoard(state);

    if (state.gameMode === "online") {
      await saveGameState(state.onlineGameCode, {
        macroBoard: state.macroBoard,
        microBoards: state.microBoards,
        turn: state.turn,
        nextForcedCell: state.nextForcedCell
      });
    }

    if (result.gameEnd) {
      if (state.gameMode === "online") {
        await finishGame(state.onlineGameCode, result.gameEnd.winner);
      }
      setTimeout(() => {
        showGameEndDialog(result.gameEnd.winner);
      }, 500);
      return;
    }

    if (state.gameMode === "ai" && state.turn === 1) {
      await playAITurn();
    }
  }
}

async function playAITurn() {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  renderStatus(state);
  renderBoard(state);
  
  const aiMove = await getAIMove(state);
  
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
// ONLINE MULTIPLAYER
// ==========================================

async function waitForOpponent(gameCode) {
  const checkInterval = setInterval(async () => {
    try {
      const result = await window.storage.get(`game:${gameCode}`, true);
      if (result) {
        const gameData = JSON.parse(result.value);
        if (gameData.status === "playing") {
          clearInterval(checkInterval);
          resetGame(state, "online");
          state.onlineWaiting = false;
          renderStatus(state);
          renderBoard(state);
          
          startOnlinePolling(gameCode);
        }
      }
    } catch (e) {
      console.error("Errore controllo avversario:", e);
    }
  }, 1000);
  
  setTimeout(() => {
    clearInterval(checkInterval);
    if (state.onlineWaiting) {
      alert("Tempo scaduto. Nessun avversario si è unito.");
      state.ui.screen = "menu";
      state.onlineWaiting = false;
      renderStatus(state);
      renderBoard(state);
    }
  }, 300000);
}

function startOnlinePolling(gameCode) {
  const pollingId = startPolling(gameCode, state.onlinePlayerId, (newState) => {
    if (newState) {
      state.macroBoard = newState.macroBoard;
      state.microBoards = newState.microBoards;
      state.turn = newState.turn;
      state.nextForcedCell = newState.nextForcedCell;
      
      renderStatus(state);
      renderBoard(state);
    }
  });
  
  state.onlinePollingId = pollingId;
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
  } else if (state.gameMode === "online") {
    const mySymbol = state.onlinePlayerId === state.onlinePlayer1Id ? "X" : "O";
    if (winner === mySymbol) {
      message = "🎉 HAI VINTO! 🎉\n\nComplimenti per la vittoria!";
    } else {
      message = "😔 HAI PERSO\n\nL'avversario ha vinto questa volta!";
    }
  } else {
    message = `🎉 VITTORIA GIOCATORE ${winner}! 🎉\n\nComplimenti per la vittoria!`;
  }
  
  alert(message);
  
  if (state.onlinePollingId) {
    stopPolling(state.onlinePollingId);
  }
  
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

  // Crea clone della micro griglia
  const clone = document.createElement("div");
  clone.className = "micro-zoom-clone";
  
  // Copia le celle
  const cells = macroCellEl.querySelectorAll(".micro-cell");
  cells.forEach(cell => {
    const cloneCell = cell.cloneNode(true);
    clone.appendChild(cloneCell);
  });
  
  document.body.appendChild(clone);

  const rect = macroCellEl.getBoundingClientRect();
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";

  // Force reflow
  requestAnimationFrame(() => {
    const targetSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.85);
    const centerX = (window.innerWidth - targetSize) / 2;
    const centerY = (window.innerHeight - targetSize) / 2;

    const scale = targetSize / rect.width;
    const translateX = centerX - rect.left;
    const translateY = centerY - rect.top;

    fade.classList.add("active");
    clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    clone.style.opacity = "1";

    setTimeout(() => {
      state.ui.viewingMicro = microIndex;
      renderStatus(state);
      renderBoard(state);
      clone.remove();
      fade.remove();
    }, 500);
  });
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
  
  state.ui.viewingMicro = null;
  renderStatus(state);
  renderBoard(state);
  
  setTimeout(() => {
    const macroCell = document.querySelector(`.macro-cell[data-micro="${targetMicroIndex}"]`);
    if (!macroCell) {
      onComplete();
      return;
    }
    
    const rectEnd = macroCell.getBoundingClientRect();

    const fade = document.createElement("div");
    fade.className = "fade-overlay active";
    document.body.appendChild(fade);

    const clone = fullscreen.cloneNode(true);
    clone.className = "micro-zoom-clone";
    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";
    clone.style.width = rectStart.width + "px";
    clone.style.height = rectStart.height + "px";
    
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const scale = rectEnd.width / rectStart.width;
      const translateX = rectEnd.left - rectStart.left;
      const translateY = rectEnd.top - rectStart.top;

      clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      fade.classList.remove("active");

      setTimeout(() => {
        clone.remove();
        fade.remove();
        onComplete();
      }, 500);
    });
  }, 50);
}
