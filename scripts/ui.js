import { getMicroBoardIndex, getMacroCellCoords } from "../app/boardModel.js";
import { isMicroPlayable, isMicroWon } from "../app/gameRules.js";

/* ------------------------------
   HELPER: Descrizione posizione testuale
-------------------------------- */
function getPositionDescription(cellIndex) {
  const r = Math.floor(cellIndex / 3);
  const c = cellIndex % 3;
  
  const rowPos = (r === 0) ? "in alto"
              : (r === 1) ? "al centro"
              :              "in basso";
 
  const colPos = (c === 0) ? "a sinistra"
              : (c === 1) ? "al centro"
              :              "a destra";
 
  // Se entrambe sono "al centro" (r === 1 e c === 1), evitiamo ripetizioni
  const descrizionePos = (r === 1 && c === 1)
    ? "al centro"
    : (r === 1)
      ? `al centro ${colPos}`
      : (c === 1)
        ? `${rowPos} al centro`
        : `${rowPos} ${colPos}`;
  
  return descrizionePos;
}

/* ------------------------------
   FORMAT TIME
-------------------------------- */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* ------------------------------
   BAR STATUS
-------------------------------- */
export function renderStatus(state) {
  const status = document.getElementById("status-bar");
  
  if (state.ui.screen === "menu" || state.ui.screen === "difficulty" || 
      state.ui.screen === "online" || state.ui.screen === "nickname" ||
      state.ui.screen === "leaderboard") {
    status.style.display = "none";
    return;
  }

  status.style.display = "block";
  const player = state.players[state.turn];

  if (state.ui.viewingMicro !== null) {
    const idx = state.ui.viewingMicro;
    const descrizione = getPositionDescription(idx);
    
    if (state.gameMode === "ai" && state.turn === 1) {
      status.textContent = `AI sta pensando nella casella ${descrizione}`;
    } else if (state.gameMode === "online") {
      const symbol = state.onlinePlayerId === state.onlinePlayer1Id ? "X" : "O";
      status.textContent = `Tu sei ${symbol} - Giocando nella casella ${descrizione}`;
    } else {
      status.textContent = `Stai giocando nella casella ${descrizione}`;
    }
    return;
  }

  if (state.gameMode === "ai" && state.turn === 1) {
    status.textContent = "Turno dell'AI...";
    return;
  }
  
  if (state.gameMode === "online") {
    const isMyTurn = (state.turn === 0 && state.onlinePlayerId === state.onlinePlayer1Id) ||
                     (state.turn === 1 && state.onlinePlayerId !== state.onlinePlayer1Id);
    const mySymbol = state.onlinePlayerId === state.onlinePlayer1Id ? "X" : "O";
    
    if (isMyTurn) {
      if (state.nextForcedCell === null) {
        status.textContent = `Il tuo turno (${mySymbol}) — scegli una casella`;
      } else {
        const descrizione = getPositionDescription(state.nextForcedCell);
        status.textContent = `Tocca a ${mySymbol} — devi giocare nella casella ${descrizione}`;
      }
    } else {
      status.textContent = `In attesa dell'avversario...`;
    }
    return;
  }

  if (state.nextForcedCell === null) {
    status.textContent = `Turno: ${player} — scegli una casella`;
  } else {
    const descrizione = getPositionDescription(state.nextForcedCell);
    status.textContent = `Tocca a ${player} — devi giocare nella casella ${descrizione}`;
  }
}

/* ------------------------------
   BOARD ROOT SWITCH
-------------------------------- */
export function renderBoard(state) {
  const root = document.getElementById("board-root");

  if (state.ui.screen === "menu") {
    renderMenu(root);
    return;
  }

  if (state.ui.screen === "difficulty") {
    renderDifficultyModal(root);
    return;
  }

  if (state.ui.screen === "nickname") {
    renderNicknameModal(root);
    return;
  }

  if (state.ui.screen === "online") {
    renderOnlineModal(root, state);
    return;
  }

  if (state.ui.screen === "leaderboard") {
    renderLeaderboardModal(root, state);
    return;
  }

  if (state.ui.viewingMicro !== null) {
    renderMicroFullscreen(state, state.ui.viewingMicro, root);
  } else {
    renderMacro(state, root);
  }
}

