// app/rl.js
// Agente RL con TensorFlow.js per difficoltà media

import { isMicroPlayable, isCellEmpty, checkWin, checkGameEnd } from "./gameRules.js";
import { playMove } from "./engine.js";

class RLAgent {
  constructor() {
    this.model = null;
    this.epsilon = 0.2; // 20% esplorazione
    this.initialized = false;
    this.training = false;
  }

  /**
   * Inizializza il modello neurale
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Carica modello salvato o crea nuovo
      try {
        this.model = await tf.loadLayersModel('indexeddb://tristris-rl-model');
        console.log("Modello RL caricato da storage");
      } catch (e) {
        // Crea nuovo modello
        this.model = tf.sequential({
          layers: [
            tf.layers.dense({ inputShape: [245], units: 256, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.3 }),
            tf.layers.dense({ units: 128, activation: 'relu' }),
            tf.layers.dropout({ rate: 0.2 }),
            tf.layers.dense({ units: 64, activation: 'relu' }),
            tf.layers.dense({ units: 1, activation: 'tanh' }) // Output: valore posizione [-1, 1]
          ]
        });
        
        this.model.compile({
          optimizer: tf.train.adam(0.0005),
          loss: 'meanSquaredError'
        });
        
        console.log("Nuovo modello RL creato - avvio training...");
        await this.trainModel(100); // Training iniziale
      }
      
      this.initialized = true;
    } catch (error) {
      console.error("Errore inizializzazione RL:", error);
    }
  }

  /**
   * Training del modello con self-play
   */
  async trainModel(episodes = 100) {
    if (this.training) return;
    this.training = true;
    
    console.log(`Inizio training di ${episodes} episodi...`);
    
    for (let ep = 0; ep < episodes; ep++) {
      await this.playTrainingGame();
      
      if ((ep + 1) % 10 === 0) {
        console.log(`Training: ${ep + 1}/${episodes} episodi completati`);
      }
    }
    
    // Salva modello
    try {
      await this.model.save('indexeddb://tristris-rl-model');
      console.log("Modello salvato");
    } catch (e) {
      console.error("Errore salvataggio modello:", e);
    }
    
    this.training = false;
  }

  /**
   * Gioca una partita di training (self-play)
   */
  async playTrainingGame() {
    const state = this.createInitialState();
    const experiences = [];
    
    while (true) {
      const result = checkGameEnd(state);
      if (result.finished) {
        // Calcola reward finale
        let reward;
        if (result.winner === 'draw') {
          reward = 0;
        } else {
          // Reward positivo per O (AI), negativo per X
          reward = result.winner === 'O' ? 1 : -1;
        }
        
        // Backpropagate reward
        await this.updateModel(experiences, reward);
        break;
      }
      
      // Seleziona mossa
      const moves = this.getAllMoves(state);
      if (moves.length === 0) break;
      
      let move;
      if (Math.random() < this.epsilon || !this.initialized) {
        // Esplorazione
        move = moves[Math.floor(Math.random() * moves.length)];
      } else {
        // Sfruttamento - usa modello
        move = await this.selectBestMove(state, moves);
      }
      
      // Salva esperienza
      const stateEncoding = this.encodeState(state);
      experiences.push({ state: stateEncoding, move });
      
      // Esegui mossa
      playMove(state, move.micro, move.row, move.col);
    }
  }

  /**
   * Aggiorna il modello con le esperienze
   */
  async updateModel(experiences, finalReward) {
    if (experiences.length === 0) return;
    
    const states = [];
    const targets = [];
    
    // Reward decrescente dal finale all'inizio
    const gamma = 0.95; // Discount factor
    
    for (let i = experiences.length - 1; i >= 0; i--) {
      const exp = experiences[i];
      const reward = finalReward * Math.pow(gamma, experiences.length - 1 - i);
      
      // Alterna il segno per turni alternati
      const adjustedReward = (experiences.length - i) % 2 === 0 ? reward : -reward;
      
      states.push(exp.state);
      targets.push(adjustedReward);
    }
    
    const xs = tf.tensor2d(states);
    const ys = tf.tensor2d(targets, [targets.length, 1]);
    
    await this.model.fit(xs, ys, {
      epochs: 1,
      verbose: 0
    });
    
    xs.dispose();
    ys.dispose();
  }

  /**
   * Seleziona la mossa migliore usando il modello
   */
  async selectBestMove(state, moves) {
    let bestMove = moves[0];
    let bestValue = -Infinity;
    
    for (const move of moves) {
      // Simula la mossa
      const testState = JSON.parse(JSON.stringify(state));
      playMove(testState, move.micro, move.row, move.col);
      
      // Valuta con il modello
      const encoding = this.encodeState(testState);
      const prediction = this.model.predict(tf.tensor2d([encoding]));
      const value = (await prediction.data())[0];
      prediction.dispose();
      
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  /**
   * Codifica lo stato in vettore
   */
  encodeState(state) {
    const encoded = [];
    
    // Codifica microboards (81 celle * 3 stati = 243 features)
    for (let microIdx = 0; microIdx < 9; microIdx++) {
      const board = state.microBoards[microIdx];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = board[r][c];
          // One-hot encoding: [vuoto, X, O]
          if (cell === null) {
            encoded.push(1, 0, 0);
          } else if (cell === 'X') {
            encoded.push(0, 1, 0);
          } else {
            encoded.push(0, 0, 1);
          }
        }
      }
    }
    
    // Macroboard (9 celle)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = state.macroBoard[r][c];
        if (cell === 'X') encoded.push(-1);
        else if (cell === 'O') encoded.push(1);
        else encoded.push(0);
      }
    }
    
    // Turno e forced cell
    encoded.push(state.turn === 0 ? -1 : 1);
    encoded.push(state.nextForcedCell === null ? -1 : state.nextForcedCell / 8);
    
    return encoded;
  }

  /**
   * Crea stato iniziale per training
   */
  createInitialState() {
    return {
      macroSize: 3,
      microSize: 3,
      players: ["X", "O"],
      turn: 0,
      macroBoard: Array.from({ length: 3 }, () => Array(3).fill(null)),
      microBoards: Array.from({ length: 9 }, () => 
        Array.from({ length: 3 }, () => Array(3).fill(null))
      ),
      nextForcedCell: null
    };
  }

  /**
   * Seleziona mossa per il gioco
   */
  async selectMove(state) {
    if (!this.initialized) {
      await this.init();
    }
    
    const moves = this.getAllMoves(state);
    if (moves.length === 0) return null;
    
    // Usa sempre il modello (con piccola esplorazione)
    if (Math.random() < 0.1) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    
    return await this.selectBestMove(state, moves);
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
