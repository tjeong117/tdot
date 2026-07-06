'use client'

import { useEffect, useRef } from 'react'
import { initWatchSim } from './watch-engine'

const css = `
.watchsim{
  --bg:#0a0c10; --panel:#12161d; --ink:#e8e2d2; --muted:#8a93a3;
  --brass:#c9a24b; --steel:#b9c2cf; --ruby:#e0405a; --accent:#7fd4c1;
  --line:#222a35;
  background:radial-gradient(1200px 800px at 70% -10%, #161b24 0%, var(--bg) 60%);
  color:var(--ink);
  font:14px/1.45 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  -webkit-font-smoothing:antialiased;
  border:1px solid var(--line); border-radius:16px; overflow:hidden;
}
.watchsim *{box-sizing:border-box}
.watchsim .ws-header{
  display:flex; align-items:baseline; gap:14px; padding:14px 20px;
  border-bottom:1px solid var(--line);
}
.watchsim .ws-header h2{font-size:15px; margin:0; letter-spacing:.12em; text-transform:uppercase; color:var(--ink)}
.watchsim .ws-header .sub{color:var(--muted); font-size:12px}
.watchsim .ws-header .grav{margin-left:auto; color:var(--brass); font-size:12px; letter-spacing:.1em}
.watchsim .ws-main{display:flex; gap:18px; padding:18px 20px; flex-wrap:wrap; align-items:flex-start}
.watchsim .stage{position:relative; flex:1 1 560px; min-width:300px}
.watchsim canvas{width:100%; height:auto; display:block; border-radius:14px;
  background:linear-gradient(180deg,#0e1218,#0a0d12);
  border:1px solid var(--line); box-shadow:0 20px 60px rgba(0,0,0,.5)}
.watchsim aside{flex:1 1 290px; max-width:340px; display:flex; flex-direction:column; gap:14px}
.watchsim .card{background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px}
.watchsim .card h3{margin:0 0 10px; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted)}
.watchsim .readout{display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:13px}
.watchsim .readout .k{color:var(--muted)}
.watchsim .readout .v{text-align:right; color:var(--ink)}
.watchsim .readout .v.big{color:var(--brass); font-weight:600}
.watchsim .row{display:flex; gap:8px; flex-wrap:wrap; align-items:center}
.watchsim button{
  background:#1b212b; color:var(--ink); border:1px solid #2b3340; border-radius:8px;
  padding:7px 11px; cursor:pointer; font:inherit; font-size:12px; transition:.12s;
}
.watchsim button:hover{border-color:var(--brass); color:#fff}
.watchsim button.active{background:var(--brass); color:#101216; border-color:var(--brass); font-weight:600}
.watchsim label.field{display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--muted)}
.watchsim input[type=range]{width:100%; accent-color:var(--brass)}
.watchsim input[type=datetime-local]{background:#0d1117; color:var(--ink); border:1px solid #2b3340;
  border-radius:8px; padding:6px; font:inherit; font-size:12px}
.watchsim .speedval{color:var(--accent); font-variant-numeric:tabular-nums}
.watchsim .legend{display:grid; grid-template-columns:14px 1fr; gap:6px 8px; font-size:11px; color:var(--muted); align-items:center}
.watchsim .dot{width:12px; height:12px; border-radius:3px}
.watchsim .ws-footer{padding:8px 20px 16px; color:var(--muted); font-size:11px; border-top:1px solid var(--line)}
.watchsim .toggle-views{display:flex; gap:6px}
.watchsim .hint{color:var(--muted); font-size:11px; margin-top:6px}
`

export function WatchSim() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!rootRef.current) return
    return initWatchSim(rootRef.current)
  }, [])

  return (
    <div ref={rootRef} className="watchsim">
      <style>{css}</style>
      <div className="ws-header">
        <h2>Calibre PC·48</h2>
        <span className="sub">perpetual calendar · mechanical simulation</span>
        <span className="grav" id="beat">
          28 800 A/h
        </span>
      </div>

      <div className="ws-main">
        <div className="stage">
          <canvas id="c" />
          <div className="hint">
            Drag the speed slider to watch days, leap years &amp; the Feb-29
            jump play out. Toggle <b>Movement</b> to see the gear train,
            escapement &amp; the 48-month program wheel work.
          </div>
        </div>

        <aside>
          <div className="card">
            <h3>Indications</h3>
            <div className="readout">
              <span className="k">Weekday</span>
              <span className="v big" id="r-dow">—</span>
              <span className="k">Date</span>
              <span className="v big" id="r-date">—</span>
              <span className="k">Month</span>
              <span className="v big" id="r-month">—</span>
              <span className="k">Year</span>
              <span className="v" id="r-year">—</span>
              <span className="k">Leap cam</span>
              <span className="v" id="r-leap">—</span>
              <span className="k">Time</span>
              <span className="v" id="r-time">—</span>
              <span className="k">Moon age</span>
              <span className="v" id="r-moon">—</span>
              <span className="k">Balance</span>
              <span className="v" id="r-bal">—</span>
            </div>
          </div>

          <div className="card">
            <h3>View</h3>
            <div className="toggle-views">
              <button id="v-dial">Dial</button>
              <button id="v-move">Movement</button>
              <button id="v-both">Both</button>
            </div>
          </div>

          <div className="card">
            <h3>Drive</h3>
            <div className="row" style={{ marginBottom: 10 }}>
              <button id="playpause" className="active">
                ⏸ Pause
              </button>
              <button data-mult="1">live</button>
              <button data-mult="60">×60</button>
              <button data-mult="3600">×1h/s</button>
              <button data-mult="86400">×1d/s</button>
              <button data-mult="2592000">×1mo/s</button>
            </div>
            <label className="field">
              log speed · <span className="speedval" id="speedlabel"></span>
              <input id="speed" type="range" min="0" max="7.5" step="0.01" defaultValue="0" />
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field" style={{ flex: 1 }}>
                set date/time
                <input id="setdt" type="datetime-local" step="1" />
              </label>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button id="apply">Set</button>
              <button id="now">Now</button>
              <button id="feb28">Feb 28, 2028 23:59</button>
            </div>
          </div>

          <div className="card">
            <h3>Mechanism</h3>
            <div className="legend">
              <span className="dot" style={{ background: '#c9a24b' }} />
              <span>Going train (mainspring → escapement)</span>
              <span className="dot" style={{ background: '#b9c2cf' }} />
              <span>Date star (31) &amp; 24h driving wheel</span>
              <span className="dot" style={{ background: '#7fd4c1' }} />
              <span>48-month program wheel + grand lever</span>
              <span className="dot" style={{ background: '#e0405a' }} />
              <span>Leap-year cam (4 yr) &amp; jewels</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="ws-footer">
        Kinematic horological model: exact going-train ratios (3rd/4th/escape
        wheels), a beating Swiss-lever escapement &amp; balance, motion works
        (12:1), and a true perpetual calendar — a 48-step program wheel read by
        a grand lever that commands the date star to skip 1–4 teeth at month
        end, with a 4-position leap cam carrying the 29th of February.
      </div>
    </div>
  )
}
