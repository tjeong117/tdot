'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/* The Milky Way–Andromeda merger as a restricted N-body simulation
   (after Toomre & Toomre, 1972): the two galaxy cores are real point
   masses that orbit each other, and every star is a massless test
   particle moving in their combined (softened) potential. That is the
   cheapest simulation that still produces genuine tidal tails.

   A drag term stands in for dynamical friction once the cores overlap,
   so the encounter actually decays into a merger instead of ringing
   forever. The whole run is deterministic (seeded PRNG), which is what
   makes the timeline scrubbable: rewinding just re-runs the universe. */

const G = 1
const M_MW = 1
const M_M31 = 1.25
const D0 = 70 // initial core separation
const V_FRAC = 0.95 // of the parabolic velocity
const TANGENT = 0.45 // tangential fraction -> grazing first pass
const EPS_CORE = 6 // core-core softening
const EPS_STAR = 3.2 // star-core softening
const DT = 0.5
const FRIC_R = 25 // dynamical friction reach
const FRIC_K = 0.03
const STEPS_TOTAL = 1300
const GYR_TOTAL = 6.0 // display mapping; the sim itself is unitless
const PLAY_RATE = STEPS_TOTAL / 60 // steps per second: full story in ~1 min
const CATCHUP = 50 // max sim steps per frame while scrubbing

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Galaxy = {
  mass: number
  n: number
  radius: number
  euler: [number, number, number]
  spin: 1 | -1
  core: [number, number, number]
  mid: [number, number, number]
  accent: [number, number, number]
}

