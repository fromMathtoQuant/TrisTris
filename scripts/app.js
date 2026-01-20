// scripts/app.js
import { renderBoard, renderStatus } from "./ui.js";
import { initGameState, resetGame } from "../app/gameState.js";
import { isMicroPlayable } from "../app/gameRules.js";
import { playMove } from "../app/engine.js";
import { getAIMove } from "../app/ai.js";
import { 
  initSupabase, 
  createGame, 
  joinGame, 
  saveGameState, 
  loadGameState, 
  subscribeToGame, 
  unsubscribe,
  finishGame,
  checkGameStatus
} from "../app/supabase.js";

// Timeout per AI (millisecondi)
const AI_TIMEOUTS = {
  easy: 1000,    // 1 secondo
  medium: 3000,  // 3 secondi
  hard: 6000     // 6 secondi
};

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

// Inizializza Supabase
initSupabase();

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

  /* ---- COPIA CODICE ---- */
  if (el.dataset.action === "copy-code") {
    try {
      await navigator.clipboard.writeText(state.onlineGameCode);
      el.textContent = "Copiato!";
      el.classList.add("copied");
      setTimeout(() => {
        el.textContent = "Copia";
        el.classList.remove("copied");
      }, 2000);
    } catch (err) {
      console.error("Errore copia:", err);
      alert("Impossibile copiare. Codice: " + state.onlineGameCode);
    }
    return;
  }

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
    state.ui.screen = "online";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- CREA PARTITA ONLINE ---- */
  if (el.dataset.action === "create-online") {
    const result = await createGame();
    if (result.success) {
      state.onlineGameId = result.gameId;
      state.onlineGameCode = result.code;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.playerId;
      state.onlineWaiting = true;
      renderStatus(state);
      renderBoard(state);
      
      waitForOpponent(result.gameId);
    } else {
      alert(`Errore nella creazione della partita:\n${result.error}\n\nAssicurati di aver configurato Supabase correttamente.`);
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
    
    const result = await joinGame(code);
    if (result.success) {
      resetGame(state, "online");
      state.onlineGameId = result.gameId;
      state.onlineGameCode = result.code;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.player1Id;
      
      const gameState = await loadGameState(result.gameId);
      if (gameState && gameState.state) {
        Object.assign(state, gameState.state);
        state.onlinePlayer1Id = gameState.player1Id;
      }
      
      renderStatus(state);
      renderBoard(state);
      
      startOnlineSubscription(result.gameId);
    } else {
      alert(result.error || "Errore nell'unione alla partita");
    }
    return;
  }

  /* ---- ANNULLA ONLINE ---- */
  if (el.dataset.action === "cancel-online") {
    if (state.onlineChannel) {
      await unsubscribe(state.onlineChannel);
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
      if (state.onlineChannel) {
        await unsubscribe(state.onlineChannel);
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
      await saveGameState(state.onlineGameId, {
        macroBoard: state.macroBoard,
        microBoards: state.microBoards,
        turn: state.turn,
        nextForcedCell: state.nextForcedCell
      });
    }

    if (result.gameEnd) {
      if (state.gameMode === "online") {
        await finishGame(state.onlineGameId, result.gameEnd.winner);
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
  state.ui.aiThinking = true;
  renderBoard(state);
  
  const timeout = AI_TIMEOUTS[state.aiDifficulty] || 3000;
  
  try {
    // Crea promise con timeout
    const aiMovePromise = getAIMove(state);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );
    
    // Race tra AI e timeout
    const aiMove = await Promise.race([aiMovePromise, timeoutPromise]);
    
    state.ui.aiThinking = false;
    
    if (!aiMove) {
      console.error("AI non ha trovato mosse valide");
      renderBoard(state);
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
  } catch (error) {
    console.error("Errore AI o timeout:", error);
    state.ui.aiThinking = false;
    
    // Fallback: mossa casuale
    const moves = getAllValidMoves(state);
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      const result = playMove(state, randomMove.micro, randomMove.row, randomMove.col);
      
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
  }
}

function getAllValidMoves(state) {
  const moves = [];
  for (let micro = 0; micro < 9; micro++) {
    if (!isMicroPlayable(state, micro)) continue;
    const board = state.microBoards[micro];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[r][c] === null) {
          moves.push({ micro, row: r, col: c });
        }
      }
    }
  }
  return moves;
}

// ==========================================
// ONLINE MULTIPLAYER (SUPABASE)
// ==========================================

async function waitForOpponent(gameId) {
  const checkInterval = setInterval(async () => {
    const status = await checkGameStatus(gameId);
    if (status && status.status === "playing") {
      clearInterval(checkInterval);
      resetGame(state, "online");
      state.onlineWaiting = false;
      renderStatus(state);
      renderBoard(state);
      
      startOnlineSubscription(gameId);
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

function startOnlineSubscription(gameId) {
  const channel = subscribeToGame(gameId, (update) => {
    if (update.current_state) {
      const newState = update.current_state;
      state.macroBoard = newState.macroBoard;
      state.microBoards = newState.microBoards;
      state.turn = newState.turn;
      state.nextForcedCell = newState.nextForcedCell;
      
      renderStatus(state);
      renderBoard(state);
    }
    
    if (update.status === "finished") {
      setTimeout(() => {
        showGameEndDialog(update.winner);
      }, 500);
    }
  });
  
  state.onlineChannel = channel;
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
  
  if (state.onlineChannel) {
    unsubscribe(state.onlineChannel);
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

  const clone = document.createElement("div");
  clone.className = "micro-zoom-clone";
  
  const cells = macroCellEl.querySelectorAll(".micro-cell");
  cells.forEach(cell => {
    const cloneCell = document.createElement("div");
    cloneCell.className = "micro-cell";
    
    const img = cell.querySelector("img");
    if (img) {
      const cloneImg = img.cloneNode(true);
      cloneCell.appendChild(cloneImg);
    }
    
    clone.appendChild(cloneCell);
  });
  
  document.body.appendChild(clone);

  const rect = macroCellEl.getBoundingClientRect();
  
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";

  requestAnimationFrame(() => {
    const targetSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.85);
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const finalLeft = centerX - targetSize / 2;
    const finalTop = centerY - targetSize / 2;
    
    const rectCenterX = rect.left + rect.width / 2;
    const rectCenterY = rect.top + rect.height / 2;
    
    const scale = targetSize / rect.width;
    const translateX = (finalLeft + targetSize / 2) - rectCenterX;
    const translateY = (finalTop + targetSize / 2) - rectCenterY;

    clone.style.transformOrigin = "center center";
    
    fade.classList.add("active");
    clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

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
    clone.style.transformOrigin = "center center";
    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";
    clone.style.width = rectStart.width + "px";
    clone.style.height = rectStart.height + "px";
    
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const rectStartCenterX = rectStart.left + rectStart.width / 2;
      const rectStartCenterY = rectStart.top + rectStart.height / 2;
      
      const rectEndCenterX = rectEnd.left + rectEnd.width / 2;
      const rectEndCenterY = rectEnd.top + rectEnd.height / 2;
      
      const scale = rectEnd.width / rectStart.width;
      const translateX = rectEndCenterX - rectStartCenterX;
      const translateY = rectEndCenterY - rectStartCenterY;

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
