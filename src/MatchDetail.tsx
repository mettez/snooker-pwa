import { useEffect, useMemo, useState } from 'react';
import { API } from './lib/api';

type Match = {
  MatchID: string;
  Date: string;
  Season: number;
  BestOf: number;
  FirstBreakerPlayerID?: 'nik'|'roel'|'';
  WinnerPlayerID?: 'nik'|'roel'|'';
  Notes?: string;
}
type Frame = {
  FrameID: string;
  MatchID: string;
  FrameNo: number;
  NikScore: number;
  RoelScore: number;
  WinnerPlayerID?: 'nik'|'roel'|'';
  BreakerPlayerID?: 'nik'|'roel'|'';
  Season: number;
}
type Break = {
  BreakID: string;
  MatchID: string;
  FrameID?: string;
  FrameId?: string;
  PlayerID: 'nik'|'roel';
  Points: number;
  Season: number;
  FrameNo?: number;
}

const playerLabel: Record<'nik'|'roel', string> = { nik: 'Nik', roel: 'Roel' };

const getFrameWinner = (frame: Frame): 'nik' | 'roel' | null => {
  if (frame.WinnerPlayerID === 'nik' || frame.WinnerPlayerID === 'roel') {
    return frame.WinnerPlayerID;
  }
  if (frame.NikScore === frame.RoelScore) return null;
  return frame.NikScore > frame.RoelScore ? 'nik' : 'roel';
};

