// app/mcts.js
// Monte Carlo Tree Search per difficoltà difficile

import { isMicroPlayable, isCellEmpty, checkWin, checkGameEnd } from "./gameRules.js";
import { playMove } from "./engine.js";

class MCTSNode {
  constructor(state, parent = null, move = null) {
    this.state = JSON.parse(JSON.stringify(state)); // Deep copy
    this.parent = parent;
    this.move = move; // { micro, row, col }
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
    
    // Applica la mossa
    playMove(newState, move.micro, move.row, move.col);
    
    const childNode = new MCTSNode(newState, this, move);
    this.children.push(childNode);
    
    return childNode;
  }
}

/**
 * Simula una partita casuale fino alla fine
 */
function simulate(state) {
  const simState = JSON.parse(JSON.stringify(state));
  
  let depth = 0;
  const maxDepth = 100; // Previeni loop infiniti
  
  while (depth < maxDepth) {
    const result = checkGameEnd(simState);
    if (result.finished) {
      // Restituisci 1 se O vince, 0 se X vince, 0.5 per pareggio
      if (result.winner === 'O') return 1;
      if (result.winner === 'X') return 0;
      return 0.5;
    }
    
    // Mossa casuale
    const moves = getValidMoves(simState);
    if (moves.length === 0) return 0.5; // Pareggio
    
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    playMove(simState, randomMove.micro, randomMove.row, randomMove.col);
    
    depth++;
  }
  
  return 0.5; // Timeout -> pareggio
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

/**
 * Backpropagation
 */
function backpropagate(node, result) {
  let current = node;
  
  while (current !== null) {
    current.visits++;
    // Se il nodo rappresenta una mossa di O, aggiungi il risultato
    // Altrimenti sottrai (perché X vuole minimizzare)
    const isOMove = current.state.turn === 0; // Dopo la mossa, il turno cambia
    current.wins += isOMove ? result : (1 - result);
    current = current.parent;
  }
}

/**
 * MCTS principale
 */
export async function getMCTSMove(state, iterations = 500) {
  const rootNode = new MCTSNode(state);
  
  for (let i = 0; i < iterations; i++) {
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
  }
  
  // Scegli la mossa con più visite (più robusta)
  if (rootNode.children.length === 0) return null;
  
  const bestChild = rootNode.children.reduce((best, child) => {
    return child.visits > best.visits ? child : best;
  });
  
  return bestChild.move;
}
