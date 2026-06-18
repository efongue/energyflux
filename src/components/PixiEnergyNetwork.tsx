import { memo, useEffect, useMemo, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { formatEnergy } from '../utils/energyUnits'

export type PixiFlowPerformanceLevel = 'normal' | 'reduced' | 'minimal'

export type PixiEnergyFlow = {
  id: string
  path: CubicPath
  color: number
  value: number
  arrivalLabel?: string
  arrivalLabelOffsetX?: number
  width: number
  maxParticles: number
  visible: boolean
  loop?: boolean
  speedMultiplier?: number
}

type CubicPath = {
  start: Point
  cp1: Point
  cp2: Point
  end: Point
}

type Point = {
  x: number
  y: number
}

type ParticleSpec = {
  unit: number
  size: number
  shape: 'circle' | 'diamond'
}

type ParticleView = {
  graphic: Graphics
  active: boolean
  t: number
  speed: number
  unit: number
  color: number
  shape: 'circle' | 'diamond'
  size: number
  drawSignature: string
}

type PixiEnergyNetworkProps = {
  flows: PixiEnergyFlow[]
  performanceLevel: PixiFlowPerformanceLevel
  clickPowerLabel: string
}

type CachedFlowGraphics = {
  shadow: Graphics
  rail: Graphics
  glow: Graphics
  core: Graphics
  width: number
  color: number
  visible: boolean
  active: boolean
}

type SampledPoint = {
  x: number
  y: number
  rotation: number
}

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 620
const PARTICLE_UNITS: ReadonlyArray<{ unit: number; size: number; shape: 'circle' | 'diamond' }> = [
  { unit: 1000, size: 9.5, shape: 'diamond' },
  { unit: 100, size: 7.5, shape: 'circle' },
  { unit: 10, size: 5.7, shape: 'circle' },
  { unit: 1, size: 3.8, shape: 'circle' },
]
const QUALITY_DENSITY: Record<PixiFlowPerformanceLevel, number> = {
  normal: 1,
  reduced: 0.68,
  minimal: 0.42,
}
const FPS_DEGRADE_THRESHOLD = 42
const FPS_RECOVER_THRESHOLD = 28
const HUB_POSITION = { x: 500, y: 279 }
const FLOW_ARRIVAL_LABEL_INTERVAL_SECONDS = 0.9

const STORAGE_CLICK_PATH: CubicPath = {
  start: { x: 462, y: 356 },
  cp1: { x: 440, y: 390 },
  cp2: { x: 420, y: 428 },
  end: { x: 418, y: 456 },
}

const getParticleSpeed = (flow: PixiEnergyFlow) => {
  const baseSpeed = flow.loop === false
    ? 0.18 + Math.min(0.34, Math.log10(Math.max(flow.value, 1)) * 0.045)
    : 1

  return baseSpeed * (flow.speedMultiplier ?? 1)
}

const sampleCubicInto = (path: CubicPath, t: number, out: Point) => {
  const inv = 1 - t
  const inv2 = inv * inv
  const t2 = t * t
  const a = inv2 * inv
  const b = 3 * inv2 * t
  const c = 3 * inv * t2
  const d = t2 * t

  out.x = a * path.start.x + b * path.cp1.x + c * path.cp2.x + d * path.end.x
  out.y = a * path.start.y + b * path.cp1.y + c * path.cp2.y + d * path.end.y
}

const sampleCubicTangentInto = (path: CubicPath, t: number, out: Point) => {
  const inv = 1 - t
  const a = -3 * inv * inv
  const b = 3 * inv * inv - 6 * inv * t
  const c = 6 * inv * t - 3 * t * t
  const d = 3 * t * t

  out.x = a * path.start.x + b * path.cp1.x + c * path.cp2.x + d * path.end.x
  out.y = a * path.start.y + b * path.cp1.y + c * path.cp2.y + d * path.end.y
}

const sampleCubicPath = (path: CubicPath, segments = 120): SampledPoint[] => {
  const points: SampledPoint[] = []
  const scratchPoint: Point = { x: 0, y: 0 }
  const scratchTangent: Point = { x: 0, y: 0 }

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    sampleCubicInto(path, t, scratchPoint)
    sampleCubicTangentInto(path, t, scratchTangent)
    points.push({
      x: scratchPoint.x,
      y: scratchPoint.y,
      rotation: Math.atan2(scratchTangent.y, scratchTangent.x),
    })
  }
  return points
}

