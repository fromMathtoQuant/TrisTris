
// scripts/ui.js
import { getMicroBoardIndex, getMacroCellCoords } from "../app/boardModel.js";
import { isMicroPlayable, isMicroWon } from "../app/gameRules.js";

/** Barra di stato */
export function renderStatus(state) {
  const status = document.getElementById("status-bar");
  const player = state.players[state.turn];

  if (state.nextForcedCell === null) {
    status.textContent = `Turno: ${player} • Scegli una microgriglia libera`;
  } else {
    const r = Math.floor(state.nextForcedCell / state.macroSize);
    const c = state.nextForcedCell % state.macroSize;
    status.textContent = `Turno: ${player} • Gioca nella micro (${r + 1}, ${c + 1})`;
  }
}

/** Render della macrogriglia */
export function renderBoard(state) {
  const root = document.getElementById("board-root");
  root.innerHTML = "";

  const macro = document.createElement("div");
  macro.className = "macro-grid";

  const size = state.macroSize;

  // Determina quali microgrid sono attive
  const forced = state.nextForcedCell;
  const active = new Set();

  if (forced !== null && isMicroPlayable(state, forced)) {
    active.add(forced);
  } else {
    // nessun vincolo o micro obbligata non giocabile → tutte le playable attive
    for (let i = 0; i < 9; i++) {
      if (isMicroPlayable(state, i)) active.add(i);
    }
  }

  // Render celle macro
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const macroCell = document.createElement("div");
      macroCell.className = "macro-cell";

      const microIndex = getMicroBoardIndex(r, c);

      const microGrid = renderMicroGrid(state, microIndex);

      // Micro vinta?
      if (isMicroWon(state, microIndex)) {
        microGrid.classList.add("micro-grid--won");

        const winner = state.macroBoard[r][c];

        const overlay = document.createElement("div");
        overlay.className = `micro-winner-overlay ${winner}`;
        overlay.textContent = winner;

        microGrid.appendChild(overlay);
      }

      // Highlight active / disabled
      if (!isMicroWon(state, microIndex)) {
        if (active.has(microIndex)) {
          microGrid.classList.add("micro-grid--active");
        } else {
          microGrid.classList.add("micro-grid--disabled");
        }
      }

      macroCell.appendChild(microGrid);
      macro.appendChild(macroCell);
    }
  }

  root.appendChild(macro);
}

/** Render di una micro-griglia 3×3 */
export function renderMicroGrid(state, microIndex) {
  const board = state.microBoards[microIndex];
  const micro = document.createElement("div");
  micro.className = "micro-grid";
  micro.dataset.index = microIndex;

  const size = state.microSize;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
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
