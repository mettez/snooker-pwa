import { useEffect, useMemo, useState } from 'react';
import {
  createMatch as createMatchRecord,
  getBreaksBySeason,
  getFramesBySeason,
  getFramesForMatch,
  getMatchesBySeason,
  getSeasons,
} from './data/scoresRepository';
import MatchDetail from './MatchDetail';


type Stats = {
  nik: { matches: number; frames: number; hiBreak: number; breaks10: number };
  roel:{ matches: number; frames: number; hiBreak: number; breaks10: number };
};

type Match = {
  MatchID: string;
  Date: string;
  Season: number;
  BestOf: number;
  FirstBreakerPlayerID?: 'nik'|'roel'|'';
  WinnerPlayerID?: 'nik'|'roel'|'';
  Notes?: string | null;
  NikFrames?: number;
  RoelFrames?: number;
  NikScore?: number;
  RoelScore?: number;
};

const KPI_FIELDS: Array<{ key: keyof Stats['nik']; label: string; helper?: string }> = [
  { key: 'matches', label: 'Wedstrijden' },
  { key: 'frames', label: 'Frames' },
  { key: 'hiBreak', label: 'Hoogste Break' },
  { key: 'breaks10', label: 'Aantal 10+ Breaks' },
];

function generateDefaultSeasons(current: number) {
  return Array.from({ length: 7 }).map((_, idx) => current + 1 - idx);
}

type FrameLite = {
  MatchID: string;
  NikScore: number;
  RoelScore: number;
  WinnerPlayerID?: 'nik'|'roel'|'';
};
type BreakLite = {
  PlayerID: 'nik'|'roel';
  Points: number;
};

function computeSeasonStats(matches: Match[], frames: FrameLite[], breaks: BreakLite[]): Stats {
  const stats: Stats = {
    nik: { matches: 0, frames: 0, hiBreak: 0, breaks10: 0 },
    roel:{ matches: 0, frames: 0, hiBreak: 0, breaks10: 0 },
  };

  const framesByMatch = frames.reduce<Record<string, { nik: number; roel: number }>>((acc, f) => {
    acc[f.MatchID] ||= { nik: 0, roel: 0 };
    const winner: 'nik' | 'roel' | null =
      f.WinnerPlayerID === 'nik' || f.WinnerPlayerID === 'roel'
        ? f.WinnerPlayerID
        : f.NikScore === f.RoelScore
          ? null
          : f.NikScore > f.RoelScore ? 'nik' : 'roel';
    if (winner) acc[f.MatchID][winner] += 1;
    return acc;
  }, {});

  for (const m of matches) {
    const declared = m.WinnerPlayerID;
    if (declared === 'nik' || declared === 'roel') {
      stats[declared].matches += 1;
      continue;
    }
    const totals = framesByMatch[m.MatchID];
    if (!totals) continue;
    if (totals.nik > totals.roel) stats.nik.matches += 1;
    if (totals.roel > totals.nik) stats.roel.matches += 1;
  }

  for (const f of frames) {
    const winner: 'nik' | 'roel' | null =
      f.WinnerPlayerID === 'nik' || f.WinnerPlayerID === 'roel'
        ? f.WinnerPlayerID
        : f.NikScore === f.RoelScore
          ? null
          : f.NikScore > f.RoelScore ? 'nik' : 'roel';
    if (winner) stats[winner].frames += 1;
  }

  for (const b of breaks) {
    const p = b.PlayerID;
    if (p !== 'nik' && p !== 'roel') continue;
    if (b.Points >= 10) stats[p].breaks10 += 1;
    if (b.Points > stats[p].hiBreak) stats[p].hiBreak = b.Points;
  }
  return stats;
}

