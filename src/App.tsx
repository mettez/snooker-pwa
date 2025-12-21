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
  const [showStats, setShowStats] = useState(true);
  const [showNewMatch, setShowNewMatch] = useState(false);
  const [showRecentMatches, setShowRecentMatches] = useState(true);

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
          <header className="detail-bar">
            <button
              type="button"
              className="text-white text-lg font-semibold hover:text-[var(--primary)]"
              onClick={()=> setSelected(null)}
              aria-label="Terug"
            >
              ←
            </button>
            <div className="detail-bar-title">Wedstrijd Details</div>
            <button
              type="button"
              className="detail-bar-action"
              onClick={()=> setSelected(null)}
            >
              Gereed
            </button>
          </header>
          <MatchDetail matchId={selected} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="container">
        <header className="topbar">
          <div className="brand">
            <div className="logo-mark" aria-label="SnookerScore logo" />
            <span className="logo-text">SnookerScore</span>
          </div>
          <label className="sr-only" htmlFor="season-select">Seizoen</label>
          <select
            id="season-select"
            className="season-select"
            value={season}
            onChange={e => setSeason(Number(e.target.value))}
          >
            {seasons.map(y => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </header>

        <header className="hero">
          <div className="hero-cta-minimal">
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowNewMatch(true);
                const target = document.getElementById('new-match');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Start nieuwe match
            </button>
          </div>
        </header>

        {showNewMatch && (
          <section className="section" id="new-match">
            <div className="section-heading">
              <h3 className="h2">Nieuwe match</h3>
              <button className="btn btn-ghost btn-sm" onClick={()=> setShowNewMatch(false)}>Sluiten</button>
            </div>
            <div className="item new-match-card">
              <div className="new-match-left">
                <div className="space-y-2">
                  <div className="label">Datum</div>
                  <input
                    id="match-date"
                    type="date"
                    className="input"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="label">Break-off</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`break-choice ${starter==='nik'?'break-choice-active':''}`}
                      onClick={()=> setStarter('nik')}
                    >
                      <span className={`break-avatar ${starter==='nik' ? '' : 'break-avatar-muted'}`}>
                        <img src="/Nik.png" alt="Nik" />
                      </span>
                      <span>Nik</span>
                    </button>
                    <button
                      type="button"
                      className={`break-choice ${starter==='roel'?'break-choice-active':''}`}
                      onClick={()=> setStarter('roel')}
                    >
                      <span className={`break-avatar ${starter==='roel' ? '' : 'break-avatar-muted'}`}>
                        <img src="/Roel.png" alt="Roel" />
                      </span>
                      <span>Roel</span>
                    </button>
                  </div>
                </div>
                <div className="new-match-cta">
                  <button className="btn btn-primary" onClick={createMatch as any}>Aanmaken</button>
                </div>
              </div>
              <div className="new-match-right">
                <div className="label text-right md:text-left">Best of</div>
                <select
                  id="bestof-select"
                  className="input"
                  value={bestOf}
                  onChange={e => setBestOf(Number(e.target.value))}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={7}>7</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {loading && <div className="item">Laden…</div>}
        {msg && <div className="item">{msg}</div>}

        <div className="layout-grid">
          <div className="stack">
            {statsForDisplay && (
              <section className="section">
                <div className="section-heading">
                  <h3 className="h2">Head To Head</h3>
                </div>
                {showStats && (
                  <div className="stats-grid">
                    {[
                      { key: 'matches' as const, label: 'Wins', icon: '🏆', unit: 'matches' },
                      { key: 'frames' as const, label: 'Frames', icon: '🔲', unit: 'won' },
                      { key: 'breaks10' as const, label: '10+ Breaks', icon: '🔥', unit: 'times' },
                      { key: 'hiBreak' as const, label: 'High Break', icon: '✶', unit: 'points' },
                    ].map(metric => (
                      <div key={metric.key} className="stat-card">
                        <div className="stat-head">
                          <span className="stat-icon" aria-hidden="true">{metric.icon}</span>
                          {metric.label}
                        </div>
                        <div className="stat-body">
                          <div className="stat-player">
                            <div className="stat-player-name">Nik</div>
                            <div className="stat-value">{statsForDisplay.nik[metric.key]}</div>
                            <div className="stat-sub">{metric.unit}</div>
                          </div>
                          <div className="stat-sep">-</div>
                          <div className="stat-player">
                            <div className="stat-player-name">Roel</div>
                            <div className="stat-value">{statsForDisplay.roel[metric.key]}</div>
                            <div className="stat-sub">{metric.unit}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

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
                      const winner: 'nik' | 'roel' | null = nikLeading ? 'nik' : roelLeading ? 'roel' : (m.WinnerPlayerID === 'nik' || m.WinnerPlayerID === 'roel') ? m.WinnerPlayerID : null;
                      const displayDate = new Date(m.Date).toLocaleDateString('nl-BE');
                      const tone = nikLeading ? 'match-card-nik' : roelLeading ? 'match-card-roel' : '';
                      const isSelected = selected === m.MatchID;
                      const nikStarted = m.FirstBreakerPlayerID === 'nik';
                      const roelStarted = m.FirstBreakerPlayerID === 'roel';
                      const starterLabel = (pid: 'nik' | 'roel') => {
                        const isStarter = pid === 'nik' ? nikStarted : roelStarted;
                        if (!isStarter) return null;
                        return <span className="match-starter-name" aria-hidden="true"></span>;
                      };
                      return (
                        <button
                          type="button"
                          key={m.MatchID}
                          className={['match-card w-full text-left', tone, isSelected ? 'match-card-active' : ''].filter(Boolean).join(' ')}
                          onClick={()=> setSelected(m.MatchID)}
                        >
                          <div className="match-card-top">
                            <span className="match-chip">Best of {m.BestOf}</span>
                          </div>
                          <div className="match-card-body">
                            <div className="match-face-row">
                              <div className="match-player">
                                <div className={['match-avatar', winner === 'nik' ? '' : 'match-avatar-loser'].join(' ')}>
                                  {nikStarted && <span className="match-starter-dot" aria-hidden="true"></span>}
                                  <img src="/Nik.png" alt="Nik" />
                                </div>
                                <div className="match-player-name">Nik {starterLabel('nik')}</div>
                              </div>
                              <div className="match-score-center">
                                <div className="match-score-large">
                                  <span className={nikLeading ? 'text-[var(--primary)]' : ''}>{typeof nikFrames === 'number' ? nikFrames : '—'}</span>
                                  <span className="match-score-sep"> - </span>
                                  <span className={roelLeading ? 'text-[var(--primary)]' : ''}>{typeof roelFrames === 'number' ? roelFrames : '—'}</span>
                                </div>
                                <div className="match-score-sub">Eindstand • {displayDate}</div>
                                {loadError && <div className="chip chip-warn mt-1">Score niet beschikbaar</div>}
                                {!loadError && !hasBoth && <div className="chip chip-neutral mt-1">Nog bezig</div>}
                              </div>
                              <div className="match-player">
                                <div className={['match-avatar', winner === 'roel' ? '' : 'match-avatar-loser'].join(' ')}>
                                  {roelStarted && <span className="match-starter-dot" aria-hidden="true"></span>}
                                  <img src="/Roel.png" alt="Roel" />
                                </div>
                                <div className="match-player-name">Roel {starterLabel('roel')}</div>
                              </div>
                            </div>
                          </div>
                          {m.Notes && (
                            <div className="match-card-footer">
                              <span className="muted text-xs">{m.Notes}</span>
                            </div>
                          )}
                        </button>
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
