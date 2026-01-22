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
import {
  loginUser,
  loadSession,
  saveSession,
  getLeaderboard,
  updateUserStats
} from "../app/auth.js";

// Timeout per AI (millisecondi)
const AI_TIMEOUTS = {
  easy: 1000,
  medium: 3000,
  hard: 6000
};

// Previeni zoom su iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

// Anno footer
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

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

// Carica sessione utente se esiste
const savedUser = loadSession();
if (savedUser) {
  state.user = savedUser;
}

// Primo render
renderStatus(state);
renderBoard(state);

// ==========================================
// TIMER MANAGEMENT
// ==========================================

function startTimer(state) {
  if (!state.timedMode) {
    return;
  }

  // Ferma timer precedente
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  state.lastMoveTime = Date.now();

  state.timerInterval = setInterval(() => {
    if (state.ui.screen !== "game" || state.ui.viewingMicro !== null) {
      return;
    }

    const now = Date.now();
    const elapsed = Math.floor((now - state.lastMoveTime) / 1000);

    if (state.turn === 0) {
      state.timerX = Math.max(0, 300 - elapsed);
      if (state.timerX === 0) {
        stopTimer(state);
        handleTimeoutWin("O");
      }
    } else {
      state.timerO = Math.max(0, 300 - elapsed);
      if (state.timerO === 0) {
        stopTimer(state);
        handleTimeoutWin("X");
      }
    }

    renderBoard(state);
  }, 100);
}

