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
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    camera.position.set(0, 3, 8)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.enableZoom = false
    controls.enablePan = false
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.3
    // OrbitControls sets touch-action: none; allow vertical swipes to scroll the page
    renderer.domElement.style.touchAction = 'pan-y'

    // Event horizon
    const blackHoleGeometry = new THREE.SphereGeometry(1, 128, 128)
    const blackHoleMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 1,
    })
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial)
    scene.add(blackHole)

    // --- Physics Constants ---
    const GM = 50.0 // Gravitational constant times mass (arbitrary units)
    const epsilon = 0.0001 // Softening factor to avoid singularities
    const spin = new THREE.Vector3(0, 1, 0) // Black hole spin axis
    const frameDraggingStrength = 0.05

    const isSmallScreen = window.innerWidth < 768

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
      }

      // Round sprite texture for the particles
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      const textureSize = 64
      canvas.width = textureSize
      canvas.height = textureSize
      context.beginPath()
      context.arc(textureSize / 2, textureSize / 2, textureSize / 2, 0, 2 * Math.PI)
      context.fillStyle = 'white'
      context.fill()
      const texture = new THREE.CanvasTexture(canvas)

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size: size,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        alphaMap: texture,
        alphaTest: 0.5,
      })

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      const particles = new THREE.Points(geometry, material)
      scene.add(particles)

      return { particles, positions, velocities, dtFactor, geometry, material, texture }
    }

    const innerParticles = createParticleSystem(
      isSmallScreen ? 15000 : 50000,
      1.2, // just outside the event horizon (r = 1)
      30,
      0.02,
      0.02
    )
    const outerParticles = createParticleSystem(
      isSmallScreen ? 30000 : 100000,
      3,
      8,
      0.015,
      0.01
    )

    // --- Animation Loop ---
    // Velocity update = gravitational pull + frame-dragging term, then integrate position.
    let frameId: number
    const tempPos = new THREE.Vector3()
    const tempAccel = new THREE.Vector3()
    const tempAccel2 = new THREE.Vector3()
    const tempVel = new THREE.Vector3()

    const updateParticles = (system: ReturnType<typeof createParticleSystem>) => {
      const dt = system.dtFactor
      const { positions, velocities } = system
      for (let i = 0; i < positions.length; i += 3) {
        tempPos.set(positions[i], positions[i + 1], positions[i + 2])
        const r = tempPos.length()

        // a = -GM * r_vec / (r^3 + epsilon)
        tempAccel.copy(tempPos).multiplyScalar(-GM / (r * r * r + epsilon))

        tempVel.set(velocities[i], velocities[i + 1], velocities[i + 2])
        // a_drag ~ v x spin / (r^3 + epsilon)
        tempAccel2
          .copy(tempVel)
          .cross(spin)
          .multiplyScalar(frameDraggingStrength / (r * r * r + epsilon))

        velocities[i] += (tempAccel.x + tempAccel2.x) * dt
        velocities[i + 1] += (tempAccel.y + tempAccel2.y) * dt
        velocities[i + 2] += (tempAccel.z + tempAccel2.z) * dt

        positions[i] += velocities[i] * dt
        positions[i + 1] += velocities[i + 1] * dt
        positions[i + 2] += velocities[i + 2] * dt
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
      for (const system of [innerParticles, outerParticles]) {
        system.geometry.dispose()
        system.material.dispose()
        system.texture.dispose()
      }
      blackHoleGeometry.dispose()
      blackHoleMaterial.dispose()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="absolute inset-0 bg-black" />
}