/* ------------------------------
   MENU INIZIALE
-------------------------------- */
function renderMenu(root) {
  root.innerHTML = "";
  root.className = "menu-screen";

  const title = document.createElement("h1");
  title.className = "menu-title";
  title.textContent = "TrisTris";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "menu-buttons";

  const pvpBtn = document.createElement("button");
  pvpBtn.textContent = "2 Giocatori Locali";
  pvpBtn.className = "menu-btn";
  pvpBtn.dataset.action = "start-pvp";

  const aiBtn = document.createElement("button");
  aiBtn.textContent = "Contro AI";
  aiBtn.className = "menu-btn secondary";
  aiBtn.dataset.action = "start-ai";

  const onlineBtn = document.createElement("button");
  onlineBtn.textContent = "Online 2 Giocatori";
  onlineBtn.className = "menu-btn online";
  onlineBtn.dataset.action = "start-online";

  buttonsContainer.appendChild(pvpBtn);
  buttonsContainer.appendChild(aiBtn);
  buttonsContainer.appendChild(onlineBtn);

  root.appendChild(title);
  root.appendChild(buttonsContainer);
}

/* ------------------------------
   DIFFICULTY MODAL
-------------------------------- */
function renderDifficultyModal(root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const modal = document.createElement("div");
  modal.className = "difficulty-modal";

  const content = document.createElement("div");
  content.className = "difficulty-content";

  const title = document.createElement("h2");
  title.className = "difficulty-title";
  title.textContent = "Scegli la difficoltà";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "difficulty-buttons";

  const easyBtn = document.createElement("button");
  easyBtn.className = "difficulty-btn easy";
  easyBtn.innerHTML = "<strong>Facile</strong><br><small>Minimax (≤1s)</small>";
  easyBtn.dataset.difficulty = "easy";

  const mediumBtn = document.createElement("button");
  mediumBtn.className = "difficulty-btn medium";
  mediumBtn.innerHTML = "<strong>Medio</strong><br><small>RL Neural Net (≤3s)</small>";
  mediumBtn.dataset.difficulty = "medium";

  const hardBtn = document.createElement("button");
  hardBtn.className = "difficulty-btn hard";
  hardBtn.innerHTML = "<strong>Difficile</strong><br><small>MCTS (≤6s)</small>";
  hardBtn.dataset.difficulty = "hard";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "difficulty-btn difficulty-cancel";
  cancelBtn.textContent = "Annulla";
  cancelBtn.dataset.action = "cancel-difficulty";

  buttonsContainer.appendChild(easyBtn);
  buttonsContainer.appendChild(mediumBtn);
  buttonsContainer.appendChild(hardBtn);
  buttonsContainer.appendChild(cancelBtn);

  content.appendChild(title);
  content.appendChild(buttonsContainer);
  modal.appendChild(content);
  root.appendChild(modal);
}

/* ------------------------------
   NICKNAME MODAL
-------------------------------- */
function renderNicknameModal(root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const modal = document.createElement("div");
  modal.className = "nickname-modal";

  const content = document.createElement("div");
  content.className = "nickname-content";

  const title = document.createElement("h2");
  title.className = "nickname-title";
  title.textContent = "Scegli il tuo Nickname";

  const description = document.createElement("p");
  description.style.textAlign = "center";
  description.style.color = "#64748b";
  description.style.marginBottom = "1.5rem";
  description.textContent = "Il nickname sarà usato per la classifica ELO";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Inserisci nickname";
  input.className = "nickname-input";
  input.id = "nickname-input";
  input.maxLength = 20;
  input.autocomplete = "off";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "difficulty-buttons";

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "online-btn";
  confirmBtn.textContent = "Conferma";
  confirmBtn.dataset.action = "confirm-nickname";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "online-btn online-cancel";
  cancelBtn.textContent = "Annulla";
  cancelBtn.dataset.action = "cancel-nickname";

  buttonsContainer.appendChild(confirmBtn);
  buttonsContainer.appendChild(cancelBtn);

  content.appendChild(title);
  content.appendChild(description);
  content.appendChild(input);
  content.appendChild(buttonsContainer);
  modal.appendChild(content);
  root.appendChild(modal);

  // Focus sull'input
  setTimeout(() => input.focus(), 100);

  // Enter per confermare
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      confirmBtn.click();
    }
  });
}