function stopTimer(state) {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function switchTimer(state) {
  if (!state.timedMode) {
    return;
  }

  const now = Date.now();
  const elapsed = Math.floor((now - state.lastMoveTime) / 1000);

  // Aggiorna il timer del giocatore che ha appena mosso
  if (state.turn === 1) { // Il turno è appena cambiato, quindi l'ultimo a muovere era X (turn 0)
    state.timerX = Math.max(0, state.timerX - elapsed);
  } else { // L'ultimo a muovere era O (turn 1)
    state.timerO = Math.max(0, state.timerO - elapsed);
  }

  // Reset del timestamp per il nuovo turno
  state.lastMoveTime = Date.now();
}

function handleTimeoutWin(winner) {
  setTimeout(() => {
    alert(`Tempo scaduto! ${winner} vince per timeout!`);
    
    if (state.onlineChannel) {
      unsubscribe(state.onlineChannel);
    }
    
    state.ui.screen = "menu";
    renderStatus(state);
    renderBoard(state);
  }, 100);
}

// ==========================================
// CLICK HANDLER
// ==========================================

document.addEventListener("click", async (e) => {
  const el = e.target;
  if (!(el instanceof HTMLElement)) return;

  /* ---- COPIA CODICE ---- */
  if (el.dataset.action === "copy-code") {
    try {
      await navigator.clipboard.writeText(state.onlineGameCode);
      el.innerHTML = "✓";
      el.classList.add("copied");
      setTimeout(() => {
        el.innerHTML = "📋";
        el.classList.remove("copied");
      }, 2000);
    } catch (err) {
      alert("Impossibile copiare. Codice: " + state.onlineGameCode);
    }
    return;
  }

  /* ---- BOTTONE PVP ---- */
  if (el.dataset.action === "start-pvp") {
    state.ui.screen = "pvp-mode";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- PVP TIMED ---- */
  if (el.dataset.action === "pvp-timed") {
    resetGame(state, "pvp", null, true);
    startTimer(state);
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- PVP CLASSIC ---- */
  if (el.dataset.action === "pvp-classic") {
    resetGame(state, "pvp", null, false);
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- ANNULLA PVP MODE ---- */
  if (el.dataset.action === "cancel-pvp-mode") {
    state.ui.screen = "menu";
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
    // Controlla se utente è loggato
    if (!state.user) {
      state.ui.screen = "nickname";
      renderStatus(state);
      renderBoard(state);
    } else {
      state.ui.screen = "online";
      renderStatus(state);
      renderBoard(state);
    }
    return;
  }

  /* ---- CONFERMA NICKNAME ---- */
  if (el.dataset.action === "confirm-nickname") {
    const input = document.getElementById("nickname-input");
    const nickname = input?.value?.trim();
    
    if (!nickname || nickname.length < 3) {
      alert("Il nickname deve essere almeno 3 caratteri");
      return;
    }
    
    // Login/registrazione
    const result = await loginUser(nickname);
    if (result.success) {
      state.user = result.user;
      saveSession(result.user);
      state.ui.screen = "online";
      renderStatus(state);
      renderBoard(state);
    } else {
      alert(result.error || "Errore durante la registrazione");
    }
    return;
  }

  /* ---- ANNULLA NICKNAME ---- */
  if (el.dataset.action === "cancel-nickname") {
    state.ui.screen = "menu";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- MOSTRA CLASSIFICA ---- */
  if (el.dataset.action === "show-leaderboard") {
    const result = await getLeaderboard(100);
    if (result.success) {
      state.leaderboard = result.leaderboard;
      state.ui.screen = "leaderboard";
      renderStatus(state);
      renderBoard(state);
    } else {
      alert("Errore caricamento classifica: " + result.error);
    }
    return;
  }

  /* ---- CHIUDI CLASSIFICA ---- */
  if (el.dataset.action === "close-leaderboard") {
    state.ui.screen = "online";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- CREA PARTITA ONLINE ---- */
  if (el.dataset.action === "create-online") {
    state.ui.screen = "online-mode";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- ONLINE TIMED ---- */
  if (el.dataset.action === "online-timed") {
    const result = await createGame();
    if (result.success) {
      state.onlineGameId = result.gameId;
      state.onlineGameCode = result.code;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.playerId;
      state.onlineWaiting = true;
      state.timedMode = true;
      state.ui.screen = "online";
      renderStatus(state);
      renderBoard(state);
      
      waitForOpponent(result.gameId, true);
    } else {
      alert(`Errore: ${result.error}`);
    }
    return;
  }

  /* ---- ONLINE CLASSIC ---- */
  if (el.dataset.action === "online-classic") {
    const result = await createGame();
    if (result.success) {
      state.onlineGameId = result.gameId;
      state.onlineGameCode = result.code;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.playerId;
      state.onlineWaiting = true;
      state.timedMode = false;
      state.ui.screen = "online";
      renderStatus(state);
      renderBoard(state);
      
      waitForOpponent(result.gameId, false);
    } else {
      alert(`Errore: ${result.error}`);
    }
    return;
  }

  /* ---- ANNULLA ONLINE MODE ---- */
  if (el.dataset.action === "cancel-online-mode") {
    state.ui.screen = "online";
    renderStatus(state);
    renderBoard(state);
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
      // Prima di resettare il gioco, chiediamo la modalità
      const timedChoice = window.confirm("Vuoi giocare con tempo (5 minuti)?\n\nOK = Con tempo\nAnnulla = Classic");
      
      resetGame(state, "online", null, timedChoice);
      state.onlineGameId = result.gameId;
      state.onlineGameCode = result.code;
      state.onlinePlayerId = result.playerId;
      state.onlinePlayer1Id = result.player1Id;
      
      const gameState = await loadGameState(result.gameId);
      if (gameState && gameState.state) {
        Object.assign(state, gameState.state);
        state.onlinePlayer1Id = gameState.player1Id;
      }
      
      if (timedChoice) {
        startTimer(state);
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
      state.onlineChannel = null;
    }
    stopTimer(state);
    state.ui.screen = "menu";
    state.onlineWaiting = false;
    state.onlineGameCode = null;
    state.onlineGameId = null;
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

  /* ---- ANNULLA DIFFICOLTÀ ---- */
  if (el.dataset.action === "cancel-difficulty") {
    state.ui.screen = "menu";
    renderStatus(state);
    renderBoard(state);
    return;
  }

  /* ---- TORNA AL MENU ---- */
  if (el.dataset.action === "back-to-menu") {
    const confirm = window.confirm("Tornare al menu? La partita sarà persa.");
    if (confirm) {
      if (state.onlineChannel) {
        await unsubscribe(state.onlineChannel);
      }
      stopTimer(state);
      state.ui.screen = "menu";
      renderStatus(state);
      renderBoard(state);
    }
    return;
  }

  /* ---- RESA ---- */
  if (el.dataset.action === "surrender") {
    const confirm = window.confirm("Sei sicuro di volerti arrendere? Perderai la partita.");
    if (confirm) {
      const winner = state.turn === 0 ? "O" : "X";
      
      if (state.gameMode === "online") {
        await finishGame(state.onlineGameId, winner);
        
        if (state.user) {
          const opponentElo = 1000;
          await updateUserStats(state.user.id, "loss", opponentElo);
        }
      }
      
      stopTimer(state);
      alert(`Ti sei arreso. ${winner} vince!`);
      
      if (state.onlineChannel) {
        await unsubscribe(state.onlineChannel);
      }
      
      state.ui.screen = "menu";
      renderStatus(state);
      renderBoard(state);
    }
    return;
  }

  /* ---- CHIUDI FULLSCREEN ---- */
  if (el.dataset.action === "close-micro") {
    const microIndex = state.ui.viewingMicro;
    
    // Se timedMode è true, chiudi immediatamente senza animazione
    if (state.timedMode) {
      state.ui.viewingMicro = null;
      renderStatus(state);
      renderBoard(state);
    } else {
      // Altrimenti usa l'animazione zoom out
      animateMicroZoomOut(microIndex, () => {
        state.ui.viewingMicro = null;
        renderStatus(state);
        renderBoard(state);
      });
    }
    return;
  }

  /* ---- APRI MICRO ---- */
  if (el.closest(".macro-cell") && state.ui.viewingMicro === null) {
    const cell = el.closest(".macro-cell");
    const idx = Number(cell.dataset.micro);
  
    if (!isMicroPlayable(state, idx)) return;
  
    if (state.gameMode === "online") {
      const isMyTurn = (state.turn === 0 && state.onlinePlayerId === state.onlinePlayer1Id) ||
                       (state.turn === 1 && state.onlinePlayerId !== state.onlinePlayer1Id);
      if (!isMyTurn) return;
    }
  
    // Se timedMode è true, mostra immediatamente senza animazione
    if (state.timedMode) {
      state.ui.viewingMicro = idx;
      renderStatus(state);
      renderBoard(state);
    } else {
      // Altrimenti usa l'animazione zoom
      animateMicroZoomIn(cell, idx);
    }
    return;
  }

  /* ---- MOSSA ---- */
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
    switchTimer(state);
    
    state.ui.viewingMicro = null;
    renderStatus(state);
    renderBoard(state);

    if (state.gameMode === "online") {
      await saveGameState(state.onlineGameId, {
        macroBoard: state.macroBoard,
        microBoards: state.microBoards,
        turn: state.turn,
        nextForcedCell: state.nextForcedCell,
        timerX: state.timerX,
        timerO: state.timerO,
        timedMode: state.timedMode
      });
    }

    if (result.gameEnd) {
      stopTimer(state);
      
      if (state.gameMode === "online") {
        await finishGame(state.onlineGameId, result.gameEnd.winner);
        
        // Aggiorna ELO
        if (state.user) {
          const mySymbol = state.onlinePlayerId === state.onlinePlayer1Id ? "X" : "O";
          let eloResult;
          if (result.gameEnd.winner === "draw") {
            eloResult = "draw";
          } else if (result.gameEnd.winner === mySymbol) {
            eloResult = "win";
          } else {
            eloResult = "loss";
          }
          
          const opponentElo = 1000; // ELO base per il calcolo
          await updateUserStats(state.user.id, eloResult, opponentElo);
        }
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
    const aiMovePromise = getAIMove(state);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );
    
    const aiMove = await Promise.race([aiMovePromise, timeoutPromise]);
    
    state.ui.aiThinking = false;
    
    if (!aiMove) {
      console.error("AI non ha trovato mosse");
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
    console.error("Errore AI:", error);
    state.ui.aiThinking = false;
    
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
// ONLINE
// ==========================================

async function waitForOpponent(gameId, timed) {
  const checkInterval = setInterval(async () => {
    const status = await checkGameStatus(gameId);
    if (status && status.status === "playing") {
      clearInterval(checkInterval);
      resetGame(state, "online", null, timed);
      state.onlineWaiting = false;
      if (timed) {
        startTimer(state);
      }
      renderStatus(state);
      renderBoard(state);
      
      startOnlineSubscription(gameId);
    }
  }, 1000);
  
  setTimeout(() => {
    clearInterval(checkInterval);
    if (state.onlineWaiting) {
      alert("Tempo scaduto. Nessun avversario.");
      state.ui.screen = "online";
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
      
      if (newState.timerX !== undefined) state.timerX = newState.timerX;
      if (newState.timerO !== undefined) state.timerO = newState.timerO;
      if (newState.timedMode !== undefined) state.timedMode = newState.timedMode;
      
      if (state.timedMode) {
        switchTimer(state);
      }
      
      renderStatus(state);
      renderBoard(state);
    }
    
    if (update.status === "finished") {
      stopTimer(state);
      setTimeout(() => {
        showGameEndDialog(update.winner);
      }, 500);
    }
  });
  
  state.onlineChannel = channel;
}

// ==========================================
// DIALOG FINE
// ==========================================

function showGameEndDialog(winner) {
  let message;
  if (winner === "draw") {
    message = "PAREGGIO!";
  } else if (state.gameMode === "ai") {
    if (winner === "X") {
      message = "🎉 HAI VINTO! 🎉";
    } else {
      message = "😢 L'AI HA VINTO";
    }
  } else if (state.gameMode === "online") {
    const mySymbol = state.onlinePlayerId === state.onlinePlayer1Id ? "X" : "O";
    if (winner === mySymbol) {
      message = "🎉 HAI VINTO! 🎉";
    } else {
      message = "😢 HAI PERSO";
    }
  } else {
    message = `🎉 VITTORIA ${winner}! 🎉`;
  }
  
  alert(message);
  
  if (state.onlineChannel) {
    unsubscribe(state.onlineChannel);
  }
  
  stopTimer(state);
  
  state.ui.screen = "menu";
  renderStatus(state);
  renderBoard(state);
}

// Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(err => console.error("SW failed", err));
  });
}

/* ===== ANIMAZIONI ===== */

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
  
  // Calcola il centro della macro-cell
  const macroCenterX = rect.left + rect.width / 2;
  const macroCenterY = rect.top + rect.height / 2;
  
  clone.style.left = rect.left + "px";
  clone.style.top = rect.top + "px";
  clone.style.width = rect.width + "px";
  clone.style.height = rect.height + "px";

  requestAnimationFrame(() => {
    const targetSize = Math.min(window.innerWidth * 0.9, window.innerHeight * 0.85);
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const scale = targetSize / rect.width;
    
    // Trasla dal centro della macro-cell al centro dello schermo
    const translateX = centerX - macroCenterX;
    const translateY = centerY - macroCenterY;

    fade.classList.add("active");
    clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

    setTimeout(() => {
      state.ui.viewingMicro = microIndex;
      renderStatus(state);
      renderBoard(state);
      clone.remove();
      fade.remove();
    }, 400);
  });
}

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
    
    // Calcola il centro dello schermo (dove si trova fullscreen)
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    
    // Calcola il centro della macro-cell di destinazione
    const macroCenterX = rectEnd.left + rectEnd.width / 2;
    const macroCenterY = rectEnd.top + rectEnd.height / 2;
    
    clone.style.left = rectStart.left + "px";
    clone.style.top = rectStart.top + "px";
    clone.style.width = rectStart.width + "px";
    clone.style.height = rectStart.height + "px";
    
    document.body.appendChild(clone);

    requestAnimationFrame(() => {
      const scale = rectEnd.width / rectStart.width;
      
      // Trasla dal centro dello schermo al centro della macro-cell
      const translateX = macroCenterX - screenCenterX;
      const translateY = macroCenterY - screenCenterY;

      clone.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      fade.classList.remove("active");

      setTimeout(() => {
        clone.remove();
        fade.remove();
        onComplete();
      }, 400);
    });
  }, 50);
}
