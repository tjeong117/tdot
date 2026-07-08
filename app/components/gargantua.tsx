'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/* NASA's 2019 black hole visualization (Jeremy Schnittman, NASA GSFC —
   public NASA imagery), rebuilt with the same technique as the Pillars:
   every bright pixel becomes a particle with depth extruded from luminance.
   Then it's set in motion — each particle is placed on a circular Keplerian
   orbit around the vertical axis through the shadow, with angular speed
   falling off as r^-1.5, so the inner disk visibly outruns the outer disk
   and the lensed halo swirls like a crown. */

const IMG_URL = '/misc/blackhole-src.jpg'
const W = 170 // world width of the reconstruction

export function Gargantua() {
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
    let imageH = (W * 9) / 16

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
      // start with the whole structure in frame, with margin to spare
      const zh = imageH / 2 / tan
      const zw = W / 2 / (tan * aspect)
      coverZ = Math.max(zh, zw) * 1.15
      camera.updateProjectionMatrix()
      applyView()
    }
    fitCamera()

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

    // orbit state, filled once the image is sampled.
    // kind 0 = disk band: revolves in x-z around the vertical axis, sweeping
    //   the edge-on band into a true volumetric disk.
    // kind 1 = lensed halo: rotates in the image plane around the shadow, so
    //   the arcs slide along themselves and keep their shape.
    let positions: Float32Array | null = null
    let posAttr: THREE.BufferAttribute | null = null
    let kind: Uint8Array | null = null
    let orbitR: Float32Array | null = null
    let fixedC: Float32Array | null = null
    let theta0: Float32Array | null = null
    let omega: Float32Array | null = null
    let bandY = 0
    let count = 0

    const buildParticles = (img: HTMLImageElement) => {
      const isSmall = window.innerWidth < 768
      const sampleW = isSmall ? 360 : 800
      const sampleH = Math.round((sampleW * img.height) / img.width)
      imageH = (W * img.height) / img.width
      fitCamera()

      const canvas = document.createElement('canvas')
      canvas.width = sampleW
      canvas.height = sampleH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(img, 0, 0, sampleW, sampleH)
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data

      const H = imageH
      // the disk band = the brightest pixel row; halo = everything else
      let bandRow = 0
      let bandBest = -1
      for (let v = 0; v < sampleH; v++) {
        let sum = 0
        for (let u = 0; u < sampleW; u++) {
          const i = (v * sampleW + u) * 4
          sum += data[i] + data[i + 1] + data[i + 2]
        }
        if (sum > bandBest) {
          bandBest = sum
          bandRow = v
        }
      }
      bandY = -(bandRow / sampleH - 0.5) * H
      const bandHalf = H * 0.055

      const pos: number[] = []
      const col: number[] = []
      const kd: number[] = []
      const oR: number[] = []
      const fx: number[] = []
      const th: number[] = []
      const om: number[] = []
      const exposure = 0.6
      const saturation = 1.2
      for (let v = 0; v < sampleH; v++) {
        for (let u = 0; u < sampleW; u++) {
          const i = (v * sampleW + u) * 4
          const r = data[i] / 255
          const g = data[i + 1] / 255
          const b = data[i + 2] / 255
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          if (lum < 0.03) continue
          const x = (u / sampleW - 0.5) * W + gauss() * 0.15
          const y = -(v / sampleH - 0.5) * H + gauss() * 0.15
          const z = Math.pow(lum, 1.3) * 14 + gauss() * (1.2 + 5 * lum) - 6
          if (Math.abs(y - bandY) < bandHalf) {
            // disk band: slow Keplerian revolution about the vertical axis
            const radius = Math.hypot(x, z)
            kd.push(0)
            oR.push(radius)
            fx.push(y)
            th.push(Math.atan2(z, x))
            om.push(0.04 + Math.min(0.16, 10 / Math.pow(Math.max(radius, 10), 1.5)))
          } else {
            // lensed halo: slide along the ring in the image plane
            const rho = Math.hypot(x, y - bandY)
            kd.push(1)
            oR.push(rho)
            fx.push(z)
            th.push(Math.atan2(y - bandY, x))
            // the halo's shape only reads right in its original orientation,
            // so instead of circulating it shimmers: particles oscillate
            // along their arcs as a radial traveling wave (this slot stores
            // the wave phase, not an angular speed)
            om.push(rho * 0.18)
          }
          pos.push(x, y, z)
          col.push(
            Math.max(0, lum + (r - lum) * saturation) * exposure,
            Math.max(0, lum + (g - lum) * saturation) * exposure,
            Math.max(0, lum + (b - lum) * saturation) * exposure
          )
        }
      }

      count = oR.length
      positions = new Float32Array(pos)
      kind = new Uint8Array(kd)
      orbitR = new Float32Array(oR)
      fixedC = new Float32Array(fx)
      theta0 = new Float32Array(th)
      omega = new Float32Array(om)

      const geometry = new THREE.BufferGeometry()
      posAttr = new THREE.BufferAttribute(positions, 3)
      geometry.setAttribute('position', posAttr)
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
      const material = new THREE.PointsMaterial({
        size: (W / sampleW) * 2.3,
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
      targetRY = (e.clientX / window.innerWidth - 0.5) * 0.5
      targetRX = (e.clientY / window.innerHeight - 0.5) * 0.3
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
      if (!prefersReducedMotion) t += dt

      if (positions && posAttr && kind && orbitR && fixedC && theta0 && omega) {
        for (let i = 0; i < count; i++) {
          const i3 = i * 3
          if (kind[i] === 0) {
            const angle = theta0[i] + omega[i] * t
            positions[i3] = orbitR[i] * Math.cos(angle)
            positions[i3 + 1] = fixedC[i]
            positions[i3 + 2] = orbitR[i] * Math.sin(angle)
          } else {
            const angle =
              theta0[i] + 0.07 * Math.sin(0.5 * t + omega[i])
            positions[i3] = orbitR[i] * Math.cos(angle)
            positions[i3 + 1] = bandY + orbitR[i] * Math.sin(angle)
            positions[i3 + 2] = fixedC[i]
          }
        }
        posAttr.needsUpdate = true
      }

      const damp = zoom > 1.3 ? 0.3 : 1 // calm the tilt while zoomed in
      group.rotation.y += (targetRY * damp - group.rotation.y) * 0.04
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
