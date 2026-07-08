'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { MirrorLoader } from './mirror-loader'

/* Generic image-to-particle-volume reconstruction: every sufficiently bright
   pixel of a (public NASA/ESA) image becomes a particle. Depth comes from
   luminance ('luminance' mode) or, for the deep field, from a flood-fill over
   the thresholded image that gives every galaxy its own depth layer
   ('galaxies' mode). Wheel zooms, drag pans, hover tilts. */

type Src = string | { landscape: string; portrait: string }

export type ParticleImageProps = {
  src: Src
  worldWidth?: number
  sampleWidth?: number // landscape sampling grid width; portrait uses ~45%
  exposure?: number | { landscape: number; portrait: number }
  saturation?: number
  lumThreshold?: number
  depth?: 'luminance' | 'galaxies'
  /* 'explorer' = fullscreen artifact with zoom/pan/loader;
     'panel' = interactive pane (zoom/pan/tilt), absolutely positioned, no loader;
     'background' = page backdrop: hover tilt only, page keeps scrolling */
  variant?: 'explorer' | 'panel' | 'background'
}

export function ParticleImage({
  src,
  worldWidth = 160,
  sampleWidth = 1250,
  exposure = 0.55,
  saturation = 1.1,
  lumThreshold = 0.045,
  depth = 'luminance',
  variant = 'explorer',
}: ParticleImageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = worldWidth

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    // pass colors through untouched: we feed sRGB values from the image, so
    // the default linear->sRGB output transform would wash them out
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const disposables: { dispose: () => void }[] = []
    let frameId = 0
    let imageH = W * 0.6

    // free exploration: wheel zooms, drag pans, hover tilts
    let coverZ = 100
    let zoom = 1
    let panX = 0
    let panY = 0

    const applyView = () => {
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      const z = coverZ / zoom
      const visW = 2 * z * tan * camera.aspect
      const visH = 2 * z * tan
      const maxX = Math.max(0, (W - visW) / 2 + 8)
      const maxY = Math.max(0, (imageH - visH) / 2 + 8)
      panX = Math.max(-maxX, Math.min(maxX, panX))
      panY = Math.max(-maxY, Math.min(maxY, panY))
      camera.position.set(panX, panY, z)
    }

    const fitCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight
      camera.aspect = aspect
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      // whole image in frame, with a little margin around it
      const zh = imageH / 2 / tan
      const zw = W / 2 / (tan * aspect)
      coverZ = Math.max(zh, zw) * 1.12
      camera.updateProjectionMatrix()
      applyView()
    }
    fitCamera()

    // soft sprite
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
    const landscape = mount.clientWidth > mount.clientHeight

    // flood fill over the thresholded mask; returns a per-pixel component id
    // and a per-component depth. Distance comes from a redshift proxy: the
    // redder a galaxy (Doppler-shifted light), the older and farther it is,
    // so red components recede and blue-white ones come near.
    const galaxyDepths = (
      mask: Uint8Array,
      data: Uint8ClampedArray,
      sw: number,
      sh: number
    ) => {
      const labels = new Int32Array(sw * sh).fill(-1)
      const compRedshift: number[] = []
      const stack: number[] = []
      let n = 0
      for (let start = 0; start < sw * sh; start++) {
        if (!mask[start] || labels[start] !== -1) continue
        let sumR = 0
        let sumB = 0
        let area = 0
        stack.push(start)
        labels[start] = n
        while (stack.length) {
          const p = stack.pop()!
          sumR += data[p * 4]
          sumB += data[p * 4 + 2]
          area++
          const px = p % sw
          const py = (p / sw) | 0
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = px + dx
            const ny = py + dy
            if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue
            const np = ny * sw + nx
            if (mask[np] && labels[np] === -1) {
              labels[np] = n
              stack.push(np)
            }
          }
        }
        // mean(R) - mean(B): the redshift proxy
        compRedshift.push((sumR - sumB) / area)
        n++
      }
      const order = compRedshift
        .map((v, i) => [v, i] as const)
        .sort((a, b) => a[0] - b[0])
      const depthOf = new Float32Array(n)
      order.forEach(([, idx], rank) => {
        const pct = n > 1 ? rank / (n - 1) : 0 // 0 = bluest, 1 = reddest
        depthOf[idx] = 25 - 138 * Math.pow(pct, 0.85)
      })
      return { labels, depthOf }
    }

    const buildParticles = (img: HTMLImageElement) => {
      const sw = landscape ? sampleWidth : Math.round(sampleWidth * 0.45)
      const sh = Math.round((sw * img.height) / img.width)
      imageH = (W * img.height) / img.width
      fitCamera()

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sw, sh)
      const data = ctx.getImageData(0, 0, sw, sh).data

      const exp =
        typeof exposure === 'number'
          ? exposure
          : landscape
            ? exposure.landscape
            : exposure.portrait

      // precompute luminance + mask (needed for galaxy labeling)
      const lums = new Float32Array(sw * sh)
      const mask = new Uint8Array(sw * sh)
      for (let p = 0; p < sw * sh; p++) {
        const i = p * 4
        const lum =
          (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255
        lums[p] = lum
        mask[p] = lum >= lumThreshold ? 1 : 0
      }
      const galaxy =
        depth === 'galaxies' ? galaxyDepths(mask, data, sw, sh) : null

      const positions: number[] = []
      const colors: number[] = []
      const H = imageH
      for (let v = 0; v < sh; v++) {
        for (let u = 0; u < sw; u++) {
          const p = v * sw + u
          if (!mask[p]) continue
          const i = p * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = lums[p]
          const x = (u / sw - 0.5) * W + gauss() * 0.15
          const y = -(v / sh - 0.5) * H + gauss() * 0.15
          const z = galaxy
            ? galaxy.depthOf[galaxy.labels[p]] + gauss() * 1.6
            : Math.pow(lum, 1.3) * 46 + gauss() * (3 + 11 * lum) - 18
          positions.push(x, y, z)
          colors.push(
            Math.max(0, lum + (r - lum) * saturation) * exp,
            Math.max(0, lum + (g - lum) * saturation) * exp,
            Math.max(0, lum + (b - lum) * saturation) * exp
          )
        }
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      )
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      const material = new THREE.PointsMaterial({
        // three sizes points in device px from CSS height: scale by the
        // pixel ratio or retina screens render every sprite at half size
        size: (W / sw) * 2.1 * renderer.getPixelRatio(),
        map: spriteTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      disposables.push(geometry, material)
      group.add(new THREE.Points(geometry, material))
      mount.style.opacity = '1'
      setReady(true)
    }

    const img = new Image()
    img.src =
      typeof src === 'string' ? src : landscape ? src.landscape : src.portrait
    img.onload = () => buildParticles(img)

    // pointer tilt + slow sway; drag pans, wheel zooms
    let targetRX = 0
    let targetRY = 0
    let dragging = false
    let lastX = 0
    let lastY = 0
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    const interactive = variant !== 'background'
    if (interactive) {
      renderer.domElement.style.touchAction = 'none'
      renderer.domElement.style.cursor = 'grab'
    }

    const onPointerMove = (e: PointerEvent) => {
      if (dragging) {
        const tan = Math.tan((camera.fov * Math.PI) / 360)
        const z = coverZ / zoom
        panX -= (e.clientX - lastX) * ((2 * z * tan * camera.aspect) / mount.clientWidth)
        panY += (e.clientY - lastY) * ((2 * z * tan) / mount.clientHeight)
        lastX = e.clientX
        lastY = e.clientY
        applyView()
        return
      }
      targetRY = (e.clientX / window.innerWidth - 0.5) * 0.42
      targetRX = (e.clientY / window.innerHeight - 0.5) * 0.24
    }
    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }
    const onPointerUp = (e: PointerEvent) => {
      dragging = false
      renderer.domElement.releasePointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grab'
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom = Math.max(1, Math.min(6, zoom * Math.exp(-e.deltaY * 0.0012)))
      applyView()
    }
    window.addEventListener('pointermove', onPointerMove)
    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    }

    let last = performance.now()
    let t = 0
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = (now - last) / 1000
      last = now
      t += dt
      const sway = prefersReducedMotion ? 0 : Math.sin(t * 0.1) * 0.06
      const damp = zoom > 1.3 ? 0.3 : 1 // calm the tilt while zoomed in
      group.rotation.y += ((targetRY + sway) * damp - group.rotation.y) * 0.04
      group.rotation.x += (targetRX * damp - group.rotation.x) * 0.04
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(animate)

    const handleResize = () => {
      fitCamera()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(frameId)
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
        className={`${
          variant === 'explorer' ? 'fixed' : 'absolute'
        } inset-0 bg-black opacity-0 transition-opacity duration-[1500ms]`}
      />
      {variant === 'explorer' && <MirrorLoader done={ready} />}
    </>
  )
}
