/*
 * Component: Object3D
 * Renders a 3D or WebGL-backed object layer used by the editor or visual effects system.
 */

import React, { useEffect, useRef } from 'react'
import { mushuScene, camera, shader3d, crystal, cone, cylinder, sphere, torus } from '../lib/mushu/src/index.js'

// ═══════════════════════════════════════════════════════════════════════════
// 3D Glow Objects — real shader-based glow (fresnel rim + additive halo)
// Uses mushu-flow's shader3d() with a custom GLSL fragment shader so the
// crystal actually glows instead of the washed-out PBR path.
// ═══════════════════════════════════════════════════════════════════════════

// Custom glowing fragment shader.
// - Fresnel rim glow (edge light) for a luminous, "energized" look
// - Additive halo around the silhouette
// - Time-based pulse
// - Double-sided (works regardless of camera angle)
const GLOW_FRAGMENT = /* glsl */`#version 300 es
precision highp float;

in vec3 vPosition;
in vec3 vNormal;
in vec2 vUv;
in vec3 vWorldPosition;

uniform float time;
uniform vec3 cameraPosition;
uniform vec3 glowColor;
uniform vec3 coreColor;
uniform float glowStrength;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPosition);

  // Fresnel rim: brighter at grazing angles (edges glow)
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndv, 2.5);

  // Subtle pulse
  float pulse = 0.85 + 0.15 * sin(time * 2.0);

  // Core body color + fresnel rim
  vec3 col = coreColor * 0.35 + glowColor * fresnel * 2.2;

  // Additive halo near the silhouette
  float halo = pow(fresnel, 1.8) * 1.4;
  col += glowColor * halo;

  // Pulse modulation
  col *= pulse;

  // Glow strength multiplier
  col *= glowStrength;

  // Soft alpha (fade faint regions so it reads as a translucent glow)
  float alpha = clamp(0.35 + fresnel * 1.6 + halo * 0.5, 0.0, 1.0);

  fragColor = vec4(col, alpha);
}`

const GLOW_VERTEX = /* glsl */`#version 300 es
precision highp float;

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec2 uv;

uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 normalMatrix;

out vec3 vPosition;
out vec3 vNormal;
out vec2 vUv;
out vec3 vWorldPosition;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vPosition = position;
  vNormal = mat3(normalMatrix) * normal;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}`

