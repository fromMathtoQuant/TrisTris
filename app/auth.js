// app/auth.js
// Sistema di autenticazione e ELO rating con Supabase

import { initSupabase } from "./supabase.js";

/**
 * SQL per creare tabella users (eseguire una sola volta in Supabase):
 * 
 * CREATE TABLE IF NOT EXISTS users (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   nickname VARCHAR(20) UNIQUE NOT NULL,
 *   elo_rating INTEGER DEFAULT 1000,
 *   wins INTEGER DEFAULT 0,
 *   losses INTEGER DEFAULT 0,
 *   draws INTEGER DEFAULT 0,
 *   games_played INTEGER DEFAULT 0,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   last_played TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_users_nickname ON users(nickname);
 * CREATE INDEX idx_users_elo ON users(elo_rating DESC);
 * 
 * -- Enable RLS
 * ALTER TABLE users ENABLE ROW LEVEL SECURITY;
 * 
 * -- Policy: tutti possono leggere
 * CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
 * 
 * -- Policy: tutti possono inserire
 * CREATE POLICY "Enable insert for all users" ON users FOR INSERT WITH CHECK (true);
 * 
 * -- Policy: tutti possono aggiornare
 * CREATE POLICY "Enable update for all users" ON users FOR UPDATE USING (true);
 * 
 * -- Aggiorna tabella games per includere nickname
 * ALTER TABLE games ADD COLUMN player1_nickname TEXT;
 * ALTER TABLE games ADD COLUMN player2_nickname TEXT;
 */

/**
 * Controlla se nickname è disponibile
 */
export async function checkNicknameAvailability(nickname) {
  const client = initSupabase();
  if (!client) return { available: false, error: 'Supabase non inizializzato' };
  
  const { data, error } = await client
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Nickname non trovato = disponibile
    return { available: true };
  }
  
  if (error) {
    return { available: false, error: error.message };
  }
  
  // Nickname trovato = non disponibile
  return { available: false, exists: true };
}

/**
 * Crea nuovo utente
 */
export async function createUser(nickname) {
  const client = initSupabase();
  if (!client) return { success: false, error: 'Supabase non inizializzato' };
  
  // Valida nickname
  if (!nickname || nickname.length < 3 || nickname.length > 20) {
    return { 
      success: false, 
      error: 'Il nickname deve essere tra 3 e 20 caratteri' 
    };
  }
  
  // Controlla disponibilità
  const availability = await checkNicknameAvailability(nickname);
  if (!availability.available) {
    return { 
      success: false, 
      error: availability.exists ? 'Nickname già in uso' : availability.error 
    };
  }
  
  // Crea utente
  const { data, error } = await client
    .from('users')
    .insert({
      nickname,
      elo_rating: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      games_played: 0
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, user: data };
}

/**
 * Login utente (carica dati esistenti)
 */
export async function loginUser(nickname) {
  const client = initSupabase();
  if (!client) return { success: false, error: 'Supabase non inizializzato' };
  
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('nickname', nickname)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Utente non trovato, crealo
      return await createUser(nickname);
    }
    return { success: false, error: error.message };
  }
  
  // Aggiorna last_played
  await client
    .from('users')
    .update({ last_played: new Date().toISOString() })
    .eq('id', data.id);
  
  return { success: true, user: data };
}

/**
 * Calcola nuovo ELO rating dopo una partita
 * K-factor: 32 per nuovi giocatori (<30 partite), 16 per esperti
 */
function calculateELO(playerElo, opponentElo, result) {
  const K = 32; // K-factor
  
  // Expected score
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  
  // Actual score: 1 = win, 0.5 = draw, 0 = loss
  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  
  // New rating
  const newRating = Math.round(playerElo + K * (actualScore - expectedScore));
  
  return newRating;
}

/**
 * Aggiorna statistiche dopo una partita
 */
export async function updateUserStats(userId, result, opponentElo = 1000) {
  const client = initSupabase();
  if (!client) return false;
  
  // Carica dati utente
  const { data: user, error: fetchError } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (fetchError) {
    console.error('Errore caricamento utente:', fetchError);
    return false;
  }
  
  // Calcola nuovo ELO
  const newElo = calculateELO(user.elo_rating, opponentElo, result);
  
  // Aggiorna stats
  const updates = {
    elo_rating: newElo,
    games_played: user.games_played + 1,
    last_played: new Date().toISOString()
  };
  
  if (result === 'win') updates.wins = user.wins + 1;
  else if (result === 'loss') updates.losses = user.losses + 1;
  else if (result === 'draw') updates.draws = user.draws + 1;
  
  const { error: updateError } = await client
    .from('users')
    .update(updates)
    .eq('id', userId);
  
  if (updateError) {
    console.error('Errore aggiornamento stats:', updateError);
    return false;
  }
  
  return true;
}

/**
 * Ottieni classifica (top 100)
 */
export async function getLeaderboard(limit = 100) {
  const client = initSupabase();
  if (!client) return { success: false, error: 'Supabase non inizializzato' };
  
  const { data, error } = await client
    .from('users')
    .select('*')
    .order('elo_rating', { ascending: false })
    .limit(limit);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, leaderboard: data };
}

/**
 * Ottieni posizione in classifica
 */
export async function getUserRank(userId) {
  const client = initSupabase();
  if (!client) return null;
  
  // Query per contare quanti utenti hanno ELO maggiore
  const { data: user } = await client
    .from('users')
    .select('elo_rating')
    .eq('id', userId)
    .single();
  
  if (!user) return null;
  
  const { count } = await client
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('elo_rating', user.elo_rating);
  
  return count + 1;
}

/**
 * Salva sessione locale
 */
export function saveSession(user) {
  try {
    localStorage.setItem('tristris_user', JSON.stringify(user));
  } catch (e) {
    console.warn('Impossibile salvare sessione:', e);
  }
}

/**
 * Carica sessione locale
 */
export function loadSession() {
  try {
    const data = localStorage.getItem('tristris_user');
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('Impossibile caricare sessione:', e);
    return null;
  }
}

/**
 * Logout
 */
export function logout() {
  try {
    localStorage.removeItem('tristris_user');
  } catch (e) {
    console.warn('Impossibile rimuovere sessione:', e);
  }
}