/* ------------------------------
   ONLINE MODAL
-------------------------------- */
function renderOnlineModal(root, state) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const modal = document.createElement("div");
  modal.className = "online-modal";

  const content = document.createElement("div");
  content.className = "online-content";

  const title = document.createElement("h2");
  title.className = "online-title";
  title.textContent = "Modalità Online";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "online-buttons";

  if (state.onlineWaiting) {
    const info = document.createElement("div");
    info.className = "online-info";
    info.innerHTML = `<div style="margin-bottom: 1rem;">Condividi questo codice:</div>`;
    
    const codeBox = document.createElement("div");
    codeBox.className = "code-box";
    
    const codeText = document.createElement("div");
    codeText.className = "online-code";
    codeText.textContent = state.onlineGameCode;
    
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-code-btn";
    copyBtn.innerHTML = "📋";
    copyBtn.dataset.action = "copy-code";
    copyBtn.title = "Copia codice";
    
    codeBox.appendChild(codeText);
    codeBox.appendChild(copyBtn);
    info.appendChild(codeBox);
    
    const waitText = document.createElement("div");
    waitText.style.marginTop = "1rem";
    waitText.textContent = "In attesa che si unisca...";
    info.appendChild(waitText);
    
    const loader = document.createElement("div");
    loader.className = "loader";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "online-btn online-cancel";
    cancelBtn.textContent = "Annulla";
    cancelBtn.dataset.action = "cancel-online";

    content.appendChild(title);
    content.appendChild(info);
    content.appendChild(loader);
    content.appendChild(cancelBtn);
  } else {
    const createBtn = document.createElement("button");
    createBtn.className = "online-btn";
    createBtn.textContent = "Crea Partita";
    createBtn.dataset.action = "create-online";

    const joinSection = document.createElement("div");
    joinSection.style.marginTop = "1.5rem";
    
    const joinLabel = document.createElement("label");
    joinLabel.textContent = "Oppure unisciti con un codice:";
    joinLabel.style.display = "block";
    joinLabel.style.marginBottom = "0.5rem";
    joinLabel.style.fontSize = "0.9rem";
    joinLabel.style.color = "#64748b";

    const joinInput = document.createElement("input");
    joinInput.type = "text";
    joinInput.placeholder = "Inserisci codice";
    joinInput.className = "online-input";
    joinInput.id = "join-code-input";
    joinInput.maxLength = 6;
    joinInput.style.textTransform = "uppercase";

    const joinBtn = document.createElement("button");
    joinBtn.className = "online-btn";
    joinBtn.textContent = "Unisciti alla Partita";
    joinBtn.dataset.action = "join-online";

    const leaderboardBtn = document.createElement("button");
    leaderboardBtn.className = "leaderboard-btn";
    leaderboardBtn.innerHTML = "🏆 Classifica";
    leaderboardBtn.dataset.action = "show-leaderboard";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "online-btn online-cancel";
    cancelBtn.textContent = "Torna al Menu";
    cancelBtn.dataset.action = "cancel-online";

    joinSection.appendChild(joinLabel);
    joinSection.appendChild(joinInput);

    buttonsContainer.appendChild(createBtn);
    buttonsContainer.appendChild(joinSection);
    buttonsContainer.appendChild(joinBtn);
    buttonsContainer.appendChild(leaderboardBtn);
    buttonsContainer.appendChild(cancelBtn);

    content.appendChild(title);
    content.appendChild(buttonsContainer);
  }

  modal.appendChild(content);
  root.appendChild(modal);
}