const getPathKey = (path: CubicPath) =>
  `${path.start.x}:${path.start.y}:${path.cp1.x}:${path.cp1.y}:${path.cp2.x}:${path.cp2.y}:${path.end.x}:${path.end.y}`

const getSampledPath = (path: CubicPath, cache: Map<string, SampledPoint[]>) => {
  const key = getPathKey(path)
  let sampled = cache.get(key)
  if (!sampled) {
    sampled = sampleCubicPath(path, 120)
    cache.set(key, sampled)
  }
  return sampled
}

const drawCubic = (graphics: Graphics, path: CubicPath) => {
  graphics
    .moveTo(path.start.x, path.start.y)
    .bezierCurveTo(path.cp1.x, path.cp1.y, path.cp2.x, path.cp2.y, path.end.x, path.end.y)
}

const drawHexagon = (graphics: Graphics, x: number, y: number, width: number, height: number) => {
  const halfWidth = width / 2
  const halfHeight = height / 2

  return graphics
    .moveTo(x - halfWidth * 0.5, y - halfHeight)
    .lineTo(x + halfWidth * 0.5, y - halfHeight)
    .lineTo(x + halfWidth, y)
    .lineTo(x + halfWidth * 0.5, y + halfHeight)
    .lineTo(x - halfWidth * 0.5, y + halfHeight)
    .lineTo(x - halfWidth, y)
    .closePath()
}

const drawHubGlow = (graphics: Graphics) => {
  drawHexagon(graphics, HUB_POSITION.x, HUB_POSITION.y, 170, 147)
    .fill({ color: 0x06b6d4, alpha: 0.045 })
    .stroke({ color: 0x67e8f9, width: 3, alpha: 0.35, join: 'miter' })

  drawHexagon(graphics, HUB_POSITION.x, HUB_POSITION.y, 214, 185)
    .stroke({ color: 0x22d3ee, width: 2, alpha: 0.18, join: 'miter' })

  drawHexagon(graphics, HUB_POSITION.x, HUB_POSITION.y, 278, 241)
    .stroke({ color: 0x22d3ee, width: 1, alpha: 0.1, join: 'miter' })
}

const buildParticleSpecs = (value: number, maxParticles: number, density: number): ParticleSpec[] => {
  const absValue = Math.abs(value)
  if (absValue <= 0 || maxParticles <= 0) return []

  let remaining = Math.max(1, Math.floor(absValue))
  const specs: ParticleSpec[] = []
  const effectiveMax = Math.max(1, Math.floor(maxParticles * density))

  PARTICLE_UNITS.forEach((unitDef) => {
    if (remaining <= 0 || specs.length >= effectiveMax) return
    const count = Math.floor(remaining / unitDef.unit)
    const availableSlots = effectiveMax - specs.length
    const visibleCount = Math.min(count, availableSlots)

    for (let index = 0; index < visibleCount; index += 1) {
      specs.push(unitDef)
    }

    if (count > availableSlots) {
      remaining = 0
      return
    }

    remaining %= unitDef.unit
  })

  if (specs.length === 0) specs.push(PARTICLE_UNITS[PARTICLE_UNITS.length - 1])
  return specs
}

