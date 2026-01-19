// app/engine.js
import { isValidMove, isMicroPlayable, checkWin, checkGameEnd } from "./gameRules.js";
import { getMacroCellCoords } from "./boardModel.js";

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
  
  // --- 2) Controllo fine partita ---
  const gameEnd = checkGameEnd(state);
  if (gameEnd.finished) {
    return { moved: true, gameEnd };
  }
  
  // --- 3) Calcolo della micro obbligata ---
  const nextCandidate = row * state.microSize + col;
  // Se la micro candidata è giocabile → obbligata
  if (isMicroPlayable(state, nextCandidate)) {
    state.nextForcedCell = nextCandidate;
  } else {
    // Altrimenti → scelta libera
    state.nextForcedCell = null;
  }
  
  // --- 4) Cambio turno ---
  state.turn = 1 - state.turn;
  
  return { moved: true, gameEnd: null };
}
