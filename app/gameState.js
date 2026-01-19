
// app/gameState.js
export function initGameState() {
  return {
    macroSize: 3,
    microSize: 3,
    players: ["X", "O"],
    turn: 0, // 0: X, 1: O
    // macroBoard può contenere null / "X" / "O" per esito micro (in futuro)
    macroBoard: createEmptyMatrix(3),
    // 9 microgriglie 3x3
    microBoards: createNestedBoards(3, 3),
    // Microgriglia obbligata per la prossima mossa (null = libera)
    nextForcedCell: null
  };
}

function createEmptyMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function createNestedBoards(macro, micro) {
  const boards = [];
  for (let i = 0; i < macro * macro; i++) {
    boards.push(createEmptyMatrix(micro));
  }
  return boards;
}
