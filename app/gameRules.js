
// app/gameRules.js
// Regole minime per ora: celle vuote, rispetto micro obbligata e gestioni "micro piena".

export function isCellEmpty(state, microIndex, row, col) {
  return state.microBoards[microIndex][row][col] === null;
}

export function isMicroFull(board) {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

export function isMicroPlayable(state, microIndex) {
  const board = state.microBoards[microIndex];
  // In futuro potremo anche controllare se la micro è già vinta e segnata su macroBoard
  return !isMicroFull(board);
}

/**
 * Una mossa è valida se:
 * - la cella è vuota
 * - se esiste una micro obbligata ed è giocabile, devi giocare lì
 * - se la micro obbligata NON è giocabile, puoi giocare in una qualsiasi micro giocabile
 */
export function isValidMove(state, microIndex, row, col) {
  if (!isCellEmpty(state, microIndex, row, col)) return false;

  const forced = state.nextForcedCell;
  if (forced === null) {
    // scelta libera: basta che la micro sia giocabile
    return isMicroPlayable(state, microIndex);
  }

  if (forced === microIndex) {
    return true; // devi giocare qui
  }

  // Forced non coincide: se la forced NON è giocabile, scelta libera tra micro giocabili
  if (!isMicroPlayable(state, forced)) {
    return isMicroPlayable(state, microIndex);
  }

  // Altrimenti no
  return false;
}

/* Placeholders per prossimi step (vittorie) */
export function checkMicroWin(board) { return null; }
export function checkMacroWin(macroBoard) { return null; }
