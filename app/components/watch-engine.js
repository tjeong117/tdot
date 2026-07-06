/* ============================================================================
   PERPETUAL CALENDAR — MECHANICAL SIMULATION
   A kinematic (constraint-based) model of a real watch movement:
     • Time base   : balance + Swiss lever escapement beating at 4 Hz (28'800 A/h)
     • Going train : center → third → fourth(sec) → escape, exact ratios
     • Motion works: minute & hour hands at 12:1
     • Calendar    : 24h driving wheel → date star(31) → month program wheel(48)
                     → grand lever decides month length → leap cam carries Feb 29
   The civil date is the source of truth (JS Date); every wheel/cam angle is
   derived from it so the mechanism is always physically consistent, and the
   intermittent (Geneva-style) jumps are animated around midnight.
   ========================================================================== */
'use strict'

export function initWatchSim(root) {
  const $ = (id) => root.querySelector('#' + id)
  const cv = $('c')
  const ctx = cv.getContext('2d')
  const TAU = Math.PI * 2

  /* ---- simulation clock ---------------------------------------------------- */
  let simTime = Date.now() // ms, the simulated civil instant
  let running = true
  let mult = 1 // time multiplier
  let lastFrame = performance.now()
  let beatPhase = 0 // escapement oscillator phase (rad), visual only
  const BEAT_HZ = 4 // 4 Hz balance => 8 beats/s => 28'800 A/h
  let rafId = 0

  /* ---- view ---------------------------------------------------------------- */
  let view = 'both' // 'dial' | 'move' | 'both'

  /* ============================ CALENDAR LOGIC =============================== */
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  function isLeap(y){ return (y%4===0 && y%100!==0) || y%400===0 }
  function daysInMonth(y,m){ return [31, isLeap(y)?29:28,31,30,31,30,31,31,30,31,30,31][m] }

  /* civil breakdown of the simulated instant */
  function civil(){
    const d = new Date(simTime)
    return {
      y:d.getFullYear(), mo:d.getMonth(), dom:d.getDate(), dow:d.getDay(),
      h:d.getHours(), mi:d.getMinutes(), s:d.getSeconds(), ms:d.getMilliseconds(),
      // continuous fractional position through the day [0,1)
      dayFrac:(d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds() + d.getMilliseconds()/1000)/86400
    }
  }

  /* Synodic moon age (days since new moon) — drives the moonphase aperture */
  function moonAge(){
    const SYN = 29.53058867
    const ref = Date.UTC(2000,0,6,18,14)/86400000 // a known new moon (days)
    let age = (((simTime/86400000) - ref) % SYN + SYN) % SYN
    return age
  }

  /* program-wheel index: 0..47 across the 4-year leap cycle (month within cycle).
     The real grand date wheel of a perpetual calendar has 48 cam steps. */
  function programIndex(c){
    const yearInCycle = ((c.y % 4) + 4) % 4 // 0..3, with leap year == 0 (…2024,2028)
    return yearInCycle*12 + c.mo // 0..47
  }

  /* ============================ DRAW HELPERS ================================ */
  function circle(x,y,r,fill,stroke,lw){
    ctx.beginPath(); ctx.arc(x,y,r,0,TAU)
    if(fill){ctx.fillStyle=fill; ctx.fill()}
    if(stroke){ctx.lineWidth=lw||1; ctx.strokeStyle=stroke; ctx.stroke()}
  }
  /* a toothed gear; teeth count sets meshing realism */
  function gear(x,y,rPitch,teeth,angle,opt={}){
    const addend = opt.addend ?? rPitch*0.10
    const ro = rPitch + addend, ri = rPitch - addend
    const body = opt.body || '#c9a24b'
    const edge = opt.edge || '#7a5e22'
    ctx.save(); ctx.translate(x,y); ctx.rotate(angle)
    ctx.beginPath()
    for(let i=0;i<teeth;i++){
      const a0 = i/teeth*TAU, a1=(i+0.5)/teeth*TAU, a2=(i+1)/teeth*TAU
      const m1=a1-0.16/teeth*TAU, m2=a1+0.16/teeth*TAU, m3=a2-0.16/teeth*TAU
      if(i===0) ctx.moveTo(ro*Math.cos(a0), ro*Math.sin(a0))
      ctx.lineTo(ro*Math.cos(m1), ro*Math.sin(m1))
      ctx.lineTo(ri*Math.cos(m2), ri*Math.sin(m2))
      ctx.lineTo(ri*Math.cos(m3), ri*Math.sin(m3))
      ctx.lineTo(ro*Math.cos(a2), ro*Math.sin(a2))
    }
    ctx.closePath()
    const g = ctx.createRadialGradient(0,0,ri*0.3,0,0,ro)
    g.addColorStop(0, opt.coreLight||'#e9c878'); g.addColorStop(1, body)
    ctx.fillStyle=g; ctx.fill()
    ctx.lineWidth=1; ctx.strokeStyle=edge; ctx.stroke()
    // spokes & arbor
    if(opt.spokes!==false){
      ctx.strokeStyle=edge; ctx.lineWidth=Math.max(2,rPitch*0.05)
      const sp = opt.spokeCount||5
      for(let i=0;i<sp;i++){ const a=i/sp*TAU
        ctx.beginPath(); ctx.moveTo(0,0)
        ctx.lineTo(ri*0.86*Math.cos(a), ri*0.86*Math.sin(a)); ctx.stroke() }
      circle(0,0,ri*0.30, '#15110a', edge, 1.5)
    }
    circle(0,0, Math.max(2,rPitch*0.07), '#2a2014', null)
    ctx.restore()
  }
  function hand(cx,cy,angle,len,wBase,wTip,color,backLen=0){
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(angle)
    ctx.beginPath()
    ctx.moveTo(-wBase, backLen)
    ctx.lineTo(-wTip, -len*0.86)
    ctx.lineTo(0, -len)
    ctx.lineTo(wTip, -len*0.86)
    ctx.lineTo(wBase, backLen)
    ctx.closePath()
    ctx.fillStyle=color; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=6; ctx.shadowOffsetY=2
    ctx.fill(); ctx.shadowColor='transparent'
    ctx.restore()
  }

  /* small subdial with a pointer */
  function subdial(cx,cy,r,frac,label,labels){
    circle(cx,cy,r,'#0c1016','#2c3543',1.5)
    circle(cx,cy,r,null,'rgba(201,162,75,.25)',1)
    ctx.fillStyle='#6f7886'; ctx.font=`${Math.round(r*0.20)}px ui-monospace`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    if(labels){
      labels.forEach((t,i)=>{
        const a=-Math.PI/2 + i/labels.length*TAU
        ctx.fillText(t, cx+Math.cos(a)*r*0.74, cy+Math.sin(a)*r*0.74)
      })
    }
    ctx.fillStyle='#8a93a3'; ctx.font=`${Math.round(r*0.16)}px ui-monospace`
    ctx.fillText(label, cx, cy+r*0.42)
    const a = -Math.PI/2 + frac*TAU
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(a+Math.PI/2)
    ctx.beginPath(); ctx.moveTo(-r*0.05,r*0.12); ctx.lineTo(0,-r*0.72); ctx.lineTo(r*0.05,r*0.12); ctx.closePath()
    ctx.fillStyle='#d9b65a'; ctx.fill(); ctx.restore()
    circle(cx,cy,r*0.07,'#d9b65a',null)
  }

  /* ============================ DIAL VIEW =================================== */
  function drawDial(cx,cy,R){
    const c = civil()

    // case + dial
    circle(cx,cy,R*1.08,'#1b212b','#3a4554',6)
    circle(cx,cy,R*1.045,'#0b0e13','#c9a24b',2)
    const dg = ctx.createRadialGradient(cx-R*0.3,cy-R*0.4,R*0.1,cx,cy,R)
    dg.addColorStop(0,'#1a2230'); dg.addColorStop(1,'#0a0d12')
    circle(cx,cy,R,dg,'#2c3543',1.5)

    // chapter ring — hour indices & minute track
    ctx.strokeStyle='rgba(201,162,75,.5)'; ctx.fillStyle='#cdd4de'
    for(let i=0;i<60;i++){
      const a=-Math.PI/2+i/60*TAU, big=i%5===0
      const r1=R*(big?0.86:0.90), r2=R*0.94
      ctx.lineWidth=big?2.4:1; ctx.beginPath()
      ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1)
      ctx.lineTo(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2); ctx.stroke()
    }
    ctx.font=`600 ${Math.round(R*0.075)}px ui-monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'
    for(let h=1;h<=12;h++){
      const a=-Math.PI/2+h/12*TAU
      ctx.fillStyle='#d8dee7'
      ctx.fillText(h, cx+Math.cos(a)*R*0.78, cy+Math.sin(a)*R*0.78)
    }

    // subdials: weekday (9h), month (3h), date ring(6h), moon(12h)
    subdial(cx-R*0.42, cy, R*0.24, c.dow/7, 'JOUR', DOW)
    subdial(cx+R*0.42, cy, R*0.24, c.mo/12, 'MOIS', MONTHS.map(m=>m[0]))
    drawMoon(cx, cy-R*0.44, R*0.22)

    // Big date ring — bottom
    drawDateArc(cx, cy+R*0.40, R*0.30, c)

    // brand text
    ctx.fillStyle='#9aa3b1'; ctx.font=`${Math.round(R*0.045)}px ui-monospace`
    ctx.fillText('CALIBRE PC·48', cx, cy-R*0.18)
    ctx.fillStyle='#6c7480'; ctx.font=`${Math.round(R*0.034)}px ui-monospace`
    ctx.fillText('PERPETUAL · AUTOMATIC', cx, cy-R*0.12)

    // ---- hands (motion works) ----
    const secA = -Math.PI/2 + (c.s + c.ms/1000)/60*TAU
    const minA = -Math.PI/2 + (c.mi + c.s/60)/60*TAU
    const hrA  = -Math.PI/2 + ((c.h%12) + c.mi/60)/12*TAU
    hand(cx,cy,hrA + Math.PI/2,  R*0.50, R*0.022, R*0.012, '#e8e2d2', R*0.10)
    hand(cx,cy,minA + Math.PI/2, R*0.72, R*0.018, R*0.008, '#e8e2d2', R*0.12)
    hand(cx,cy,secA + Math.PI/2, R*0.80, R*0.006, R*0.004, '#e0405a', R*0.18)
    circle(cx,cy,R*0.03,'#c9a24b','#7a5e22',1)
    circle(cx,cy,R*0.012,'#3a2c14',null)
  }

  function drawMoon(cx,cy,r){
    ctx.save()
    ctx.beginPath() // double-aperture style
    ctx.ellipse(cx,cy,r*1.25,r*0.78,0,Math.PI,TAU); ctx.closePath()
    ctx.fillStyle='#0a1530'; ctx.fill()
    ctx.clip()
    // night sky
    ctx.fillStyle='#0a1530'; ctx.fillRect(cx-r*1.4,cy-r,r*2.8,r*1.2)
    // moon disc, phase via terminator
    const age = moonAge()
    const phase = age/29.53058867 // 0 new, .5 full
    const mx = cx, my = cy-r*0.04, mr=r*0.62
    circle(mx,my,mr,'#e9e4d2',null)
    // shadow overlay
    ctx.fillStyle='#0a1530'
    const k = Math.cos(phase*TAU) // -1..1 terminator
    ctx.beginPath()
    if(phase<0.5){ // waxing: shadow on left
      ctx.arc(mx,my,mr,-Math.PI/2,Math.PI/2,true)
      ctx.ellipse(mx,my,mr*Math.abs(k),mr,0,Math.PI/2,-Math.PI/2, k>0)
    } else { // waning: shadow on right
      ctx.arc(mx,my,mr,-Math.PI/2,Math.PI/2,false)
      ctx.ellipse(mx,my,mr*Math.abs(k),mr,0,Math.PI/2,-Math.PI/2, k>0)
    }
    ctx.fill()
    // stars
    ctx.fillStyle='#cbb86a'
    ;[[-1.0,-0.5],[-0.7,0.2],[0.9,-0.4],[0.6,0.25],[1.1,-0.1]].forEach(([sx,sy])=>{
      circle(cx+sx*r, cy+sy*r, r*0.03, '#cbb86a', null)
    })
    ctx.restore()
    ctx.beginPath(); ctx.ellipse(cx,cy,r*1.25,r*0.78,0,Math.PI,TAU)
    ctx.strokeStyle='rgba(201,162,75,.5)'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.fillStyle='#8a93a3'; ctx.font=`${Math.round(r*0.26)}px ui-monospace`
    ctx.textAlign='center'; ctx.fillText('LUNE', cx, cy+r*0.55)
  }

  /* bottom date display: a 4-window leap indicator + numeric date pointer ring */
  function drawDateArc(cx,cy,r,c){
    // leap window: shows 1,2,3,'L' with current highlighted
    const yic = ((c.y%4)+4)%4
    const labels = ['L','1','2','3'] // L = leap year (Feb 29)
    circle(cx,cy,r,'#0c1016','#2c3543',1.5)
    ctx.font=`${Math.round(r*0.30)}px ui-monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'
    for(let i=0;i<4;i++){
      const a=-Math.PI/2+i/4*TAU
      const on = (i===yic)
      ctx.fillStyle = on ? '#e0405a' : '#525c6a'
      ctx.fillText(labels[i], cx+Math.cos(a)*r*0.62, cy+Math.sin(a)*r*0.62)
    }
    // central big date number
    ctx.fillStyle='#c9a24b'; ctx.font=`700 ${Math.round(r*0.5)}px ui-monospace`
    ctx.fillText(String(c.dom).padStart(2,'0'), cx, cy-r*0.02)
    ctx.fillStyle='#8a93a3'; ctx.font=`${Math.round(r*0.16)}px ui-monospace`
    ctx.fillText('QUANTIÈME · LEAP', cx, cy+r*0.40)
    // leap-cam pointer
    const a=-Math.PI/2+yic/4*TAU
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(a+Math.PI/2)
    ctx.beginPath(); ctx.moveTo(-r*0.04,r*0.1); ctx.lineTo(0,-r*0.5); ctx.lineTo(r*0.04,r*0.1)
    ctx.closePath(); ctx.fillStyle='#e0405a'; ctx.fill(); ctx.restore()
  }

  /* ========================== MOVEMENT VIEW ================================ */
  /* exact going-train angles derived from simTime. */
  function drawMovement(cx,cy,R){
    const c = civil()
    const t = simTime/1000 // seconds

    // baseplate
    circle(cx,cy,R*1.06,'#11161d','#2c3543',4)
    const pg=ctx.createRadialGradient(cx-R*0.3,cy-R*0.4,R*0.1,cx,cy,R*1.06)
    pg.addColorStop(0,'#161c25'); pg.addColorStop(1,'#0c1016')
    circle(cx,cy,R*1.02,pg,'#222a35',1)
    // perlage hint
    ctx.save(); ctx.globalAlpha=0.05; ctx.strokeStyle='#cdd4de'
    for(let i=0;i<260;i++){const a=i*2.39996, rr=Math.sqrt(i/260)*R; circle(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,R*0.04,null,'#cdd4de',0.6)}
    ctx.restore()

    // ----- GOING TRAIN (brass) -----
    const aCenter = t/3600*TAU // center wheel — 1 turn/hour
    const cwx=cx-R*0.16, cwy=cy-R*0.05
    const twx=cx+R*0.20, twy=cy-R*0.30 // third wheel
    const aFourth = t/60*TAU // fourth wheel (seconds) — 1 turn/minute
    const fwx=cx+R*0.46, fwy=cy+R*0.06
    const ewx=cx+R*0.30, ewy=cy+R*0.42 // escape wheel

    drawBarrel(cx-R*0.62, cy+R*0.42, R*0.26, t/(3600*8)*TAU)
    gear(cx-R*0.62, cy+R*0.42, R*0.255, 80, t/(3600*8)*TAU, {body:'#b98e3a',edge:'#6f521d',spokeCount:4})
    gear(cwx,cwy, R*0.20, 64, aCenter, {body:'#c9a24b',edge:'#7a5e22'})
    gear(twx,twy, R*0.13, 40, -aCenter*8, {body:'#c9a24b',edge:'#7a5e22',spokeCount:4})
    gear(fwx,fwy, R*0.11, 30, aFourth, {body:'#cdb05f',edge:'#7a5e22',spokeCount:4})

    // escape wheel steps: 15 teeth, advances each beat
    const beats = (simTime/1000)*8 // 8 beats per simulated second
    const escTeeth=15
    const escStep = Math.floor(beats)/escTeeth*TAU
    gear(ewx,ewy, R*0.085, escTeeth, escStep, {body:'#9fb0c2',edge:'#516072',coreLight:'#d6e0ec',addend:R*0.022,spokeCount:3})

    // pallet fork + balance (the regulator)
    drawEscapement(ewx,ewy,R*0.085, cx-R*0.04, cy+R*0.40, R*0.205)

    // arbor markers
    ;[[cx-R*0.62,cy+R*0.42],[cwx,cwy],[twx,twy],[fwx,fwy],[ewx,ewy]].forEach(p=>circle(p[0],p[1],3,'#c9a24b',null))

    // ----- CALENDAR WORKS (steel + accent + ruby) -----
    // 24-hour driving wheel: 1 turn / 24h, flicks the date star at midnight
    const a24 = -c.dayFrac*TAU - Math.PI/2
    const h24x=cx-R*0.30, h24y=cy-R*0.42
    gear(h24x,h24y, R*0.14, 48, a24, {body:'#9aa6b4',edge:'#4a5462',coreLight:'#cfd8e3',spokeCount:6})
    // driving finger
    ctx.save(); ctx.translate(h24x,h24y); ctx.rotate(a24)
    ctx.fillStyle='#e0405a'; ctx.beginPath()
    ctx.moveTo(R*0.02,0); ctx.lineTo(R*0.20,-R*0.03); ctx.lineTo(R*0.20,R*0.03); ctx.closePath(); ctx.fill()
    ctx.restore()

    // DATE STAR — 31 teeth, advanced one step per day (Geneva-style intermittent)
    const dsx=cx+R*0.04, dsy=cy-R*0.46, dsr=R*0.13
    const dayPos = dateStarPosition(c)
    drawDateStar(dsx,dsy,dsr, dayPos, c.dom)

    // 48-MONTH PROGRAM WHEEL + GRAND LEVER (the heart of the perpetual calendar)
    drawProgramWheel(cx+R*0.46, cy-R*0.40, R*0.20, c)

    // LEAP CAM (4-year), ruby jewel
    drawLeapCam(cx+R*0.60, cy+R*0.40, R*0.10, c)

    // jewels
    ;[[cwx,cwy],[fwx,fwy],[twx,twy],[ewx,ewy],[dsx,dsy]].forEach(p=>{
      circle(p[0],p[1],R*0.018,'#e0405a',null)
      circle(p[0],p[1],R*0.009,'#ff8198',null)
    })

    // labels
    ctx.fillStyle='#6c7480'; ctx.font=`${Math.round(R*0.032)}px ui-monospace`; ctx.textAlign='center'
    ctx.fillText('MAINSPRING', cx-R*0.62, cy+R*0.74)
    ctx.fillText('ESCAPEMENT', cx-R*0.02, cy+R*0.66)
    ctx.fillText('24H WHEEL', h24x, h24y+R*0.22)
    ctx.fillText('DATE ★31', dsx, dsy+R*0.22)
    ctx.fillText('PROGRAM ★48 + GRAND LEVER', cx+R*0.46, cy-R*0.66)
    ctx.fillText('LEAP CAM', cx+R*0.60, cy+R*0.56)
  }

  function drawBarrel(x,y,r,a){
    circle(x,y,r,'#5a4a28','#3a2f18',2)
    ctx.save(); ctx.translate(x,y); ctx.rotate(a)
    ctx.strokeStyle='rgba(0,0,0,.4)'; ctx.lineWidth=1.4
    for(let i=0;i<6;i++){ const rr=r*(0.2+i*0.12)
      ctx.beginPath(); ctx.arc(0,0,rr,0,TAU*0.92); ctx.stroke() }
    ctx.restore()
  }

  function drawEscapement(ex,ey,er, bx,by,br){
    // pallet fork between escape wheel and balance
    const swing = Math.sin(beatPhase)*0.18
    ctx.save()
    const fork_x=(ex+bx)/2, fork_y=(ey+by)/2
    ctx.translate(fork_x,fork_y); ctx.rotate(swing)
    ctx.strokeStyle='#9fb0c2'; ctx.lineWidth=er*0.18; ctx.lineCap='round'
    ctx.beginPath(); ctx.moveTo(-er*0.9,0); ctx.lineTo(er*0.9,0); ctx.stroke()
    // pallet jewels
    circle(-er*0.9,0,er*0.16,'#e0405a',null); circle(er*0.9,0,er*0.16,'#e0405a',null)
    ctx.restore()

    // balance wheel
    const bA = Math.sin(beatPhase)*(270*Math.PI/180)/2 // ±135° amplitude
    ctx.save(); ctx.translate(bx,by); ctx.rotate(bA)
    circle(0,0,br,'#0d1117','#9fb0c2',br*0.10)
    circle(0,0,br*0.86,null,'rgba(159,176,194,.35)',1)
    ctx.strokeStyle='#9fb0c2'; ctx.lineWidth=br*0.06
    for(let i=0;i<4;i++){const a=i/4*TAU
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*br*0.92,Math.sin(a)*br*0.92); ctx.stroke()}
    for(let i=0;i<8;i++){const a=i/8*TAU; circle(Math.cos(a)*br*0.9,Math.sin(a)*br*0.9,br*0.07,'#cdd4de','#516072',1)}
    circle(0,0,br*0.12,'#c9a24b',null)
    ctx.restore()
    // hairspring (breathing)
    ctx.save(); ctx.translate(bx,by); ctx.strokeStyle='rgba(201,162,75,.6)'; ctx.lineWidth=1.2
    const breathe = 1+Math.sin(beatPhase)*0.04
    ctx.beginPath()
    for(let a=0;a<TAU*3.2;a+=0.12){ const rr=(br*0.16+a*br*0.03)*breathe
      const px=Math.cos(a)*rr, py=Math.sin(a)*rr
      a===0?ctx.moveTo(px,py):ctx.lineTo(px,py)}
    ctx.stroke(); ctx.restore()
  }

  /* date star angular position with an intermittent midnight kick */
  function dateStarPosition(c){
    const teeth=31
    const idx = c.dom-1
    const kick = smoothKick(c.dayFrac)
    return ((idx + kick)/teeth)*TAU
  }
  /* near midnight (dayFrac ~ .999..1), advance quickly by one tooth */
  function smoothKick(f){
    const start=0.985
    if(f<start) return 0
    const u=(f-start)/(1-start) // 0..1 in last ~21 min
    return easeInOutBack(u) // overshoots like a real jumper spring
  }
  function easeInOutBack(x){
    const c1=1.70158, c2=c1*1.525
    return x<0.5
      ? (Math.pow(2*x,2)*((c2+1)*2*x-c2))/2
      : (Math.pow(2*x-2,2)*((c2+1)*(2*x-2)+c2)+2)/2
  }

  function drawDateStar(x,y,r,ang,dom){
    // 31-point star wheel
    gear(x,y,r,31,ang,{body:'#aeb9c6',edge:'#4a5462',coreLight:'#dde4ec',addend:r*0.16,spokeCount:6})
    // index jumper spring (clicks into a tooth)
    ctx.save(); ctx.translate(x,y)
    ctx.strokeStyle='#c9a24b'; ctx.lineWidth=r*0.06; ctx.lineCap='round'
    ctx.beginPath(); ctx.moveTo(r*1.5,-r*0.9); ctx.quadraticCurveTo(r*1.05,-r*0.2,r*1.02,0); ctx.stroke()
    circle(r*1.02,0,r*0.08,'#e0405a',null)
    ctx.restore()
    ctx.fillStyle='#8a93a3'; ctx.font=`${Math.round(r*0.18)}px ui-monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(String(dom), x, y)
  }

  /* The 48-tooth program wheel: cam depth encodes the length of each month across
     the 4-year cycle. The grand lever feels the cam and, at month end, lets the
     date star skip (31-len) extra teeth to snap to the 1st. */
  function drawProgramWheel(x,y,r,c){
    const idx = programIndex(c) // 0..47
    const ang = (idx/48)*TAU + smoothKick(c.dom>=daysInMonth(c.y,c.mo)?c.dayFrac:0)/48*TAU
    ctx.save(); ctx.translate(x,y); ctx.rotate(-ang - Math.PI/2)
    ctx.beginPath()
    for(let i=0;i<=48;i++){
      const yr=Math.floor((i%48)/12); const mo=(i%48)%12
      const len=daysInMonth(2024+yr,mo) // 2024 = leap reference
      const depth = {28:0.52,29:0.66,30:0.82,31:1.0}[len]
      const rr=r*(0.42+0.46*depth)
      const a=(i/48)*TAU
      const px=Math.cos(a)*rr, py=Math.sin(a)*rr
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)
    }
    ctx.closePath()
    const g=ctx.createRadialGradient(0,0,r*0.2,0,0,r)
    g.addColorStop(0,'#173c36'); g.addColorStop(1,'#0f2a26')
    ctx.fillStyle=g; ctx.fill()
    ctx.strokeStyle='#7fd4c1'; ctx.lineWidth=1.4; ctx.stroke()
    // highlight current month notch
    const a0=(idx/48)*TAU
    circle(Math.cos(a0)*r*0.78, Math.sin(a0)*r*0.78, r*0.05, '#bff0e4', null)
    circle(0,0,r*0.16,'#0c1016','#7fd4c1',1.4)
    ctx.restore()

    // GRAND LEVER — a feeler arm resting on the cam at the feeler point
    const len=daysInMonth(c.y,c.mo)
    const depth={28:0.52,29:0.66,30:0.82,31:1.0}[len]
    const feelR=r*(0.42+0.46*depth)
    ctx.save(); ctx.translate(x,y)
    ctx.strokeStyle='#7fd4c1'; ctx.lineWidth=r*0.07; ctx.lineCap='round'
    const pivx=r*1.7, pivy=-r*0.2
    ctx.beginPath(); ctx.moveTo(pivx,pivy); ctx.lineTo(feelR,0); ctx.stroke()
    circle(pivx,pivy,r*0.07,'#e0405a',null) // pivot jewel
    circle(feelR,0,r*0.06,'#bff0e4',null) // feeler tip on cam
    ctx.restore()

    // readout of current commanded month length
    ctx.fillStyle='#7fd4c1'; ctx.font=`${Math.round(r*0.16)}px ui-monospace`; ctx.textAlign='center'
    ctx.fillText(`${MONTHS[c.mo]} = ${len}d`, x, y+r*1.18)
  }

  function drawLeapCam(x,y,r,c){
    const yic=((c.y%4)+4)%4 // 0 = leap (carries Feb 29)
    const ang=(yic/4)*TAU
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang)
    // 4-lobe cam, one lobe (the leap notch) deeper
    ctx.beginPath()
    for(let i=0;i<=64;i++){
      const a=i/64*TAU; const quad=Math.floor((i%64)/16)
      const notch = quad===0 ? 0.62 : 1.0 // leap quadrant cut in
      const rr=r*notch
      const px=Math.cos(a)*rr, py=Math.sin(a)*rr
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py)
    }
    ctx.closePath(); ctx.fillStyle='#3a1018'; ctx.strokeStyle='#e0405a'; ctx.lineWidth=1.3
    ctx.fill(); ctx.stroke()
    ctx.restore()
    circle(x,y,r*0.14,'#0c1016','#e0405a',1.2)
    ctx.fillStyle='#e0405a'; ctx.font=`${Math.round(r*0.3)}px ui-monospace`; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(yic===0?'29':'·', x, y)
  }

  /* ============================== RENDER ==================================== */
  function layout(){
    const w=cv.clientWidth, h=Math.max(420, Math.round(w*0.62))
    const dpr=Math.min(window.devicePixelRatio||1, 2)
    cv.width=w*dpr; cv.height=h*dpr
    cv.style.height=h+'px'
    ctx.setTransform(dpr,0,0,dpr,0,0)
    return {w,h}
  }

  function render(){
    const {w,h}=layout()
    ctx.clearRect(0,0,w,h)
    if(view==='both'){
      const R=Math.min(w*0.245, h*0.42)
      drawDial(w*0.27, h*0.5, R)
      drawMovement(w*0.74, h*0.5, R)
    } else {
      const R=Math.min(w*0.40, h*0.42)
      if(view==='dial') drawDial(w*0.5,h*0.5,R)
      else drawMovement(w*0.5,h*0.5,R)
    }
  }

  /* ============================ READOUTS =================================== */
  function updateReadouts(){
    const c=civil()
    $('r-dow').textContent = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][c.dow]
    $('r-date').textContent = String(c.dom).padStart(2,'0')+' '+MONTHS[c.mo]
    $('r-month').textContent = MONTHS[c.mo]+' ('+daysInMonth(c.y,c.mo)+'d)'
    $('r-year').textContent = c.y + (isLeap(c.y)?' · leap':'')
    const yic=((c.y%4)+4)%4
    $('r-leap').textContent = yic===0?'year 0 / 4 (Feb 29)':('year '+yic+' / 4')
    $('r-time').textContent = `${String(c.h).padStart(2,'0')}:${String(c.mi).padStart(2,'0')}:${String(c.s).padStart(2,'0')}`
    $('r-moon').textContent = moonAge().toFixed(1)+' d'
    $('r-bal').textContent = '4 Hz · ±135°'
  }

  /* ============================ MAIN LOOP ================================== */
  function tick(now){
    const dt=(now-lastFrame)/1000; lastFrame=now
    if(running){
      simTime += dt*1000*mult
      beatPhase += TAU*BEAT_HZ*dt*Math.min(1, Math.max(0.25, Math.log10(mult+1)+0.4))
    }
    render()
    updateReadouts()
    rafId = requestAnimationFrame(tick)
  }

  /* ============================ CONTROLS =================================== */
  function setMultFromSlider(v){
    // log slider 0..7.5 -> 1 .. ~3e7
    mult = Math.pow(10, v)
    $('speedlabel').textContent = humanRate(mult)
  }
  function humanRate(m){
    if(m<2) return 'live (×1)'
    if(m<3600) return '×'+Math.round(m)+'  ('+ (m).toFixed(0) +' s/s)'
    if(m<86400) return (m/3600).toFixed(1)+' h / sec'
    if(m<2592000) return (m/86400).toFixed(1)+' days / sec'
    return (m/2592000).toFixed(1)+' months / sec'
  }
  $('speed').addEventListener('input',e=>setMultFromSlider(parseFloat(e.target.value)))
  root.querySelectorAll('[data-mult]').forEach(b=>{
    b.addEventListener('click',()=>{
      mult=parseFloat(b.dataset.mult)
      $('speed').value=Math.log10(mult)
      $('speedlabel').textContent=humanRate(mult)
    })
  })
  $('playpause').addEventListener('click',e=>{
    running=!running
    e.target.textContent = running?'⏸ Pause':'▶ Play'
    e.target.classList.toggle('active',running)
  })
  function setView(v){
    view=v
    ;['v-dial','v-move','v-both'].forEach(id=>$(id).classList.remove('active'))
    $({dial:'v-dial',move:'v-move',both:'v-both'}[v]).classList.add('active')
  }
  $('v-dial').onclick=()=>setView('dial')
  $('v-move').onclick=()=>setView('move')
  $('v-both').onclick=()=>setView('both')

  function toLocalInput(ms){
    const d=new Date(ms - new Date(ms).getTimezoneOffset()*60000)
    return d.toISOString().slice(0,19)
  }
  $('apply').onclick=()=>{
    const v=$('setdt').value; if(v){ simTime=new Date(v).getTime() }
  }
  $('now').onclick=()=>{ simTime=Date.now(); $('setdt').value=toLocalInput(simTime) }
  $('feb28').onclick=()=>{
    simTime=new Date(2028,1,28,23,59,30).getTime() // leap year — watch Feb 29 appear
    $('setdt').value=toLocalInput(simTime)
    mult=3600; $('speed').value=Math.log10(mult); $('speedlabel').textContent=humanRate(mult)
  }

  /* init */
  $('setdt').value=toLocalInput(simTime)
  setMultFromSlider(0)
  setView(cv.clientWidth < 640 ? 'dial' : 'both') // both panes are cramped on phones
  window.addEventListener('resize',render)
  rafId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', render)
  }
}
