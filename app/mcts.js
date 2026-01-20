// app/mcts.js
// Monte Carlo Tree Search con budget di tempo per difficoltà difficile

import { isMicroPlayable, isCellEmpty, checkWin, checkGameEnd } from "./gameRules.js";
import { playMove } from "./engine.js";

class MCTSNode {
  constructor(state, parent = null, move = null) {
    this.state = JSON.parse(JSON.stringify(state));
    this.parent = parent;
    this.move = move;
    this.children = [];
    this.wins = 0;
    this.visits = 0;
    this.untriedMoves = this.getValidMoves();
  }

  getValidMoves() {
    const moves = [];
    const forced = this.state.nextForcedCell;
    
    if (forced !== null && isMicroPlayable(this.state, forced)) {
      const board = this.state.microBoards[forced];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (isCellEmpty(this.state, forced, r, c)) {
            moves.push({ micro: forced, row: r, col: c });
          }
        }
      }
      return moves;
    }
    
    for (let microIdx = 0; microIdx < 9; microIdx++) {
      if (!isMicroPlayable(this.state, microIdx)) continue;
      
      const board = this.state.microBoards[microIdx];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (isCellEmpty(this.state, microIdx, r, c)) {
            moves.push({ micro: microIdx, row: r, col: c });
          }
        }
      }
    }
    
    return moves;
  }

  isFullyExpanded() {
    return this.untriedMoves.length === 0;
  }

  isTerminal() {
    const result = checkGameEnd(this.state);
    return result.finished;
  }

  ucb1(explorationParam = Math.sqrt(2)) {
    if (this.visits === 0) return Infinity;
    
    const exploitation = this.wins / this.visits;
    const exploration = Math.sqrt(Math.log(this.parent.visits) / this.visits);
    
    return exploitation + explorationParam * exploration;
  }

  bestChild() {
    return this.children.reduce((best, child) => {
      return child.ucb1() > best.ucb1() ? child : best;
    });
  }

  expand() {
    const move = this.untriedMoves.pop();
    const newState = JSON.parse(JSON.stringify(this.state));
    
    playMove(newState, move.micro, move.row, move.col);
    
    const childNode = new MCTSNode(newState, this, move);
    this.children.push(childNode);
    
    return childNode;
  }
}

function simulate(state) {
  const simState = JSON.parse(JSON.stringify(state));
  
  let depth = 0;
  const maxDepth = 100;
  
  while (depth < maxDepth) {
    const result = checkGameEnd(simState);
    if (result.finished) {
      if (result.winner === 'O') return 1;
      if (result.winner === 'X') return 0;
      return 0.5;
    }
    
    const moves = getValidMoves(simState);
    if (moves.length === 0) return 0.5;
    
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    playMove(simState, randomMove.micro, randomMove.row, randomMove.col);
    
    depth++;
  }
  
  return 0.5;
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

function backpropagate(node, result) {
  let current = node;
  
  while (current !== null) {
    current.visits++;
    const isOMove = current.state.turn === 0;
    current.wins += isOMove ? result : (1 - result);
    current = current.parent;
  }
}

/**
 * MCTS con limite di tempo (6 secondi per hard)
 */
export async function getMCTSMove(state, maxTimeMs = 6000) {
  const rootNode = new MCTSNode(state);
  const startTime = Date.now();
  let iterations = 0;
  
  // Esegui MCTS fino al timeout
  while (Date.now() - startTime < maxTimeMs) {
    let node = rootNode;
    
    // Selection
    while (!node.isTerminal() && node.isFullyExpanded()) {
      node = node.bestChild();
    }
    
    // Expansion
    if (!node.isTerminal() && !node.isFullyExpanded()) {
      node = node.expand();
    }
    
    // Simulation
    const result = simulate(node.state);
    
    // Backpropagation
    backpropagate(node, result);
    
    iterations++;
    
    // Ogni 100 iterazioni controlla il tempo
    if (iterations % 100 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  console.log(`MCTS completato: ${iterations} iterazioni in ${Date.now() - startTime}ms`);
  
  // Scegli la mossa con più visite
  if (rootNode.children.length === 0) return null;
  
  const bestChild = rootNode.children.reduce((best, child) => {
    return child.visits > best.visits ? child : best;
  });
  
  return bestChild.move;
}