const drawParticle = (particle: ParticleView) => {
  const { graphic, color, size, shape } = particle
  graphic.clear()
  graphic
    .moveTo(-size * 2.7, -size * 0.24)
    .lineTo(-size * 0.38, -size * 0.58)
    .lineTo(size * 0.22, 0)
    .lineTo(-size * 0.38, size * 0.58)
    .lineTo(-size * 2.7, size * 0.24)
    .closePath()
    .fill({ color, alpha: 0.18 })
  graphic.circle(0, 0, size * 1.95).fill({ color, alpha: 0.1 })
  if (shape === 'diamond') {
    graphic
      .moveTo(0, -size * 1.25)
      .lineTo(size, 0)
      .lineTo(0, size * 1.25)
      .lineTo(-size, 0)
      .closePath()
      .fill({ color, alpha: 0.96 })
    graphic.circle(size * 0.08, 0, size * 0.34).fill({ color: 0xffffff, alpha: 0.72 })
  } else {
    graphic.circle(0, 0, size).fill({ color, alpha: 0.96 })
    graphic.circle(size * 0.22, -size * 0.18, size * 0.32).fill({ color: 0xffffff, alpha: 0.62 })
  }
}

const createParticleView = (particleLayer: Container, initialT: number): ParticleView => {
  const graphic = new Graphics()
  particleLayer.addChild(graphic)

  return {
    graphic,
    active: true,
    t: initialT,
    speed: 0.18,
    unit: 1,
    color: 0xffffff,
    shape: 'circle',
    size: 4,
    drawSignature: '',
  }
}

const syncParticlePool = (
  flow: PixiEnergyFlow,
  specs: ParticleSpec[],
  pool: ParticleView[],
  particleLayer: Container,
) => {
  while (pool.length < specs.length) {
    pool.push(createParticleView(particleLayer, pool.length / Math.max(specs.length, 1)))
  }

  const burstOffset = specs.length > 1 ? Math.min(0.45 / (specs.length - 1), 0.03) : 0
  const particleSpeed = getParticleSpeed(flow)
  const specsLength = Math.max(specs.length, 1)

  for (let index = 0; index < pool.length; index += 1) {
    const particle = pool[index]
    const spec = specs[index]
    if (!flow.visible || !spec) {
      particle.active = false
      particle.graphic.visible = false
      continue
    }

    const particleSize = Math.max(spec.size, Math.min(11, flow.width * 0.55 * (spec.unit >= 1000 ? 1.35 : 1)))
    const drawSignature = `${flow.color}:${spec.shape}:${particleSize.toFixed(2)}`

    const wasActive = particle.active
    particle.active = true
    particle.graphic.visible = true
    particle.unit = spec.unit
    particle.speed = particleSpeed
    if (!wasActive) {
      particle.t = flow.loop === false ? -index * burstOffset : index / specsLength
    }

    if (particle.drawSignature !== drawSignature) {
      particle.color = flow.color
      particle.shape = spec.shape
      particle.size = particleSize
      particle.drawSignature = drawSignature
      drawParticle(particle)
    }
  }
}

const createHtmlFloatingLabel = (container: HTMLDivElement, text: string, x: number, y: number, color: string) => {
  const labelEl = document.createElement('div')
  const isNegative = /^[-−]/.test(text.trim())

  labelEl.textContent = text
  labelEl.style.left = `${x}px`
  labelEl.style.top = `${y}px`
  labelEl.style.color = color
  labelEl.className = `floating-energy-label ${isNegative ? 'float-down' : 'float-up'}`

  container.appendChild(labelEl)

  setTimeout(() => {
    labelEl.remove()
  }, 900)
}

