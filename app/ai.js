// app/ai.js
import { isMicroPlayable, isCellEmpty } from "./gameRules.js";

/**
 * AI Bot - trova la mossa migliore in base alla difficoltà
 */
export function getAIMove(state) {
  const difficulty = state.aiDifficulty;
  
  switch (difficulty) {
    case "easy":
      return getRandomMove(state);
    case "medium":
      // Per ora usa mosse casuali - implementeremo RL/MCTS dopo
      return getRandomMove(state);
    case "hard":
      // Per ora usa mosse casuali - implementeremo RL/MCTS dopo
      return getRandomMove(state);
    default:
      return getRandomMove(state);
  }
}

/**
 * Mossa casuale - per difficoltà facile
 */
function getRandomMove(state) {
  const availableMoves = getAllAvailableMoves(state);
  
  if (availableMoves.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * availableMoves.length);
  return availableMoves[randomIndex];
}

/**
 * Ottiene tutte le mosse disponibili
 */
function getAllAvailableMoves(state) {
  const moves = [];
  const forced = state.nextForcedCell;
  
  // Se c'è una micro obbligata
  if (forced !== null && isMicroPlayable(state, forced)) {
    const board = state.microBoards[forced];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (isCellEmpty(state, forced, r, c)) {
          moves.push({ micro: forced, row: r, col: c });
        }
      }
    }
    return moves;
  }
  
  // Altrimenti tutte le micro giocabili
  for (let microIndex = 0; microIndex < 9; microIndex++) {
    if (!isMicroPlayable(state, microIndex)) continue;
    
    const board = state.microBoards[microIndex];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (isCellEmpty(state, microIndex, r, c)) {
          moves.push({ micro: microIndex, row: r, col: c });
        }
      }
    }
  }
  
  return moves;
}

/**
 * Placeholder per RL Bot (da implementare)
 */
export function getRLMove(state) {
  // TODO: Implementare Reinforcement Learning
  console.log("RL Bot non ancora implementato");
  return getRandomMove(state);
}

/**
 * Placeholder per MCTS Bot (da implementare)
 */
export function getMCTSMove(state) {
  // TODO: Implementare Monte Carlo Tree Search
  console.log("MCTS Bot non ancora implementato");
  return getRandomMove(state);
}
