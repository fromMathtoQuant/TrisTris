import { isValidMove } from "./gameRules.js";

export function playMove(state, macroIndex, row, col) {
  if (!isValidMove(state, macroIndex, row, col)) return state;

  const board = state.microBoards[macroIndex];
  board[row][col] = state.players[state.turn];

  // placeholder: rule to determine forced next move
  state.nextForcedCell = row * state.microSize + col;

  // alterna giocatore
  state.turn = 1 - state.turn;

  return state;
}
