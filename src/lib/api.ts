const BASE = import.meta.env.VITE_API_URL as string;
const KEY  = import.meta.env.VITE_API_KEY as string;

function toParams(obj: Record<string, any>) {
  const p = new URLSearchParams();
  for (const [k,v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    p.set(k, String(v));
  }
  return p.toString();
}

async function call<T=any>(action: string, params: Record<string, any> = {}) {
  const qs = toParams({ action, secret: KEY, ...params });
  const res = await fetch(`${BASE}?${qs}`, { method: 'GET' });
  const text = await res.text();           // altijd eerst tekst lezen
  let json: any;
  try { json = JSON.parse(text); }
  catch {
    throw new Error(`API parse error: ${text.slice(0,120)}`);
  }
  if (!json.ok) throw new Error(json.error || 'API error');
  return json as T;
}

export const API = {
  listSeasons: () => call('listSeasons'),
  seasonStats: (season: number) => call('listSeasonStats', { season }),
  listMatches: (season: number) => call('listMatches', { season }),
  addMatch: (p: { date: string; bestOf: number; firstBreakerPlayerID?: 'nik'|'roel'; notes?: string }) => call('addMatch', p),
    getMatch: (matchId: string) =>
    call('getMatch', { matchId }),

  addFrame: (p: {
    matchId: string;
    frameNo: number;
    NikScore: number;
    RoelScore: number;
    BreakerPlayerID?: 'nik'|'roel';
  }) => call('addFrame', p),

  addBreak: (p: {
    matchId: string;
    frameId?: string;
    frameNo?: number;
    playerId: 'nik'|'roel';
    points: number;
  }) => call('addBreak', p),
} as any;
