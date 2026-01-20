// app/supabase.js
// Integrazione Supabase per modalità online

// IMPORTANTE: Inserisci qui le tue credenziali Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // es: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabase = null;

/**
 * Inizializza Supabase client
 */
export function initSupabase() {
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase library non caricata');
    return null;
  }
  
  if (!supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  
  return supabase;
}

/**
 * Crea le tabelle necessarie (da eseguire una volta)
 * 
 * SQL da eseguire in Supabase SQL Editor:
 * 
 * -- Tabella games
 * CREATE TABLE IF NOT EXISTS games (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   code VARCHAR(6) UNIQUE NOT NULL,
 *   player1_id TEXT NOT NULL,
 *   player2_id TEXT,
 *   status VARCHAR(20) DEFAULT 'waiting',
 *   current_state JSONB,
 *   winner VARCHAR(10),
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * -- Indice per code
 * CREATE INDEX idx_games_code ON games(code);
 * 
 * -- Abilita Realtime
 * ALTER PUBLICATION supabase_realtime ADD TABLE games;
 * 
 * -- Tabella moves (opzionale, per storico mosse)
 * CREATE TABLE IF NOT EXISTS moves (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   game_id UUID REFERENCES games(id) ON DELETE CASCADE,
 *   player_id TEXT NOT NULL,
 *   micro_index INTEGER NOT NULL,
 *   row INTEGER NOT NULL,
 *   col INTEGER NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 */

/**
 * Genera codice partita univoco
 */
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Crea nuova partita
 */
export async function createGame() {
  const client = initSupabase();
  if (!client) {
    return { success: false, error: 'Supabase non inizializzato' };
  }
  
  const code = generateGameCode();
  const playerId = crypto.randomUUID();
  
  const { data, error } = await client
    .from('games')
    .insert({
      code,
      player1_id: playerId,
      status: 'waiting',
      current_state: null
    })
    .select()
    .single();
  
  if (error) {
    console.error('Errore creazione partita:', error);
    return { success: false, error: error.message };
  }
  
  return {
    success: true,
    gameId: data.id,
    code: data.code,
    playerId
  };
}

/**
 * Unisciti a partita esistente
 */
export async function joinGame(code) {
  const client = initSupabase();
  if (!client) {
    return { success: false, error: 'Supabase non inizializzato' };
  }
  
  // Cerca partita con il codice
  const { data: game, error: findError } = await client
    .from('games')
    .select('*')
    .eq('code', code)
    .single();
  
  if (findError || !game) {
    return { success: false, error: 'Partita non trovata' };
  }
  
  if (game.player2_id) {
    return { success: false, error: 'Partita già piena' };
  }
  
  const playerId = crypto.randomUUID();
  
  // Aggiorna partita
  const { error: updateError } = await client
    .from('games')
    .update({
      player2_id: playerId,
      status: 'playing',
      updated_at: new Date().toISOString()
    })
    .eq('id', game.id);
  
  if (updateError) {
    return { success: false, error: updateError.message };
  }
  
  return {
    success: true,
    gameId: game.id,
    code: game.code,
    playerId,
    player1Id: game.player1_id
  };
}

/**
 * Salva stato partita
 */
export async function saveGameState(gameId, state) {
  const client = initSupabase();
  if (!client) return false;
  
  const { error } = await client
    .from('games')
    .update({
      current_state: state,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId);
  
  if (error) {
    console.error('Errore salvataggio stato:', error);
    return false;
  }
  
  return true;
}

/**
 * Carica stato partita
 */
export async function loadGameState(gameId) {
  const client = initSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('games')
    .select('current_state, player1_id')
    .eq('id', gameId)
    .single();
  
  if (error) {
    console.error('Errore caricamento stato:', error);
    return null;
  }
  
  return {
    state: data.current_state,
    player1Id: data.player1_id
  };
}

/**
 * Salva mossa
 */
export async function saveMove(gameId, playerId, micro, row, col) {
  const client = initSupabase();
  if (!client) return false;
  
  const { error } = await client
    .from('moves')
    .insert({
      game_id: gameId,
      player_id: playerId,
      micro_index: micro,
      row,
      col
    });
  
  if (error) {
    console.error('Errore salvataggio mossa:', error);
    return false;
  }
  
  return true;
}

/**
 * Sottoscrivi a cambiamenti partita con Realtime
 */
export function subscribeToGame(gameId, onUpdate) {
  const client = initSupabase();
  if (!client) return null;
  
  const channel = client
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      },
      (payload) => {
        console.log('Aggiornamento ricevuto:', payload);
        if (payload.new.current_state) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();
  
  return channel;
}

/**
 * Cancella sottoscrizione
 */
export async function unsubscribe(channel) {
  if (channel) {
    await channel.unsubscribe();
  }
}

/**
 * Segna partita come finita
 */
export async function finishGame(gameId, winner) {
  const client = initSupabase();
  if (!client) return false;
  
  const { error } = await client
    .from('games')
    .update({
      status: 'finished',
      winner,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId);
  
  if (error) {
    console.error('Errore conclusione partita:', error);
    return false;
  }
  
  return true;
}

/**
 * Controlla se partita è in attesa di giocatore
 */
export async function checkGameStatus(gameId) {
  const client = initSupabase();
  if (!client) return null;
  
  const { data, error } = await client
    .from('games')
    .select('status, player2_id')
    .eq('id', gameId)
    .single();
  
  if (error) return null;
  
  return data;
}
