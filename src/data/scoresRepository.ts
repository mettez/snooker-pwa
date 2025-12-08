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
  const { data, error } = await supabase.from('frames').insert([
    {
      match_id: input.matchId,
      frame_no: input.frameNo,
      nik_score: input.nikScore,
      roel_score: input.roelScore,
      breaker_id: input.breakerId ?? null,
      season: input.season ?? new Date().getFullYear(),
    } as FrameInsert,
  ]).select().single();
  if (error) throw error;
  return data ? mapFrame(data) : null;
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

export async function updateFrame(input: {
  frameId: string;
  nikScore: number;
  roelScore: number;
  breakerId?: 'nik' | 'roel';
}) {
  type FrameUpdate = Database['public']['Tables']['frames']['Update'];
  const winner =
    input.nikScore === input.roelScore
      ? null
      : input.nikScore > input.roelScore
        ? 'nik'
        : 'roel';
  const { error } = await supabase
    .from('frames')
    .update({
      nik_score: input.nikScore,
      roel_score: input.roelScore,
      breaker_id: input.breakerId ?? null,
      winner_id: winner,
    } as FrameUpdate)
    .eq('id', input.frameId);
  if (error) throw error;
}

export async function updateBreak(input: {
  breakId: string;
  points: number;
}) {
  type BreakUpdate = Database['public']['Tables']['breaks']['Update'];
  const { error } = await supabase
    .from('breaks')
    .update({ points: input.points } as BreakUpdate)
    .eq('id', input.breakId);
  if (error) throw error;
}

export async function getOrCreateActiveFrame(matchId: string, season?: number) {
  const { data: frames, error } = await supabase
    .from('frames')
    .select('*')
    .eq('match_id', matchId)
    .order('frame_no', { ascending: true });
  if (error) throw error;
  const mapped = (frames ?? []).map(mapFrame);
  const active = mapped.find(f => !f.WinnerPlayerID);
  if (active) return active;
  const nextNo = mapped.length ? Math.max(...mapped.map(f => f.FrameNo)) + 1 : 1;
  try {
    const created = await createFrame({
      matchId,
      frameNo: nextNo,
      nikScore: 0,
      roelScore: 0,
      breakerId: undefined,
      season,
    });
    if (created) return created;
  } catch (err: any) {
    const dup = err?.code === '23505' || (typeof err?.message === 'string' && err.message.includes('duplicate key'));
    if (!dup) throw err;
    // duplicate: refetch that frame
    const { data: refetch, error: refetchErr } = await supabase
      .from('frames')
      .select('*')
      .eq('match_id', matchId)
      .eq('frame_no', nextNo)
      .maybeSingle();
    if (refetchErr) throw refetchErr;
    if (refetch) return mapFrame(refetch);
  }
  throw new Error('Kon actieve frame niet bepalen');
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
