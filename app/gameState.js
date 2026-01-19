// app/gameState.js
export function initGameState() {
  return {
    macroSize: 3,
    microSize: 3,
    players: ["X", "O"],
    turn: 0, // 0: X, 1: O
    // macroBoard può contenere null / "X" / "O" per esito micro
    macroBoard: createEmptyMatrix(3),
    // 9 microgriglie 3x3
    microBoards: createNestedBoards(3, 3),
    // Microgriglia obbligata per la prossima mossa (null = libera)
    nextForcedCell: null,
    ui: {
      viewingMicro: null,
      screen: "menu" // "menu" | "game"
    }
  };
}

export function resetGame(state) {
  state.turn = 0;
  state.macroBoard = createEmptyMatrix(3);
  state.microBoards = createNestedBoards(3, 3);
  state.nextForcedCell = null;
  state.ui.viewingMicro = null;
  state.ui.screen = "game";
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
