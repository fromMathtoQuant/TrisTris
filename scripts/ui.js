
// scripts/ui.js
import { getMicroBoardIndex } from "../app/boardModel.js";

/**
 * Render della macrogriglia + microgriglie
 */
export function renderBoard(state) {
  const root = document.getElementById("board-root");

  root.innerHTML = ""; // pulizia contenuto precedente

  const macro = document.createElement("div");
  macro.className = "macro-grid";

  const size = state.macroSize;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const macroCell = document.createElement("div");
      macroCell.className = "macro-cell";

      const microIndex = getMicroBoardIndex(r, c);

      // Microgrid container
      const micro = renderMicroGrid(state, microIndex);

      macroCell.appendChild(micro);
      macro.appendChild(macroCell);
    }
  }

  root.appendChild(macro);
}

/**
 * Render singola microgriglia 3x3
 */
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