export function Collision() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sliderRef = useRef<HTMLInputElement | null>(null)
  const readoutRef = useRef<HTMLSpanElement | null>(null)
  const [playing, setPlaying] = useState(true)
  const playingRef = useRef(true)
  const targetStep = useRef(0)
  const scrubbing = useRef(false)

  const setPlay = (p: boolean) => {
    playingRef.current = p
    setPlaying(p)
  }

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (prefersReducedMotion) setPlay(false)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      3000
    )
    camera.position.set(0, 62, 132)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = 'none'

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 45
    controls.maxDistance = 420
    controls.minPolarAngle = 0.15
    controls.maxPolarAngle = 2.95
    controls.autoRotate = !prefersReducedMotion
    controls.autoRotateSpeed = 0.2

    const isSmall = window.innerWidth < 768
    const N = isSmall ? 30000 : 90000
    const nMW = Math.round((N * 12) / 26)
    const galaxies: Galaxy[] = [
      {
        mass: M_MW,
        n: nMW,
        radius: 13,
        euler: [-0.4, 0, 0.15],
        spin: 1,
        core: [1.0, 0.9, 0.72],
        mid: [0.91, 0.72, 0.42],
        accent: [0.72, 0.8, 1.0],
      },
      {
        mass: M_M31,
        n: N - nMW,
        radius: 15,
        euler: [0.85, 0.6, 0],
        spin: -1,
        core: [1.0, 0.95, 0.86],
        mid: [0.62, 0.72, 1.0],
        accent: [1.0, 0.82, 0.55],
      },
    ]

    // sim state, mutated in place; geometry attributes view these arrays
    const corePos = new Float32Array(6)
    const coreVel = new Float32Array(6)
    const starPos = new Float32Array(N * 3)
    const starVel = new Float32Array(N * 3)
    const starCol = new Float32Array(N * 3)
    let curStep = 0

    const circularSpeed = (mass: number, r: number) =>
      Math.sqrt(
        (G * mass * r * r) / Math.pow(r * r + EPS_STAR * EPS_STAR, 1.5)
      )

    const initSim = () => {
      const rnd = mulberry32(42)
      const gauss = () => rnd() + rnd() - 1

      // cores on a decaying near-parabolic encounter (tuned offline)
      const vp = Math.sqrt((2 * G * (M_MW + M_M31)) / D0)
      const dir = [-Math.sqrt(1 - TANGENT * TANGENT), 0, TANGENT]
      corePos.set([-D0 / 2, 0, 0, D0 / 2, 0, 0])
      for (let k = 0; k < 3; k++) {
        coreVel[k] = (-dir[k] * V_FRAC * vp * M_M31) / (M_MW + M_M31)
        coreVel[3 + k] = (dir[k] * V_FRAC * vp * M_MW) / (M_MW + M_M31)
      }

      let i = 0
      for (let g = 0; g < 2; g++) {
        const gal = galaxies[g]
        const e = new THREE.Euler(...gal.euler)
        const u = new THREE.Vector3(1, 0, 0).applyEuler(e)
        const v = new THREE.Vector3(0, 0, 1).applyEuler(e)
        const nrm = new THREE.Vector3(0, 1, 0).applyEuler(e)
        const cx = corePos[g * 3]
        const cy = corePos[g * 3 + 1]
        const cz = corePos[g * 3 + 2]
        const nBulge = Math.floor(gal.n * 0.12)

        for (let s = 0; s < gal.n; s++, i++) {
          const i3 = i * 3
          let px = 0
          let py = 0
          let pz = 0
          let vx = 0
          let vy = 0
          let vz = 0
          let t = 0 // 0 at center -> 1 at rim, drives the color ramp

          if (s < nBulge) {
            // central bulge: small isotropic cloud on tumbling orbits
            const r = 0.4 + 2.6 * Math.pow(rnd(), 0.8)
            let dx = gauss()
            let dy = gauss()
            let dz = gauss()
            const dl = Math.hypot(dx, dy, dz) || 1
            dx /= dl
            dy /= dl
            dz /= dl
            px = dx * r
            py = dy * r
            pz = dz * r
            // random tangential direction: cross(radial, random)
            let tx = dy * u.z - dz * u.y
            let ty = dz * u.x - dx * u.z
            let tz = dx * u.y - dy * u.x
            const tl = Math.hypot(tx, ty, tz) || 1
            const sp = 0.8 * circularSpeed(gal.mass, r)
            vx = (tx / tl) * sp
            vy = (ty / tl) * sp
            vz = (tz / tl) * sp
            t = 0
          } else {
            // exponential-ish disk on circular orbits
            const r = 1.6 + (gal.radius - 1.6) * Math.pow(rnd(), 0.72)
            const a = rnd() * Math.PI * 2
            const cosA = Math.cos(a)
            const sinA = Math.sin(a)
            const h = gauss() * (0.25 + (0.5 * r) / gal.radius)
            px = u.x * r * cosA + v.x * r * sinA + nrm.x * h
            py = u.y * r * cosA + v.y * r * sinA + nrm.y * h
            pz = u.z * r * cosA + v.z * r * sinA + nrm.z * h
            const sp = circularSpeed(gal.mass, r)
            vx = gal.spin * (-u.x * sinA + v.x * cosA) * sp + gauss() * 0.012
            vy = gal.spin * (-u.y * sinA + v.y * cosA) * sp + gauss() * 0.012
            vz = gal.spin * (-u.z * sinA + v.z * cosA) * sp + gauss() * 0.012
            t = r / gal.radius
          }

          starPos[i3] = cx + px
          starPos[i3 + 1] = cy + py
          starPos[i3 + 2] = cz + pz
          starVel[i3] = coreVel[g * 3] + vx
          starVel[i3 + 1] = coreVel[g * 3 + 1] + vy
          starVel[i3 + 2] = coreVel[g * 3 + 2] + vz

          const ramp = Math.min(1, t * 1.5)
          let cr = gal.core[0] + (gal.mid[0] - gal.core[0]) * ramp
          let cg = gal.core[1] + (gal.mid[1] - gal.core[1]) * ramp
          let cb = gal.core[2] + (gal.mid[2] - gal.core[2]) * ramp
          if (t > 0.25 && rnd() < 0.22) {
            ;[cr, cg, cb] = gal.accent
          }
          const bright = (0.1 + 0.13 * rnd()) * (s < nBulge ? 1.1 : 1)
          starCol[i3] = cr * bright
          starCol[i3 + 1] = cg * bright
          starCol[i3 + 2] = cb * bright
        }
      }
      curStep = 0
    }

    const stepSim = () => {
      // cores: mutual softened gravity + friction inside FRIC_R
      const dx = corePos[3] - corePos[0]
      const dy = corePos[4] - corePos[1]
      const dz = corePos[5] - corePos[2]
      const d2 = dx * dx + dy * dy + dz * dz
      const d = Math.sqrt(d2)
      const inv = G / Math.pow(d2 + EPS_CORE * EPS_CORE, 1.5)
      let f = 0
      if (d < FRIC_R) f = FRIC_K * Math.pow(1 - d / FRIC_R, 2)
      for (let k = 0; k < 3; k++) {
        const rk = [dx, dy, dz][k]
        const dv = coreVel[3 + k] - coreVel[k]
        coreVel[k] += (rk * inv * M_M31 + f * dv * (M_M31 / (M_MW + M_M31))) * DT
        coreVel[3 + k] +=
          (-rk * inv * M_MW - f * dv * (M_MW / (M_MW + M_M31))) * DT
      }
      for (let k = 0; k < 3; k++) {
        corePos[k] += coreVel[k] * DT
        corePos[3 + k] += coreVel[3 + k] * DT
      }

      // stars: massless, feel both cores
      const e2 = EPS_STAR * EPS_STAR
      const c0x = corePos[0]
      const c0y = corePos[1]
      const c0z = corePos[2]
      const c1x = corePos[3]
      const c1y = corePos[4]
      const c1z = corePos[5]
      for (let i3 = 0; i3 < N * 3; i3 += 3) {
        const px = starPos[i3]
        const py = starPos[i3 + 1]
        const pz = starPos[i3 + 2]
        let ax = c0x - px
        let ay = c0y - py
        let az = c0z - pz
        let w = (G * M_MW) / Math.pow(ax * ax + ay * ay + az * az + e2, 1.5)
        let sx = ax * w
        let sy = ay * w
        let sz = az * w
        ax = c1x - px
        ay = c1y - py
        az = c1z - pz
        w = (G * M_M31) / Math.pow(ax * ax + ay * ay + az * az + e2, 1.5)
        sx += ax * w
        sy += ay * w
        sz += az * w
        const vx = starVel[i3] + sx * DT
        const vy = starVel[i3 + 1] + sy * DT
        const vz = starVel[i3 + 2] + sz * DT
        starVel[i3] = vx
        starVel[i3 + 1] = vy
        starVel[i3 + 2] = vz
        starPos[i3] = px + vx * DT
        starPos[i3 + 1] = py + vy * DT
        starPos[i3 + 2] = pz + vz * DT
      }
      curStep++
    }

    initSim()

    // soft sprite shared by stars and cores
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteCanvas.height = 64
    const sctx = spriteCanvas.getContext('2d')!
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.5, 'rgba(255,255,255,0.75)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 64, 64)
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas)

    const disposables: { dispose: () => void }[] = [spriteTexture]

    const starGeometry = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(starPos, 3)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    starGeometry.setAttribute('position', posAttr)
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
    const starMaterial = new THREE.PointsMaterial({
      size: 0.34 * renderer.getPixelRatio(),
      map: spriteTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    disposables.push(starGeometry, starMaterial)
    scene.add(new THREE.Points(starGeometry, starMaterial))

    const coreGeometry = new THREE.BufferGeometry()
    const coreAttr = new THREE.BufferAttribute(corePos, 3)
    coreAttr.setUsage(THREE.DynamicDrawUsage)
    coreGeometry.setAttribute('position', coreAttr)
    coreGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array([0.6, 0.5, 0.36, 0.45, 0.5, 0.6]),
        3
      )
    )
    const coreMaterial = new THREE.PointsMaterial({
      size: 4.5 * renderer.getPixelRatio(),
      map: spriteTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    disposables.push(coreGeometry, coreMaterial)
    scene.add(new THREE.Points(coreGeometry, coreMaterial))

    const syncUI = () => {
      if (sliderRef.current && !scrubbing.current) {
        sliderRef.current.value = String(curStep)
      }
      if (readoutRef.current) {
        const gyr = (curStep / STEPS_TOTAL) * GYR_TOTAL
        readoutRef.current.textContent = `t + ${gyr.toFixed(2)} Gyr`
      }
    }

    let frameId = 0
    let last = performance.now()
    let acc = 0
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now

      if (playingRef.current && targetStep.current < STEPS_TOTAL) {
        acc += dt * PLAY_RATE
        const whole = Math.floor(acc)
        if (whole > 0) {
          acc -= whole
          targetStep.current = Math.min(STEPS_TOTAL, targetStep.current + whole)
        }
      }

      const target = Math.round(targetStep.current)
      let moved = false
      if (target < curStep) {
        initSim() // rewind = re-run the universe
        moved = true // buffers changed even if no steps follow (target 0)
      }
      let budget = CATCHUP
      while (curStep < target && budget-- > 0) {
        stepSim()
        moved = true
      }
      if (moved) {
        posAttr.needsUpdate = true
        coreAttr.needsUpdate = true
        syncUI()
        if (playingRef.current && curStep >= STEPS_TOTAL) setPlay(false)
      }

      controls.update()
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(animate)
    mount.style.opacity = '1'
    syncUI()

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameId)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div
        ref={mountRef}
        className="fixed inset-0 bg-black opacity-0 transition-opacity duration-1000"
      />
      <div className="absolute right-6 top-16 z-10 flex w-[min(340px,calc(100vw-3rem))] items-center gap-3 md:right-10 md:top-10 md:w-[340px] [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
        <button
          type="button"
          aria-label={playing ? 'pause' : 'play'}
          className="font-readout w-5 shrink-0 cursor-pointer text-left text-neutral-200 eh-hover-bright"
          onClick={() => {
            if (!playing && targetStep.current >= STEPS_TOTAL) {
              targetStep.current = 0 // replay from the top
            }
            setPlay(!playing)
          }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input
          ref={sliderRef}
          type="range"
          min={0}
          max={STEPS_TOTAL}
          step={1}
          defaultValue={0}
          aria-label="simulation time"
          className="eh-range h-1 flex-1 cursor-pointer"
          onPointerDown={() => {
            scrubbing.current = true
          }}
          onPointerUp={() => {
            scrubbing.current = false
          }}
          onInput={(event) => {
            targetStep.current = Number(event.currentTarget.value)
          }}
        />
        <span
          ref={readoutRef}
          className="font-readout w-[92px] shrink-0 text-right text-neutral-400"
        >
          t + 0.00 Gyr
        </span>
      </div>
    </>
  )
}
