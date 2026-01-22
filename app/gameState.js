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
    // Timer properties
    timedMode: false, // true se modalità con tempo, false se classic
    timerX: 300, // 5 minuti in secondi
    timerO: 300,
    timerInterval: null,
    lastMoveTime: null,
    // Online properties (Supabase)
    onlineGameId: null,
    onlineGameCode: null,
    onlinePlayerId: null,
    onlinePlayer1Id: null,
    onlineWaiting: false,
    onlineChannel: null,
    // Auth & ELO
    user: null, // { id, nickname, elo_rating, wins, losses, draws }
    leaderboard: [], // Array di utenti
    ui: {
      viewingMicro: null,
      screen: "menu", // "menu" | "difficulty" | "online" | "game" | "nickname" | "leaderboard" | "pvp-mode" | "online-mode"
      aiThinking: false
    }
  };
}

export function resetGame(state, mode = "pvp", difficulty = null, timed = false) {
  state.turn = 0;
  state.macroBoard = createEmptyMatrix(3);
  state.microBoards = createNestedBoards(3, 3);
  state.nextForcedCell = null;
  state.gameMode = mode;
  state.aiDifficulty = difficulty;
  state.timedMode = timed;
  state.ui.viewingMicro = null;
  state.ui.screen = "game";
  state.ui.aiThinking = false;
  
  // Reset timers solo se modalità con tempo
  if (timed) {
    state.timerX = 300;
    state.timerO = 300;
    state.lastMoveTime = Date.now();
  }
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
