import { memo, useEffect, useMemo, useRef } from 'react'
import { Application, Container, Graphics, Text } from 'pixi.js'
import { formatEnergy } from '../utils/energyUnits'

export type PixiFlowPerformanceLevel = 'normal' | 'reduced' | 'minimal'

export type PixiEnergyFlow = {
  id: string
  path: CubicPath
  color: number
  value: number
  arrivalLabel?: string
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

type FloatingLabel = {
  text: Text
  age: number
  duration: number
  vy: number
}

type PixiEnergyNetworkProps = {
  flows: PixiEnergyFlow[]
  performanceLevel: PixiFlowPerformanceLevel
  clickPulseToken: number
  clickPowerLabel: string
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
const MAX_FLOATING_LABELS: Record<PixiFlowPerformanceLevel, number> = {
  normal: 14,
  reduced: 8,
  minimal: 4,
}
const FPS_DEGRADE_THRESHOLD = 42
const FPS_RECOVER_THRESHOLD = 28
const HUB_POSITION = { x: 500, y: 279 }
const FLOW_ARRIVAL_LABEL_INTERVAL_SECONDS = 0.9

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
  graphic.circle(0, 0, size * 1.85).fill({ color, alpha: 0.11 })
  if (shape === 'diamond') {
    graphic
      .moveTo(0, -size * 1.25)
      .lineTo(size, 0)
      .lineTo(0, size * 1.25)
      .lineTo(-size, 0)
      .closePath()
      .fill({ color, alpha: 0.96 })
  } else {
    graphic.circle(0, 0, size).fill({ color, alpha: 0.96 })
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

const createFloatingLabel = (text: string, x: number, y: number, color: number): FloatingLabel => {
  const isNegativeLabel = /^[-−]/.test(text.trim())
  const label = new Text({
    text,
    style: {
      fill: color,
      stroke: {
        color: 0x02040b,
        width: 4,
        join: 'round',
      },
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 18,
      fontWeight: '800',
      leading: 4,
      dropShadow: {
        color: 0x000000,
        blur: 6,
        distance: 3,
        angle: 1.4,
        alpha: 0.7,
      },
    },
  })

  label.anchor.set(0.5)
  label.position.set(x, isNegativeLabel ? y - 20 : y)

  return {
    text: label,
    age: 0,
    duration: 0.9,
    vy: isNegativeLabel ? 44 : -44,
  }
}

export const PixiEnergyNetwork = memo(function PixiEnergyNetwork({
  flows,
  performanceLevel,
  clickPulseToken,
  clickPowerLabel,
}: PixiEnergyNetworkProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const staticLayerRef = useRef<Container | null>(null)
  const particleLayerRef = useRef<Container | null>(null)
  const labelLayerRef = useRef<Container | null>(null)
  const hubLayerRef = useRef<Container | null>(null)
  const particlePoolsRef = useRef<Map<string, ParticleView[]>>(new Map())
  const labelsRef = useRef<FloatingLabel[]>([])
  const flowsRef = useRef(flows)
  const performanceLevelRef = useRef(performanceLevel)
  const clickPowerLabelRef = useRef(clickPowerLabel)
  const previousClickPulseTokenRef = useRef(clickPulseToken)
  const frameAccumulatorRef = useRef({ total: 0, count: 0, quality: performanceLevel })
  const flowArrivalLabelTimesRef = useRef<Map<string, number>>(new Map())

  const visibleFlowsKey = useMemo(
    () =>
      flows
        .map((flow) => `${flow.id}:${flow.visible ? 1 : 0}:${Math.round(flow.value)}:${Math.round(flow.width)}:${flow.maxParticles}:${flow.loop === false ? 0 : 1}:${flow.speedMultiplier ?? 1}:${flow.arrivalLabel ?? ''}`)
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
    const app = new Application()
    const particlePools = particlePoolsRef.current
    const flowArrivalLabelTimes = flowArrivalLabelTimesRef.current
    appRef.current = app

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
      if (destroyed) {
        destroyApp()
        return
      }

      app.canvas.className = 'absolute inset-0 h-full w-full'
      host.appendChild(app.canvas)

      const world = new Container()
      const staticLayer = new Container()
      const particleLayer = new Container()
      const labelLayer = new Container()
      const hubLayer = new Container()

      world.addChild(staticLayer, particleLayer, hubLayer, labelLayer)
      app.stage.addChild(world)
      worldRef.current = world
      staticLayerRef.current = staticLayer
      particleLayerRef.current = particleLayer
      labelLayerRef.current = labelLayer
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
      }

      resize()
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(host)

      const scratchPoint: Point = { x: 0, y: 0 }

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
          for (let particleIndex = 0; particleIndex < pool.length; particleIndex += 1) {
            const particle = pool[particleIndex]
            if (!particle.active) continue
            particle.t += deltaSeconds * particle.speed
            if (particle.t >= 1) {
              if (particle.unit >= 10 && labelsRef.current.length < MAX_FLOATING_LABELS[currentQuality]) {
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

                  labelTexts.forEach((labelText, labelIndex) => {
                    if (labelsRef.current.length >= MAX_FLOATING_LABELS[currentQuality]) return

                    const pairedOffsetX = labelTexts.length > 1 ? (labelIndex - (labelTexts.length - 1) / 2) * 48 : 0
                    const label = createFloatingLabel(labelText, path.end.x + pairedOffsetX, path.end.y, flow.color)
                    labelLayer.addChild(label.text)
                    labelsRef.current.push(label)
                  })
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
            sampleCubicInto(path, particle.t, scratchPoint)
            particle.graphic.position.set(scratchPoint.x, scratchPoint.y)
            particle.graphic.alpha = currentQuality === 'normal'
              ? 0.55 + Math.sin((particle.t + currentTime / 1200) * Math.PI * 2) * 0.25
              : 0.72
          }
        }

        const labels = labelsRef.current
        let nextLabelIndex = 0
        for (let index = 0; index < labels.length; index += 1) {
          const label = labels[index]
          label.age += deltaSeconds
          label.text.y += label.vy * deltaSeconds
          label.text.alpha = Math.max(0, 1 - label.age / label.duration)
          label.text.scale.set(1 + label.age * 0.18)
          if (label.age < label.duration) {
            labels[nextLabelIndex] = label
            nextLabelIndex += 1
            continue
          }
          label.text.destroy()
        }
        labels.length = nextLabelIndex
      })

      renderNetwork()
    }

    const renderNetwork = () => {
      const staticLayer = staticLayerRef.current
      const particleLayer = particleLayerRef.current
      const hubLayer = hubLayerRef.current
      if (!staticLayer || !particleLayer || !hubLayer) return

      staticLayer.removeChildren().forEach((child) => child.destroy())
      hubLayer.removeChildren().forEach((child) => child.destroy())

      const density = QUALITY_DENSITY[frameAccumulatorRef.current.quality]
      const nextFlowIds = new Set(flowsRef.current.map((flow) => flow.id))
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

      flowsRef.current.forEach((flow) => {
        const track = new Graphics()
        drawCubic(track, flow.path)
        track.stroke({ color: flow.color, width: Math.max(1.5, flow.width * 0.26), alpha: flow.visible ? 0.28 : 0.08 })
        staticLayer.addChild(track)

        if (flow.visible && flow.value > 0) {
          const glow = new Graphics()
          drawCubic(glow, flow.path)
          glow.stroke({ color: flow.color, width: flow.width + 8, alpha: 0.055 })
          staticLayer.addChild(glow)
        }

        const specs = buildParticleSpecs(flow.value, flow.maxParticles, density)
        const pool = particlePoolsRef.current.get(flow.id) ?? []
        syncParticlePool(flow, specs, pool, particleLayer)
        particlePoolsRef.current.set(flow.id, pool)
      })

      const hubGlow = new Graphics()
      drawHubGlow(hubGlow)
      hubLayer.addChild(hubGlow)
    }

    void init()

    return () => {
      destroyed = true
      resizeObserver?.disconnect()
      labelsRef.current.forEach((label) => label.text.destroy())
      labelsRef.current = []
      flowArrivalLabelTimes.clear()
      particlePools.forEach((pool) => pool.forEach((particle) => particle.graphic.destroy()))
      particlePools.clear()
      destroyApp()
      appRef.current = null
    }
  }, [])

  useEffect(() => {
    const staticLayer = staticLayerRef.current
    const particleLayer = particleLayerRef.current
    const hubLayer = hubLayerRef.current
    if (!staticLayer || !particleLayer || !hubLayer) return

    staticLayer.removeChildren().forEach((child) => child.destroy())
    hubLayer.removeChildren().forEach((child) => child.destroy())

    const density = QUALITY_DENSITY[performanceLevelRef.current]
    const nextFlowIds = new Set(flows.map((flow) => flow.id))
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

    flows.forEach((flow) => {
      const track = new Graphics()
      drawCubic(track, flow.path)
      track.stroke({ color: flow.color, width: Math.max(1.5, flow.width * 0.26), alpha: flow.visible ? 0.28 : 0.08 })
      staticLayer.addChild(track)

      if (flow.visible && flow.value > 0) {
        const glow = new Graphics()
        drawCubic(glow, flow.path)
        glow.stroke({ color: flow.color, width: flow.width + 8, alpha: 0.055 })
        staticLayer.addChild(glow)
      }

      const specs = buildParticleSpecs(flow.value, flow.maxParticles, density)
      const pool = particlePoolsRef.current.get(flow.id) ?? []
      syncParticlePool(flow, specs, pool, particleLayer)
      particlePoolsRef.current.set(flow.id, pool)
    })

    const hubGlow = new Graphics()
    drawHubGlow(hubGlow)
    hubLayer.addChild(hubGlow)
  }, [visibleFlowsKey, flows, performanceLevel])

  useEffect(() => {
    if (clickPulseToken === previousClickPulseTokenRef.current) return
    previousClickPulseTokenRef.current = clickPulseToken

    const labelLayer = labelLayerRef.current
    if (!labelLayer) return

    const pulse = new Graphics()
    drawHexagon(pulse, 0, 0, 166, 110).stroke({ color: 0x22d3ee, width: 4, alpha: 0.45, join: 'miter' })
    pulse.position.set(HUB_POSITION.x, HUB_POSITION.y)
    labelLayer.addChild(pulse)

    const label = createFloatingLabel(`+${clickPowerLabelRef.current}`, HUB_POSITION.x, HUB_POSITION.y - 52, 0x22d3ee)
    labelLayer.addChild(label.text)
    labelsRef.current.push(label)

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
  }, [clickPulseToken])

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
})
