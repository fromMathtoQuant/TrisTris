import { getMicroBoardIndex, getMacroCellCoords } from "../app/boardModel.js";
import { isMicroPlayable, isMicroWon } from "../app/gameRules.js";

/* ------------------------------
   BAR STATUS
-------------------------------- */
export function renderStatus(state) {
  const status = document.getElementById("status-bar");
  
  if (state.ui.screen === "menu" || state.ui.screen === "difficulty") {
    status.textContent = "Benvenuto in TrisTris!";
    return;
  }

  const player = state.players[state.turn];

  if (state.ui.viewingMicro !== null) {
    const idx = state.ui.viewingMicro;
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    
    if (state.gameMode === "ai" && state.turn === 1) {
      status.textContent = `AI sta pensando nella micro (${r+1}, ${c+1})...`;
    } else {
      status.textContent = `Stai giocando nella micro (${r+1}, ${c+1})`;
    }
    return;
  }

  if (state.gameMode === "ai" && state.turn === 1) {
    status.textContent = "Turno dell'AI...";
    return;
  }

  if (state.nextForcedCell === null) {
    status.textContent = `Turno: ${player} — scegli una micro`;
  } else {
    const r = Math.floor(state.nextForcedCell / 3);
    const c = state.nextForcedCell % 3;
    status.textContent = `Turno: ${player} — devi giocare nella micro (${r+1}, ${c+1})`;
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
  root.className = "board-placeholder menu-screen";

  const title = document.createElement("h2");
  title.className = "menu-title";
  title.textContent = "TrisTris";

  const description = document.createElement("p");
  description.className = "menu-description";
  description.textContent = "Il gioco del tris elevato al quadrato!";

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "menu-buttons";

  const pvpBtn = document.createElement("button");
  pvpBtn.textContent = "2 Giocatori";
  pvpBtn.className = "menu-btn";
  pvpBtn.dataset.action = "start-pvp";

  const aiBtn = document.createElement("button");
  aiBtn.textContent = "Contro AI";
  aiBtn.className = "menu-btn secondary";
  aiBtn.dataset.action = "start-ai";

  buttonsContainer.appendChild(pvpBtn);
  buttonsContainer.appendChild(aiBtn);

  root.appendChild(title);
  root.appendChild(description);
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
  easyBtn.textContent = "Facile";
  easyBtn.dataset.difficulty = "easy";

  const mediumBtn = document.createElement("button");
  mediumBtn.className = "difficulty-btn medium";
  mediumBtn.textContent = "Medio";
  mediumBtn.dataset.difficulty = "medium";

  const hardBtn = document.createElement("button");
  hardBtn.className = "difficulty-btn hard";
  hardBtn.textContent = "Difficile";
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
   MACROGRID
-------------------------------- */
function renderMacro(state, root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  const backBtn = document.createElement("button");
  backBtn.textContent = "← Torna al Menu";
  backBtn.className = "install-btn";
  backBtn.dataset.action = "back-to-menu";
  backBtn.style.cssText = "margin-bottom:1rem;align-self:flex-start";
  root.appendChild(backBtn);

  const macro = document.createElement("div");
  macro.className = "macro-grid";

  const active = getActiveMicroSet(state);

  for (let idx = 0; idx < 9; idx++) {
    const macroCell = document.createElement("div");
    macroCell.className = "macro-cell";
    macroCell.dataset.micro = idx;

    if (active.has(idx)) {
      macroCell.classList.add("micro-grid--active");
    } else {
      macroCell.classList.add("micro-grid--disabled");
    }

    const r = Math.floor(idx / 3);
    const c = idx % 3;

    if (isMicroWon(state, idx)) {
      const winner = state.macroBoard[r][c];
      const overlay = document.createElement("div");
      overlay.className = `micro-winner-overlay ${winner}`;
      overlay.textContent = winner;
      macroCell.appendChild(overlay);
    } else {
      macroCell.appendChild(renderMicroPreview(state, idx));
    }

    macro.appendChild(macroCell);
  }

  root.appendChild(macro);
}

/* ------------------------------
   MICRO FULLSCREEN
-------------------------------- */
function renderMicroFullscreen(state, microIndex, root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

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
   MICRO PREVIEW (in macro)
-------------------------------- */
function renderMicroPreview(state, microIndex) {
  const preview = document.createElement("div");
  preview.className = "micro-grid micro-preview";

  const board = state.microBoards[microIndex];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("div");
      cell.className = "micro-cell";
      cell.textContent = board[r][c] ?? "";
      preview.appendChild(cell);
    }
  }
  return preview;
}

/* ------------------------------
   MICRO GRID FULL VERSION
-------------------------------- */
export function renderMicroGrid(state, microIndex) {
  const board = state.microBoards[microIndex];
  const micro = document.createElement("div");
  micro.className = "micro-grid";
  micro.dataset.index = microIndex;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = document.createElement("button");
      cell.className = "micro-cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.dataset.micro = microIndex;

      cell.textContent = board[r][c] ?? "";

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