/* ------------------------------
   LEADERBOARD MODAL
-------------------------------- */
function renderLeaderboardModal(root, state) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const modal = document.createElement("div");
  modal.className = "leaderboard-modal";

  const content = document.createElement("div");
  content.className = "leaderboard-content";

  const title = document.createElement("h2");
  title.className = "leaderboard-title";
  title.textContent = "🏆 Classifica ELO";

  if (state.leaderboard && state.leaderboard.length > 0) {
    const list = document.createElement("ul");
    list.className = "leaderboard-list";

    state.leaderboard.forEach((player, index) => {
      const item = document.createElement("li");
      item.className = "leaderboard-item";

      const rank = document.createElement("div");
      rank.className = "leaderboard-rank";
      rank.textContent = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;

      const playerInfo = document.createElement("div");
      playerInfo.className = "leaderboard-player";

      const nickname = document.createElement("div");
      nickname.className = "leaderboard-nickname";
      nickname.textContent = player.nickname;

      const stats = document.createElement("div");
      stats.className = "leaderboard-stats";
      stats.textContent = `${player.wins}W - ${player.losses}L - ${player.draws}D`;

      playerInfo.appendChild(nickname);
      playerInfo.appendChild(stats);

      const elo = document.createElement("div");
      elo.className = "leaderboard-elo";
      elo.textContent = player.elo_rating;

      item.appendChild(rank);
      item.appendChild(playerInfo);
      item.appendChild(elo);

      list.appendChild(item);
    });

    content.appendChild(title);
    content.appendChild(list);
  } else {
    const emptyMsg = document.createElement("p");
    emptyMsg.style.textAlign = "center";
    emptyMsg.style.color = "#64748b";
    emptyMsg.style.padding = "2rem";
    emptyMsg.textContent = "Nessun giocatore in classifica";

    content.appendChild(title);
    content.appendChild(emptyMsg);
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "online-btn";
  closeBtn.textContent = "Chiudi";
  closeBtn.dataset.action = "close-leaderboard";
  closeBtn.style.marginTop = "1rem";

  content.appendChild(closeBtn);
  modal.appendChild(content);
  root.appendChild(modal);
}

/* ------------------------------
   RENDER TIMERS
-------------------------------- */
function renderTimers(state, container) {
  if (state.gameMode !== "pvp" && state.gameMode !== "online") {
    return;
  }

  const timersContainer = document.createElement("div");
  timersContainer.className = "timers-container";

  // Timer O (sopra)
  const timerO = document.createElement("div");
  timerO.className = "timer";
  if (state.turn === 1) {
    timerO.classList.add("active");
  }
  if (state.timerO <= 60 && state.timerO > 10) {
    timerO.classList.add("warning");
  } else if (state.timerO <= 10) {
    timerO.classList.add("danger");
  }

  const symbolO = document.createElement("div");
  symbolO.className = "timer-symbol";
  const imgO = document.createElement("img");
  imgO.src = "O.png";
  imgO.alt = "O";
  symbolO.appendChild(imgO);

  const timeO = document.createElement("div");
  timeO.className = "timer-time";
  timeO.textContent = formatTime(state.timerO);

  timerO.appendChild(symbolO);
  timerO.appendChild(timeO);

  // Timer X (sotto)
  const timerX = document.createElement("div");
  timerX.className = "timer";
  if (state.turn === 0) {
    timerX.classList.add("active");
  }
  if (state.timerX <= 60 && state.timerX > 10) {
    timerX.classList.add("warning");
  } else if (state.timerX <= 10) {
    timerX.classList.add("danger");
  }

  const symbolX = document.createElement("div");
  symbolX.className = "timer-symbol";
  const imgX = document.createElement("img");
  imgX.src = "ICS.png";
  imgX.alt = "X";
  symbolX.appendChild(imgX);

  const timeX = document.createElement("div");
  timeX.className = "timer-time";
  timeX.textContent = formatTime(state.timerX);

  timerX.appendChild(symbolX);
  timerX.appendChild(timeX);

  timersContainer.appendChild(timerO);
  timersContainer.appendChild(timerX);

  container.appendChild(timersContainer);
}

