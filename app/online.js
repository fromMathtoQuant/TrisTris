// app/online.js
// Gestione partite online usando window.storage condiviso

/**
 * Genera un codice partita univoco
 */
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Crea una nuova partita online
 */
export async function createOnlineGame() {
  const gameCode = generateGameCode();
  
  const gameData = {
    code: gameCode,
    player1: Date.now().toString(), // ID player 1
    player2: null,
    state: null,
    currentMove: null,
    created: Date.now(),
    status: "waiting" // waiting | playing | finished
  };
  
  try {
    await window.storage.set(`game:${gameCode}`, JSON.stringify(gameData), true);
    return { success: true, gameCode, playerId: gameData.player1 };
  } catch (error) {
    console.error("Errore creazione partita:", error);
    return { success: false, error };
  }
}

/**
 * Unisciti a una partita esistente
 */
export async function joinOnlineGame(gameCode) {
  try {
    const result = await window.storage.get(`game:${gameCode}`, true);
    
    if (!result) {
      return { success: false, error: "Partita non trovata" };
    }
    
    const gameData = JSON.parse(result.value);
    
    if (gameData.player2) {
      return { success: false, error: "Partita già piena" };
    }
    
    const playerId = Date.now().toString();
    gameData.player2 = playerId;
    gameData.status = "playing";
    
    await window.storage.set(`game:${gameCode}`, JSON.stringify(gameData), true);
    
    return { success: true, gameCode, playerId };
  } catch (error) {
    console.error("Errore unione partita:", error);
    return { success: false, error: "Codice non valido o partita non esistente" };
  }
}

/**
 * Salva lo stato della partita
 */
export async function saveGameState(gameCode, state) {
  try {
    const result = await window.storage.get(`game:${gameCode}`, true);
    if (!result) return false;
    
    const gameData = JSON.parse(result.value);
    gameData.state = state;
    gameData.lastUpdate = Date.now();
    
    await window.storage.set(`game:${gameCode}`, JSON.stringify(gameData), true);
    return true;
  } catch (error) {
    console.error("Errore salvataggio stato:", error);
    return false;
  }
}

/**
 * Carica lo stato della partita
 */
export async function loadGameState(gameCode) {
  try {
    const result = await window.storage.get(`game:${gameCode}`, true);
    if (!result) return null;
    
    const gameData = JSON.parse(result.value);
    return gameData.state;
  } catch (error) {
    console.error("Errore caricamento stato:", error);
    return null;
  }
}

/**
 * Polling per aggiornamenti (controlla ogni secondo)
 */
export function startPolling(gameCode, playerId, onUpdate) {
  let lastUpdate = 0;
  
  const poll = async () => {
    try {
      const result = await window.storage.get(`game:${gameCode}`, true);
      if (!result) {
        console.error("Partita non trovata");
        return;
      }
      
      const gameData = JSON.parse(result.value);
      
      // Se c'è un aggiornamento e non è la nostra mossa
      if (gameData.lastUpdate && gameData.lastUpdate > lastUpdate) {
        lastUpdate = gameData.lastUpdate;
        onUpdate(gameData.state);
      }
      
      // Se la partita è finita, ferma il polling
      if (gameData.status === "finished") {
        clearInterval(intervalId);
      }
    } catch (error) {
      console.error("Errore polling:", error);
    }
  };
  
  const intervalId = setInterval(poll, 1000);
  return intervalId; // Restituisce l'ID per poterlo fermare
}

/**
 * Ferma il polling
 */
export function stopPolling(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
  }
}

/**
 * Segna la partita come finita
 */
export async function finishGame(gameCode, winner) {
  try {
    const result = await window.storage.get(`game:${gameCode}`, true);
    if (!result) return false;
    
    const gameData = JSON.parse(result.value);
    gameData.status = "finished";
    gameData.winner = winner;
    
    await window.storage.set(`game:${gameCode}`, JSON.stringify(gameData), true);
    return true;
  } catch (error) {
    console.error("Errore conclusione partita:", error);
    return false;
  }
}

/**
 * Verifica se è il turno del giocatore
 */
export async function isMyTurn(gameCode, playerId, currentTurn) {
  try {
    const result = await window.storage.get(`game:${gameCode}`, true);
    if (!result) return false;
    
    const gameData = JSON.parse(result.value);
    
    // Player 1 (creator) gioca X (turn 0)
    // Player 2 (joiner) gioca O (turn 1)
    const isPlayer1 = gameData.player1 === playerId;
    
    if (isPlayer1 && currentTurn === 0) return true;
    if (!isPlayer1 && currentTurn === 1) return true;
    
    return false;
  } catch (error) {
    console.error("Errore verifica turno:", error);
    return false;
  }
}
