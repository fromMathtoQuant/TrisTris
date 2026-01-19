
// app/gameRules.js
// Regole migliorate: gestione micro vinte + indirizzamento corretto + micro non giocabili.

/** Controlla se una cella è libera */
export function isCellEmpty(state, microIndex, row, col) {
  return state.microBoards[microIndex][row][col] === null;
}

/** Una micro è piena se tutte le celle sono occupate */
export function isMicroFull(board) {
  return board.every(row => row.every(cell => cell !== null));
}

/** Una micro è vinta se macroBoard[microIndex] contiene "X" o "O" */
export function isMicroWon(state, microIndex) {
  const size = state.macroSize;
  const row = Math.floor(microIndex / size);
  const col = microIndex % size;
  return state.macroBoard[row][col] !== null;
}

/** Una micro è giocabile se:
 *  - NON è vinta
 *  - NON è piena
 */
export function isMicroPlayable(state, microIndex) {
  const board = state.microBoards[microIndex];
  return !isMicroWon(state, microIndex) && !isMicroFull(board);
}

/**
 * Una mossa è valida se:
 * - la cella è vuota
 * - la micro scelta è giocabile
 * - se esiste una micro obbligata ed è giocabile, devi usare quella
 * - se la micro obbligata NON è giocabile, puoi scegliere una qualsiasi micro giocabile
 */
export function isValidMove(state, microIndex, row, col) {
  if (!isCellEmpty(state, microIndex, row, col)) return false;
  if (!isMicroPlayable(state, microIndex)) return false;

  const forced = state.nextForcedCell;

  if (forced === null) {
    return true; // nessun vincolo
  }

  // Se la forced è giocabile → devi giocare lì
  if (forced === microIndex && isMicroPlayable(state, forced)) {
    return true;
  }

  // Se la forced NON è giocabile → validi solo micro giocabili
  if (!isMicroPlayable(state, forced)) {
    return isMicroPlayable(state, microIndex);
  }

  return false;
}

/**
 * Controlla se una micro ha un tris vincente.
 * Restituisce "X", "O" o null.
 */
export function checkMicroWin(board) {
  const size = 3;
  const lines = [];

  // Righe e colonne
  for (let i = 0; i < size; i++) {
    lines.push(board[i]); // riga
    lines.push([board[0][i], board[1][i], board[2][i]]); // colonna
  }

  // Diagonali
  lines.push([board[0][0], board[1][1], board[2][2]]);
  lines.push([board[0][2], board[1][1], board[2][0]]);

  for (const line of lines) {
    if (line[0] && line[0] === line[1] && line[1] === line[2]) {
      return line[0];
    }
  }

  return null;
}

/** Placeholder macro */
export function checkMacroWin(macroBoard) {
  return null;
}
