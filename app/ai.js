// app/ai.js
import { getMinimaxMove } from "./minimax.js";
import { getRLMove } from "./rl.js";
import { getMCTSMove } from "./mcts.js";

/**
 * AI Bot - trova la mossa migliore in base alla difficoltà
 */
export async function getAIMove(state) {
  const difficulty = state.aiDifficulty;
  
  switch (difficulty) {
    case "easy":
      return getMinimaxMove(state, 3); // Minimax profondità 3
    case "medium":
      return await getRLMove(state);
    case "hard":
      return await getMCTSMove(state, 1000);
    default:
      return getMinimaxMove(state, 3);
  }
}
