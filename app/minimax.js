// app/minimax.js
// Minimax con Alpha-Beta Pruning e limite di tempo

import { isMicroPlayable, isCellEmpty, checkWin, checkGameEnd } from "./gameRules.js";
import { playMove } from "./engine.js";

const MAX_DEPTH = 3;
let startTime = 0;
let timeLimit = 1000;

function evaluateBoard(state) {
  const gameEnd = checkGameEnd(state);
  
  if (gameEnd.finished) {
    if (gameEnd.winner === 'O') return 1000;
    if (gameEnd.winner === 'X') return -1000;
    return 0;
  }
  
  let score = 0;
  
  // Macroboard
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cell = state.macroBoard[r][c];
      if (cell === 'O') score += 100;
      else if (cell === 'X') score -= 100;
    }
  }
  
  // Microboards
  for (let micro = 0; micro < 9; micro++) {
    const board = state.microBoards[micro];
    
    // Centro micro
    if (board[1][1] === 'O') score += 3;
    else if (board[1][1] === 'X') score -= 3;
    
    // Angoli micro
    const corners = [[0,0], [0,2], [2,0], [2,2]];
    for (const [r, c] of corners) {
      if (board[r][c] === 'O') score += 2;
      else if (board[r][c] === 'X') score -= 2;
    }
    
    // Conta celle
    let oCount = 0, xCount = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[r][c] === 'O') oCount++;
        else if (board[r][c] === 'X') xCount++;
      }
    }
    
    score += oCount - xCount;
  }
  
  return score;
}

function getValidMoves(state) {
  const moves = [];
  const forced = state.nextForcedCell;
  
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
  
  for (let microIdx = 0; microIdx < 9; microIdx++) {
    if (!isMicroPlayable(state, microIdx)) continue;
    
    const board = state.microBoards[microIdx];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (isCellEmpty(state, microIdx, r, c)) {
          moves.push({ micro: microIdx, row: r, col: c });
        }
      }
    }
  }
  
  return moves;
}

function minimax(state, depth, alpha, beta, isMaximizing) {
  // Timeout check
  if (Date.now() - startTime > timeLimit) {
    return evaluateBoard(state);
  }
  
  const gameEnd = checkGameEnd(state);
  
  if (depth === 0 || gameEnd.finished) {
    return evaluateBoard(state);
  }
  
  const moves = getValidMoves(state);
  
  if (moves.length === 0) {
    return evaluateBoard(state);
  }
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    
    for (const move of moves) {
      const newState = JSON.parse(JSON.stringify(state));
      playMove(newState, move.micro, move.row, move.col);
      
      const eval_ = minimax(newState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      
      if (beta <= alpha) break;
    }
    
    return maxEval;
  } else {
    let minEval = Infinity;
    
    for (const move of moves) {
      const newState = JSON.parse(JSON.stringify(state));
      playMove(newState, move.micro, move.row, move.col);
      
      const eval_ = minimax(newState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      
      if (beta <= alpha) break;
    }
    
    return minEval;
  }
}

export function getMinimaxMove(state, depth = MAX_DEPTH, maxTimeMs = 1000) {
  startTime = Date.now();
  timeLimit = maxTimeMs;
  
  const moves = getValidMoves(state);
  
  if (moves.length === 0) {
    return null;
  }
  
  let bestMove = moves[0];
  let bestValue = -Infinity;
  let alpha = -Infinity;
  let beta = Infinity;
  
  for (const move of moves) {
    const newState = JSON.parse(JSON.stringify(state));
    playMove(newState, move.micro, move.row, move.col);
    
    const moveValue = minimax(newState, depth - 1, alpha, beta, false);
    
    if (moveValue > bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
    
    alpha = Math.max(alpha, bestValue);
    
    // Timeout check
    if (Date.now() - startTime > timeLimit) {
      console.log(`Minimax timeout dopo ${Date.now() - startTime}ms`);
      break;
    }
  }
  
  console.log(`Minimax completato in ${Date.now() - startTime}ms`);
  return bestMove;
}