export const PixiEnergyNetwork = memo(function PixiEnergyNetwork({
  flows,
  performanceLevel,
  clickPowerLabel,
}: PixiEnergyNetworkProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const staticLayerRef = useRef<Container | null>(null)
  const particleLayerRef = useRef<Container | null>(null)
  const hubLayerRef = useRef<Container | null>(null)
  const cachedFlowsRef = useRef<Map<string, CachedFlowGraphics>>(new Map())
  const particlePoolsRef = useRef<Map<string, ParticleView[]>>(new Map())
  const storageClickParticlesRef = useRef<ParticleView[]>([])
  const pathCacheRef = useRef<Map<string, SampledPoint[]>>(new Map())
  const scaleRef = useRef({ x: 1, y: 1 })
  const flowsRef = useRef(flows)
  const performanceLevelRef = useRef(performanceLevel)
  const clickPowerLabelRef = useRef(clickPowerLabel)
  const frameAccumulatorRef = useRef({ total: 0, count: 0, quality: performanceLevel })
  const flowArrivalLabelTimesRef = useRef<Map<string, number>>(new Map())

  const flowRenderKey = useMemo(
    () =>
      flows
        .map((flow) => {
          const path = flow.path
          return [
            flow.id,
            flow.visible ? 1 : 0,
            Math.round(flow.width),
            flow.maxParticles,
            flow.loop === false ? 0 : 1,
            flow.speedMultiplier ?? 1,
            flow.arrivalLabelOffsetX ?? 0,
            path.start.x,
            path.start.y,
            path.cp1.x,
            path.cp1.y,
            path.cp2.x,
            path.cp2.y,
            path.end.x,
            path.end.y,
          ].join(':')
        })
        .join('|'),
    [flows],
  )

  useEffect(() => {
    flowsRef.current = flows
  }, [flows])

  useEffect(() => {
    performanceLevelRef.current = performanceLevel
    frameAccumulatorRef.current.quality = performanceLevel
  }, [performanceLevel])

  useEffect(() => {
    clickPowerLabelRef.current = clickPowerLabel
  }, [clickPowerLabel])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    let destroyed = false
    let appReady = false
    let appDestroyed = false
    let resizeObserver: ResizeObserver | null = null
    let lastRendererWidth = 0
    let lastRendererHeight = 0
    let cleanupHubListener: (() => void) | null = null

    const app = new Application()
    const particlePools = particlePoolsRef.current
    const flowArrivalLabelTimes = flowArrivalLabelTimesRef.current
    appRef.current = app

    const syncTickerVisibility = () => {
      if (document.visibilityState === 'hidden') {
        app.ticker.stop()
        return
      }

      if (!appDestroyed) {
        app.ticker.start()
      }
    }

    const destroyApp = () => {
      if (!appReady || appDestroyed) return
      appDestroyed = true
      app.destroy({ removeView: true }, { children: true })
    }

    const init = async () => {
      await app.init({
        backgroundAlpha: 0,
        antialias: false,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 1.5),
        powerPreference: 'high-performance',
        gcActive: true,
        gcMaxUnusedTime: 90_000,
        gcFrequency: 45_000,
      })
      appReady = true
      syncTickerVisibility()
      if (destroyed) {
        destroyApp()
        return
      }

      app.canvas.className = 'absolute inset-0 h-full w-full'
      host.appendChild(app.canvas)

      const world = new Container()
      const staticLayer = new Container()
      const particleLayer = new Container()
      const hubLayer = new Container()

      world.addChild(staticLayer, particleLayer, hubLayer)
      app.stage.addChild(world)
      worldRef.current = world
      staticLayerRef.current = staticLayer
      particleLayerRef.current = particleLayer
      hubLayerRef.current = hubLayer
      hubLayer.position.set(HUB_POSITION.x, HUB_POSITION.y)
      hubLayer.pivot.set(HUB_POSITION.x, HUB_POSITION.y)

      const resize = () => {
        const rect = host.getBoundingClientRect()
        const width = Math.max(1, Math.floor(rect.width))
        const height = Math.max(1, Math.floor(rect.height))
        if (width === lastRendererWidth && height === lastRendererHeight) return
        lastRendererWidth = width
        lastRendererHeight = height
        app.renderer.resize(width, height)
        world.scale.set(width / VIEWBOX_WIDTH, height / VIEWBOX_HEIGHT)
        scaleRef.current = { x: width / VIEWBOX_WIDTH, y: height / VIEWBOX_HEIGHT }
      }

      resize()
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)

      app.ticker.add((ticker) => {
        if (document.visibilityState === 'hidden') return

        const deltaSeconds = Math.min(ticker.deltaMS / 1000, 0.05)
        const frameStats = frameAccumulatorRef.current
        const currentTime = app.ticker.lastTime
        frameStats.total += ticker.deltaMS
        frameStats.count += 1
        if (frameStats.count >= 30) {
          const avg = frameStats.total / frameStats.count
          if (avg > FPS_DEGRADE_THRESHOLD) {
            frameStats.quality = 'minimal'
          } else if (avg < FPS_RECOVER_THRESHOLD) {
            frameStats.quality = performanceLevelRef.current
          }
          frameStats.total = 0
          frameStats.count = 0
        }
        const currentQuality = frameStats.quality

        const pulse = 1 + Math.sin(currentTime / 220) * 0.055
        hubLayer.scale.set(pulse)

        const flows = flowsRef.current
        for (let flowIndex = 0; flowIndex < flows.length; flowIndex += 1) {
          const flow = flows[flowIndex]
          const pool = particlePoolsRef.current.get(flow.id)
          if (!pool || !flow.visible || flow.value <= 0) continue

          const path = flow.path
          const sampledPoints = getSampledPath(path, pathCacheRef.current)
          const segmentsCount = sampledPoints.length - 1

          for (let particleIndex = 0; particleIndex < pool.length; particleIndex += 1) {
            const particle = pool[particleIndex]
            if (!particle.active) continue
            particle.t += deltaSeconds * particle.speed
            if (particle.t >= 1) {
              if (particle.unit >= 10) {
                const nowSeconds = currentTime / 1000
                const previousLabelTime = flowArrivalLabelTimesRef.current.get(flow.id) ?? -Infinity
                const labelInterval = currentQuality === 'normal'
                  ? FLOW_ARRIVAL_LABEL_INTERVAL_SECONDS
                  : FLOW_ARRIVAL_LABEL_INTERVAL_SECONDS * 1.8

                if (nowSeconds - previousLabelTime >= labelInterval) {
                  flowArrivalLabelTimesRef.current.set(flow.id, nowSeconds)
                  const labelTexts = (flow.arrivalLabel ?? `+${formatEnergy(flow.value)}`)
                    .split('\n')
                    .map((labelText) => labelText.trim())
                    .filter(Boolean)

                  const overlay = overlayRef.current
                  if (overlay) {
                    const scale = scaleRef.current
                    const colorHex = '#' + flow.color.toString(16).padStart(6, '0')

                    labelTexts.forEach((labelText, labelIndex) => {
                      const pairedOffsetX = labelTexts.length > 1 ? (labelIndex - (labelTexts.length - 1) / 2) * 48 : 0
                      const screenX = (path.end.x + pairedOffsetX + (flow.arrivalLabelOffsetX ?? 0)) * scale.x
                      const screenY = path.end.y * scale.y
                      createHtmlFloatingLabel(overlay, labelText, screenX, screenY, colorHex)
                    })
                  }
                }
              }
              if (flow.loop === false) {
                particle.t = 1
                particle.active = false
                particle.graphic.visible = false
                continue
              }
              particle.t %= 1
            }

            if (particle.t < 0) {
              particle.graphic.visible = true
              particle.graphic.alpha = 0
              particle.graphic.position.set(path.start.x, path.start.y)
              continue
            }

            particle.graphic.visible = true
            const lookupIndex = Math.min(segmentsCount, Math.max(0, Math.floor(particle.t * segmentsCount)))
            const pointSpec = sampledPoints[lookupIndex]

            particle.graphic.position.set(pointSpec.x, pointSpec.y)
            particle.graphic.rotation = pointSpec.rotation
            particle.graphic.scale.set(1 + Math.sin((particle.t + currentTime / 900) * Math.PI * 2) * 0.08)
            particle.graphic.alpha = currentQuality === 'normal'
              ? 0.55 + Math.sin((particle.t + currentTime / 1200) * Math.PI * 2) * 0.25
              : 0.72
          }
        }

        // Update storage click burst particles (V2 direct direct anim)
        const storageParticles = storageClickParticlesRef.current
        const sampledStoragePath = getSampledPath(STORAGE_CLICK_PATH, pathCacheRef.current)
        const storageSegmentsCount = sampledStoragePath.length - 1

        for (let index = 0; index < storageParticles.length; index += 1) {
          const particle = storageParticles[index]
          if (!particle.active) continue

          particle.t += deltaSeconds * particle.speed
          if (particle.t >= 1) {
            particle.active = false
            particle.graphic.visible = false
            continue
          }

          if (particle.t < 0) {
            particle.graphic.visible = true
            particle.graphic.alpha = 0
            particle.graphic.position.set(STORAGE_CLICK_PATH.start.x, STORAGE_CLICK_PATH.start.y)
            continue
          }

          particle.graphic.visible = true
          const lookupIndex = Math.min(storageSegmentsCount, Math.max(0, Math.floor(particle.t * storageSegmentsCount)))
          const pointSpec = sampledStoragePath[lookupIndex]

          particle.graphic.position.set(pointSpec.x, pointSpec.y)
          particle.graphic.rotation = pointSpec.rotation
          particle.graphic.scale.set(1 + Math.sin((particle.t + currentTime / 900) * Math.PI * 2) * 0.08)
          particle.graphic.alpha = currentQuality === 'normal'
            ? 0.55 + Math.sin((particle.t + currentTime / 1200) * Math.PI * 2) * 0.25
            : 0.72
        }
      })

      // Add static hub glow once
      const hubGlow = new Graphics()
      drawHubGlow(hubGlow)
      hubLayer.addChild(hubGlow)

      updateStaticLayers()
      updateParticles()

      // Attach direct event listener to Central Hub to bypass React render loop on clicks
      cleanupHubListener = setupHubListener()
    }

    const setupHubListener = () => {
      const hubButton = document.querySelector('.central-node-button')
      if (!hubButton) return null

      const triggerStorageClickBurst = () => {
        const particleLayer = particleLayerRef.current
        if (!particleLayer) return

        const burstSize = 8
        const particleSpeed = 1.9
        const flowColor = 0x38bdf8
        const pool = storageClickParticlesRef.current
        const launchDelay = 0.05

        for (let i = 0; i < burstSize; i += 1) {
          let particle = pool.find((p) => !p.active)
          if (!particle) {
            particle = createParticleView(particleLayer, 0)
            pool.push(particle)
          }

          particle.active = true
          particle.graphic.visible = true
          particle.t = -i * launchDelay
          particle.speed = particleSpeed
          particle.unit = 10
          particle.color = flowColor
          particle.size = 7

          const drawSignature = `${flowColor}:circle:7`
          if (particle.drawSignature !== drawSignature) {
            particle.drawSignature = drawSignature
            drawParticle(particle)
          }
        }
      }

      const handleHubPointerDown = () => {
        const staticLayer = staticLayerRef.current
        if (!staticLayer) return

        // Click expanding ring hexagon animation directly in Pixi
        const pulse = new Graphics()
        drawHexagon(pulse, 0, 0, 166, 110).stroke({ color: 0x22d3ee, width: 4, alpha: 0.45, join: 'miter' })
        pulse.position.set(HUB_POSITION.x, HUB_POSITION.y)
        staticLayer.addChild(pulse)

        const scale = scaleRef.current
        const screenX = HUB_POSITION.x * scale.x
        const screenY = (HUB_POSITION.y - 52) * scale.y
        const overlay = overlayRef.current
        if (overlay) {
          createHtmlFloatingLabel(overlay, `+${clickPowerLabelRef.current}`, screenX, screenY, '#22d3ee')
        }

        // Trigger manual storage flow burst particles locally
        triggerStorageClickBurst()

        let age = 0
        const app = appRef.current
        if (!app) return

        const animatePulse = () => {
          age += app.ticker.deltaMS / 1000
          pulse.scale.set(1 + age * 1.5)
          pulse.alpha = Math.max(0, 1 - age / 0.45)
          if (age >= 0.45) {
            app.ticker.remove(animatePulse)
            pulse.destroy()
          }
        }
        app.ticker.add(animatePulse)
      }

      hubButton.addEventListener('pointerdown', handleHubPointerDown)
      return () => {
        hubButton.removeEventListener('pointerdown', handleHubPointerDown)
      }
    }

    const updateStaticLayers = () => {
      const staticLayer = staticLayerRef.current
      if (!staticLayer) return

      const currentFlows = flowsRef.current
      const nextFlowIds = new Set(currentFlows.map((flow) => flow.id))

      // Clean up deleted flows
      cachedFlowsRef.current.forEach((cached, flowId) => {
        if (!nextFlowIds.has(flowId)) {
          cached.shadow.destroy()
          cached.rail.destroy()
          cached.glow.destroy()
          cached.core.destroy()
          cachedFlowsRef.current.delete(flowId)
        }
      })

      // Update or create graphics
      currentFlows.forEach((flow) => {
        const isActive = flow.visible && flow.value > 0
        let cached = cachedFlowsRef.current.get(flow.id)

        if (!cached) {
          const shadow = new Graphics()
          const rail = new Graphics()
          const glow = new Graphics()
          const core = new Graphics()

          staticLayer.addChild(shadow)
          staticLayer.addChild(rail)
          staticLayer.addChild(glow)
          staticLayer.addChild(core)

          cached = {
            shadow,
            rail,
            glow,
            core,
            width: -1,
            color: -1,
            visible: false,
            active: false,
          }
          cachedFlowsRef.current.set(flow.id, cached)
        }

        const needsRedraw = cached.width !== flow.width || cached.color !== flow.color

        if (needsRedraw) {
          cached.shadow.clear()
          drawCubic(cached.shadow, flow.path)
          cached.shadow.stroke({ color: 0x020617, width: flow.width + 16, alpha: 0.34 })

          cached.rail.clear()
          drawCubic(cached.rail, flow.path)
          cached.rail.stroke({ color: flow.color, width: Math.max(2, flow.width * 0.34), alpha: 0.24 })

          cached.glow.clear()
          drawCubic(cached.glow, flow.path)
          cached.glow.stroke({ color: flow.color, width: flow.width + 10, alpha: 0.06 })

          cached.core.clear()
          drawCubic(cached.core, flow.path)
          cached.core.stroke({ color: flow.color, width: Math.max(1.2, flow.width * 0.14), alpha: 0.36 })

          cached.width = flow.width
          cached.color = flow.color
        }

        cached.shadow.visible = flow.visible
        cached.shadow.alpha = flow.visible ? 1.0 : 0.47

        cached.rail.visible = flow.visible
        cached.rail.alpha = flow.visible ? 1.0 : 0.33

        cached.glow.visible = isActive
        cached.core.visible = isActive

        cached.visible = flow.visible
        cached.active = isActive
      })
    }

    const updateParticles = () => {
      const particleLayer = particleLayerRef.current
      if (!particleLayer) return

      const density = QUALITY_DENSITY[frameAccumulatorRef.current.quality]
      const currentFlows = flowsRef.current
      const nextFlowIds = new Set(currentFlows.map((flow) => flow.id))

      const keysToDelete: string[] = []
      particlePoolsRef.current.forEach((pool, flowId) => {
        if (!nextFlowIds.has(flowId)) {
          pool.forEach((particle) => particle.graphic.destroy())
          keysToDelete.push(flowId)
        }
      })
      keysToDelete.forEach((flowId) => {
        particlePoolsRef.current.delete(flowId)
      })

      currentFlows.forEach((flow) => {
        const specs = buildParticleSpecs(flow.value, flow.maxParticles, density)
        const pool = particlePoolsRef.current.get(flow.id) ?? []
        syncParticlePool(flow, specs, pool, particleLayer)
        particlePoolsRef.current.set(flow.id, pool)
      })
    }

    document.addEventListener('visibilitychange', syncTickerVisibility)
    void init()

    return () => {
      destroyed = true
      document.removeEventListener('visibilitychange', syncTickerVisibility)
      resizeObserver?.disconnect()

      if (cleanupHubListener) {
        cleanupHubListener()
      }

      cachedFlowsRef.current.forEach((cached) => {
        cached.shadow.destroy()
        cached.rail.destroy()
        cached.glow.destroy()
        cached.core.destroy()
      })
      cachedFlowsRef.current.clear()

      flowArrivalLabelTimes.clear()
      particlePools.forEach((pool) => pool.forEach((particle) => particle.graphic.destroy()))
      particlePools.clear()
      storageClickParticlesRef.current.forEach((p) => p.graphic.destroy())
      storageClickParticlesRef.current = []
      destroyApp()
      appRef.current = null
    }
  }, [])

  // Dynamic flow value & caps updates (triggered every game tick)
  useEffect(() => {
    const staticLayer = staticLayerRef.current
    const particleLayer = particleLayerRef.current
    const hubLayer = hubLayerRef.current
    if (!staticLayer || !particleLayer || !hubLayer) return

    // Update static layers dynamically (efficiently checks cache)
    const currentFlows = flowsRef.current
    const nextFlowIds = new Set(currentFlows.map((flow) => flow.id))

    cachedFlowsRef.current.forEach((cached, flowId) => {
      if (!nextFlowIds.has(flowId)) {
        cached.shadow.destroy()
        cached.rail.destroy()
        cached.glow.destroy()
        cached.core.destroy()
        cachedFlowsRef.current.delete(flowId)
      }
    })

    currentFlows.forEach((flow) => {
      const isActive = flow.visible && flow.value > 0
      let cached = cachedFlowsRef.current.get(flow.id)

      if (!cached) {
        const shadow = new Graphics()
        const rail = new Graphics()
        const glow = new Graphics()
        const core = new Graphics()

        staticLayer.addChild(shadow)
        staticLayer.addChild(rail)
        staticLayer.addChild(glow)
        staticLayer.addChild(core)

        cached = {
          shadow,
          rail,
          glow,
          core,
          width: -1,
          color: -1,
          visible: false,
          active: false,
        }
        cachedFlowsRef.current.set(flow.id, cached)
      }

      const needsRedraw = cached.width !== flow.width || cached.color !== flow.color

      if (needsRedraw) {
        cached.shadow.clear()
        drawCubic(cached.shadow, flow.path)
        cached.shadow.stroke({ color: 0x020617, width: flow.width + 16, alpha: 0.34 })

        cached.rail.clear()
        drawCubic(cached.rail, flow.path)
        cached.rail.stroke({ color: flow.color, width: Math.max(2, flow.width * 0.34), alpha: 0.24 })

        cached.glow.clear()
        drawCubic(cached.glow, flow.path)
        cached.glow.stroke({ color: flow.color, width: flow.width + 10, alpha: 0.06 })

        cached.core.clear()
        drawCubic(cached.core, flow.path)
        cached.core.stroke({ color: flow.color, width: Math.max(1.2, flow.width * 0.14), alpha: 0.36 })

        cached.width = flow.width
        cached.color = flow.color
      }

      cached.shadow.visible = flow.visible
      cached.shadow.alpha = flow.visible ? 1.0 : 0.47

      cached.rail.visible = flow.visible
      cached.rail.alpha = flow.visible ? 1.0 : 0.33

      cached.glow.visible = isActive
      cached.core.visible = isActive

      cached.visible = flow.visible
      cached.active = isActive
    })

    // Update particle pools
    const density = QUALITY_DENSITY[performanceLevel]
    const keysToDelete: string[] = []
    particlePoolsRef.current.forEach((pool, flowId) => {
      if (!nextFlowIds.has(flowId)) {
        pool.forEach((particle) => particle.graphic.destroy())
        keysToDelete.push(flowId)
      }
    })
    keysToDelete.forEach((flowId) => {
      particlePoolsRef.current.delete(flowId)
    })

    currentFlows.forEach((flow) => {
      const specs = buildParticleSpecs(flow.value, flow.maxParticles, density)
      const pool = particlePoolsRef.current.get(flow.id) ?? []
      syncParticlePool(flow, specs, pool, particleLayer)
      particlePoolsRef.current.set(flow.id, pool)
    })
  }, [flowRenderKey, performanceLevel])

  return (
    <div
      ref={hostRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      style={{ transform: 'translate3d(0, 0, 0)', willChange: 'transform' }}
    >
      <div ref={overlayRef} className="absolute inset-0 z-20 pointer-events-none overflow-hidden" />
    </div>
  )
})
