'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* The site's one piece of ornament: a photograph rebuilt as a particle volume,
   sitting as a banner above the masthead. Pixels brighter than lumThreshold
   become points; brightness also pushes them toward the camera, so the nebula
   has real depth and drifts as the pointer moves. Non-interactive by design —
   it never swallows a scroll. */

type ParticleLogoProps = {
  src: string
  height?: number
  worldWidth?: number // world-space width of the image plane
  sampleWidth?: number // sampling grid width; match the source for 1:1 detail
  pointScale?: number // sprite size relative to sample spacing; lower = crisper
  focusY?: number // which band of the image the crop keeps (0 top, 1 bottom)
  exposure?: number
  saturation?: number
  lumThreshold?: number // pixels dimmer than this become no particle
  depthScale?: number // brightness->depth spread, relative to the fullscreen art
}

export function ParticleLogo({
  src,
  height = 170,
  worldWidth = 160,
  sampleWidth = 1400,
  pointScale = 1.75,
  focusY = 0.5,
  exposure = 0.95,
  saturation = 1.1,
  lumThreshold = 0.038,
  depthScale = 0.35,
}: ParticleLogoProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

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

    // how much of the image height survives the crop, as a fraction
    let visibleFraction = 1

    const fitCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight
      camera.aspect = aspect
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      const zh = imageH / 2 / tan
      const zw = W / 2 / (tan * aspect)
      // cover, not contain: fill the strip and crop the image top and bottom,
      // otherwise a 3:2 photo in a 5:1 banner sits tiny between black bars
      const z = Math.min(zh, zw)
      const visH = 2 * z * tan
      visibleFraction = Math.min(1, visH / imageH)
      // slide the crop window to focusY, clamped so it never leaves the image
      const travel = Math.max(0, (imageH - visH) / 2)
      camera.position.set(0, (0.5 - focusY) * 2 * travel, z)
      camera.updateProjectionMatrix()
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

    // the band of image rows the current framing needs, as a half-fraction
    const neededBand = () => Math.min(0.5, visibleFraction * 0.5 * 1.25)

    let points: THREE.Points | null = null
    let builtBand = 0

    const buildParticles = (img: HTMLImageElement) => {
      const sw = sampleWidth
      const sh = Math.round((sw * img.height) / img.width)
      imageH = (W * img.height) / img.width
      fitCamera()

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sw, sh)
      const data = ctx.getImageData(0, 0, sw, sh).data

      // only the cropped band is ever on screen, so don't pay for the rest —
      // that budget buys full source resolution instead. The margin covers the
      // few rows that swing into view as the volume tilts.
      const band = neededBand()
      builtBand = band
      const vFrom = Math.max(0, Math.floor((focusY - band) * sh))
      const vTo = Math.min(sh, Math.ceil((focusY + band) * sh))

      const positions: number[] = []
      const colors: number[] = []
      const H = imageH
      for (let v = vFrom; v < vTo; v++) {
        for (let u = 0; u < sw; u++) {
          const i = (v * sw + u) * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < lumThreshold) continue
          const x = (u / sw - 0.5) * W + gauss() * 0.15
          const y = -(v / sh - 0.5) * H + gauss() * 0.15
          // brightness pushes a point toward the camera. Cover framing sits the
          // camera far closer than the fullscreen version did, so the spread is
          // scaled down to keep the nearest points off the near plane.
          const z =
            (Math.pow(lum, 1.3) * 46 + gauss() * (3 + 11 * lum) - 18) *
            depthScale
          positions.push(x, y, z)
          colors.push(
            Math.max(0, lum + (r - lum) * saturation) * exposure,
            Math.max(0, lum + (g - lum) * saturation) * exposure,
            Math.max(0, lum + (b - lum) * saturation) * exposure
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
        size: (W / sw) * pointScale * renderer.getPixelRatio(),
        map: spriteTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      if (points) {
        group.remove(points)
        points.geometry.dispose()
        ;(points.material as THREE.Material).dispose()
      }
      disposables.push(geometry, material)
      points = new THREE.Points(geometry, material)
      group.add(points)
      mount.style.opacity = '1'
    }

    const img = new Image()
    let loaded: HTMLImageElement | null = null
    img.src = src
    img.onload = () => {
      loaded = img
      buildParticles(img)
    }

    // pointer tilt + slow sway, read from the window so the banner reacts to
    // the cursor anywhere on the page
    let targetRX = 0
    let targetRY = 0
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    const onPointerMove = (e: PointerEvent) => {
      targetRY = (e.clientX / window.innerWidth - 0.5) * 0.42
      targetRX = (e.clientY / window.innerHeight - 0.5) * 0.24
    }
    window.addEventListener('pointermove', onPointerMove)

    let last = performance.now()
    let t = 0
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = (now - last) / 1000
      last = now
      t += dt
      const sway = prefersReducedMotion ? 0 : Math.sin(t * 0.1) * 0.06
      group.rotation.y += (targetRY + sway - group.rotation.y) * 0.04
      group.rotation.x += (targetRX - group.rotation.x) * 0.04
      renderer.render(scene, camera)
    }
    frameId = requestAnimationFrame(animate)

    const handleResize = () => {
      fitCamera()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      // a narrower window shows more of the image than the built band covers;
      // rebuild rather than let empty rows show as black bars
      if (loaded && neededBand() > builtBand + 0.01) buildParticles(loaded)
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

  return <div ref={mountRef} className="particle-logo" style={{ height }} />
}
