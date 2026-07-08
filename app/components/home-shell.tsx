'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/* Apple-style scrollytelling for the home page: the left panel holds ONE
   persistent particle field; as the active card on the right changes, every
   particle flies to its position and color in the next image, morphing one
   nebula into another. Targets are prebuilt in the background after mount so
   transitions are instant. */

export type Scene = {
  key: string // scenes with the same key don't morph between each other
  src: string | null // null = procedural starfield (the sky card)
  caption: string
}

const W = 150 // world width of the panel reconstruction
const MORPH_S = 1.25

export function HomeShell({
  scenes,
  children,
}: {
  scenes: Scene[]
  children: React.ReactNode
}) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  const morphToRef = useRef<(index: number) => void>(() => {})

  // ---- the particle field ----
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const isSmall = window.innerWidth < 768
    const N = isSmall ? 70000 : 180000

    const scene3 = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene3.add(group)

    const disposables: { dispose: () => void }[] = []
    let frameId = 0

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
    disposables.push(spriteTexture)

    const gauss = () => Math.random() + Math.random() - 1

    type Target = { pos: Float32Array; col: Float32Array; coverZ: number }
    const targets = new Map<string, Target>()

    const fitZ = (imageH: number) => {
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      const zh = imageH / 2 / tan
      const zw = W / 2 / (tan * camera.aspect)
      return Math.max(zh, zw) * 1.08
    }

    // sample an image into exactly N particles (duplicate w/ jitter if sparse)
    const buildImageTarget = (img: HTMLImageElement): Target => {
      const sw = 520
      const sh = Math.round((sw * img.height) / img.width)
      const imageH = (W * img.height) / img.width
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sw, sh)
      const data = ctx.getImageData(0, 0, sw, sh).data

      const cand: number[] = [] // packed [x,y,z,r,g,b]
      const saturation = 1.1
      const exposure = 0.55
      for (let v = 0; v < sh; v++) {
        for (let u = 0; u < sw; u++) {
          const i = (v * sw + u) * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < 0.045) continue
          cand.push(
            (u / sw - 0.5) * W,
            -(v / sh - 0.5) * imageH,
            Math.pow(lum, 1.3) * 42 + gauss() * (3 + 10 * lum) - 16,
            Math.max(0, lum + (r - lum) * saturation) * exposure,
            Math.max(0, lum + (g - lum) * saturation) * exposure,
            Math.max(0, lum + (b - lum) * saturation) * exposure
          )
        }
      }
      const M = cand.length / 6
      const pos = new Float32Array(N * 3)
      const col = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        const c = (M > 0 ? (i < M ? i : Math.floor(Math.random() * M)) : 0) * 6
        const jitter = i < M ? 0.12 : 0.45
        pos[i * 3] = cand[c] + gauss() * jitter
        pos[i * 3 + 1] = cand[c + 1] + gauss() * jitter
        pos[i * 3 + 2] = cand[c + 2] + gauss() * jitter
        col[i * 3] = cand[c + 3]
        col[i * 3 + 1] = cand[c + 4]
        col[i * 3 + 2] = cand[c + 5]
      }
      return { pos, col, coverZ: fitZ(imageH) }
    }

    // procedural starfield for the sky card
    const buildStarTarget = (): Target => {
      const imageH = W * 1.3
      const pos = new Float32Array(N * 3)
      const col = new Float32Array(N * 3)
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * W * 0.96
        pos[i * 3 + 1] = (Math.random() - 0.5) * imageH * 0.96
        pos[i * 3 + 2] = gauss() * 9
        const pick = Math.random()
        let r = 0,
          g = 0,
          b = 0
        if (pick < 0.004) {
          // a bright gold star
          r = 0.9
          g = 0.72
          b = 0.38
        } else if (pick < 0.1) {
          const v = 0.22 + Math.random() * 0.3
          r = v * 0.85
          g = v * 0.9
          b = v
        } else {
          const v = Math.pow(Math.random(), 3) * 0.16
          r = g = b = v
        }
        col[i * 3] = r
        col[i * 3 + 1] = g
        col[i * 3 + 2] = b
      }
      return { pos, col, coverZ: fitZ(imageH) }
    }

    const loadTarget = async (s: Scene): Promise<Target> => {
      const cached = targets.get(s.key)
      if (cached) return cached
      let t: Target
      if (!s.src) {
        t = buildStarTarget()
      } else {
        const img = new Image()
        img.src = s.src
        await img.decode()
        t = buildImageTarget(img)
      }
      targets.set(s.key, t)
      return t
    }

    // live buffers
    const positions = new Float32Array(N * 3)
    const colors = new Float32Array(N * 3)
    const geometry = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(positions, 3)
    const colAttr = new THREE.BufferAttribute(colors, 3)
    geometry.setAttribute('position', posAttr)
    geometry.setAttribute('color', colAttr)
    const material = new THREE.PointsMaterial({
      size: (W / 520) * 2.1 * renderer.getPixelRatio(),
      map: spriteTexture,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
    disposables.push(geometry, material)
    scene3.add(new THREE.Points(geometry, material))
    // keep points out of the frustum-culling path while buffers churn
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000)

    // morph state
    let from: Target | null = null
    let to: Target | null = null
    let fromZ = 220
    let t = 1
    let cameraZ = 220
    let currentKey = ''

    const startMorph = (target: Target) => {
      from = {
        pos: positions.slice(),
        col: colors.slice(),
        coverZ: cameraZ,
      }
      fromZ = cameraZ
      to = target
      t = 0
    }

    morphToRef.current = (index: number) => {
      const s = scenes[index]
      if (!s || s.key === currentKey) return
      currentKey = s.key
      loadTarget(s).then((target) => {
        // a later card may have been selected while this one loaded
        if (currentKey === s.key) startMorph(target)
      })
    }

    // boot: show scene 0 immediately, then prebuild the rest in the background
    loadTarget(scenes[0]).then((target) => {
      positions.set(target.pos)
      colors.set(target.col)
      posAttr.needsUpdate = true
      colAttr.needsUpdate = true
      cameraZ = target.coverZ
      currentKey = scenes[0].key
      from = to = target
      mount.style.opacity = '1'
      const rest = scenes.filter((s) => !targets.has(s.key))
      const prebuild = async () => {
        for (const s of rest) {
          await loadTarget(s)
          await new Promise((res) => setTimeout(res, 60))
        }
      }
      prebuild()
    })

    // hover tilt + sway
    let targetRX = 0
    let targetRY = 0
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    const onPointerMove = (e: PointerEvent) => {
      targetRY = (e.clientX / window.innerWidth - 0.5) * 0.4
      targetRX = (e.clientY / window.innerHeight - 0.5) * 0.22
    }
    window.addEventListener('pointermove', onPointerMove)

    const ease = (x: number) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

    let last = performance.now()
    let clock = 0
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = (now - last) / 1000
      last = now
      clock += dt

      if (from && to && t < 1) {
        t = Math.min(1, t + dt / MORPH_S)
        const e = ease(t)
        const fp = from.pos
        const fc = from.col
        const tp = to.pos
        const tc = to.col
        for (let i = 0; i < N * 3; i++) {
          positions[i] = fp[i] + (tp[i] - fp[i]) * e
          colors[i] = fc[i] + (tc[i] - fc[i]) * e
        }
        cameraZ = fromZ + (to.coverZ - fromZ) * e
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      }
      camera.position.set(0, 0, cameraZ)

      const sway = prefersReducedMotion ? 0 : Math.sin(clock * 0.1) * 0.05
      group.rotation.y += (targetRY + sway - group.rotation.y) * 0.04
      group.rotation.x += (targetRX - group.rotation.x) * 0.04
      renderer.render(scene3, camera)
    }
    frameId = requestAnimationFrame(animate)

    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(frameId)
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- card activation drives the morph ----
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const cards = Array.from(rail.querySelectorAll('[data-card]'))
    const indexOf = new Map(cards.map((c, i) => [c, i]))
    const observer = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null
        for (const entry of entries) {
          entry.target.classList.toggle('card-active', entry.isIntersecting)
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry
          }
        }
        if (best) {
          const index = indexOf.get(best.target) ?? 0
          setActive(index)
          morphToRef.current(index)
        }
      },
      { root: rail, threshold: 0.5 }
    )
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="fixed inset-0 z-30 bg-black text-white">
      <div className="absolute inset-0 md:right-1/2">
        <div
          ref={mountRef}
          className="absolute inset-0 bg-black opacity-0 transition-opacity duration-[1500ms]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-6 px-6 md:px-10 [text-shadow:0_1px_3px_rgba(0,0,0,0.95),0_0_14px_rgba(0,0,0,0.8)]">
          <h1 className="text-3xl font-semibold tracking-tighter md:text-4xl">
            Tom Jeong
          </h1>
          <p key={active} className="caption-fade font-readout mt-2 text-neutral-400">
            {scenes[active]?.caption}
          </p>
        </div>
      </div>
      <div
        ref={railRef}
        className="absolute inset-0 md:left-1/2 overflow-y-auto snap-y snap-proximity"
      >
        {children}
      </div>
    </div>
  )
}