/* ------------------------------
   MACROGRID
-------------------------------- */
function renderMacro(state, root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Menu";
  backBtn.className = "back-menu-btn";
  backBtn.dataset.action = "back-to-menu";
  root.appendChild(backBtn);

  const gameContainer = document.createElement("div");
  gameContainer.className = "game-container";

  const macro = document.createElement("div");
  macro.className = "macro-grid";

  const active = getActiveMicroSet(state);
  const isXTurn = state.turn === 0;

  for (let idx = 0; idx < 9; idx++) {
    const macroCell = document.createElement("div");
    macroCell.className = "macro-cell";
    macroCell.dataset.micro = idx;

    if (active.has(idx)) {
      macroCell.classList.add(isXTurn ? "micro-grid--active-x" : "micro-grid--active-o");
    } else {
      macroCell.classList.add("micro-grid--disabled");
    }

    const r = Math.floor(idx / 3);
    const c = idx % 3;

    if (isMicroWon(state, idx)) {
      const winner = state.macroBoard[r][c];
      const overlay = document.createElement("div");
      overlay.className = `micro-winner-overlay`;
      
      const img = document.createElement("img");
      img.src = winner === 'X' ? 'ICS.png' : 'O.png';
      img.alt = winner;
      overlay.appendChild(img);
      
      macroCell.appendChild(overlay);
      
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "micro-cell";
        cell.style.opacity = "0";
        macroCell.appendChild(cell);
      }
    } else {
      renderMicroCells(state, idx, macroCell);
    }

    macro.appendChild(macroCell);
  }

  gameContainer.appendChild(macro);

  // Render timers
  renderTimers(state, gameContainer);

  if (state.gameMode === "ai" && state.turn === 1 && state.ui.aiThinking) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-loading";
    loadingDiv.innerHTML = `
      <div class="spinner"></div>
      <span>AI sta pensando...</span>
    `;
    gameContainer.appendChild(loadingDiv);
  }

  root.appendChild(gameContainer);
}

/* ------------------------------
   MICRO CELLS (in macro)
-------------------------------- */
function renderMicroCells(state, microIndex, container) {
  const board = state.microBoards[microIndex];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("div");
      cell.className = "micro-cell";
      
      const symbol = board[r][c];
      if (symbol === 'X') {
        const img = document.createElement("img");
        img.src = "ICS.png";
        img.alt = "X";
        cell.appendChild(img);
      } else if (symbol === 'O') {
        const img = document.createElement("img");
        img.src = "O.png";
        img.alt = "O";
        cell.appendChild(img);
      }
      
      container.appendChild(cell);
    }
  }
}

/* ------------------------------
   MICRO FULLSCREEN
-------------------------------- */
function renderMicroFullscreen(state, microIndex, root) {
  root.innerHTML = "";
  root.className = "board-placeholder";
  root.style.background = "transparent";
  root.style.border = "none";
  root.style.padding = "0";

  const overlay = document.createElement("div");
  overlay.className = "micro-fullscreen-overlay";

  const header = document.createElement("div");
  header.className = "micro-fullscreen-header";

  const closeBtn = document.createElement("button");
  closeBtn.className = "micro-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.dataset.action = "close-micro";

  header.appendChild(closeBtn);
  overlay.appendChild(header);

  const body = document.createElement("div");
  body.className = "micro-fullscreen-body";

  const microGrid = renderMicroGrid(state, microIndex);
  microGrid.classList.add("fullscreen-micro");

  body.appendChild(microGrid);
  overlay.appendChild(body);

  root.appendChild(overlay);
}

/* ------------------------------
   MICRO GRID FULL VERSION
-------------------------------- */
export function renderMicroGrid(state, microIndex) {
  const board = state.microBoards[microIndex];
  const micro = document.createElement("div");
  micro.className = "fullscreen-micro";
  micro.dataset.index = microIndex;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("button");
      cell.className = "micro-cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.dataset.micro = microIndex;
      
      const symbol = board[r][c];
      if (symbol === 'X') {
        const img = document.createElement("img");
        img.src = "ICS.png";
        img.alt = "X";
        cell.appendChild(img);
      } else if (symbol === 'O') {
        const img = document.createElement("img");
        img.src = "O.png";
        img.alt = "O";
        cell.appendChild(img);
      }
      
      micro.appendChild(cell);
    }
  }

  return micro;
}

/* ------------------------------
   HELPERS
-------------------------------- */
function getActiveMicroSet(state) {
  const active = new Set();
  const forced = state.nextForcedCell;

  if (forced !== null && isMicroPlayable(state, forced)) {
    active.add(forced);
    return active;
  }

  for (let i = 0; i < 9; i++) {
    if (isMicroPlayable(state, i)) active.add(i);
  }

  return active;
}
