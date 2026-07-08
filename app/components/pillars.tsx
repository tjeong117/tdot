'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* Pillars of Creation (Eagle Nebula, M16) — NASA / ESA / CSA / STScI, JWST
   NIRCam 2022 (public NASA imagery). Reconstructed as a particle volume:
   every sufficiently bright pixel becomes a particle, with depth extruded
   from luminance plus noise, so the nebula gains real parallax under the
   camera's drift and the pointer's tilt. */

const IMG_PORTRAIT = '/misc/pillars.jpg'
const IMG_LANDSCAPE = '/misc/pillars-wide.jpg' // 16:9 crop for laptop screens
const W = 160 // world width of the reconstruction

export function Pillars() {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

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
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const disposables: { dispose: () => void }[] = []
    let frameId = 0
    let imageH = W * 1.7 // corrected once the image loads

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
      // start with the whole image in frame, with a little margin around it
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

    const buildParticles = (img: HTMLImageElement) => {
      const landscape = mount.clientWidth > mount.clientHeight
      const sampleW = landscape ? 800 : 220
      const sampleH = Math.round((sampleW * img.height) / img.width)
      imageH = (W * img.height) / img.width
      fitCamera()

      const canvas = document.createElement('canvas')
      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sampleW, sampleH)
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data

      const positions: number[] = []
      const colors: number[] = []
      const H = imageH
      // additive blending over ~4-6 overlapping soft sprites per pixel:
      // scale each particle's color down to conserve the image's exposure.
      // the landscape framing sits closer, spreading light over more screen
      // pixels, so it needs a hotter exposure
      const exposure = landscape ? 0.9 : 0.62
      const saturation = landscape ? 1.45 : 1.35
      for (let v = 0; v < sampleH; v++) {
        for (let u = 0; u < sampleW; u++) {
          const i = (v * sampleW + u) * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < 0.045) continue
          const x = (u / sampleW - 0.5) * W + gauss() * 0.2
          const y = -(v / sampleH - 0.5) * H + gauss() * 0.2
          const z =
            Math.pow(lum, 1.3) * 46 + gauss() * (3 + 11 * lum) - 18
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
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(colors, 3)
      )
      const material = new THREE.PointsMaterial({
        size: (W / sampleW) * 2.1,
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
    }

    const img = new Image()
    img.src =
      mount.clientWidth > mount.clientHeight ? IMG_LANDSCAPE : IMG_PORTRAIT
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
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'

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
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

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
  }, [])

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 bg-black opacity-0 transition-opacity duration-[1500ms]"
    />
  )
}
