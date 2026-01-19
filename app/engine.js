  // app/engine.js
  import { isValidMove, isMicroPlayable } from "./gameRules.js";
  import { getMacroCellCoords } from "./boardModel.js";
  import { checkWin } from "./gameRules.js";
  
  export function playMove(state, microIndex, row, col) {
    if (!isValidMove(state, microIndex, row, col)) {
      return false;
    }

  const symbol = state.players[state.turn];
  const board = state.microBoards[microIndex];

  // Piazza la X / O
  board[row][col] = symbol;

  // --- 1) Controllo vittoria micro ---
  const winner = checkWin(board);
  if (winner) {
    const { row: macroR, col: macroC } = getMacroCellCoords(microIndex);
    state.macroBoard[macroR][macroC] = winner;
  }

  // --- 2) Calcolo della micro obbligata ---
  const nextCandidate = row * state.microSize + col;

  // Se la micro candidata è giocabile → obbligata
  if (isMicroPlayable(state, nextCandidate)) {
    state.nextForcedCell = nextCandidate;
  } else {
    // Altrimenti → scelta libera
    state.nextForcedCell = null;
  }

  // --- 3) Cambio turno ---
  state.turn = 1 - state.turn;

  return true;
}
