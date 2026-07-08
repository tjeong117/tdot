'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MirrorLoader } from './mirror-loader'

/* A true 3D reconstruction of NASA's 2019 black hole visualization
   (Jeremy Schnittman, NASA GSFC — public NASA imagery).

   Instead of extruding the flat image, the image is used as measurement:
   - The edge-on disk band is collapsed into a radial brightness/color
     profile, which seeds a real three-dimensional annulus of ~140k
     particles on genuine Keplerian orbits (inner disk outruns the outer).
   - Doppler beaming is computed live: particles moving toward the camera
     brighten, so the bright side always faces the approaching flow no
     matter where you orbit.
   - The lensed halo (the far side of the disk bent over and under the
     shadow) is axisymmetric in reality, so its image always faces the
     observer: the halo billboards to the camera, which is physically what
     a real black hole's lensed image does as you move around it. */

const IMG_URL = '/misc/blackhole-src.jpg'
const W = 170 // world width of the source image
const R_IN = 20
const R_OUT = 85
const SHADOW_R = 13
const BEAM = 0.8 // doppler beaming strength

export function Gargantua() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)

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
    camera.position.set(0, 26, 128)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    // pass sRGB colors through untouched (no double gamma)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.touchAction = 'none'

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = false
    controls.minDistance = 55
    controls.maxDistance = 300
    // keep the view near the disk plane, where the lensed geometry is honest
    controls.minPolarAngle = 0.9
    controls.maxPolarAngle = 2.25
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.25

    const disposables: { dispose: () => void }[] = []
    let frameId = 0

    // event horizon
    const shadowGeometry = new THREE.SphereGeometry(SHADOW_R, 64, 64)
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    disposables.push(shadowGeometry, shadowMaterial)
    scene.add(new THREE.Mesh(shadowGeometry, shadowMaterial))

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

    // filled by buildScene
    const haloGroup = new THREE.Group()
    scene.add(haloGroup)
    let positions: Float32Array | null = null
    let colors: Float32Array | null = null
    let baseColors: Float32Array | null = null
    let posAttr: THREE.BufferAttribute | null = null
    let colAttr: THREE.BufferAttribute | null = null
    let radius: Float32Array | null = null
    let height: Float32Array | null = null
    let theta0: Float32Array | null = null
    let omega: Float32Array | null = null
    let count = 0

    const buildScene = (img: HTMLImageElement) => {
      const isSmall = window.innerWidth < 768
      const sw = 640
      const sh = Math.round((sw * img.height) / img.width)
      const imageH = (W * img.height) / img.width

      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sw, sh)
      const data = ctx.getImageData(0, 0, sw, sh).data

      // the disk band = the brightest pixel row
      let bandRow = 0
      let bandBest = -1
      for (let v = 0; v < sh; v++) {
        let sum = 0
        for (let u = 0; u < sw; u++) {
          const i = (v * sw + u) * 4
          sum += data[i] + data[i + 1] + data[i + 2]
        }
        if (sum > bandBest) {
          bandBest = sum
          bandRow = v
        }
      }
      const bandY = -(bandRow / sh - 0.5) * imageH
      const bandHalf = imageH * 0.055

      // --- radial color/brightness profile measured from the band ---
      const NB = 96
      const acc = Array.from({ length: NB }, () => [0, 0, 0, 0, 0]) // r,g,b,lum,n
      const exposure = 0.5
      const saturation = 1.1
      const haloPos: number[] = []
      const haloCol: number[] = []
      for (let v = 0; v < sh; v++) {
        for (let u = 0; u < sw; u++) {
          const i = (v * sw + u) * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < 0.03) continue
          const x = (u / sw - 0.5) * W
          const y = -(v / sh - 0.5) * imageH
          const dy = Math.abs(y - bandY)
          if (dy < bandHalf) {
            const bucket = Math.min(
              NB - 1,
              Math.floor((Math.abs(x) / (W / 2)) * NB)
            )
            acc[bucket][0] += r
            acc[bucket][1] += g
            acc[bucket][2] += b
            acc[bucket][3] += lum
            acc[bucket][4]++
            // feather: keep band pixels near the strip's edge in the halo
            // too, so the lensed dome connects to the disk without a hard
            // black gap when viewed edge-on
            if (Math.random() < Math.pow(dy / bandHalf, 2.2)) {
              haloPos.push(
                x + gauss() * 0.15,
                y - bandY + gauss() * 0.15,
                gauss() * 1.2
              )
              haloCol.push(
                Math.max(0, lum + (r - lum) * saturation) * exposure,
                Math.max(0, lum + (g - lum) * saturation) * exposure,
                Math.max(0, lum + (b - lum) * saturation) * exposure
              )
            }
          } else {
            // lensed halo, kept as the measured image, billboarded later
            haloPos.push(x + gauss() * 0.15, y - bandY + gauss() * 0.15, gauss() * 1.2)
            haloCol.push(
              Math.max(0, lum + (r - lum) * saturation) * exposure,
              Math.max(0, lum + (g - lum) * saturation) * exposure,
              Math.max(0, lum + (b - lum) * saturation) * exposure
            )
          }
        }
      }
      const profile: [number, number, number, number][] = []
      let lastFilled: [number, number, number, number] = [0.6, 0.25, 0.08, 0.2]
      for (let bIdx = 0; bIdx < NB; bIdx++) {
        const [r, g, b, lum, n] = acc[bIdx]
        if (n > 3) {
          lastFilled = [r / n, g / n, b / n, lum / n]
        }
        profile.push(lastFilled)
      }

      // --- halo points ---
      const haloGeometry = new THREE.BufferGeometry()
      haloGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(haloPos, 3)
      )
      haloGeometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(haloCol, 3)
      )
      const haloMaterial = new THREE.PointsMaterial({
        size: (W / sw) * 2.3 * renderer.getPixelRatio(),
        map: spriteTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      disposables.push(haloGeometry, haloMaterial)
      const haloPoints = new THREE.Points(haloGeometry, haloMaterial)
      haloPoints.position.y = 0 // arcs are centered on the shadow
      haloGroup.add(haloPoints)

      // --- true 3D disk seeded from the radial profile ---
      count = isSmall ? 50000 : 140000
      positions = new Float32Array(count * 3)
      colors = new Float32Array(count * 3)
      baseColors = new Float32Array(count * 3)
      radius = new Float32Array(count)
      height = new Float32Array(count)
      theta0 = new Float32Array(count)
      omega = new Float32Array(count)

      // radius CDF weighted by measured brightness x circumference
      const cdf: number[] = []
      let total = 0
      for (let bIdx = 0; bIdx < NB; bIdx++) {
        const rMid = ((bIdx + 0.5) / NB) * (W / 2)
        const w =
          rMid < R_IN || rMid > R_OUT ? 0 : Math.pow(profile[bIdx][3], 1.2) * rMid
        total += w
        cdf.push(total)
      }

      for (let i = 0; i < count; i++) {
        const pick = Math.random() * total
        let bIdx = 0
        while (cdf[bIdx] < pick && bIdx < NB - 1) bIdx++
        const r = ((bIdx + Math.random()) / NB) * (W / 2)
        const th = Math.random() * Math.PI * 2
        radius[i] = r
        theta0[i] = th
        height[i] = gauss() * (0.65 + 0.026 * r)
        omega[i] = 0.42 * Math.pow(r / R_IN, -1.5)
        const [pr, pg, pb, plum] = profile[bIdx]
        const scale = 0.34
        baseColors[i * 3] = Math.max(0, plum + (pr - plum) * 1.25) * scale
        baseColors[i * 3 + 1] = Math.max(0, plum + (pg - plum) * 1.25) * scale
        baseColors[i * 3 + 2] = Math.max(0, plum + (pb - plum) * 1.25) * scale
      }

      const geometry = new THREE.BufferGeometry()
      posAttr = new THREE.BufferAttribute(positions, 3)
      colAttr = new THREE.BufferAttribute(colors, 3)
      geometry.setAttribute('position', posAttr)
      geometry.setAttribute('color', colAttr)
      const material = new THREE.PointsMaterial({
        size: 0.85 * renderer.getPixelRatio(),
        map: spriteTexture,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      disposables.push(geometry, material)
      scene.add(new THREE.Points(geometry, material))

      mount.style.opacity = '1'
      setReady(true)
    }

    const img = new Image()
    img.src = IMG_URL
    img.onload = () => buildScene(img)

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (prefersReducedMotion) controls.autoRotate = false

    let last = performance.now()
    let t = 0
    const animate = (now: number) => {
      frameId = requestAnimationFrame(animate)
      const dt = (now - last) / 1000
      last = now
      if (!prefersReducedMotion) t += dt

      if (positions && colors && baseColors && posAttr && colAttr && radius) {
        // camera direction in the disk plane, for doppler beaming
        const cLen = Math.hypot(camera.position.x, camera.position.z) || 1
        const cx = camera.position.x / cLen
        const cz = camera.position.z / cLen
        for (let i = 0; i < count; i++) {
          const th = theta0![i] + omega![i] * t
          const cosT = Math.cos(th)
          const sinT = Math.sin(th)
          const i3 = i * 3
          positions[i3] = radius[i] * cosT
          positions[i3 + 1] = height![i]
          positions[i3 + 2] = radius[i] * sinT
          // prograde velocity direction is (-sin, 0, cos)
          const beam = Math.max(
            0.15,
            Math.min(2.5, 1 + BEAM * (-sinT * cx + cosT * cz))
          )
          colors[i3] = baseColors[i3] * beam
          colors[i3 + 1] = baseColors[i3 + 1] * beam
          colors[i3 + 2] = baseColors[i3 + 2] * beam
        }
        posAttr.needsUpdate = true
        colAttr.needsUpdate = true
      }

      // the lensed image of an axisymmetric disk always faces the observer
      haloGroup.rotation.y = Math.atan2(camera.position.x, camera.position.z)

      controls.update()
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
      cancelAnimationFrame(frameId)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={mountRef}
        className="fixed inset-0 bg-black opacity-0 transition-opacity duration-[1500ms]"
      />
      <MirrorLoader done={ready} />
    </>
  )
}