export default function App(){
  const currentYear = new Date().getFullYear();
  const [seasons, setSeasons] = useState<number[]>(generateDefaultSeasons(currentYear));
  const [season, setSeason] = useState<number>(currentYear);
  const [stats, setStats]   = useState<Stats|null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<string, { nik: number; roel: number } | null>>({});
  const [showStats, setShowStats] = useState(false);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [showRecentMatches, setShowRecentMatches] = useState(false);

  // formulier voor nieuwe match
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [bestOf, setBestOf] = useState(3);
  const [starter, setStarter] = useState<'nik'|'roel'>('nik');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(()=>{
    const current = new Date().getFullYear();
    getSeasons()
      .then(list => {
        if (list.length) {
          setSeasons(list);
          setSeason(list.includes(current) ? current : list[0]);
        } else {
          setSeasons(generateDefaultSeasons(current));
          setSeason(current);
        }
      })
      .catch((err: any)=>{
        console.warn('Seizoenen ophalen mislukt, fallback naar standaardlijst', err);
        setSeasons(generateDefaultSeasons(current));
        setSeason(current);
      });
  },[]);

  useEffect(()=>{
    let alive = true;
    setLoading(true);
    setMatchScores({});
    Promise.all([
      getMatchesBySeason(season),
      getFramesBySeason(season),
      getBreaksBySeason(season),
    ])
      .then(([matchesData, framesData, breaksData])=>{
        if (!alive) return;
        setMatches(matchesData as Match[]);
        setStats(computeSeasonStats(matchesData as Match[], framesData as FrameLite[], breaksData as BreakLite[]));
      })
      .catch(e=> setMsg('Fout: ' + e.message))
      .finally(()=> setLoading(false));
    return ()=> { alive = false; };
  },[season]);

  useEffect(() => {
    if (!matches.length) return;
    const lastWithBreaker = matches.reduce<Match | null>((latest, match) => {
      if (!match.FirstBreakerPlayerID || (match.FirstBreakerPlayerID !== 'nik' && match.FirstBreakerPlayerID !== 'roel')) {
        return latest;
      }
      if (!latest) return match;
      const latestDate = new Date(latest.Date).getTime();
      const currentDate = new Date(match.Date).getTime();
      return currentDate > latestDate ? match : latest;
    }, null);
    if (!lastWithBreaker?.FirstBreakerPlayerID) return;
    setStarter(lastWithBreaker.FirstBreakerPlayerID === 'nik' ? 'roel' : 'nik');
  }, [matches]);

  async function createMatch(e: React.FormEvent){
    e.preventDefault();
    setMsg(null);
    try{
      // Neem het jaar uit het ingevulde datumveld om het seizoen af te leiden
      const parsedYear = Number((date ?? '').slice(0, 4));
      const seasonFromDate = Number.isFinite(parsedYear) ? parsedYear : Number(new Date(date).getFullYear());
      const seasonForMatch = Number.isNaN(seasonFromDate) ? season : seasonFromDate;
      const created = await createMatchRecord({
        date,
        bestOf,
        season: seasonForMatch,
        firstBreakerPlayerID: starter,
      });
      const newMatchId: string | undefined = created?.MatchID;
      setMsg('Match aangemaakt ✔︎');
      // refresh lijst
      const refreshed = await getMatchesBySeason(seasonForMatch);
      setMatches(refreshed as Match[]);
      const refreshedSeasons = await getSeasons();
      if (refreshedSeasons.length) setSeasons(refreshedSeasons);
      setSeason(seasonForMatch);
      if (newMatchId) {
        setSelected(newMatchId);
      } else if (refreshed.length > 0) {
        setSelected(refreshed[0].MatchID);
      }
    }catch(err:any){
      setMsg('Fout: ' + err.message);
    }
  }

  const visibleMatches = useMemo(
    () => matches.slice(0, showAllMatches ? matches.length : 3),
    [matches, showAllMatches]
  );

  const matchesNeedingScores = useMemo(
    () => visibleMatches.filter(m => !Object.prototype.hasOwnProperty.call(matchScores, m.MatchID)),
    [visibleMatches, matchScores]
  );
  const statsWithDerivedMatches = useMemo(() => {
    if (!stats) return null;
    let nikBonus = 0;
    let roelBonus = 0;
    for (const match of matches) {
      if (match.BestOf === 3 && !match.WinnerPlayerID) {
        const nikFrames = typeof match.NikFrames === 'number'
          ? match.NikFrames
          : (typeof match.NikScore === 'number' ? match.NikScore : null);
        const roelFrames = typeof match.RoelFrames === 'number'
          ? match.RoelFrames
          : (typeof match.RoelScore === 'number' ? match.RoelScore : null);
        if (typeof nikFrames === 'number' && typeof roelFrames === 'number') {
          const totalFrames = nikFrames + roelFrames;
          if (totalFrames === 3) {
            if (nikFrames > roelFrames) nikBonus += 1;
            if (roelFrames > nikFrames) roelBonus += 1;
          }
        }
      }
    }
    if (nikBonus === 0 && roelBonus === 0) return stats;
    return {
      nik: { ...stats.nik, matches: stats.nik.matches + nikBonus },
      roel: { ...stats.roel, matches: stats.roel.matches + roelBonus },
    };
  }, [stats, matches]);
  const statsForDisplay = statsWithDerivedMatches ?? stats;
  useEffect(() => {
    let alive = true;
    if (matchesNeedingScores.length === 0) return;
    (async () => {
      try {
        const entries: Array<[string, { nik: number; roel: number } | null]> = await Promise.all(
          matchesNeedingScores.map(async m => {
            try {
              const frames = await getFramesForMatch(m.MatchID);
              const totals = frames.reduce(
                (acc, frame) => {
                  const winner: 'nik' | 'roel' | null =
                    frame.WinnerPlayerID === 'nik' || frame.WinnerPlayerID === 'roel'
                      ? frame.WinnerPlayerID
                      : frame.NikScore === frame.RoelScore
                        ? null
                        : frame.NikScore > frame.RoelScore ? 'nik' : 'roel';
                  if (winner) acc[winner] += 1;
                  return acc;
                },
                { nik: 0, roel: 0 }
              );
              return [m.MatchID, totals];
            } catch (err) {
              console.warn('Kon matchscore niet ophalen voor', m.MatchID, err);
              return [m.MatchID, null] as [string, { nik: number; roel: number } | null];
            }
          })
        );
        if (!alive) return;
        setMatchScores(prev => {
          const next = { ...prev };
          for (const [id, totals] of entries) {
            if (next[id] === undefined) next[id] = totals;
          }
          return next;
        });
      } catch (error) {
        console.error('Kon match score niet laden', error);
      }
    })();
    return () => { alive = false; };
  }, [matchesNeedingScores]);
  if (selected) {
    return (
      <div className="app-shell">
        <div className="container space-y-6">
          <header className="hero">
            <div>
              <h1 className="h1">SnookerScore</h1>
              <div className="muted">Seizoen {season}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={()=> setSelected(null)}>Terug</button>
          </header>
          <MatchDetail matchId={selected} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="container">
        <header className="hero">
          <div>
            <h1 className="h1">SnookerScore</h1>
          </div>
          <div className="space-y-2">
            <span className="label">Seizoen</span>
            <select
              className="input w-32"
              value={season}
              onChange={e => setSeason(Number(e.target.value))}
            >
              {seasons.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loading && <div className="item">Laden…</div>}
        {msg && <div className="item">{msg}</div>}

        <div className="layout-grid">
          <div className="stack">
            {statsForDisplay && (
              <section className="section">
                <div className="accordion">
                  <button
                    type="button"
                    className="accordion-header"
                    aria-expanded={showStats}
                    onClick={()=> setShowStats(prev => !prev)}
                  >
                    <h2 className="h2">Head-to-head</h2>
                    <span className={`accordion-icon ${showStats ? 'accordion-icon-open' : ''}`} aria-hidden="true">⌃</span>
                  </button>
                  {showStats && (
                    <div className="p-4 border-t border-white/5">
                      <div className="kpi-grid">
                        {KPI_FIELDS.map(metric => (
                          <div key={metric.key} className="kpi-card">
                            <div className="kpi-card-title">{metric.label}</div>
                            <div className="kpi-card-values">
                              <span className={`pill pill-nik ${statsForDisplay.nik[metric.key] >= statsForDisplay.roel[metric.key] ? 'pill-highlight-nik' : ''}`}>
                                Nik
                                <span>{statsForDisplay.nik[metric.key]}</span>
                              </span>
                              <span className={`pill pill-roel ${statsForDisplay.roel[metric.key] >= statsForDisplay.nik[metric.key] ? 'pill-highlight-roel' : ''}`}>
                                Roel
                                <span>{statsForDisplay.roel[metric.key]}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="section">
              <div className="accordion">
                <button
                  type="button"
                  className="accordion-header"
                  aria-expanded={showNewMatch}
                  onClick={()=> setShowNewMatch(prev => !prev)}
                >
                  <h2 className="h2">Nieuwe match</h2>
                  <span className={`accordion-icon ${showNewMatch ? 'accordion-icon-open' : ''}`} aria-hidden="true">⌃</span>
                </button>
                {showNewMatch && (
                  <div className="p-4 border-t border-white/5 space-y-4">
                    <div>
                      <div className="label">Datum</div>
                      <input type="date" className="input" value={date} onChange={e=> setDate(e.target.value)} />
                    </div>
                    <div>
                      <div className="label">Best of</div>
                      <select className="input" value={bestOf} onChange={e=> setBestOf(Number(e.target.value))}>
                        <option value={3}>3</option>
                        <option value={5}>5</option>
                        <option value={7}>7</option>
                      </select>
                    </div>
                    <div>
                      <div className="label">Break-off</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`btn ${starter==='nik'?'btn-primary':'btn-ghost'}`}
                          onClick={()=> setStarter('nik')}
                        >
                          Nik
                        </button>
                        <button
                          type="button"
                          className={`btn ${starter==='roel'?'btn-primary':'btn-ghost'}`}
                          onClick={()=> setStarter('roel')}
                        >
                          Roel
                        </button>
                      </div>
                    </div>
                    <button className="btn btn-primary" onClick={createMatch as any}>Aanmaken</button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="section">
              <div className="accordion">
                <button
                  type="button"
                  className="accordion-header"
                  aria-expanded={showRecentMatches}
                  onClick={()=> setShowRecentMatches(prev => !prev)}
                >
                  <div>
                    <h2 className="h2">Overzicht van alle matchen</h2>
                    {matches.length > 0 && (
                      <p className="muted mt-1 text-xs">Laatste {visibleMatches.length} van {matches.length}</p>
                    )}
                  </div>
                  <span className={`accordion-icon ${showRecentMatches ? 'accordion-icon-open' : ''}`} aria-hidden="true">⌃</span>
                </button>
                {showRecentMatches && (
                  <div className="p-4 border-t border-white/5 space-y-4">
                    {visibleMatches.map(m=>{
                      const scoreEntry = matchScores[m.MatchID];
                      const score = scoreEntry && typeof scoreEntry === 'object' ? scoreEntry : undefined;
                      const loadError = scoreEntry === null;
                      const nikFrames = score?.nik ?? (typeof m.NikFrames === 'number'
                        ? m.NikFrames
                        : (typeof m.NikScore === 'number' ? m.NikScore : null));
                      const roelFrames = score?.roel ?? (typeof m.RoelFrames === 'number'
                        ? m.RoelFrames
                        : (typeof m.RoelScore === 'number' ? m.RoelScore : null));
                      const hasBoth = typeof nikFrames === 'number' && typeof roelFrames === 'number';
                      const nikLeading = hasBoth && (nikFrames as number) > (roelFrames as number);
                      const roelLeading = hasBoth && (roelFrames as number) > (nikFrames as number);
                      const displayDate = new Date(m.Date).toLocaleDateString('nl-BE');
                      const tone = nikLeading ? 'match-card-nik' : roelLeading ? 'match-card-roel' : '';
                      const isSelected = selected === m.MatchID;
                      const nikStarted = m.FirstBreakerPlayerID === 'nik';
                      const roelStarted = m.FirstBreakerPlayerID === 'roel';
                      return (
                        <div key={m.MatchID} className={['match-card', tone, isSelected ? 'match-card-active' : ''].filter(Boolean).join(' ')}>
                          <div className="match-card-header">
                            <div>
                              <div className="match-card-date">{displayDate}</div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={()=> setSelected(m.MatchID)}>
                              {isSelected ? 'Geopend' : 'Bekijk'}
                            </button>
                          </div>
                          <div className="match-card-scores">
                            <div className={`match-score-line ${nikLeading ? 'match-score-line-winner-nik' : ''}`}>
                              <span className="flex items-center gap-2 text-xs font-semibold uppercase text-sky-300">
                                Nik
                                {nikStarted && <span className="pill-indicator" aria-hidden="true"></span>}
                              </span>
                              <span className={`match-score-value match-score-value-nik`}>
                                {typeof nikFrames === 'number' ? nikFrames : '—'}
                              </span>
                            </div>
                            <div className={`match-score-line ${roelLeading ? 'match-score-line-winner-roel' : ''}`}>
                              <span className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-200">
                                Roel
                                {roelStarted && <span className="pill-indicator" aria-hidden="true"></span>}
                              </span>
                              <span className={`match-score-value match-score-value-roel`}>
                                {typeof roelFrames === 'number' ? roelFrames : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="match-card-flags">
                            {loadError && <span className="chip chip-warn">Score niet beschikbaar</span>}
                            {!loadError && !hasBoth && <span className="chip chip-neutral">Nog bezig</span>}
                          </div>
                          {m.Notes && (
                            <div className="match-card-footer">
                              <span className="muted text-xs">{m.Notes}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {matches.length === 0 && <div className="recent-empty">Nog geen matchen.</div>}
                    {matches.length > 3 && (
                      <button
                        className="btn btn-ghost w-full"
                        onClick={()=> setShowAllMatches(prev => !prev)}
                      >
                        {showAllMatches ? 'Verberg oudere matchen' : `Toon oudere matchen (${matches.length - 3})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
