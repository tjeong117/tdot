'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function BlackHole() {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      70,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    camera.position.set(0, 7, 20)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4
    // OrbitControls sets touch-action: none; allow vertical swipes to scroll the page
    renderer.domElement.style.touchAction = 'pan-y'

    const disposables: { dispose: () => void }[] = []

    // Soft radial sprite shared by all particle systems
    const makeSpriteTexture = (stops: [number, string][]) => {
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      const g = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
      )
      for (const [offset, color] of stops) g.addColorStop(offset, color)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      const texture = new THREE.CanvasTexture(canvas)
      disposables.push(texture)
      return texture
    }

    const particleTexture = makeSpriteTexture([
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ])

    // Event horizon
    const blackHoleGeometry = new THREE.SphereGeometry(1, 128, 128)
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    disposables.push(blackHoleGeometry, blackHoleMaterial)
    scene.add(new THREE.Mesh(blackHoleGeometry, blackHoleMaterial))

    // Photon-ring glow hugging the horizon, drawn as a rim around the black sphere
    const glowTexture = makeSpriteTexture([
      [0, 'rgba(255,190,120,0.9)'],
      [0.25, 'rgba(255,160,80,0.35)'],
      [0.6, 'rgba(120,60,40,0.08)'],
      [1, 'rgba(0,0,0,0)'],
    ])
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
    disposables.push(glowMaterial)
    const glow = new THREE.Sprite(glowMaterial)
    glow.scale.set(7, 7, 1)
    scene.add(glow)

    // Warm halo lying in the disk plane
    const haloTexture = makeSpriteTexture([
      [0, 'rgba(0,0,0,0)'],
      [0.14, 'rgba(0,0,0,0)'],
      [0.2, 'rgba(255,200,140,0.55)'],
      [0.32, 'rgba(255,140,60,0.2)'],
      [1, 'rgba(0,0,0,0)'],
    ])
    const haloGeometry = new THREE.PlaneGeometry(16, 16)
    const haloMaterial = new THREE.MeshBasicMaterial({
      map: haloTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    })
    disposables.push(haloGeometry, haloMaterial)
    const halo = new THREE.Mesh(haloGeometry, haloMaterial)
    halo.rotation.x = -Math.PI / 2
    scene.add(halo)

    // --- Physics Constants ---
    const GM = 50.0 // Gravitational constant times mass (arbitrary units)
    const epsilon = 0.0001 // Softening factor to avoid singularities
    const frameDraggingStrength = 0.05 // Spin axis is +Y

    const isSmallScreen = window.innerWidth < 768

    // Accretion temperature ramp: white-hot at the horizon out to dim violet
    const cHot = new THREE.Color(0xffffff)
    const cGold = new THREE.Color(0xffc46b)
    const cEmber = new THREE.Color(0xff7a2a)
    const cFar = new THREE.Color(0x53306b)
    const tempColor = new THREE.Color()
    const colorForRadius = (r: number) => {
      if (r < 4) return tempColor.copy(cHot).lerp(cGold, (r - 1.2) / 2.8)
      if (r < 10) return tempColor.copy(cGold).lerp(cEmber, (r - 4) / 6)
      return tempColor.copy(cEmber).lerp(cFar, Math.min((r - 10) / 20, 1))
    }

    // --- Particle System Creation ---
    // Particles start in a spherical shell with roughly circular orbital velocity.
    const createParticleSystem = (
      count: number,
      minRadius: number,
      maxRadius: number,
      size: number,
      dtFactor: number
    ) => {
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      const velocities = new Float32Array(count * 3)
      const colors = new Float32Array(count * 3)

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const radius = minRadius + Math.random() * (maxRadius - minRadius)
        const theta = Math.random() * 2 * Math.PI
        const phi = Math.acos(2 * Math.random() - 1)

        const x = radius * Math.sin(phi) * Math.cos(theta)
        const y = radius * Math.sin(phi) * Math.sin(theta)
        const z = radius * Math.cos(phi)
        positions[i3] = x
        positions[i3 + 1] = y
        positions[i3 + 2] = z

        const posVec = new THREE.Vector3(x, y, z)
        const tangent = new THREE.Vector3()
        if (Math.abs(posVec.y) < 0.99 * posVec.length()) {
          tangent.crossVectors(posVec, new THREE.Vector3(0, 1, 0))
        } else {
          tangent.crossVectors(posVec, new THREE.Vector3(1, 0, 0))
        }
        tangent.normalize()
        const speed = Math.sqrt(GM / radius)
        tangent.multiplyScalar(speed)
        velocities[i3] = tangent.x
        velocities[i3 + 1] = tangent.y
        velocities[i3 + 2] = tangent.z

        const c = colorForRadius(radius)
        colors[i3] = c.r
        colors[i3 + 1] = c.g
        colors[i3 + 2] = c.b
      }

      const material = new THREE.PointsMaterial({
        size: size,
        map: particleTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      disposables.push(geometry, material)

      const particles = new THREE.Points(geometry, material)
      scene.add(particles)

      return { particles, positions, velocities, dtFactor }
    }

    const dpr = renderer.getPixelRatio()
    const innerParticles = createParticleSystem(
      isSmallScreen ? 25000 : 90000,
      1.2, // just outside the event horizon (r = 1)
      30,
      0.05 * dpr,
      0.02
    )
    const outerParticles = createParticleSystem(
      isSmallScreen ? 40000 : 160000,
      3,
      9,
      0.04 * dpr,
      0.01
    )

    // --- Background starfield (static, far away) ---
    const starCount = isSmallScreen ? 1500 : 5000
    const starPositions = new Float32Array(starCount * 3)
    const starColors = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3
      const radius = 150 + Math.random() * 250
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)
      starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[i3 + 2] = radius * Math.cos(phi)
      const brightness = 0.4 + Math.random() * 0.6
      const blueTint = Math.random() * 0.15
      starColors[i3] = brightness - blueTint
      starColors[i3 + 1] = brightness - blueTint * 0.5
      starColors[i3 + 2] = brightness
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))
    const starMaterial = new THREE.PointsMaterial({
      size: 1.1,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    })
    disposables.push(starGeometry, starMaterial)
    scene.add(new THREE.Points(starGeometry, starMaterial))

    // --- Animation Loop ---
    // Scalar math (no Vector3 allocations or calls) keeps 250k particles at 60fps.
    // Velocity update = gravitational pull + frame-dragging term, then integrate.
    let frameId: number

    const updateParticles = (system: ReturnType<typeof createParticleSystem>) => {
      const dt = system.dtFactor
      const { positions, velocities } = system
      for (let i = 0; i < positions.length; i += 3) {
        const px = positions[i]
        const py = positions[i + 1]
        const pz = positions[i + 2]
        const r2 = px * px + py * py + pz * pz
        const invR3 = 1 / (r2 * Math.sqrt(r2) + epsilon)

        // a = -GM * r_vec / (r^3 + epsilon)
        const gScale = -GM * invR3
        const vx = velocities[i]
        const vy = velocities[i + 1]
        const vz = velocities[i + 2]
        // a_drag = v x spin / (r^3 + epsilon), spin = (0,1,0) => (-vz, 0, vx)
        const dragScale = frameDraggingStrength * invR3
        const ax = px * gScale - vz * dragScale
        const ay = py * gScale
        const az = pz * gScale + vx * dragScale

        const nvx = vx + ax * dt
        const nvy = vy + ay * dt
        const nvz = vz + az * dt
        velocities[i] = nvx
        velocities[i + 1] = nvy
        velocities[i + 2] = nvz

        positions[i] = px + nvx * dt
        positions[i + 1] = py + nvy * dt
        positions[i + 2] = pz + nvz * dt
      }
      system.particles.geometry.attributes.position.needsUpdate = true
    }

    const animate = () => {
      frameId = requestAnimationFrame(animate)
      updateParticles(innerParticles)
      updateParticles(outerParticles)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Fade the scene in once the first frames are up
    requestAnimationFrame(() => {
      mount.style.opacity = '1'
    })

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
    <div
      ref={mountRef}
      className="absolute inset-0 bg-black opacity-0 transition-opacity duration-1000"
    />
  )
}
