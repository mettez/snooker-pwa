import { supabase } from '../lib/supabaseClient';
import type { Break, Database, Frame, Match, Player } from '../types/database';

type LegacyMatch = {
  MatchID: string;
  Date: string;
  Season: number;
  BestOf: number;
  FirstBreakerPlayerID?: 'nik' | 'roel' | '';
  WinnerPlayerID?: 'nik' | 'roel' | '';
  Notes?: string | null;
  NikFrames?: number;
  RoelFrames?: number;
  NikScore?: number;
  RoelScore?: number;
};

const mapMatch = (m: Match): LegacyMatch => ({
  MatchID: m.id,
  Date: m.date,
  Season: m.season,
  BestOf: m.best_of,
  FirstBreakerPlayerID: (m.first_breaker_id as any) ?? '',
  WinnerPlayerID: (m.winner_id as any) ?? '',
  Notes: m.notes,
});

const mapFrame = (f: Frame) => ({
  FrameID: f.id,
  MatchID: f.match_id,
  FrameNo: f.frame_no,
  NikScore: f.nik_score,
  RoelScore: f.roel_score,
  WinnerPlayerID: (f.winner_id as any) ?? '',
  BreakerPlayerID: (f.breaker_id as any) ?? '',
  Season: f.season,
});

const mapBreak = (b: Break) => ({
  BreakID: b.id,
  MatchID: b.match_id,
  FrameID: b.frame_id ?? undefined,
  PlayerID: b.player_id as 'nik' | 'roel',
  Points: b.points,
  Season: b.season,
});

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase.from('players').select('*').order('id');
  if (error) throw error;
  return data ?? [];
}

export async function getMatchesBySeason(season: number): Promise<LegacyMatch[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('season', season)
    .order('date', { ascending: false });
  if (error) throw error;
  const mapped = (data ?? []).map(mapMatch);
  return mapped.filter(m => Number(m.Season) === Number(season));
}

export async function getFramesForMatch(matchId: string) {
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('match_id', matchId)
    .order('frame_no');
  if (error) throw error;
  return (data ?? []).map(mapFrame);
}

export async function getBreaksForFrame(frameId: string) {
  const { data, error } = await supabase
    .from('breaks')
    .select('*')
    .eq('frame_id', frameId)
    .order('points', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapBreak);
}

export async function getMatchDetail(matchId: string) {
  const [matchRes, framesRes, breaksRes] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('frames').select('*').eq('match_id', matchId).order('frame_no'),
    supabase.from('breaks').select('*').eq('match_id', matchId).order('points', { ascending: false }),
  ]);
  if (matchRes.error) throw matchRes.error;
  if (framesRes.error) throw framesRes.error;
  if (breaksRes.error) throw breaksRes.error;
  return {
    match: mapMatch(matchRes.data),
    frames: (framesRes.data ?? []).map(mapFrame),
    breaks: (breaksRes.data ?? []).map(mapBreak),
  };
}

// schrijven (optioneel, later inschakelen)
export async function createMatch(input: {
  date: string;
  season: number;
  bestOf: number;
  firstBreakerPlayerID?: 'nik' | 'roel';
  notes?: string | null;
}) {
  type MatchInsert = Database['public']['Tables']['matches']['Insert'];
  const { data, error } = await supabase
    .from('matches')
    .insert([
      {
        date: input.date,
        season: input.season,
        best_of: input.bestOf,
        first_breaker_id: input.firstBreakerPlayerID ?? null,
        notes: input.notes ?? null,
      } as MatchInsert,
    ])
    .select()
    .single();
  if (error) throw error;
  return mapMatch(data);
}

export async function createFrame(input: {
  matchId: string;
  frameNo: number;
  nikScore: number;
  roelScore: number;
  breakerId?: 'nik' | 'roel';
  season?: number;
}) {
  type FrameInsert = Database['public']['Tables']['frames']['Insert'];
  const { error } = await supabase.from('frames').insert([
    {
      match_id: input.matchId,
      frame_no: input.frameNo,
      nik_score: input.nikScore,
      roel_score: input.roelScore,
      breaker_id: input.breakerId ?? null,
      season: input.season ?? new Date().getFullYear(),
    } as FrameInsert,
  ]);
  if (error) throw error;
}

export async function createBreak(input: {
  matchId: string;
  frameId?: string;
  playerId: 'nik' | 'roel';
  points: number;
  season?: number;
}) {
  type BreakInsert = Database['public']['Tables']['breaks']['Insert'];
  const { error } = await supabase.from('breaks').insert([
    {
      match_id: input.matchId,
      frame_id: input.frameId ?? null,
      player_id: input.playerId,
      points: input.points,
      season: input.season ?? new Date().getFullYear(),
    } as BreakInsert,
  ]);
  if (error) throw error;
}
export async function getSeasons(): Promise<number[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('season')
    .order('season', { ascending: false });
  if (error) throw error;
  const unique = new Set<number>();
  (data ?? []).forEach(row => {
    const numeric = typeof row.season === 'number'
      ? row.season
      : typeof row.season === 'string'
        ? Number(row.season)
        : NaN;
    if (!Number.isNaN(numeric)) unique.add(numeric);
  });
  return Array.from(unique).sort((a, b) => b - a);
}

export async function getFramesBySeason(season: number) {
  const { data, error } = await supabase
    .from('frames')
    .select('*')
    .eq('season', season);
  if (error) throw error;
  return (data ?? []).map(mapFrame);
}

export async function getBreaksBySeason(season: number) {
  const { data, error } = await supabase
    .from('breaks')
    .select('*')
    .eq('season', season);
  if (error) throw error;
  return (data ?? []).map(mapBreak);
}