// Map of object model -> preset geometry parts
// Each part is a geometry descriptor + local transform.
const SHAPE_BUILDERS = {
    crystal: {
        label: 'Glowing Crystal',
        build: () => ({
            parts: [
                // Main faceted shard (uses the real crystal geometry)
                { geom: () => crystal({ radius: 0.85, height: 2.4, sides: 6, midRatio: 0.55 }), pos: [0, 0.1, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                // Inner brighter shard
                { geom: () => crystal({ radius: 0.45, height: 2.6, sides: 6, midRatio: 0.5 }), pos: [0, 0.25, 0], rot: [0, 0.4, 0], scale: [1, 1, 1] },
                // Base plinth
                { geom: () => cylinder({ radius: 0.5, radiusTop: 0.6, height: 0.35, radialSegments: 6 }), pos: [0, -1.25, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
            ]
        })
    },
    crystalCluster: {
        label: 'Crystal Cluster',
        build: () => ({
            parts: [
                { geom: () => crystal({ radius: 0.7, height: 2.0, sides: 5 }), pos: [-0.75, -0.1, 0.25], rot: [0, 0.5, -0.35], scale: [1, 0.85, 1] },
                { geom: () => crystal({ radius: 0.95, height: 2.7, sides: 6 }), pos: [0, 0.15, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                { geom: () => crystal({ radius: 0.6, height: 1.9, sides: 5 }), pos: [0.85, -0.1, -0.3], rot: [0, -0.4, 0.3], scale: [1, 0.85, 1] },
                { geom: () => cylinder({ radius: 0.9, height: 0.3, radialSegments: 20 }), pos: [0, -1.35, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
            ]
        })
    },
    orb: {
        label: 'Energy Orb',
        build: () => ({
            parts: [
                { geom: () => sphere({ radius: 1.05, widthSegments: 28, heightSegments: 20 }), pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                { geom: () => sphere({ radius: 0.55, widthSegments: 16, heightSegments: 12 }), pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
            ]
        })
    },
    prism: {
        label: 'Neon Prism',
        build: () => ({
            parts: [
                { geom: () => cylinder({ radius: 0.9, radiusTop: 0.9, height: 1.9, radialSegments: 6 }), pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                { geom: () => cylinder({ radius: 1.15, radiusTop: 1.15, height: 0.25, radialSegments: 6 }), pos: [0, -1.0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                { geom: () => cylinder({ radius: 1.15, radiusTop: 1.15, height: 0.25, radialSegments: 6 }), pos: [0, 1.0, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
            ]
        })
    },
    runestone: {
        label: 'Rune Stone',
        build: () => ({
            parts: [
                { geom: () => cylinder({ radius: 0.85, radiusTop: 0.6, height: 2.3, radialSegments: 6 }), pos: [0, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] },
                { geom: () => cylinder({ radius: 1.15, radiusTop: 1.15, height: 0.3, radialSegments: 20 }), pos: [0, -1.25, 0], rot: [0, 0, 0], scale: [1, 1, 1] }
            ]
        })
    }
}

const hexToRgb = (hex) => {
    const h = (hex || '#4488ff').replace('#', '')
    const norm = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const bigint = parseInt(norm, 16)
    return [((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255]
}

/**
 * Object3D
 * Renders a live 3D mesh (default: glowing crystal) into a canvas using
 * mushu-flow's scene graph and a custom glow shader. Auto-rotates and
 * gently floats for an alive, magical feel.
 *
 * @param {Object} props
 * @param {string} props.model - model key (crystal, crystalCluster, orb, prism, runestone)
 * @param {string} props.color - hex color for the glow
 * @param {boolean} props.autoRotate - whether the object auto-rotates
 * @param {number} props.width - requested render width (CSS)
 * @param {number} props.height - requested render height (CSS)
 */
function Object3D({ model = 'crystal', color = '#4488ff', autoRotate = true, width, height }) {
    const canvasRef = useRef(null)
    const sceneRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        let scene
        try {
            scene = mushuScene(canvas, {
                clearColor: [0, 0, 0, 0] // transparent so it sits on the page
            })
        } catch (e) {
            console.warn('Scene init failed:', e)
            return
        }

        const builder = SHAPE_BUILDERS[model] || SHAPE_BUILDERS.crystal
        const c = hexToRgb(color)
        const glowColor = [c[0], c[1], c[2]]
        const coreColor = [Math.min(1, c[0] * 1.4), Math.min(1, c[1] * 1.4), Math.min(1, c[2] * 1.4)]
        const glowStrength = model === 'orb' ? 1.6 : 1.25

        // Build a custom glowing shader program (double-sided + transparent).
        const glowShader = shader3d(GLOW_VERTEX, GLOW_FRAGMENT, {
            transparent: true,
            cullFace: 'NONE',            // double-sided so it never vanishes
            depthWrite: false,
            blendSrc: 'SRC_ALPHA',
            blendDst: 'ONE_MINUS_SRC_ALPHA',
            uniforms: {
                glowColor,
                coreColor,
                glowStrength
            }
        })
        scene.use(glowShader)

        const parts = builder.build().parts

        // Add each part as a root object sharing the glow shader material.
        let rootObj = null
        parts.forEach((part, idx) => {
            const geom = part.geom()
            const obj = scene.add(`${model}_${idx}`, {
                material: glowShader,
                geometry: geom,
                position: part.pos,
                rotation: part.rot,
                scale: part.scale
            })
            if (idx === 0) rootObj = obj
        })

        // Set up an orbiting camera (projection computed from aspect).
        const cam = camera({
            position: [0, 0.2, 4.6],
            target: [0, 0, 0],
            fov: 46,
            near: 0.1,
            far: 100
        })
        scene.use(cam)
        cam.init(scene.ctx) // populate ctx.state.camera

        // Auto-rotation + gentle float on the root object.
        if (rootObj) {
            const baseY = rootObj.rotation[1] || 0
            rootObj.userData.update = (obj) => {
                if (!autoRotate) return
                obj.rotation[1] = baseY + scene.ctx.time * 0.65
                obj.position[1] = Math.sin(scene.ctx.time * 1.1) * 0.1
            }
        }

        scene.go()
        sceneRef.current = scene

        // Resize handling (keep canvas crisp on DPI changes).
        const onResize = () => {
            try {
                const rect = canvas.getBoundingClientRect()
                const dpr = window.devicePixelRatio || 1
                canvas.width = Math.max(1, rect.width * dpr)
                canvas.height = Math.max(1, rect.height * dpr)
                scene.gl.viewport(0, 0, canvas.width, canvas.height)
                scene.ctx.aspect = canvas.width / canvas.height
                if (typeof cam.resize === 'function') cam.resize(scene.ctx)
            } catch (e) { /* ignore */ }
        }
        window.addEventListener('resize', onResize)

        return () => {
            window.removeEventListener('resize', onResize)
            if (sceneRef.current) {
                try { sceneRef.current.stop() } catch (e) { }
                try { sceneRef.current.destroy() } catch (e) { }
                sceneRef.current = null
            }
        }
    }, [model, color, autoRotate])

    return (
        <canvas
            ref={canvasRef}
            className="obj3d-canvas"
            style={{
                width: '100%',
                height: '100%',
                display: 'block',
                pointerEvents: 'none'
            }}
        />
    )
}

export default Object3D
