// app/rl.js
// Agente RL - Solo inferenza, nessun training nella PWA

import { isMicroPlayable, isCellEmpty } from "./gameRules.js";

class RLAgent {
  constructor() {
    this.model = null;
    this.initialized = false;
  }

  /**
   * Carica il modello pre-allenato
   */
  async init() {
    if (this.initialized) return;
    
    try {
      // Prova a caricare modello da IndexedDB
      this.model = await tf.loadLayersModel('indexeddb://tristris-rl-model');
      // console.log("✅ Modello RL caricato da storage");
      alert("✅ Modello RL caricato da storage");
      this.initialized = true;
    } catch (e) {
      // console.warn("⚠️  Modello RL non trovato - usando fallback euristico");
      alert("⚠️  Modello RL non trovato - usando fallback euristico");
      console.warn("Allena il modello con il training tool separato");
      this.initialized = false;
    }
  }

  /**
   * Seleziona mossa migliore
   */
  async selectMove(state) {
    const moves = this.getAllMoves(state);
    if (moves.length === 0) return null;
    
    // Se modello non disponibile, usa euristica
    if (!this.initialized || !this.model) {
      return this.selectHeuristicMove(state, moves);
    }
    
    // Usa modello neurale
    return await this.selectBestMove(state, moves);
  }

  /**
   * Seleziona mossa usando il modello neurale
   */
  async selectBestMove(state, moves) {
    let bestMove = moves[0];
    let bestValue = -Infinity;
    
    for (const move of moves) {
      const testState = JSON.parse(JSON.stringify(state));
      testState.microBoards[move.micro][move.row][move.col] = 'O';
      testState.turn = 0;
      
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
   * Fallback euristico se modello non disponibile
   */
  selectHeuristicMove(state, moves) {
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    for (const move of moves) {
      const score = this.evaluateMove(state, move);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    return bestMove;
  }

  /**
   * Valuta mossa con euristica
   */
  evaluateMove(state, move) {
    let score = 0;
    const board = state.microBoards[move.micro];
    
    // Centro micro
    if (move.row === 1 && move.col === 1) score += 10;
    
    // Angoli
    if ((move.row === 0 || move.row === 2) && (move.col === 0 || move.col === 2)) {
      score += 5;
    }
    
    // Preferisci completare linee
    const tempBoard = board.map(r => [...r]);
    tempBoard[move.row][move.col] = 'O';
    
    // Controlla se vince micro
    if (this.checkWinSimple(tempBoard, 'O')) score += 100;
    
    // Controlla se blocca avversario
    const tempBoardX = board.map(r => [...r]);
    tempBoardX[move.row][move.col] = 'X';
    if (this.checkWinSimple(tempBoardX, 'X')) score += 50;
    
    return score;
  }

  /**
   * Check vittoria semplice
   */
  checkWinSimple(board, player) {
    // Righe
    for (let r = 0; r < 3; r++) {
      if (board[r][0] === player && board[r][1] === player && board[r][2] === player) {
        return true;
      }
    }
    
    // Colonne
    for (let c = 0; c < 3; c++) {
      if (board[0][c] === player && board[1][c] === player && board[2][c] === player) {
        return true;
      }
    }
    
    // Diagonali
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true;
    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true;
    
    return false;
  }

  /**
   * Codifica stato
   */
  encodeState(state) {
    const encoded = [];
    
    // Microboards (243 features)
    for (let microIdx = 0; microIdx < 9; microIdx++) {
      const board = state.microBoards[microIdx];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cell = board[r][c];
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
    
    // Macroboard (9 features)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = state.macroBoard[r][c];
        if (cell === 'X') encoded.push(-1);
        else if (cell === 'O') encoded.push(1);
        else encoded.push(0);
      }
    }
    
    // Turno e forced (2 features)
    encoded.push(state.turn === 0 ? -1 : 1);
    encoded.push(state.nextForcedCell === null ? -1 : state.nextForcedCell / 8);
    
    return encoded; // Totale: 254 features
  }

  /**
   * Ottiene mosse valide
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
  if (!rlAgent.initialized) {
    await rlAgent.init();
  }
  return await rlAgent.selectMove(state);
}