export default function MatchDetail({
  matchId,
  onClose,
}: { matchId: string; onClose: () => void }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // formulier voor nieuw frame
  const orderedFrames = useMemo(() => [...frames].sort((a,b)=> a.FrameNo - b.FrameNo), [frames]);
  const activeFrame = useMemo(() => findActiveFrame(orderedFrames), [orderedFrames]);
  const highestFrameNo = orderedFrames.length ? orderedFrames[orderedFrames.length - 1].FrameNo : 0;
  const nextNo = activeFrame ? activeFrame.FrameNo : highestFrameNo + 1;
  const [nik, setNik] = useState<number>(0);
  const [roel, setRoel] = useState<number>(0);
  const suggestedBreaker = useMemo<'nik'|'roel'|''>(() => {
    const first = match?.FirstBreakerPlayerID;
    if (first === 'nik' || first === 'roel') {
      return nextNo % 2 === 1 ? first : (first === 'nik' ? 'roel' : 'nik');
    }
    return '';
  }, [match, nextNo]);
  const [breaker, setBreaker] = useState<'nik'|'roel'|''>('');
  const framesFilled = orderedFrames.filter(f => f.NikScore !== 0 || f.RoelScore !== 0 || f.WinnerPlayerID).length;
  const reachedBestOf = match ? framesFilled >= match.BestOf : false;

  // --- 10+ break formulier state ---
  const [brPlayer, setBrPlayer] = useState<'nik'|'roel'>('nik');
  const [brPoints, setBrPoints] = useState<number>(10);
  const [brFrameNo, setBrFrameNo] = useState<number | ''>('');

  useEffect(() => {
    const suggested = activeFrame ? activeFrame.FrameNo : nextNo;
    setBrFrameNo(prev => (prev === '' ? suggested : prev));
  }, [activeFrame, nextNo]);

  function findActiveFrame(list: Frame[]) {
    const sorted = [...list].sort((a,b)=> a.FrameNo - b.FrameNo);
    for (let i = sorted.length - 1; i >= 0; i--) {
      const f = sorted[i];
      if (!f.WinnerPlayerID) return f;
    }
    return null;
  }

  // toevoegen van 10+ break
  async function addTenPlus(e: React.FormEvent) {
    e.preventDefault();
    if (Number(brPoints) < 10) { setMsg('Fout: break moet ≥ 10 zijn'); return; }
    const frameNoValueRaw = brFrameNo === '' ? (activeFrame ? activeFrame.FrameNo : nextNo) : Number(brFrameNo);
    if (Number.isNaN(frameNoValueRaw) || frameNoValueRaw <= 0) { setMsg('Fout: vul een geldig frame nummer in'); return; }
    const frameNoValue = frameNoValueRaw;
    setBusy(true); setMsg(null);
    try {
      const targetFrame = frames.find(f => f.FrameNo === frameNoValue) || null;
      await API.addBreak({
        matchId,
        playerId: brPlayer,
        points: Number(brPoints),
        frameId: targetFrame?.FrameID,
        frameNo: frameNoValue,
      });
      // reset + herladen
      setBrPoints(10);
      setBrFrameNo('');
      await load();
      setMsg('10+ break toegevoegd ✔︎');
    } catch (err:any) {
      setMsg('Fout: ' + err.message);
    } finally { setBusy(false); }
  }

  useEffect(() => { setBreaker(suggestedBreaker) }, [suggestedBreaker]);

  async function load(): Promise<{ match: Match; frames: Frame[]; breaks: Break[] }> {
    setMsg(null);
    const r = await API.getMatch(matchId);
    const matchData = (r as any).match as Match;
    const frameData = ((r as any).frames || []) as Frame[];
    const breakData = ((r as any).breaks || []) as Break[];
    setMatch(matchData);
    setFrames(frameData);
    setBreaks(breakData);
    return { match: matchData, frames: frameData, breaks: breakData };
  }

  useEffect(() => { load().catch(e => setMsg('Fout: ' + e.message)) }, [matchId]);

  async function addFrame(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await API.addFrame({
        matchId,
        frameNo: nextNo,
        NikScore: Number(nik),
        RoelScore: Number(roel),
        // BreakerPlayerID is optioneel; backend berekent ook om-en-om
        BreakerPlayerID: breaker || undefined,
      });
      setNik(0); setRoel(0);
      await load();
      setMsg('Frame toegevoegd ✔︎');
    } catch (err: any) {
      setMsg('Fout: ' + err.message);
    } finally { setBusy(false) }
  }

  const frameTotals = useMemo(() => {
    return frames.reduce(
      (acc, frame) => {
        const winner = getFrameWinner(frame);
        if (winner) acc[winner] += 1;
        return acc;
      },
      { nik: 0, roel: 0 } as { nik: number; roel: number }
    );
  }, [frames]);

  if (!match) return <div className="card">Laden…</div>;

  const formattedDate = new Date(match.Date).toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit' });
  const nikStarted = match.FirstBreakerPlayerID === 'nik';
  const roelStarted = match.FirstBreakerPlayerID === 'roel';

  return (
    <div className="space-y-6">
      <div className="match-summary-panel">
        <div className="match-summary-top">
          <div>
            <div className="section-label">Match</div>
            <div className="match-summary-date">{formattedDate}</div>
            <div className="muted text-xs mt-1">Best of {match.BestOf}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Terug</button>
        </div>
        <div className="match-card-scores">
          <div className={`match-score-line ${frameTotals.roel > frameTotals.nik ? 'match-score-line-winner-roel' : ''}`}>
            <span className="pill pill-roel">
              {playerLabel.roel}
              {roelStarted && <span className="pill-indicator" aria-hidden="true"></span>}
            </span>
            <span className="match-score-value match-score-value-roel">{frameTotals.roel}</span>
          </div>
          <div className={`match-score-line ${frameTotals.nik > frameTotals.roel ? 'match-score-line-winner-nik' : ''}`}>
            <span className="pill pill-nik">
              {playerLabel.nik}
              {nikStarted && <span className="pill-indicator" aria-hidden="true"></span>}
            </span>
            <span className="match-score-value match-score-value-nik">{frameTotals.nik}</span>
          </div>
        </div>
      </div>

      {msg && <div className="item">{msg}</div>}

      <section className="section">
        <div className="section-heading">
          <h3 className="h2">Frames</h3>
        </div>
        {orderedFrames.length === 0 ? (
          <div className="item muted">Nog geen frames.</div>
        ) : (
          <div className="frame-timeline">
            {orderedFrames.map(frame => {
              const winner = getFrameWinner(frame);
              return (
                <div className="frame-timeline-row" key={frame.FrameID}>
                  <div className="frame-card">
                    <div className="frame-card-header">
                      <div className="frame-card-title">Frame {frame.FrameNo}</div>
                    </div>
                    <div className="frame-card-body">
                      <div className={`match-score-line ${winner === 'roel' ? 'match-score-line-winner-roel' : ''}`}>
                        <span className="pill pill-roel">{playerLabel.roel}</span>
                        <span className="match-score-value match-score-value-roel">{frame.RoelScore}</span>
                      </div>
                      <div className={`match-score-line ${winner === 'nik' ? 'match-score-line-winner-nik' : ''}`}>
                        <span className="pill pill-nik">{playerLabel.nik}</span>
                        <span className="match-score-value match-score-value-nik">{frame.NikScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!reachedBestOf ? (
        <section className="section" id="new-frame">
          <div className="section-heading">
            <h3 className="h2">Nieuw frame</h3>
          </div>
          <div className="item space-y-4">
            <div className="row">
              <div className="flex-1 space-y-2">
                <div className="label">Nik</div>
                <input type="number" className="input" value={nik} onChange={e => setNik(Number(e.target.value))} />
              </div>
              <div className="flex-1 space-y-2">
                <div className="label">Roel</div>
                <input type="number" className="input" value={roel} onChange={e => setRoel(Number(e.target.value))} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={addFrame as any} disabled={busy}>Toevoegen</button>
          </div>
        </section>
      ) : (
        <section className="section">
          <div className="item muted text-sm">Maximaal aantal frames voor deze match is bereikt.</div>
        </section>
      )}

      <section className="section">
        <div className="section-heading">
          <h3 className="h2">10+ breaks</h3>
        </div>

        {!reachedBestOf && (
          <div className="item space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button"
                      className={`btn ${brPlayer==='nik' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={()=> setBrPlayer('nik')}>Nik</button>
              <button type="button"
                      className={`btn ${brPlayer==='roel' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={()=> setBrPlayer('roel')}>Roel</button>
            </div>
            <div>
              <div className="label">Punten (≥ 10)</div>
              <input type="number" min={10} className="input"
                     value={brPoints} onChange={e=> setBrPoints(Number(e.target.value))} />
            </div>

            <div>
              <div className="label">Frame nr.</div>
              <input
                type="number"
                min={1}
                className="input"
                placeholder={`bv. ${activeFrame ? activeFrame.FrameNo : nextNo}`}
                value={brFrameNo}
                onChange={e=> setBrFrameNo(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <div className="muted text-xs">
                Actief frame: {activeFrame ? `Frame ${activeFrame.FrameNo}` : `Frame ${nextNo} (wordt aangemaakt bij opslaan)`}
              </div>
            </div>

            <button className="btn btn-primary" onClick={addTenPlus as any} disabled={busy}>
              Toevoegen
            </button>
          </div>
        )}
        {reachedBestOf && (
          <div className="item muted text-sm">Alle frames zijn gespeeld — er kunnen geen extra 10+ breaks meer toegevoegd worden.</div>
        )}

        <div className="break-grid mt-3">
          {(['nik','roel'] as const).map(player => {
            const playerBreaks = breaks.filter(b => b.PlayerID === player);
            return (
              <div key={player} className="break-player-card">
                <div className="break-player-header">
                  <span>{playerLabel[player]}</span>
                  <span className="muted text-xs">{playerBreaks.length} break(s)</span>
                </div>
                <div className="space-y-2">
                  {playerBreaks.map(b => {
                    const frameId = b.FrameID ?? (b as any).FrameId;
                    const frameLabel = b.FrameNo ?? (frameId ? frames.find(f=>f.FrameID===frameId)?.FrameNo : undefined);
                    return (
                      <div key={b.BreakID} className="break-pill">
                        <span className="break-pill-value">{b.Points}</span>
                        <span className="muted text-xs">{frameLabel ? `Frame ${frameLabel}` : 'Frame ?'}</span>
                      </div>
                    );
                  })}
                  {playerBreaks.length === 0 && <div className="muted text-xs">Nog geen 10+ breaks.</div>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
