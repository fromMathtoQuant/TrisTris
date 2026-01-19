// app/rl.js
// Agente RL con TensorFlow.js per difficoltà media

import { isMicroPlayable, isCellEmpty, checkWin } from "./gameRules.js";

class RLAgent {
  constructor() {
    this.model = null;
    this.epsilon = 0.3; // 30% esplorazione, 70% sfruttamento
    this.initialized = false;
  }

  /**
   * Inizializza il modello neurale
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Modello semplice: state -> Q-values
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [243], units: 128, activation: 'relu' }), // 243 = 3^5 possibili stati per cella
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 81, activation: 'linear' }) // 81 possibili mosse (9 micro x 9 celle)
        ]
      });
      
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });
      
      this.initialized = true;
      console.log("RL Agent inizializzato");
    } catch (error) {
      console.error("Errore inizializzazione RL:", error);
    }
  }

  /**
   * Codifica lo stato della partita in un vettore
   */
  encodeState(state) {
    const encoded = [];
    
    // Codifica ogni microboard
    for (let microIdx = 0; microIdx < 9; microIdx++) {
      const board = state.microBoards[microIdx];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = board[r][c];
          // -1 per X, 0 per vuoto, 1 per O
          if (cell === 'X') encoded.push(-1);
          else if (cell === 'O') encoded.push(1);
          else encoded.push(0);
        }
      }
    }
    
    // Aggiungi info macro board
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = state.macroBoard[r][c];
        if (cell === 'X') encoded.push(-1);
        else if (cell === 'O') encoded.push(1);
        else encoded.push(0);
      }
    }
    
    // Aggiungi turno corrente
    encoded.push(state.turn === 0 ? -1 : 1);
    
    // Aggiungi forced cell (normalizzato)
    encoded.push(state.nextForcedCell === null ? 0 : (state.nextForcedCell / 8));
    
    return encoded;
  }

  /**
   * Valuta una mossa usando euristica
   */
  evaluateMove(state, micro, row, col) {
    let score = 0;
    
    // Preferisci mosse che completano tris in micro
    const board = state.microBoards[micro];
    const tempBoard = board.map(r => [...r]);
    tempBoard[row][col] = 'O';
    
    if (checkWin(tempBoard) === 'O') {
      score += 100; // Vittoria micro
    }
    
    // Blocca vittoria avversario
    const tempBoardX = board.map(r => [...r]);
    tempBoardX[row][col] = 'X';
    if (checkWin(tempBoardX) === 'X') {
      score += 50; // Blocco vittoria
    }
    
    // Preferisci centro
    if (row === 1 && col === 1) score += 10;
    
    // Preferisci angoli
    if ((row === 0 || row === 2) && (col === 0 || col === 2)) score += 5;
    
    // Penalizza mosse che mandano avversario in micro favorevole
    const nextMicro = row * 3 + col;
    if (isMicroPlayable(state, nextMicro)) {
      // Controlla se quella micro è quasi vinta da X
      const nextBoard = state.microBoards[nextMicro];
      let xCount = 0;
      nextBoard.forEach(r => r.forEach(c => { if (c === 'X') xCount++; }));
      if (xCount >= 2) score -= 30;
    }
    
    return score;
  }

  /**
   * Seleziona la mossa migliore
   */
  async selectMove(state) {
    if (!this.initialized) {
      await this.init();
    }
    
    const availableMoves = this.getAllMoves(state);
    if (availableMoves.length === 0) return null;
    
    // Epsilon-greedy: esplorazione vs sfruttamento
    if (Math.random() < this.epsilon) {
      // Esplorazione: mossa casuale
      return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
    
    // Sfruttamento: usa euristica (per ora, poi useremo il modello)
    let bestMove = null;
    let bestScore = -Infinity;
    
    for (const move of availableMoves) {
      const score = this.evaluateMove(state, move.micro, move.row, move.col);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  /**
   * Ottiene tutte le mosse valide
   */
  getAllMoves(state) {
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
}

// Istanza globale
const rlAgent = new RLAgent();

/**
 * Ottieni mossa da agente RL
 */
export async function getRLMove(state) {
  return await rlAgent.selectMove(state);
}
