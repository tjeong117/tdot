'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* Pillars of Creation (Eagle Nebula, M16) — NASA / ESA / CSA / STScI, JWST
   NIRCam 2022 (public NASA imagery). Reconstructed as a particle volume:
   every sufficiently bright pixel becomes a particle, with depth extruded
   from luminance plus noise, so the nebula gains real parallax under the
   camera's drift and the pointer's tilt. */

const IMG_URL = '/misc/pillars.jpg'
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

    const fitCamera = () => {
      const aspect = mount.clientWidth / mount.clientHeight
      camera.aspect = aspect
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      // frame most of the image height so the pillars read as pillars;
      // empty space around them is just space
      const zh = imageH / 2 / tan
      const zw = W / 2 / (tan * aspect)
      camera.position.set(0, 0, Math.max(zh * 0.8, zw))
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

    const buildParticles = (img: HTMLImageElement) => {
      const isSmall = window.innerWidth < 768
      const sampleW = isSmall ? 190 : 340
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
      // scale each particle's color down to conserve the image's exposure
      const exposure = 0.62
      const saturation = 1.35
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
    img.src = IMG_URL
    img.onload = () => buildParticles(img)

    // pointer tilt + slow sway
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
  }, [])

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 bg-black opacity-0 transition-opacity duration-[1500ms]"
    />
  )
}
