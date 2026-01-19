
// app/engine.js
import { isValidMove, isMicroPlayable } from "./gameRules.js";

/**
 * Prova a giocare una mossa.
 * @returns {boolean} true se la mossa è stata eseguita, false altrimenti.
 */
export function playMove(state, microIndex, row, col) {
  if (!isValidMove(state, microIndex, row, col)) {
    return false;
  }

  const symbol = state.players[state.turn];
  const board = state.microBoards[microIndex];

  // Applica la mossa
  board[row][col] = symbol;

  // TODO: in futuro -> checkMicroWin(board) e aggiornare macroBoard

  // Calcola la prossima micro obbligata per l'avversario
  const nextCandidate = row * state.microSize + col;
  state.nextForcedCell = isMicroPlayable(state, nextCandidate) ? nextCandidate : null;

  // Alterna turno
  state.turn = 1 - state.turn;

  return true;
}
