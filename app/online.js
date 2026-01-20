// app/online.js
// Gestione partite online usando window.storage condiviso

/**
 * Verifica se window.storage è disponibile
 */
function isStorageAvailable() {
  return typeof window !== 'undefined' && 
         window.storage && 
         typeof window.storage.get === 'function';
}

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
  if (!isStorageAvailable()) {
    console.error("Storage non disponibile");
    return { success: false, error: "Storage non disponibile" };
  }

  const gameCode = generateGameCode();
  
  const gameData = {
    code: gameCode,
    player1: Date.now().toString(),
    player2: null,
    state: null,
    currentMove: null,
    created: Date.now(),
    status: "waiting"
  };
  
  try {
    const result = await window.storage.set(`game:${gameCode}`, JSON.stringify(gameData), true);
    if (!result) {
      throw new Error("Set storage failed");
    }
    return { success: true, gameCode, playerId: gameData.player1 };
  } catch (error) {
    console.error("Errore creazione partita:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}

/**
 * Unisciti a una partita esistente
 */
export async function joinOnlineGame(gameCode) {
  if (!isStorageAvailable()) {
    return { success: false, error: "Storage non disponibile" };
  }

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
  if (!isStorageAvailable()) return false;

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
  if (!isStorageAvailable()) return null;

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
 * Polling per aggiornamenti
 */
export function startPolling(gameCode, playerId, onUpdate) {
  if (!isStorageAvailable()) {
    console.error("Storage non disponibile per polling");
    return null;
  }

  let lastUpdate = 0;
  
  const poll = async () => {
    try {
      const result = await window.storage.get(`game:${gameCode}`, true);
      if (!result) return;
      
      const gameData = JSON.parse(result.value);
      
      if (gameData.lastUpdate && gameData.lastUpdate > lastUpdate) {
        lastUpdate = gameData.lastUpdate;
        onUpdate(gameData.state);
      }
      
      if (gameData.status === "finished") {
        clearInterval(intervalId);
      }
    } catch (error) {
      console.error("Errore polling:", error);
    }
  };
  
  const intervalId = setInterval(poll, 1000);
  return intervalId;
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
  if (!isStorageAvailable()) return false;

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
