import { getMicroBoardIndex, getMacroCellCoords } from "../app/boardModel.js";
import { isMicroPlayable, isMicroWon } from "../app/gameRules.js";

/* ------------------------------
   BAR STATUS
-------------------------------- */
export function renderStatus(state) {
  const status = document.getElementById("status-bar");
  
  if (state.ui.screen === "menu") {
    status.textContent = "Benvenuto in TrisTris!";
    return;
  }

  const player = state.players[state.turn];

  if (state.ui.viewingMicro !== null) {
    const idx = state.ui.viewingMicro;
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    status.textContent = `Stai giocando nella micro (${r+1}, ${c+1})`;
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

  const container = document.createElement("div");
  container.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2rem;padding:3rem";

  const title = document.createElement("h2");
  title.textContent = "TrisTris";
  title.style.cssText = "font-size:3rem;margin:0;background:linear-gradient(90deg,var(--accent),var(--accent-2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text";

  const description = document.createElement("p");
  description.textContent = "Il gioco del tris elevato al quadrato!";
  description.style.cssText = "text-align:center;font-size:1.1rem;opacity:0.8;max-width:400px";

  const startBtn = document.createElement("button");
  startBtn.textContent = "Inizia Partita";
  startBtn.className = "install-btn";
  startBtn.dataset.action = "start-game";
  startBtn.style.cssText = "padding:1rem 2rem;font-size:1.1rem;cursor:pointer";

  container.appendChild(title);
  container.appendChild(description);
  container.appendChild(startBtn);
  root.appendChild(container);
}

/* ------------------------------
   MACROGRID
-------------------------------- */
function renderMacro(state, root) {
  root.innerHTML = "";
  root.className = "board-placeholder";

  // Bottone torna al menu
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
      // mostra overlay vinta
      const winner = state.macroBoard[r][c];
      const overlay = document.createElement("div");
      overlay.className = `micro-winner-overlay ${winner}`;
      overlay.textContent = winner;
      macroCell.appendChild(overlay);
    } else {
      // micro non vinta → preview ridotta o griglia ghost
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
  root.className = "";

  const overlay = document.createElement("div");
  overlay.className = "micro-fullscreen-overlay";

  /* HEADER */
  const header = document.createElement("div");
  header.className = "micro-fullscreen-header";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button"; 
  closeBtn.className = "micro-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.dataset.closeMicro = "true";

  header.appendChild(closeBtn);
  overlay.appendChild(header);

  /* BODY */
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
