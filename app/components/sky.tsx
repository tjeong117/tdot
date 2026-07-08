'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import skyData from './sky-data.json'

/* Star catalog + constellation figures derived from the HYG database via
   d3-celestial (BSD-3). Coordinates are [lon, dec] in degrees, lon = RA
   mapped to -180..180. The camera sits at the center of the celestial
   sphere looking out, planetarium-style. */

const DEG = Math.PI / 180
const R = 500 // celestial sphere radius

function toVec(lon: number, dec: number, radius = R) {
  const ra = lon * DEG
  const d = dec * DEG
  return new THREE.Vector3(
    radius * Math.cos(d) * Math.cos(ra),
    radius * Math.sin(d),
    -radius * Math.cos(d) * Math.sin(ra)
  )
}

/* Approximate star color from B–V color index (temperature) */
function bvColor(bv: number, out: THREE.Color) {
  if (bv <= 0) {
    out.setRGB(0.67, 0.78, 1.0)
  } else if (bv <= 0.4) {
    const t = bv / 0.4
    out.setRGB(0.67 + 0.33 * t, 0.78 + 0.22 * t, 1.0)
  } else if (bv <= 0.8) {
    const t = (bv - 0.4) / 0.4
    out.setRGB(1.0, 1.0 - 0.08 * t, 1.0 - 0.22 * t)
  } else if (bv <= 1.4) {
    const t = (bv - 0.8) / 0.6
    out.setRGB(1.0, 0.92 - 0.12 * t, 0.78 - 0.23 * t)
  } else {
    out.setRGB(1.0, 0.65, 0.45)
  }
  return out
}

// magnitude buckets -> point size and brightness
const BUCKETS = [
  { max: 0.5, size: 12, lum: 1.0 },
  { max: 1.5, size: 9, lum: 1.0 },
  { max: 2.5, size: 6.6, lum: 0.95 },
  { max: 3.5, size: 4.8, lum: 0.85 },
  { max: 4.5, size: 3.3, lum: 0.72 },
  { max: 99, size: 2.3, lum: 0.58 },
]

export function Sky() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const linesRef = useRef<THREE.Object3D | null>(null)
  const labelsRef = useRef<THREE.Object3D | null>(null)
  const [showFigures, setShowFigures] = useState(true)
  const [showNames, setShowNames] = useState(true)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    )
    camera.position.set(0, 0, 0)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'

    const disposables: { dispose: () => void }[] = []

    // soft round sprite for stars
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteCanvas.height = 64
    const sctx = spriteCanvas.getContext('2d')!
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.9)')
    grad.addColorStop(0.6, 'rgba(255,255,255,0.32)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 64, 64)
    const starTexture = new THREE.CanvasTexture(spriteCanvas)
    disposables.push(starTexture)

    // ---- stars, bucketed by magnitude ----
    const tmpColor = new THREE.Color()
    const buckets: { pos: number[]; col: number[] }[] = BUCKETS.map(() => ({
      pos: [],
      col: [],
    }))
    for (const [lon, dec, mag, bv] of skyData.stars as number[][]) {
      const b = BUCKETS.findIndex((k) => mag <= k.max)
      const v = toVec(lon, dec)
      buckets[b].pos.push(v.x, v.y, v.z)
      bvColor(bv, tmpColor)
      buckets[b].col.push(
        tmpColor.r * BUCKETS[b].lum,
        tmpColor.g * BUCKETS[b].lum,
        tmpColor.b * BUCKETS[b].lum
      )
    }
    buckets.forEach((b, i) => {
      if (!b.pos.length) return
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3))
      const m = new THREE.PointsMaterial({
        size: BUCKETS[i].size,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      disposables.push(g, m)
      scene.add(new THREE.Points(g, m))
    })

    // ---- constellation figures in accretion gold ----
    const linePositions: number[] = []
    for (const polys of Object.values(skyData.lines) as number[][][][]) {
      for (const poly of polys) {
        for (let i = 0; i < poly.length - 1; i++) {
          const a = toVec(poly[i][0], poly[i][1], R * 0.995)
          const b = toVec(poly[i + 1][0], poly[i + 1][1], R * 0.995)
          linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z)
        }
      }
    }
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3)
    )
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    disposables.push(lineGeometry, lineMaterial)
    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSegments)
    linesRef.current = lineSegments

    // ---- constellation name labels (major figures only) ----
    const labelGroup = new THREE.Group()
    const entries = Object.values(skyData.names) as {
      n: string
      p: number[]
      r: number
    }[]
    for (const { n, p, r } of entries) {
      if (r > 2) continue
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 96
      const ctx = canvas.getContext('2d')!
      ctx.font =
        '400 44px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(227,178,100,0.85)'
      ctx.fillText(n.toUpperCase(), 256, 48)
      const tex = new THREE.CanvasTexture(canvas)
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: r === 1 ? 0.5 : 0.32,
        depthWrite: false,
      })
      disposables.push(tex, mat)
      const sprite = new THREE.Sprite(mat)
      sprite.position.copy(toVec(p[0], p[1], R * 0.97))
      sprite.scale.set(56, 10.5, 1)
      labelGroup.add(sprite)
    }
    scene.add(labelGroup)
    labelsRef.current = labelGroup

    // ---- look controls: drag to pan the sky, wheel to zoom fov ----
    let yaw = 82 * DEG // start facing Orion
    let pitch = 8 * DEG
    let dragging = false
    let lastX = 0
    let lastY = 0
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    const applyLook = () => {
      pitch = Math.max(-1.45, Math.min(1.45, pitch))
      const dir = new THREE.Vector3(
        Math.cos(pitch) * Math.cos(yaw),
        Math.sin(pitch),
        -Math.cos(pitch) * Math.sin(yaw)
      )
      camera.lookAt(dir)
    }
    applyLook()

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const scale = (camera.fov / 60) * 0.0022
      yaw += (e.clientX - lastX) * scale
      pitch += (e.clientY - lastY) * scale
      lastX = e.clientX
      lastY = e.clientY
      applyLook()
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      renderer.domElement.releasePointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grab'
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      camera.fov = Math.max(25, Math.min(75, camera.fov + e.deltaY * 0.03))
      camera.updateProjectionMatrix()
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // ---- render loop with slow sidereal drift ----
    let frameId: number
    let last = performance.now()
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = (now - last) / 1000
      last = now
      if (!dragging && !prefersReducedMotion) {
        yaw += 0.004 * dt
        applyLook()
      }
      renderer.render(scene, camera)
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frameId)
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      linesRef.current = null
      labelsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (linesRef.current) linesRef.current.visible = showFigures
  }, [showFigures])
  useEffect(() => {
    if (labelsRef.current) labelsRef.current.visible = showNames
  }, [showNames])

  const toggleClass = (on: boolean) =>
    `font-readout rounded-full px-3 py-1 transition-colors ${
      on
        ? 'eh-pill'
        : 'text-neutral-500 ring-1 ring-inset ring-neutral-700/40 hover:text-neutral-300'
    }`

  return (
    <div className="relative h-[70svh] min-h-[440px] overflow-hidden rounded-2xl border border-neutral-800 bg-black">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
        <p className="font-readout text-neutral-500">
          drag to pan · scroll to zoom
        </p>
        <div className="pointer-events-auto flex gap-2">
          <button
            className={toggleClass(showFigures)}
            onClick={() => setShowFigures((v) => !v)}
          >
            figures
          </button>
          <button
            className={toggleClass(showNames)}
            onClick={() => setShowNames((v) => !v)}
          >
            names
          </button>
        </div>
      </div>
    </div>
  )
}
