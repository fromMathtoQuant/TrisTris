
// scripts/ui.js
import { getMicroBoardIndex } from "../app/boardModel.js";
import { isMicroPlayable } from "../app/gameRules.js";

/** Barra di stato in alto */
export function renderStatus(state) {
  const status = document.getElementById("status-bar");

  const player = state.players[state.turn];
  if (state.nextForcedCell === null) {
    status.textContent = `Turno: ${player} • Scegli una microgriglia libera`;
  } else {
    const targetRow = Math.floor(state.nextForcedCell / state.macroSize);
    const targetCol = state.nextForcedCell % state.macroSize;
    status.textContent = `Turno: ${player} • Gioca nella microgriglia (${targetRow + 1}, ${targetCol + 1})`;
  }
}

/** Render della macrogriglia + microgriglie */
export function renderBoard(state) {
  const root = document.getElementById("board-root");
  root.innerHTML = "";

  const macro = document.createElement("div");
  macro.className = "macro-grid";

  const size = state.macroSize;

  // Quali micro sono attive?
  const forced = state.nextForcedCell;
  const activeSet = new Set();
  if (forced !== null && isMicroPlayable(state, forced)) {
    activeSet.add(forced);
  } else {
    // nessun vincolo: attive tutte le micro giocabili
    for (let i = 0; i < size * size; i++) {
      if (isMicroPlayable(state, i)) activeSet.add(i);
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const macroCell = document.createElement("div");
      macroCell.className = "macro-cell";

      const microIndex = getMicroBoardIndex(r, c);
      const micro = renderMicroGrid(state, microIndex);

      // Evidenzia/Disabilita
      if (activeSet.has(microIndex)) {
        micro.classList.add("micro-grid--active");
        micro.setAttribute("aria-label", `Microgriglia ${r + 1},${c + 1} (attiva)`);
      } else {
        micro.classList.add("micro-grid--disabled");
        micro.setAttribute("aria-label", `Microgriglia ${r + 1},${c + 1} (non giocabile ora)`);
      }

      macroCell.appendChild(micro);
      macro.appendChild(macroCell);
    }
  }

  root.appendChild(macro);
}

/** Render singola microgriglia 3x3 */
export function renderMicroGrid(state, microIndex) {
  const board = state.microBoards[microIndex];
  const micro = document.createElement("div");
  micro.className = "micro-grid";
  micro.dataset.index = String(microIndex);

  const size = state.microSize;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.createElement("button");
      cell.className = "micro-cell";
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);
      cell.dataset.micro = String(microIndex);

      const val = board[r][c];
      cell.textContent = val ?? "";
      cell.setAttribute("aria-label", `Cella ${r + 1},${c + 1} ${val ? `(${val})` : "(vuota)"}`);

      micro.appendChild(cell);
    }
  }

  return micro;
}
