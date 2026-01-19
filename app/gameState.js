// app/gameState.js
export function initGameState() {
  return {
    macroSize: 3,
    microSize: 3,
    players: ["X", "O"],
    turn: 0, // 0: X, 1: O
    macroBoard: createEmptyMatrix(3),
    microBoards: createNestedBoards(3, 3),
    nextForcedCell: null,
    gameMode: null, // "pvp" | "ai" | "online"
    aiDifficulty: null, // "easy" | "medium" | "hard"
    // Online properties
    onlineGameCode: null,
    onlinePlayerId: null,
    onlinePlayer1Id: null,
    onlineWaiting: false,
    onlinePollingId: null,
    ui: {
      viewingMicro: null,
      screen: "menu" // "menu" | "difficulty" | "online" | "game"
    }
  };
}

export function resetGame(state, mode = "pvp", difficulty = null) {
  state.turn = 0;
  state.macroBoard = createEmptyMatrix(3);
  state.microBoards = createNestedBoards(3, 3);
  state.nextForcedCell = null;
  state.gameMode = mode;
  state.aiDifficulty = difficulty;
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
