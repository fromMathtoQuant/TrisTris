export function initGameState() {
  return {
    macroSize: 3,
    microSize: 3,
    players: ["X", "O"],
    turn: 0,
    macroBoard: createEmptyMatrix(3),
    microBoards: createNestedBoards(3, 3),
    nextForcedCell: null // regola del gioco: la microgriglia obbligata
  };
}

function createEmptyMatrix(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function createNestedBoards(macro, micro) {
  const boards = [];
  for (let i = 0; i < macro * macro; i++) {
    const singleBoard = createEmptyMatrix(micro);
    boards.push(singleBoard);
  }
  return boards;
}
