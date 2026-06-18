import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, SetStateAction, Dispatch } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  BrainCircuit,
  GraduationCap,
  ChevronDown,
  CircuitBoard,
  Eye,
  Euro,
  Factory,
  Play,
  Gauge,
  Heart,
  Hospital,
  House,
  Server,
  Store,
  ThermometerSun,
  TrainFront,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
  Coins,
  Zap,
} from 'lucide-react'
import { PixiEnergyNetwork } from './PixiEnergyNetwork'
import type { PixiEnergyFlow } from './PixiEnergyNetwork'
import { formatCompactUnit, formatEnergy, formatEnergyRate, formatSignedEnergyRate } from '../utils/energyUnits'
import backgroundMusicUrl from '../../flux_energie_incremental_loop.mp3'

const MarketChart = lazy(() => import('./MarketChart').then((module) => ({ default: module.MarketChart })))

function MarketChartFallback() {
  return (
    <div className="market-chart-compact flex min-h-[188px] min-w-0 flex-col rounded-md border border-yellow-300/20 bg-slate-950/45 p-2 text-xs text-slate-400">
      <div className="mb-1 h-4 w-48 max-w-full rounded bg-yellow-300/10" />
      <div className="flex flex-1 items-center justify-center rounded border border-slate-700/40 bg-slate-950/35">
        Chargement du graphique...
      </div>
    </div>
  )
}

type Tone = 'cyan' | 'yellow' | 'green' | 'orange' | 'violet'

type EnergyNodeProps = {
  icon: ReactNode
  label: string
  value: ReactNode
  color: string
  className: string
  isEmphasized?: boolean
  onClick?: () => void
  actionLabel?: string
  actionDisabled?: boolean
  disabledReason?: string
}

type HudStatTone = 'cyan' | 'yellow' | 'emerald' | 'violet' | 'orange'

type HudStatCardProps = {
  label: string
  value: ReactNode
  detail: ReactNode
  icon: ReactNode
  tone: HudStatTone
  className?: string
  detailClassName?: string
  detailTitle?: string
  subdetail?: ReactNode
  subdetailTitle?: string
  valueTitle?: string
}

type UpgradeTone = 'cyan' | 'violet'

type UpgradeRowProps = {
  upgrade: UpgradeState
  cost: number
  isAffordable: boolean
  isInteractiveMode: boolean
  currentValueLabel: string
  tone: UpgradeTone
  children?: ReactNode
  isDisabled?: boolean
  disabledReason?: string
  isMaxed?: boolean
  onBuy: () => void
}

type ShopTab = 'generators' | 'consumption' | 'hub' | 'upgrades'

type ShopSectionTone = 'cyan' | 'orange' | 'violet'

type ShopSectionHeaderProps = {
  eyebrow: string
  title?: string
  tone: ShopSectionTone
  meta?: ReactNode
}

type EnergyChartPoint = {
  hour: string
  minuteOfDay: number
  // Historical chart keeps its existing keys, but these values are Wh/min rates.
  productionEnergy: number
  consumptionEnergy: number
  battery: number
  cost: number
}

type EnergyChartProps = {
  data: EnergyChartPoint[]
  emptyLabel?: string
}

type MarketChartPoint = {
  time: string
  cours: number
}

const toneStyles: Record<Tone, string> = {
  cyan: 'from-cyan-300/20 to-cyan-500/5 text-cyan-200 shadow-cyan-500/15',
  yellow: 'from-yellow-300/20 to-yellow-500/5 text-yellow-100 shadow-yellow-400/15',
  green: 'from-emerald-300/20 to-emerald-500/5 text-emerald-100 shadow-emerald-500/15',
  orange: 'from-orange-300/20 to-orange-500/5 text-orange-100 shadow-orange-500/15',
  violet: 'from-violet-300/20 to-violet-500/5 text-violet-100 shadow-violet-500/15',
}

const shopTabs: ReadonlyArray<{
  id: ShopTab
  label: string
  icon: LucideIcon
}> = [
  { id: 'generators', label: 'Production', icon: Factory },
  { id: 'consumption', label: 'Conso', icon: House },
  { id: 'hub', label: 'Nœud', icon: CircuitBoard },
  { id: 'upgrades', label: 'Recherches', icon: GraduationCap },
]

const STARTING_MONEY = 600
const MARKET_BASE_SELL_RATE = 0.08
const CONSUMER_REVENUE_MULTIPLIER = 5

const DEMO_STANDARD_GENERATOR_LEVELS: Readonly<Record<string, number>> = {
  solar: 3,
  wind: 3,
  biomass: 3,
  hydro: 3,
  geothermal: 1,
  gas: 3,
  coal: 3,
  nuclear: 3,
  fusion: 3,
}

const showDebugControls = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEBUG === 'true'

const mapPanelClassName =
  'control-panel energy-map-panel relative min-h-[430px] lg:flex-1 overflow-hidden rounded-lg border border-cyan-200/15 lg:min-h-[480px]'

const mapGridClassName =
  'grid min-h-[430px] flex-1 gap-3 lg:min-h-[480px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]'

const mapHubClassName =
  'energy-hub absolute left-1/2 top-[45%] z-20 flex h-[140px] w-[162px] flex-col items-center justify-center rounded-lg text-center relative lg:h-[159px] lg:w-[184px]'

const mapHubMotionStyle = {
  x: '-50%',
  y: '-50%',
}

const BASE_FLOW_PARTICLE_CAP = 48
const MEDIUM_FLOW_PARTICLE_CAP = 72
const LARGE_FLOW_PARTICLE_CAP = 120
const FLOW_PARTICLE_GLOBAL_BUDGET = 220
const FLOW_PARTICLE_GLOBAL_BUDGET_LOW_PERF = 120
const MANUAL_GRID_FLOW_VISUAL_DURATION_MS = 2600
const MAX_LOG_ENTRIES = 60
const FLOW_TICK_INTERVAL_MS = 1000
type FlowPerformanceLevel = 'normal' | 'reduced' | 'minimal'
const FLOW_PERF_SAMPLE_SIZE = 18
const FLOW_PERF_REDUCED_THRESHOLD_MS = 42
const FLOW_PERF_MINIMAL_THRESHOLD_MS = 52
const FLOW_PERF_RECOVER_NORMAL_MS = 34
const FLOW_PERF_BUDGET_SCALE: Record<FlowPerformanceLevel, number> = {
  normal: 1,
  reduced: 0.72,
  minimal: 0.46,
}
const CHART_UPDATE_TICK_DIVISOR = 2
const MARKET_HISTORY_UPDATE_TICK_DIVISOR = 2
const GAME_SECONDS_PER_REAL_SECOND = 60
const SIMULATED_SECONDS_PER_TICK = (FLOW_TICK_INTERVAL_MS / 1000) * GAME_SECONDS_PER_REAL_SECOND
const SIMULATED_MINUTES_PER_TICK = SIMULATED_SECONDS_PER_TICK / 60
const MINUTES_PER_DAY = 24 * 60
const CHART_HISTORY_WINDOW_MINUTES = MINUTES_PER_DAY
const CLICK_POWER_MAX_LEVEL = 10
const CLICK_POWER_MIN_WH = 10
const CLICK_POWER_MAX_WH = 5_000_000

const chartPanelClassName =
  'control-panel h-[210px] flex flex-col min-w-0 shrink-0 rounded-lg border border-white/10 p-3 lg:h-[220px]'

const chartBodyClassName = 'flex-1 min-h-[124px] min-w-0 lg:min-h-[132px]'

const mapProducerIds = ['solar', 'wind', 'biomass', 'hydro', 'geothermal', 'gas', 'coal', 'nuclear', 'fusion'] as const
type MapProducerId = typeof mapProducerIds[number]

const mapConsumerIds = ['residential', 'commerce', 'industry', 'publicServices', 'transport', 'data', 'research', 'climate'] as const
type MapConsumerId = typeof mapConsumerIds[number]

type StorageTier = {
  level: number
  name: string
  capacity: number
  description: string
}

const mapNodePositions: Record<MapProducerId | MapConsumerId | 'export' | 'storage', string> = {
  solar: 'left-[4%] top-[7%]',
  wind: 'left-[4%] top-[17%]',
  biomass: 'left-[4%] top-[27%]',
  hydro: 'left-[4%] top-[37%]',
  geothermal: 'left-[4%] top-[47%]',
  gas: 'left-[4%] top-[57%]',
  coal: 'left-[4%] top-[67%]',
  nuclear: 'left-[4%] top-[77%]',
  fusion: 'left-[4%] top-[87%]',
  residential: 'left-[59%] top-[7%] sm:left-[64%] lg:left-[77%]',
  commerce: 'left-[59%] top-[18%] sm:left-[64%] lg:left-[77%]',
  industry: 'left-[59%] top-[29%] sm:left-[64%] lg:left-[77%]',
  publicServices: 'left-[59%] top-[40%] sm:left-[64%] lg:left-[77%]',
  transport: 'left-[59%] top-[51%] sm:left-[64%] lg:left-[77%]',
  data: 'left-[59%] top-[62%] sm:left-[64%] lg:left-[77%]',
  research: 'left-[59%] top-[73%] sm:left-[64%] lg:left-[77%]',
  climate: 'left-[59%] top-[84%] sm:left-[64%] lg:left-[77%]',
  storage: 'left-[30%] top-[70%]',
  export: 'left-[44%] top-[70%] sm:left-[50%] lg:left-[55%]',
}

const HUB_ANCHOR_POINT = { x: 500, y: 279 }
const MARKET_NODE_ANCHOR_POINT = { x: 627, y: 434 }

const STORAGE_TIERS: readonly StorageTier[] = [
  {
    level: 1,
    name: 'Module de stockage',
    capacity: 1000,
    description: 'Capacité tampon pour stocker les excédents.',
  },
  {
    level: 2,
    name: 'Banque de batteries',
    capacity: 1000000,
    description: 'Réserve plus stable pour absorber les pointes de production.',
  },
  {
    level: 3,
    name: 'Capacité de réseau',
    capacity: 1000000000,
    description: 'Capacité réseau étendue pour piloter plus longtemps.',
  },
]

const STORAGE_BASE_CAPACITY = 200
const STORAGE_MAX_LEVEL = STORAGE_TIERS.length
const MINIMUM_MARKET_SELL_AMOUNT = 0

const getStorageCapacity = (level: number) => {
  if (level <= 0) return STORAGE_BASE_CAPACITY
  const clampedLevel = Math.min(Math.max(Math.round(level), 1), STORAGE_MAX_LEVEL)
  return STORAGE_TIERS[clampedLevel - 1]?.capacity ?? STORAGE_TIERS[STORAGE_MAX_LEVEL - 1].capacity
}

const getStorageTier = (level: number) => {
  if (level <= 0) return null
  const clampedLevel = Math.min(Math.max(Math.round(level), 1), STORAGE_MAX_LEVEL)
  return STORAGE_TIERS[clampedLevel - 1] ?? null
}

const getStorageTierLabel = (level: number) =>
  getStorageTier(level)?.name ?? 'Stockage de base'

const getStorageNextTier = (level: number) => {
  const nextIndex = Math.min(Math.max(Math.round(level), 0), STORAGE_MAX_LEVEL)
  return STORAGE_TIERS[nextIndex] ?? null
}

const clampToStorage = (value: number, capacity: number) =>
  Math.max(0, Math.min(capacity, value))

const pixiFlowPaths = {
  solar: { start: { x: 218, y: 70 }, cp1: { x: 299, y: 90 }, cp2: { x: 379, y: 220 }, end: { x: 415, y: 284 } },
  wind: { start: { x: 218, y: 132 }, cp1: { x: 299, y: 150 }, cp2: { x: 379, y: 245 }, end: { x: 415, y: 292 } },
  biomass: { start: { x: 218, y: 194 }, cp1: { x: 299, y: 205 }, cp2: { x: 379, y: 270 }, end: { x: 415, y: 300 } },
  hydro: { start: { x: 218, y: 256 }, cp1: { x: 299, y: 260 }, cp2: { x: 379, y: 292 }, end: { x: 415, y: 308 } },
  geothermal: { start: { x: 218, y: 318 }, cp1: { x: 299, y: 318 }, cp2: { x: 379, y: 312 }, end: { x: 415, y: 316 } },
  gas: { start: { x: 218, y: 380 }, cp1: { x: 299, y: 372 }, cp2: { x: 379, y: 338 }, end: { x: 415, y: 324 } },
  coal: { start: { x: 218, y: 442 }, cp1: { x: 299, y: 428 }, cp2: { x: 379, y: 360 }, end: { x: 415, y: 332 } },
  nuclear: { start: { x: 218, y: 504 }, cp1: { x: 299, y: 478 }, cp2: { x: 379, y: 390 }, end: { x: 415, y: 340 } },
  fusion: { start: { x: 218, y: 566 }, cp1: { x: 299, y: 522 }, cp2: { x: 379, y: 420 }, end: { x: 415, y: 348 } },
  grid: { start: { x: 770, y: 528 }, cp1: { x: 720, y: 500 }, cp2: { x: 650, y: 420 }, end: { x: 585, y: 360 } },
  gridReverse: { start: { x: 585, y: 360 }, cp1: { x: 650, y: 420 }, cp2: { x: 720, y: 500 }, end: { x: 770, y: 528 } },
  hubToMarket: { start: HUB_ANCHOR_POINT, cp1: { x: 530, y: 335 }, cp2: { x: 627, y: 398 }, end: MARKET_NODE_ANCHOR_POINT },
  marketToHub: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 627, y: 398 }, cp2: { x: 530, y: 335 }, end: HUB_ANCHOR_POINT },
  hubToStorage: { start: { x: 500, y: 279 }, cp1: { x: 430, y: 340 }, cp2: { x: 380, y: 390 }, end: { x: 402, y: 434 } },
  storageToHub: { start: { x: 402, y: 434 }, cp1: { x: 380, y: 390 }, cp2: { x: 430, y: 340 }, end: { x: 500, y: 279 } },
  residential: { start: { x: 560, y: 290 }, cp1: { x: 650, y: 200 }, cp2: { x: 710, y: 105 }, end: { x: 770, y: 70 } },
  commerce: { start: { x: 560, y: 300 }, cp1: { x: 650, y: 235 }, cp2: { x: 710, y: 158 }, end: { x: 770, y: 138 } },
  industry: { start: { x: 560, y: 310 }, cp1: { x: 650, y: 260 }, cp2: { x: 710, y: 216 }, end: { x: 770, y: 206 } },
  publicServices: { start: { x: 560, y: 320 }, cp1: { x: 650, y: 295 }, cp2: { x: 710, y: 270 }, end: { x: 770, y: 275 } },
  transport: { start: { x: 560, y: 330 }, cp1: { x: 650, y: 335 }, cp2: { x: 710, y: 328 }, end: { x: 770, y: 343 } },
  data: { start: { x: 560, y: 340 }, cp1: { x: 650, y: 370 }, cp2: { x: 710, y: 381 }, end: { x: 770, y: 411 } },
  research: { start: { x: 560, y: 348 }, cp1: { x: 650, y: 405 }, cp2: { x: 710, y: 434 }, end: { x: 770, y: 479 } },
  climate: { start: { x: 560, y: 356 }, cp1: { x: 650, y: 445 }, cp2: { x: 710, y: 482 }, end: { x: 770, y: 547 } },
  marketToResidential: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 702, y: 430 }, cp2: { x: 700, y: 210 }, end: { x: 770, y: 70 } },
  marketToCommerce: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 705, y: 420 }, cp2: { x: 700, y: 264 }, end: { x: 770, y: 138 } },
  marketToIndustry: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 708, y: 412 }, cp2: { x: 700, y: 318 }, end: { x: 770, y: 206 } },
  marketToPublicServices: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 712, y: 404 }, cp2: { x: 700, y: 372 }, end: { x: 770, y: 275 } },
  marketToTransport: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 715, y: 396 }, cp2: { x: 700, y: 426 }, end: { x: 770, y: 343 } },
  marketToData: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 717, y: 388 }, cp2: { x: 700, y: 480 }, end: { x: 770, y: 411 } },
  marketToResearch: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 720, y: 382 }, cp2: { x: 700, y: 534 }, end: { x: 770, y: 479 } },
  marketToClimate: { start: MARKET_NODE_ANCHOR_POINT, cp1: { x: 723, y: 378 }, cp2: { x: 700, y: 588 }, end: { x: 770, y: 547 } },
} as const

const marketToConsumerFlowPaths: Record<MapConsumerId, typeof pixiFlowPaths[keyof typeof pixiFlowPaths]> = {
  residential: pixiFlowPaths.marketToResidential,
  commerce: pixiFlowPaths.marketToCommerce,
  industry: pixiFlowPaths.marketToIndustry,
  publicServices: pixiFlowPaths.marketToPublicServices,
  transport: pixiFlowPaths.marketToTransport,
  data: pixiFlowPaths.marketToData,
  research: pixiFlowPaths.marketToResearch,
  climate: pixiFlowPaths.marketToClimate,
}

const mapGeneratorIds = new Set(['solar', 'wind', 'biomass'])

type ManualGridFlowDirection = 'gridToHub' | 'hubToGrid'
type IntroStep = 'title' | 'tagline' | 'menu'
type StartMode = 'playing' | 'monitor'

const TITLE_SCREEN_STEP_MS = 1150
const TAGLINE_SCREEN_STEP_MS = 850
const START_MODE_ZOOM_MS = 460

const FLOW_PARTICLE_UNIT_VALUES = [1000, 100, 10, 1] as const

type ObjectiveFireworkParticle = {
  id: number
  angle: number
  distance: number
  size: number
  hue: number
  delay: number
  duration: number
}

type EnergyObjective = {
  key: string
  title: string
  focus: string
  action: string
  progressCurrent?: number
  progressTarget?: number
  progressUnit?: string
  rewardLabel?: string
  completedCount?: number
  totalCount?: number
  isFinalObjective?: boolean
}

type EnergyObjectiveCandidate = EnergyObjective & {
  isComplete: boolean
}

type EnergyMilestoneFact = {
  id: string
  thresholdRate: number
  title: string
  text: string
  source: string
}

const averageEnergyRateFromAnnualEnergyTWh = (twh: number) => (twh * 1_000_000_000_000) / (365 * 24 * 60)

const energyMilestoneFacts: EnergyMilestoneFact[] = [
  {
    id: 'solar-panel-scale',
    thresholdRate: 400,
    title: 'Panneau résidentiel',
    text: 'Tu viens d’atteindre un flux comparable au premier palier d’un panneau solaire résidentiel moderne.',
    source: 'Repère DOE 2024 : module résidentiel moderne',
  },
  {
    id: 'eiffel-sparkles',
    thresholdRate: 8800 * 1000 / (365 * 24 * 60),
    title: 'Tour Eiffel',
    text: 'Ta production moyenne peut couvrir les scintillements annuels de la Tour Eiffel.',
    source: 'Tour Eiffel : 8 800 kWh/an',
  },
  {
    id: 'industrial-wind-turbine',
    thresholdRate: 5_500_000,
    title: 'Éolienne industrielle',
    text: 'Tu atteins l’ordre de grandeur d’une éolienne terrestre neuve commandée en 2023.',
    source: 'Repère IEA Wind TCP : éolienne terrestre récente',
  },
  {
    id: 'power-plant-reference',
    thresholdRate: 100_000_000,
    title: 'Centrale électrique',
    text: 'À ce palier, tu manipules un ordre de grandeur digne d’une centrale électrique de référence.',
    source: 'Repère EIA : centrale électrique',
  },
  {
    id: 'paris-energy',
    thresholdRate: averageEnergyRateFromAnnualEnergyTWh(29.4),
    title: 'Paris',
    text: 'Tu atteins l’ordre de grandeur de la consommation énergétique moyenne de Paris.',
    source: 'Paris : 29,4 TWh/an en 2020',
  },
  {
    id: 'france-average-electricity',
    thresholdRate: averageEnergyRateFromAnnualEnergyTWh(449.2),
    title: 'France',
    text: 'Ta production moyenne rejoint l’ordre de grandeur de la consommation électrique française.',
    source: 'RTE : 449,2 TWh en 2024',
  },
  {
    id: 'france-peak-electricity',
    thresholdRate: 88_000_000_000,
    title: 'Pointe nationale',
    text: 'Tu touches l’ordre de grandeur d’une pointe de consommation électrique française récente.',
    source: 'Repère RTE : pointe électrique nationale 2025',
  },
]

const getNextMilestoneFact = (productionRate: number, shownFactIds: ReadonlySet<string>) => {
  for (let index = energyMilestoneFacts.length - 1; index >= 0; index -= 1) {
    const fact = energyMilestoneFacts[index]
    if (productionRate >= fact.thresholdRate && !shownFactIds.has(fact.id)) {
      return fact
    }
  }

  return null
}

const getFlowMagnitude = (absValue: number) => {
  if (absValue >= 100) return 'large'
  if (absValue >= 10) return 'medium'
  return 'small'
}

const getFlowParticleCap = (absValue: number) => {
  const magnitude = getFlowMagnitude(absValue)
  if (magnitude === 'large') return LARGE_FLOW_PARTICLE_CAP
  if (magnitude === 'medium') return MEDIUM_FLOW_PARTICLE_CAP
  return BASE_FLOW_PARTICLE_CAP
}

const getFlowParticleDemand = (absValue: number) => {
  if (absValue <= 0) return 0
  let remaining = Math.max(1, Math.floor(absValue))
  let total = 0

  FLOW_PARTICLE_UNIT_VALUES.forEach((unit) => {
    if (remaining <= 0) return
    total += Math.floor(remaining / unit)
    remaining %= unit
  })

  const cap = getFlowParticleCap(absValue)
  return Math.min(total, cap)
}

const buildObjectiveFireworks = (seed: number): ObjectiveFireworkParticle[] => {
  const count = 24
  return Array.from({ length: count }, (_, index) => {
    const angle = ((index * 17 + seed * 7) * Math.PI) / 16
    const distance = 90 + (index % 6) * 14
    const size = 2 + (index % 4)
    const hue = (seed * 43 + index * 13) % 360
    const delay = (index % 8) * 0.02
    const duration = 1.1 + (index % 4) * 0.09

    return {
      id: index,
      angle,
      distance,
      size,
      hue,
      delay,
      duration,
    }
  })
}

const distributeParticleBudget = (requested: number[], globalBudget: number) => {
  const cappedRequested = requested.map((value) => Math.max(0, Math.floor(value)))
  const totalRequested = cappedRequested.reduce((acc, value) => acc + value, 0)

  if (totalRequested <= globalBudget) {
    return cappedRequested
  }

  if (globalBudget <= 0) {
    return cappedRequested.map(() => 0)
  }

  const quotas = cappedRequested.map((count, index) => {
    if (count === 0) {
      return {
        index,
        quota: 0,
        remainder: 0,
        demand: 0,
      }
    }

    const exact = (count / totalRequested) * globalBudget
    return {
      index,
      quota: Math.floor(exact),
      remainder: exact - Math.floor(exact),
      demand: count,
    }
  })

  const allocated = quotas.map((entry) => entry.quota)
  const used = quotas.reduce((acc, entry) => acc + entry.quota, 0)
  let remaining = globalBudget - used

  if (remaining <= 0) return allocated

  const candidates = quotas
    .filter((entry) => entry.quota > 0 || entry.demand > 0)
    .sort((a, b) => (b.remainder - a.remainder) || (b.demand - a.demand) || (a.index - b.index))

  let candidateIndex = 0
  while (remaining > 0 && candidates.length > 0) {
    const target = candidates[candidateIndex % candidates.length]
    allocated[target.index] += 1
    remaining -= 1
    candidateIndex += 1
  }

  return allocated
}

const getFlowPathWidth = (absValue: number, baseWidth = 6) => {
  const magnitude = getFlowMagnitude(absValue)
  if (magnitude === 'large') return baseWidth + 5
  if (magnitude === 'medium') return baseWidth + 2
  return baseWidth
}

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext
  }

const getAudioContextClass = () =>
  window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext

// Sound synth manager with adaptive scale pitching
class SoundEffects {
  private static ctx: AudioContext | null = null
  private static isMuted = false

  private static init() {
    if (!this.ctx) {
      const AudioContextClass = getAudioContextClass()
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  static toggleMute() {
    this.isMuted = !this.isMuted
    return this.isMuted
  }

  static getMuted() {
    return this.isMuted
  }

  static click(step = 0) {
    if (this.isMuted) return
    this.init()
    if (!this.ctx) return

    // Major scale progression for consecutive clicks
    const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]
    const freq = scale[step % scale.length]

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, this.ctx.currentTime + 0.15)

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start()
    const stopTime = this.ctx.currentTime + 0.15
    osc.stop(stopTime)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
      osc.onended = null
    }
  }

  static upgrade() {
    if (this.isMuted) return
    this.init()
    if (!this.ctx) return

    const now = this.ctx.currentTime
    const playTone = (freq: number, delay: number, dur: number) => {
      if (!this.ctx) return
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + delay)
      gain.gain.setValueAtTime(0, now + delay)
      gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(now + delay)
      const stopTime = now + delay + dur
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
        osc.onended = null
      }
      osc.stop(stopTime)
    }

    playTone(392.00, 0, 0.25) // G4
    playTone(523.25, 0.05, 0.25) // C5
    playTone(659.25, 0.10, 0.35) // E5
  }

  static error() {
    if (this.isMuted) return
    this.init()
    if (!this.ctx) return

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(120, this.ctx.currentTime)
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(this.ctx.destination)
    osc.start()
    const stopTime = this.ctx.currentTime + 0.2
    osc.stop(stopTime)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
      osc.onended = null
    }
  }
}

class MusicSequencer {
  private static audio: HTMLAudioElement | null = null
  private static isPlaying = false

  private static init() {
    if (this.audio) return
    this.audio = new Audio(backgroundMusicUrl)
    this.audio.loop = true
    this.audio.preload = 'metadata'
    this.audio.volume = 0.42
  }

  static start() {
    this.init()
    if (!this.audio || this.isPlaying) return

    this.isPlaying = true
    void this.audio.play().catch(() => {
      this.isPlaying = false
    })
  }

  static stop() {
    if (!this.audio) return
    this.isPlaying = false
    this.audio.pause()
  }
}

type AiAdvisorProps = {
  isOptimized: boolean
  pulseKey: number
}

type LogEntry = {
  id: number
  text: string
}

type GeneratorState = {
  id: string
  name: string
  levels: readonly [string, string, string]
  level: number
  baseCost: number
  costMultiplier: number
  baseProduction: number // Wh/min
  productionByLevel?: readonly [number, number, number]
  icon: string
  color: string
}

type GeneratorLevelInfo = {
  currentLevel: number
  currentName: string
  currentLabel: string
  nextLevel: number | null
  nextName: string | null
  shopName: string
  shopLabel: string
  isMaxLevel: boolean
}

type ConsumerLevel = {
  name: string
  demandWhPerMinute: number
  revenuePerMinute: number
}

type UpgradeState = {
  id: string
  name: string
  description: string
  level: number
  baseCost: number
  costMultiplier: number
  icon: LucideIcon
}

type ConsumptionUpgradeState = {
  id: MapConsumerId
  name: string
  description: string
  level: number
  levels: readonly [ConsumerLevel, ConsumerLevel, ConsumerLevel]
  baseCost: number
  costMultiplier: number
  icon: LucideIcon
  color: string
}

const initialGenerators: GeneratorState[] = [
  {
    id: 'solar',
    name: 'Solaire',
    levels: ['Toiture solaire', 'Ferme solaire', 'Parc solaire avec stockage'],
    level: 0,
    baseCost: 180,
    costMultiplier: 1.18,
    baseProduction: 50,
    productionByLevel: [50, 100, 300],
    icon: '☀️',
    color: '#fde047',
  },
  {
    id: 'wind',
    name: 'Éolien',
    levels: ['Petite éolienne', 'Parc éolien terrestre', 'Parc éolien offshore'],
    level: 0,
    baseCost: 600,
    costMultiplier: 1.21,
    baseProduction: 500,
    icon: '🌬️',
    color: '#60a5fa',
  },
  {
    id: 'biomass',
    name: 'Biomasse',
    levels: ['Générateur biomasse', 'Centrale biomasse', 'Complexe bioénergie'],
    level: 0,
    baseCost: 8200,
    costMultiplier: 1.24,
    baseProduction: 5000,
    icon: '🪵',
    color: '#34d399',
  },
  {
    id: 'hydro',
    name: 'Hydro',
    levels: ['Micro-turbine', 'Petite centrale hydro', 'Barrage hydroélectrique'],
    level: 0,
    baseCost: 19000,
    costMultiplier: 1.26,
    baseProduction: 8000,
    icon: '💧',
    color: '#38bdf8',
  },
  {
    id: 'geothermal',
    name: 'Géothermie',
    levels: ['Puits géothermique', 'Centrale géothermique', 'Géothermie profonde'],
    level: 0,
    baseCost: 28000,
    costMultiplier: 1.28,
    baseProduction: 50000,
    icon: '🔥',
    color: '#fb923c',
  },
  {
    id: 'gas',
    name: 'Gaz',
    levels: ['Générateur au gaz', 'Turbine à gaz', 'Centrale à cycle combiné'],
    level: 0,
    baseCost: 58000,
    costMultiplier: 1.3,
    baseProduction: 500000,
    icon: '⛽',
    color: '#f97316',
  },
  {
    id: 'coal',
    name: 'Charbon',
    levels: ['Petite centrale charbon', 'Centrale charbon', 'Centrale charbon supercritique'],
    level: 0,
    baseCost: 102000,
    costMultiplier: 1.32,
    baseProduction: 3000000,
    icon: '⬛',
    color: '#94a3b8',
  },
  {
    id: 'nuclear',
    name: 'Nucléaire',
    levels: ['Petit réacteur modulaire', 'Centrale nucléaire', 'Complexe nucléaire'],
    level: 0,
    baseCost: 174000,
    costMultiplier: 1.34,
    baseProduction: 16700000,
    icon: '⚛️',
    color: '#a78bfa',
  },
  {
    id: 'fusion',
    name: 'Fusion',
    levels: ['Prototype de fusion', 'Réacteur de fusion', 'Centrale de fusion'],
    level: 0,
    baseCost: 280000,
    costMultiplier: 1.38,
    baseProduction: 50000000,
    icon: '🌀',
    color: '#67e8f9',
  },
]

const getEffectiveGeneratorLevel = (generator: GeneratorState) =>
  Math.min(Math.max(generator.level, 0), generator.levels.length)

const getGeneratorProductionAtLevel = (generator: GeneratorState, level: number, multiplier: number) => {
  const safeLevel = Math.min(Math.max(level, 0), generator.levels.length)
  if (safeLevel <= 0) return 0

  const baseProduction = generator.productionByLevel?.[safeLevel - 1] ?? safeLevel * generator.baseProduction
  return baseProduction * multiplier
}

const getGeneratorProduction = (generator: GeneratorState, multiplier: number) =>
  getGeneratorProductionAtLevel(generator, getEffectiveGeneratorLevel(generator), multiplier)

const getGeneratorNextProductionGain = (generator: GeneratorState, multiplier: number) => {
  const currentLevel = getEffectiveGeneratorLevel(generator)
  const nextLevel = Math.min(currentLevel + 1, generator.levels.length)
  return getGeneratorProductionAtLevel(generator, nextLevel, multiplier) - getGeneratorProductionAtLevel(generator, currentLevel, multiplier)
}

const getGeneratorLevelInfo = (generator: GeneratorState): GeneratorLevelInfo => {
  const currentLevel = getEffectiveGeneratorLevel(generator)
  const currentName = currentLevel > 0 ? generator.levels[currentLevel - 1] : 'À débloquer'
  const nextLevel = currentLevel < generator.levels.length ? currentLevel + 1 : null
  const nextName = nextLevel ? generator.levels[nextLevel - 1] : null
  const isMaxLevel = nextLevel === null

  return {
    currentLevel,
    currentName,
    currentLabel: currentLevel > 0
      ? `${generator.name} · Niveau ${currentLevel} actif`
      : `${generator.name} · Non actif`,
    nextLevel,
    nextName,
    shopName: nextName ?? currentName,
    shopLabel: nextName
      ? `${generator.name} · Prochain Niveau ${nextLevel}`
      : `${generator.name} · Niveau ${currentLevel} maximum`,
    isMaxLevel,
  }
}

const getGeneratorDisplayName = (generator: GeneratorState) => getGeneratorLevelInfo(generator).shopName

const getActiveConsumerLevel = (consumer: ConsumptionUpgradeState) => {
  if (consumer.level <= 0) return null
  return consumer.levels[Math.min(consumer.level - 1, consumer.levels.length - 1)]
}

const getConsumerDemandWhPerMinute = (consumer: ConsumptionUpgradeState) =>
  getActiveConsumerLevel(consumer)?.demandWhPerMinute ?? 0

const getConsumerRevenuePerMinute = (consumer: ConsumptionUpgradeState) =>
  (getActiveConsumerLevel(consumer)?.revenuePerMinute ?? 0) * CONSUMER_REVENUE_MULTIPLIER

const getNextConsumerLevel = (consumer: ConsumptionUpgradeState) =>
  consumer.level < consumer.levels.length ? consumer.levels[consumer.level] : null

const getConsumerLevelSummary = (consumer: ConsumptionUpgradeState) => {
  const activeLevel = getActiveConsumerLevel(consumer)
  return activeLevel ? activeLevel.name : 'À débloquer'
}

const getClickPowerForLevel = (level: number) => {
  const safeLevel = Math.min(Math.max(level, 1), CLICK_POWER_MAX_LEVEL)
  const progress = (safeLevel - 1) / (CLICK_POWER_MAX_LEVEL - 1)
  return Math.round(CLICK_POWER_MIN_WH * Math.pow(CLICK_POWER_MAX_WH / CLICK_POWER_MIN_WH, progress))
}

const initialTechUpgrades: UpgradeState[] = [
  { id: 'click', name: 'Amplification de Clic', description: 'Puissance de clic progressive jusqu’à 5 MWh/clic', level: 1, baseCost: 320, costMultiplier: 1.35, icon: Zap },
  { id: 'gridSell', name: 'Arbitrage Boursier', description: '+20% de revenus par Wh vendu à la bourse', level: 0, baseCost: 1200, costMultiplier: 1.32, icon: Coins },
  { id: 'storage', name: 'Stockage', description: 'Capacité de réserve (3 paliers)', level: 0, baseCost: 1000, costMultiplier: 1.28, icon: BatteryCharging },
  { id: 'smartAI', name: 'Rendement Global', description: '+10% de production globale', level: 0, baseCost: 3200, costMultiplier: 1.34, icon: BrainCircuit },
  { id: 'chartUnlock', name: 'Courbe Financière', description: 'Débloque le graphique du marché en temps réel', level: 0, baseCost: 9500, costMultiplier: 2.0, icon: Activity },
]

const TECH_UPGRADE_MAX_LEVELS: Record<string, number> = {
  click: CLICK_POWER_MAX_LEVEL,
  gridSell: 10,
  storage: STORAGE_MAX_LEVEL,
  smartAI: 10,
  chartUnlock: 1,
}

const getTechUpgradeBaseCost = (upgradeId: string): number =>
  initialTechUpgrades.find((upgrade) => upgrade.id === upgradeId)?.baseCost ?? 0

const getTechUpgradeMaxLevel = (upgradeId: string): number =>
  TECH_UPGRADE_MAX_LEVELS[upgradeId] ?? Number.POSITIVE_INFINITY

const centralNodeUpgradeIds = new Set(['click', 'storage'])

const initialConsumptionUpgrades: ConsumptionUpgradeState[] = [
  {
    id: 'residential',
    name: 'Résidentiel',
    description: 'Évolution de la charge domestique de la ville.',
    level: 0,
    levels: [
      { name: 'Maisons', demandWhPerMinute: 20, revenuePerMinute: 2 },
      { name: 'Immeubles', demandWhPerMinute: 300, revenuePerMinute: 7 },
      { name: 'Quartier résidentiel intelligent', demandWhPerMinute: 5000, revenuePerMinute: 20 },
    ],
    baseCost: 1200,
    costMultiplier: 1.28,
    icon: House,
    color: '#a78bfa',
  },
  {
    id: 'commerce',
    name: 'Commerce',
    description: 'Activité marchande et bâtiments tertiaires.',
    level: 0,
    levels: [
      { name: 'Magasins', demandWhPerMinute: 100, revenuePerMinute: 4 },
      { name: 'Centre commercial', demandWhPerMinute: 10000, revenuePerMinute: 45 },
      { name: "Quartier d'affaires", demandWhPerMinute: 100000, revenuePerMinute: 220 },
    ],
    baseCost: 2400,
    costMultiplier: 1.3,
    icon: Store,
    color: '#facc15',
  },
  {
    id: 'industry',
    name: 'Industrie',
    description: 'Demande productive, lourde et régulière.',
    level: 0,
    levels: [
      { name: 'Atelier', demandWhPerMinute: 1000, revenuePerMinute: 12 },
      { name: 'Usine', demandWhPerMinute: 50000, revenuePerMinute: 160 },
      { name: 'Complexe industriel', demandWhPerMinute: 500000, revenuePerMinute: 1200 },
    ],
    baseCost: 4600,
    costMultiplier: 1.31,
    icon: Factory,
    color: '#fb923c',
  },
  {
    id: 'publicServices',
    name: 'Services publics',
    description: 'Infrastructures essentielles et charge urbaine critique.',
    level: 0,
    levels: [
      { name: 'Éclairage public', demandWhPerMinute: 200, revenuePerMinute: 3 },
      { name: 'Hôpital', demandWhPerMinute: 20000, revenuePerMinute: 90 },
      { name: 'Réseau urbain critique', demandWhPerMinute: 150000, revenuePerMinute: 600 },
    ],
    baseCost: 8000,
    costMultiplier: 1.32,
    icon: Hospital,
    color: '#38bdf8',
  },
  {
    id: 'transport',
    name: 'Transport',
    description: 'Mobilité électrique et réseau de charge public.',
    level: 0,
    levels: [
      { name: 'Bornes de recharge', demandWhPerMinute: 500, revenuePerMinute: 8 },
      { name: 'Tramway', demandWhPerMinute: 30000, revenuePerMinute: 280 },
      { name: 'Métro électrique', demandWhPerMinute: 300000, revenuePerMinute: 1800 },
    ],
    baseCost: 14500,
    costMultiplier: 1.33,
    icon: TrainFront,
    color: '#22d3ee',
  },
  {
    id: 'data',
    name: 'Data',
    description: 'Télécoms, serveurs et calcul intensif.',
    level: 0,
    levels: [
      { name: 'Antenne télécom', demandWhPerMinute: 100, revenuePerMinute: 6 },
      { name: 'Serveurs locaux', demandWhPerMinute: 5000, revenuePerMinute: 90 },
      { name: 'Data center', demandWhPerMinute: 200000, revenuePerMinute: 1500 },
    ],
    baseCost: 26000,
    costMultiplier: 1.34,
    icon: Server,
    color: '#60a5fa',
  },
  {
    id: 'research',
    name: 'Recherche',
    description: 'Formation, laboratoires et innovation énergétique.',
    level: 0,
    levels: [
      { name: 'École technique', demandWhPerMinute: 300, revenuePerMinute: 10 },
      { name: 'Laboratoire', demandWhPerMinute: 10000, revenuePerMinute: 220 },
      { name: 'Centre de recherche énergétique', demandWhPerMinute: 80000, revenuePerMinute: 1500 },
    ],
    baseCost: 47000,
    costMultiplier: 1.35,
    icon: GraduationCap,
    color: '#34d399',
  },
  {
    id: 'climate',
    name: 'Climat',
    description: 'Chauffage, climatisation et réseau thermique.',
    level: 0,
    levels: [
      { name: 'Chauffage résidentiel', demandWhPerMinute: 1000, revenuePerMinute: 9 },
      { name: 'Climatisation urbaine', demandWhPerMinute: 80000, revenuePerMinute: 350 },
      { name: 'Réseau thermique intelligent', demandWhPerMinute: 250000, revenuePerMinute: 2200 },
    ],
    baseCost: 78000,
    costMultiplier: 1.36,
    icon: ThermometerSun,
    color: '#f97316',
  },
]

const DEMO_STANDARD_CONSUMER_LEVELS: Readonly<Record<MapConsumerId, number>> = {
  residential: 0,
  commerce: 2,
  industry: 1,
  publicServices: 1,
  transport: 1,
  data: 1,
  research: 1,
  climate: 1,
}

let logIdCounter = Date.now()

const initialLogs: LogEntry[] = [
  { id: logIdCounter++, text: '🔋 Bienvenue dans EnergyFlux. Bâtissez le réseau. Maîtrisez le flux. Alimentez la ville. Découvrez l’énergie autrement.' },
]

const normalizeMinuteOfDay = (minute: number) =>
  ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY

const formatGameClockLabel = (minute: number) => {
  const normalizedMinute = normalizeMinuteOfDay(minute)
  const hour = Math.floor(normalizedMinute / 60)
  const minutes = normalizedMinute % 60

  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const createChartPoint = (
  minute: number,
  productionEnergy: number,
  consumptionEnergy: number,
  battery: number,
  cost: number,
): EnergyChartPoint => ({
  hour: formatGameClockLabel(minute),
  minuteOfDay: normalizeMinuteOfDay(minute),
  productionEnergy,
  consumptionEnergy,
  battery,
  cost,
})

const baseChartData = Array.from({ length: CHART_HISTORY_WINDOW_MINUTES }, (_, minute) => {
  const hour = minute / 60
  const minuteRatio = minute / MINUTES_PER_DAY
  const solarCycle = Math.max(0, Math.sin(((hour - 6) / 24) * Math.PI * 2))
  const demandCycle = 1 - Math.cos(((hour - 8) / 24) * Math.PI * 2) * 0.25
  const production = Math.round(180 + solarCycle * 760 + Math.sin(minuteRatio * Math.PI * 2) * 35)
  const consumption = Math.round(390 + (1 - solarCycle) * 350 + (1 - demandCycle) * 80)
  const battery = Math.round(45 + solarCycle * 30 + demandCycle * 4)
  const cost = Math.round(38 + (1 - solarCycle) * 24 + demandCycle * 5)

  return createChartPoint(
    minute,
    Math.max(90, production),
    Math.max(250, consumption),
    Math.min(100, Math.max(35, battery)),
    Math.max(24, cost),
  )
})

const prependLog = (entries: LogEntry[], text: string) => {
  const next = [{ id: logIdCounter++, text }, ...entries]
  return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next
}

type CircularHistoryState<T> = {
  buffer: T[]
  capacity: number
  start: number
  length: number
}

const createCircularHistory = <T,>(initial: readonly T[], capacity: number): CircularHistoryState<T> => {
  const safeCapacity = Math.max(1, Math.floor(capacity))
  const normalized = initial.length >= safeCapacity ? initial.slice(initial.length - safeCapacity) : initial.slice()

  return {
    buffer: [...normalized],
    capacity: safeCapacity,
    start: 0,
    length: Math.min(normalized.length, safeCapacity),
  }
}

const appendToCircularHistory = <T,>(history: CircularHistoryState<T>, item: T) => {
  if (history.capacity <= 0) return

  if (history.length < history.capacity) {
    history.buffer[history.length] = item
    history.length += 1
    return
  }

  history.buffer[history.start] = item
  history.start += 1
  if (history.start >= history.capacity) {
    history.start = 0
  }
}

const snapshotCircularHistory = <T,>(history: CircularHistoryState<T>): T[] => {
  if (history.length <= 0) return []

  if (history.length < history.capacity) {
    return history.buffer.slice(0, history.length)
  }

  if (history.start === 0) {
    return [...history.buffer]
  }

  return [...history.buffer.slice(history.start), ...history.buffer.slice(0, history.start)]
}

const sortCompletedLast = <T,>(items: readonly T[], isComplete: (item: T) => boolean) =>
  items
    .map((item, index) => ({ item, index, isComplete: isComplete(item) }))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || a.index - b.index)
    .map(({ item }) => item)

const formatMoney = (num: number, options?: { signed?: boolean }) =>
  formatCompactUnit(num, ['€', 'k€', 'M€', 'G€'], {
    ...options,
    rawDecimals: Math.abs(num) < 100 ? 2 : 0,
  })

const formatObjectiveValue = (value: number, unit?: string) => {
  if (unit === 'Wh/min') return formatEnergyRate(value)
  if (unit === 'Wh') return formatEnergy(value)
  if (unit === '€') return formatMoney(value)
  return `${Math.round(value)}`
}

type EnergyObjectiveInput = {
  isDemoMode: boolean
  isPlayingMode: boolean
  generators: GeneratorState[]
  generationRate: number
  storedEnergy: number
  isChartUnlocked: boolean
  manualSellCount: number
  hasSecondarySource: boolean
  totalGeneratorLevels: number
  improvedResearchCount: number
  chartUnlockedLevel: number
  advancedGeneratorCount: number
  upgradedGeneratorCount: number
  nextAdvancedSourceName: string
  clickUpgradeLevel: number
  storageUpgradeLevel: number
  consumptionOptimizationCount: number
}

const buildEnergyObjectiveCandidates = ({
  generators,
  generationRate,
  storedEnergy,
  isChartUnlocked,
  manualSellCount,
  hasSecondarySource,
  totalGeneratorLevels,
  improvedResearchCount,
  chartUnlockedLevel,
  advancedGeneratorCount,
  upgradedGeneratorCount,
  nextAdvancedSourceName,
  clickUpgradeLevel,
  storageUpgradeLevel,
  consumptionOptimizationCount,
}: EnergyObjectiveInput): EnergyObjectiveCandidate[] => {
  const generatorById = new Map(generators.map((generator) => [generator.id, generator]))
  const solar = generatorById.get('solar')
  const wind = generatorById.get('wind')
  const biomass = generatorById.get('biomass')
  const activeMapSources = generators.filter((generator) => generator.level > 0).length
  const solarCost = solar ? Math.round(solar.baseCost * Math.pow(solar.costMultiplier, solar.level)) : 0
  const windCost = wind ? Math.round(wind.baseCost * Math.pow(wind.costMultiplier, wind.level)) : 0
  const biomassCost = biomass ? Math.round(biomass.baseCost * Math.pow(biomass.costMultiplier, biomass.level)) : 0
  const chartUnlockCost = getTechUpgradeBaseCost('chartUnlock')

  return [
    {
      key: 'buy-solar',
      title: 'Lancer la production',
      focus: 'Achète une Toiture solaire pour créer une production passive.',
      action: `Onglet Production : Toiture solaire niveau 1 (${formatMoney(solarCost)}).`,
      progressCurrent: solar?.level ?? 0,
      progressTarget: 1,
      progressUnit: 'niveau',
      rewardLabel: 'Production passive',
      isComplete: (solar?.level ?? 0) > 0,
    },
    {
      key: 'reach-1kw',
      title: 'Passer au kWh/min',
      focus: 'Atteins 1 kWh/min pour sortir de l’échelle d’un seul panneau solaire.',
      action: (wind?.level ?? 0) === 0
        ? `Onglet Production : achète Petite éolienne dès que possible (${formatMoney(windCost)}).`
        : `Il manque ${formatEnergyRate(Math.max(1000 - generationRate, 0))}. Améliore une source active.`,
      progressCurrent: generationRate,
      progressTarget: 1000,
      progressUnit: 'Wh/min',
      rewardLabel: 'Lecture en kWh/min',
      isComplete: generationRate >= 1000,
    },
    {
      key: 'store-first-energy',
      title: 'Créer une réserve',
      focus: 'Laisse le surplus créer une première réserve vendable.',
      action: `Réserve actuelle : ${formatEnergy(storedEnergy)}. La vente est disponible dès que la réserve contient de l’énergie.`,
      progressCurrent: storedEnergy,
      progressTarget: 1,
      progressUnit: 'Wh',
      rewardLabel: 'Vente possible',
      isComplete: storedEnergy > 0,
    },
    {
      key: 'first-market-order',
      title: 'Premier ordre de marché',
      focus: 'Place un ordre de vente à la Bourse énergie pour transformer le stock en trésorerie.',
      action: 'Clique sur Vendre le stock dès que la réserve contient de l’énergie.',
      progressCurrent: manualSellCount,
      progressTarget: 1,
      progressUnit: 'ordre',
      rewardLabel: 'Trésorerie',
      isComplete: manualSellCount >= 1,
    },
    {
      key: 'upgrade-central-node',
      title: 'Renforcer le nœud central',
      focus: 'Améliore le clic pour accélérer les premières réserves manuelles.',
      action: 'Onglet Nœud : achète Amplification de Clic niveau 2.',
      progressCurrent: Math.max(0, clickUpgradeLevel - 1),
      progressTarget: 1,
      progressUnit: 'niveau',
      rewardLabel: 'Clic renforcé',
      isComplete: clickUpgradeLevel > 1,
    },
    {
      key: 'add-second-source',
      title: 'Diversifier le mix',
      focus: 'Active une deuxième source pour comparer les flux de production.',
      action: `Onglet Production : sources actives ${activeMapSources} / 2. Priorité : ${wind?.level ? 'Générateur biomasse' : 'Petite éolienne'}.`,
      progressCurrent: activeMapSources,
      progressTarget: 2,
      progressUnit: 'source',
      rewardLabel: 'Mix énergétique',
      isComplete: hasSecondarySource,
    },
    {
      key: 'optimize-demand',
      title: 'Connecter la ville',
      focus: 'Ajoute des consommateurs pour donner un vrai rôle à ton réseau électrique.',
      action: 'Onglet Consommation : fais évoluer un consommateur jusqu’au Level 3.',
      progressCurrent: consumptionOptimizationCount,
      progressTarget: 3,
      progressUnit: 'level',
      rewardLabel: 'Ville alimentée',
      isComplete: consumptionOptimizationCount >= 3,
    },
    {
      key: 'reach-10kw',
      title: 'Atteindre 10 kWh/min',
      focus: 'Franchis 10 kWh/min pour rendre les flux plus lisibles sur la carte.',
      action: `Production actuelle : ${formatEnergyRate(generationRate)}. Il manque ${formatEnergyRate(Math.max(10000 - generationRate, 0))}.`,
      progressCurrent: generationRate,
      progressTarget: 10000,
      progressUnit: 'Wh/min',
      rewardLabel: 'Flux renforcés',
      isComplete: generationRate >= 10000,
    },
    {
      key: 'add-biomass',
      title: 'Ajouter la biomasse',
      focus: 'Active la biomasse pour compléter les trois producteurs visibles de la carte.',
      action: `Onglet Production : Générateur biomasse niveau 1 (${formatMoney(biomassCost)}).`,
      progressCurrent: biomass?.level ?? 0,
      progressTarget: 1,
      progressUnit: 'niveau',
      rewardLabel: 'Carte complète',
      isComplete: (biomass?.level ?? 0) > 0,
    },
    {
      key: 'upgrade-buffer',
      title: 'Augmenter la réserve',
      focus: 'Améliore la capacité tampon pour préparer des ventes plus fortes.',
      action: storageUpgradeLevel >= STORAGE_MAX_LEVEL
        ? 'Nœud central : Stockage réseau au Tier 3, capacité maximale atteinte.'
        : `Onglet Nœud : passe au ${getStorageNextTier(storageUpgradeLevel)?.name ?? 'niveau suivant'} (${formatEnergy(getStorageCapacity(storageUpgradeLevel + 1))} max).`,
      progressCurrent: storageUpgradeLevel,
      progressTarget: STORAGE_MAX_LEVEL,
      progressUnit: 'niveau',
      rewardLabel: 'Stockage amélioré',
      isComplete: storageUpgradeLevel >= STORAGE_MAX_LEVEL,
    },
    {
      key: 'unlock-chart',
      title: 'Lire le signal 24h',
      focus: 'Débloque le graphique pour suivre production horaire, consommation et réserve.',
      action: `Onglet Recherches : Courbe Financière (${chartUnlockedLevel > 0 ? 'débloqué' : `coût ${formatMoney(chartUnlockCost)}`}).`,
      progressCurrent: isChartUnlocked ? 1 : 0,
      progressTarget: 1,
      progressUnit: 'niveau',
      rewardLabel: 'Lecture 24h',
      isComplete: isChartUnlocked,
    },
    {
      key: 'generator-expansion',
      title: 'Renforcer le parc',
      focus: 'Atteins 6 niveaux cumulés sur tes producteurs.',
      action: `Niveaux cumulés : ${totalGeneratorLevels} / 6.`,
      progressCurrent: totalGeneratorLevels,
      progressTarget: 6,
      progressUnit: 'niveau',
      rewardLabel: 'Débit stabilisé',
      isComplete: totalGeneratorLevels >= 6,
    },
    {
      key: 'reach-100kw',
      title: 'Entrer en phase industrielle',
      focus: 'Franchis 100 kWh/min pour préparer les sources avancées.',
      action: `Production actuelle : ${formatEnergyRate(generationRate)}. Il manque ${formatEnergyRate(Math.max(100000 - generationRate, 0))}.`,
      progressCurrent: generationRate,
      progressTarget: 100000,
      progressUnit: 'Wh/min',
      rewardLabel: 'Phase industrielle',
      isComplete: generationRate >= 100000,
    },
    {
      key: 'add-advanced-source',
      title: 'Débloquer une source avancée',
      focus: 'Ajoute une nouvelle filière pour découvrir hydro, géothermie, gaz, charbon, nucléaire ou fusion.',
      action: `Prochaine source : ${nextAdvancedSourceName}.`,
      progressCurrent: advancedGeneratorCount,
      progressTarget: 1,
      progressUnit: 'source',
      rewardLabel: 'Nouveau palier',
      isComplete: advancedGeneratorCount >= 1,
    },
    {
      key: 'multi-sources',
      title: 'Construire un mix complet',
      focus: 'Active 4 sources différentes pour répartir la production.',
      action: `Sources actives : ${upgradedGeneratorCount} / 4.`,
      progressCurrent: upgradedGeneratorCount,
      progressTarget: 4,
      progressUnit: 'source',
      rewardLabel: 'Mix complet',
      isComplete: upgradedGeneratorCount >= 4,
    },
    {
      key: 'research-depth',
      title: 'Structurer la R&D',
      focus: 'Atteins 3 améliorations de recherche ou de nœud pour accélérer la progression.',
      action: `Améliorations validées : ${improvedResearchCount} / 3.`,
      progressCurrent: improvedResearchCount,
      progressTarget: 3,
      progressUnit: 'amélioration',
      rewardLabel: 'R&D active',
      isComplete: improvedResearchCount >= 3,
    },
    {
      key: 'reach-1mw',
      title: 'Franchir 1 MWh/min',
      focus: 'Passe au MWh/min pour changer d’échelle de réseau.',
      action: `Production actuelle : ${formatEnergyRate(generationRate)}. Il manque ${formatEnergyRate(Math.max(1000000 - generationRate, 0))}.`,
      progressCurrent: generationRate,
      progressTarget: 1000000,
      progressUnit: 'Wh/min',
      rewardLabel: 'Échelle MWh/min',
      isComplete: generationRate >= 1000000,
    },
    {
      key: 'reach-10mw',
      title: 'Franchir 10 MWh/min',
      focus: 'Fais passer le réseau à une échelle métropolitaine.',
      action: `Production actuelle : ${formatEnergyRate(generationRate)}. Il manque ${formatEnergyRate(Math.max(10000000 - generationRate, 0))}.`,
      progressCurrent: generationRate,
      progressTarget: 10000000,
      progressUnit: 'Wh/min',
      rewardLabel: 'Échelle métropole',
      isComplete: generationRate >= 10000000,
    },
    {
      key: 'six-active-sources',
      title: 'Activer six filières',
      focus: 'Diversifie fortement le mix pour stabiliser les flux de production.',
      action: `Sources actives : ${upgradedGeneratorCount} / 6.`,
      progressCurrent: upgradedGeneratorCount,
      progressTarget: 6,
      progressUnit: 'source',
      rewardLabel: 'Mix robuste',
      isComplete: upgradedGeneratorCount >= 6,
    },
    {
      key: 'research-mastery',
      title: 'Industrialiser la R&D',
      focus: 'Atteins 5 améliorations réseau pour finaliser l’optimisation.',
      action: `Améliorations validées : ${improvedResearchCount} / 5.`,
      progressCurrent: improvedResearchCount,
      progressTarget: 5,
      progressUnit: 'amélioration',
      rewardLabel: 'Réseau optimisé',
      isComplete: improvedResearchCount >= 5,
    },
  ]
}

const buildEnergyObjective = ({
  isDemoMode,
  isPlayingMode,
  completedObjectiveKeys,
  ...input
}: EnergyObjectiveInput & {
  completedObjectiveKeys: ReadonlySet<string>
}): EnergyObjective => {
  const candidates = buildEnergyObjectiveCandidates({ isDemoMode, isPlayingMode, ...input })
  const totalCount = candidates.length
  const isCandidateComplete = (candidate: EnergyObjectiveCandidate) =>
    candidate.isComplete || completedObjectiveKeys.has(candidate.key)
  const completedCount = candidates.filter(isCandidateComplete).length

  if (!isPlayingMode && isDemoMode) {
    return {
      key: 'demo-start',
      title: 'Démo avancée',
      focus: 'Observe la boucle : production → stockage → marché → trésorerie.',
      action: 'Ajuste les niveaux pour voir les flux accélérer.',
      rewardLabel: 'Lecture du réseau',
      completedCount,
      totalCount,
    }
  }

  const nextObjective = candidates.find((candidate) => !isCandidateComplete(candidate))

  if (nextObjective) {
    return {
      ...nextObjective,
      completedCount,
      totalCount,
    }
  }

  return {
    key: 'all-objectives-complete',
    title: 'Parcours complet',
    focus: 'Tous les objectifs de découverte sont atteints. Le réseau est maîtrisé.',
    action: 'Continue à optimiser les rendements, les ventes et le mix énergétique.',
    progressCurrent: totalCount,
    progressTarget: totalCount,
    progressUnit: 'objectif',
    rewardLabel: 'Félicitations',
    completedCount,
    totalCount,
    isFinalObjective: true,
  }
}

export function EnergyControlTower() {
  const [appMode, setAppMode] = useState<'monitor' | 'menu' | 'playing'>('menu')
  const [introStep, setIntroStep] = useState<IntroStep>('title')
  const [launchingStartMode, setLaunchingStartMode] = useState<StartMode | null>(null)
  const isDemoMode = appMode === 'monitor'
  const isPlayingMode = appMode === 'playing'
  const [muted, setMuted] = useState(false)
  const introTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const launchingStartModeRef = useRef<StartMode | null>(null)
  const startModeTransitionTimeoutRef = useRef<number | null>(null)
  const manualGridFlowTimeoutRef = useRef<number | null>(null)
  const manualStorageFlowTimeoutRef = useRef<number | null>(null)
  const [clickPulseToken, setClickPulseToken] = useState(0)
  const pendingHubEnergyRef = useRef(0)
  const hubClickFlushFrameRef = useRef<number | null>(null)
  const [showObjectiveFireworks, setShowObjectiveFireworks] = useState(false)
  const [objectiveFireworksToken, setObjectiveFireworksToken] = useState(0)
  const objectiveCompletionRef = useRef(false)
  const objectiveFireworksTimeoutRef = useRef<number | null>(null)
  const shownMilestoneFactIdsRef = useRef<Set<string>>(new Set())
  const [isPerformanceMode, setIsPerformanceMode] = useState(false)
  const isPerformanceModeRef = useRef(false)
  const [flowPerfLevel, setFlowPerfLevel] = useState<FlowPerformanceLevel>('normal')
  const flowPerfLevelRef = useRef<FlowPerformanceLevel>('normal')
  const isDocumentHiddenRef = useRef(false)
  const gameTickCounterRef = useRef(0)
  const gameChartMinuteRef = useRef(CHART_HISTORY_WINDOW_MINUTES)
  const demoChartMinuteRef = useRef(CHART_HISTORY_WINDOW_MINUTES)
  const marketTrendRef = useRef<'up' | 'down' | 'stable'>('stable')

  // Currencies state
  const [watts, setWatts] = useState<number>(0)
  const [demoWatts, setDemoWatts] = useState<number>(0)
  const [manualSellCount, setManualSellCount] = useState<number>(0)
  const [money, setMoney] = useState<number>(STARTING_MONEY)

  // Market variables
  const [marketPriceMultiplier, setMarketPriceMultiplier] = useState<number>(1.0)
  const [marketTrend, setMarketTrend] = useState<'up' | 'down' | 'stable'>('stable')
  const [manualGridFlow, setManualGridFlow] = useState<number>(0)
  const [manualGridFlowDirection, setManualGridFlowDirection] = useState<ManualGridFlowDirection>('gridToHub')
  const [manualGridFlowRevenue, setManualGridFlowRevenue] = useState<number>(0)
  const [autoMarketFlow, setAutoMarketFlow] = useState<number>(0)
  const [manualStorageFlow, setManualStorageFlow] = useState<number>(0)
  const [manualStorageFlowLabel, setManualStorageFlowLabel] = useState<number>(0)

  // Game UI Tab
  const [activeTab, setActiveTab] = useState<ShopTab>('generators')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showSolarLaunchPulse, setShowSolarLaunchPulse] = useState(false)
  const launchPulseTimeoutRef = useRef<number | null>(null)
  const upgradePanelRef = useRef<HTMLDivElement | null>(null)

  // Upgrade Levels
  const [generators, setGenerators] = useState<GeneratorState[]>(() => initialGenerators)
  const [techUpgrades, setTechUpgrades] = useState<UpgradeState[]>(() => initialTechUpgrades)
  const [consumptionUpgrades, setConsumptionUpgrades] = useState<ConsumptionUpgradeState[]>(() => initialConsumptionUpgrades)
  const clickCountRef = useRef(0)

  // Refs for gameTick — allows the interval to read current values without recreating
  const marketPriceMultiplierRef = useRef(marketPriceMultiplier)
  const totalPassivePowerRateRef = useRef(0)
  const totalPowerConsumptionRef = useRef(0)
  const totalConsumerRevenueRef = useRef(0)
  const gridSellRateBonusRef = useRef(0)
  const storageWattsRef = useRef(0)
  const storageCapacityRef = useRef(STORAGE_BASE_CAPACITY)
  const isMarketUnlockedRef = useRef(false)

  // Floating log updates
  const [logs, setLogs] = useState<LogEntry[]>(() => initialLogs)
  const currentObjectiveRef = useRef('')
  const [completedObjectiveKeys, setCompletedObjectiveKeys] = useState<Set<string>>(() => new Set())

  // Circular buffers for chart histories
  const gameChartHistoryRef = useRef(createCircularHistory(baseChartData, CHART_HISTORY_WINDOW_MINUTES))
  const demoChartHistoryRef = useRef(createCircularHistory(baseChartData, CHART_HISTORY_WINDOW_MINUTES))
  const marketHistoryRef = useRef(createCircularHistory<MarketChartPoint>([], 15))
  const [gameChartHistory, setGameChartHistory] = useState<EnergyChartPoint[]>(() => [...baseChartData])
  const [demoChartHistory, setDemoChartHistory] = useState<EnergyChartPoint[]>(() => [...baseChartData])
  const [marketHistory, setMarketHistory] = useState<MarketChartPoint[]>([])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const updatePerformanceMode = () => {
      const next = mediaQuery.matches || document.hidden
      isDocumentHiddenRef.current = document.hidden
      isPerformanceModeRef.current = next
      setIsPerformanceMode((prev) => (prev === next ? prev : next))
    }

    updatePerformanceMode()

    const handleVisibilityChange = () => {
      updatePerformanceMode()
    }

    mediaQuery.addEventListener('change', updatePerformanceMode)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mediaQuery.removeEventListener('change', updatePerformanceMode)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (appMode === 'menu' || isPerformanceMode) {
      if (flowPerfLevelRef.current !== 'minimal') {
        flowPerfLevelRef.current = isPerformanceMode ? 'minimal' : 'normal'
        setFlowPerfLevel(flowPerfLevelRef.current)
      }
      return
    }

    if (appMode !== 'monitor' && appMode !== 'playing') return

    const frameSamples: number[] = []
    let frameHandle: number
    let lastFrame = performance.now()

    const sampleFrame = (timestamp: number) => {
      const delta = timestamp - lastFrame
      lastFrame = timestamp

      if (delta > 0 && delta < 1500) {
        frameSamples.push(delta)
        if (frameSamples.length > FLOW_PERF_SAMPLE_SIZE) {
          frameSamples.shift()
        }

        if (frameSamples.length === FLOW_PERF_SAMPLE_SIZE) {
          const avg = frameSamples.reduce((total, value) => total + value, 0) / frameSamples.length
          const nextPerfLevel: FlowPerformanceLevel =
            avg > FLOW_PERF_MINIMAL_THRESHOLD_MS
              ? 'minimal'
              : avg > FLOW_PERF_REDUCED_THRESHOLD_MS
                ? 'reduced'
                : avg > FLOW_PERF_RECOVER_NORMAL_MS
                  ? flowPerfLevelRef.current === 'minimal'
                    ? 'reduced'
                    : flowPerfLevelRef.current
                  : 'normal'

          if (nextPerfLevel !== flowPerfLevelRef.current) {
            flowPerfLevelRef.current = nextPerfLevel
            setFlowPerfLevel(nextPerfLevel)
          }
        }
      }

      frameHandle = requestAnimationFrame(sampleFrame)
    }

    frameHandle = requestAnimationFrame(sampleFrame)

    return () => {
      if (frameHandle) cancelAnimationFrame(frameHandle)
    }
  }, [appMode, isPerformanceMode])

  const toggleMute = useCallback(() => {
    const isMuted = SoundEffects.toggleMute()
    setMuted(isMuted)
  }, [])

  const techUpgradesById = useMemo(() => {
    const map = new Map<string, UpgradeState>()
    techUpgrades.forEach((upgrade) => {
      map.set(upgrade.id, upgrade)
    })
    return map
  }, [techUpgrades])

  const mapGenerators = useMemo(() => {
    if (!isDemoMode) return generators

    return generators.map((generator) => {
      const demoLevel = DEMO_STANDARD_GENERATOR_LEVELS[generator.id]
      if (demoLevel === undefined) return generator
      return { ...generator, level: demoLevel }
    })
  }, [generators, isDemoMode])

  const generatorsById = useMemo(() => {
    const map = new Map<string, GeneratorState>()
    mapGenerators.forEach((generator) => {
      map.set(generator.id, generator)
    })
    return map
  }, [mapGenerators])

  const isMarketUnlocked = isPlayingMode
  const isChartUnlocked = (techUpgradesById.get('chartUnlock')?.level ?? 0) > 0
  const storageUpgradeLevel = isDemoMode ? 3 : (techUpgradesById.get('storage')?.level ?? 0)
  const storageCapacity = getStorageCapacity(storageUpgradeLevel)
  const storageTierLabel = getStorageTierLabel(storageUpgradeLevel)

  const addLog = useCallback((entry: string) => {
    setLogs((prev) => prependLog(prev, entry))
  }, [])

  const addTenThousandEuros = useCallback(() => {
    setMoney((prev) => prev + 10000)
    addLog('💶 Trésorerie augmentée de +10 000 €')
  }, [addLog])

  const openResetConfirm = useCallback(() => {
    SoundEffects.click()
    setShowResetConfirm(true)
  }, [])

  const closeResetConfirm = useCallback(() => {
    SoundEffects.click()
    setShowResetConfirm(false)
  }, [])

  const resetGame = useCallback(() => {
    setShowResetConfirm(false)

    if (manualGridFlowTimeoutRef.current) {
      clearTimeout(manualGridFlowTimeoutRef.current)
      manualGridFlowTimeoutRef.current = null
    }
    if (manualStorageFlowTimeoutRef.current) {
      clearTimeout(manualStorageFlowTimeoutRef.current)
      manualStorageFlowTimeoutRef.current = null
    }
    if (objectiveFireworksTimeoutRef.current) {
      clearTimeout(objectiveFireworksTimeoutRef.current)
      objectiveFireworksTimeoutRef.current = null
    }
    if (hubClickFlushFrameRef.current) {
      cancelAnimationFrame(hubClickFlushFrameRef.current)
      hubClickFlushFrameRef.current = null
    }
    pendingHubEnergyRef.current = 0

    clickCountRef.current = 0
    gameTickCounterRef.current = 0
    gameChartMinuteRef.current = CHART_HISTORY_WINDOW_MINUTES
    demoChartMinuteRef.current = CHART_HISTORY_WINDOW_MINUTES
    currentObjectiveRef.current = ''
    objectiveCompletionRef.current = false
    marketTrendRef.current = 'stable'
    marketPriceMultiplierRef.current = 1
    totalPassivePowerRateRef.current = 0
    totalPowerConsumptionRef.current = 0
    totalConsumerRevenueRef.current = 0
    storageWattsRef.current = 0
    gridSellRateBonusRef.current = 0
    storageCapacityRef.current = STORAGE_BASE_CAPACITY
    isMarketUnlockedRef.current = false

    SoundEffects.click()
    setWatts(0)
    setDemoWatts(0)
    setManualSellCount(0)
    setMoney(STARTING_MONEY)
    setMarketPriceMultiplier(1)
    setMarketTrend('stable')
    setManualGridFlow(0)
    setManualGridFlowDirection('gridToHub')
    setManualGridFlowRevenue(0)
    setAutoMarketFlow(0)
    setManualStorageFlow(0)
    setManualStorageFlowLabel(0)
    setActiveTab('generators')
    setClickPulseToken(0)
    setShowObjectiveFireworks(false)
    setObjectiveFireworksToken(0)
    setGenerators(initialGenerators.map((generator) => ({ ...generator })))
    setTechUpgrades(initialTechUpgrades.map((upgrade) => ({ ...upgrade })))
    setConsumptionUpgrades(initialConsumptionUpgrades.map((upgrade) => ({ ...upgrade })))
    setLogs(prependLog(initialLogs, '↻ Partie réinitialisée.'))
    setCompletedObjectiveKeys(new Set())
    gameChartHistoryRef.current = createCircularHistory(baseChartData, CHART_HISTORY_WINDOW_MINUTES)
    demoChartHistoryRef.current = createCircularHistory(baseChartData, CHART_HISTORY_WINDOW_MINUTES)
    marketHistoryRef.current = createCircularHistory([], 15)
    setGameChartHistory(snapshotCircularHistory(gameChartHistoryRef.current))
    setDemoChartHistory(snapshotCircularHistory(demoChartHistoryRef.current))
    setMarketHistory([])
  }, [])

  const clearIntroTimers = useCallback(() => {
    introTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    introTimersRef.current = []
  }, [])

  const launchStartMode = useCallback((mode: StartMode) => {
    if (launchingStartModeRef.current) return

    SoundEffects.click()
    clearIntroTimers()
    launchingStartModeRef.current = mode
    setLaunchingStartMode(mode)

    if (startModeTransitionTimeoutRef.current) {
      window.clearTimeout(startModeTransitionTimeoutRef.current)
    }

    startModeTransitionTimeoutRef.current = window.setTimeout(() => {
      startModeTransitionTimeoutRef.current = null
      launchingStartModeRef.current = null
      setLaunchingStartMode(null)
      setAppMode(mode)

      if (mode === 'playing') {
        setShowSolarLaunchPulse(true)

        if (launchPulseTimeoutRef.current) {
          window.clearTimeout(launchPulseTimeoutRef.current)
        }

        launchPulseTimeoutRef.current = window.setTimeout(() => {
          setShowSolarLaunchPulse(false)
          launchPulseTimeoutRef.current = null
        }, 6000)
      }
    }, START_MODE_ZOOM_MS)
  }, [clearIntroTimers])

  const startGameMode = useCallback(() => {
    launchStartMode('playing')
  }, [launchStartMode])

  const startDemoMode = useCallback(() => {
    launchStartMode('monitor')
  }, [launchStartMode])

  const skipStartIntro = useCallback(() => {
    if (appMode !== 'menu' || introStep === 'menu') return
    clearIntroTimers()
    setIntroStep('menu')
  }, [appMode, clearIntroTimers, introStep])

  useEffect(() => {
    if (appMode !== 'menu') return

    clearIntroTimers()
    introTimersRef.current.push(
      window.setTimeout(() => setIntroStep('title'), 0),
      window.setTimeout(() => setIntroStep('tagline'), TITLE_SCREEN_STEP_MS),
      window.setTimeout(() => setIntroStep('menu'), TITLE_SCREEN_STEP_MS + TAGLINE_SCREEN_STEP_MS),
    )

    return () => {
      clearIntroTimers()
    }
  }, [appMode, clearIntroTimers])

  useEffect(() => {
    if (appMode !== 'menu' || introStep === 'menu') return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        skipStartIntro()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [appMode, introStep, skipStartIntro])

  useEffect(() => {
    return () => {
      if (startModeTransitionTimeoutRef.current) {
        window.clearTimeout(startModeTransitionTimeoutRef.current)
      }
      if (launchPulseTimeoutRef.current) {
        window.clearTimeout(launchPulseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!showResetConfirm) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowResetConfirm(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showResetConfirm])

  const techUpgradeIndexById = useMemo(() => {
    const map = new Map<string, number>()
    techUpgrades.forEach((upgrade, index) => {
      map.set(upgrade.id, index)
    })
    return map
  }, [techUpgrades])

  const consumptionUpgradeIndexById = useMemo(() => {
    const map = new Map<ConsumptionUpgradeState['id'], number>()
    consumptionUpgrades.forEach((upgrade, index) => {
      map.set(upgrade.id, index)
    })
    return map
  }, [consumptionUpgrades])

  const mapConsumptionUpgrades = useMemo(() => {
    if (!isDemoMode) return consumptionUpgrades

    return consumptionUpgrades.map((consumer) => ({
      ...consumer,
      level: DEMO_STANDARD_CONSUMER_LEVELS[consumer.id] ?? consumer.level,
    }))
  }, [consumptionUpgrades, isDemoMode])

  const consumptionUpgradesById = useMemo(() => {
    const map = new Map<ConsumptionUpgradeState['id'], ConsumptionUpgradeState>()
    mapConsumptionUpgrades.forEach((upgrade) => {
      map.set(upgrade.id, upgrade)
    })
    return map
  }, [mapConsumptionUpgrades])

  // --- INCREMENTAL CALCULATORS ---
  const smartUpgradeLevel = useMemo(() => techUpgradesById.get('smartAI')?.level ?? 0, [techUpgradesById])

  const multiplier = 1 + smartUpgradeLevel * 0.1
  const activeMultiplier = useMemo(() => (isDemoMode ? 1 : multiplier), [isDemoMode, multiplier])

  const totalPassivePowerRate = useMemo(() => {
    return mapGenerators.reduce((acc, gen) => acc + getGeneratorProduction(gen, activeMultiplier), 0)
  }, [mapGenerators, activeMultiplier])

  const resolveConsumptionFlows = useCallback(
    () => {
      const byId = mapConsumerIds.reduce(
        (acc, id) => {
          const consumer = consumptionUpgradesById.get(id)
          acc[id] = consumer ? getConsumerDemandWhPerMinute(consumer) : 0
          return acc
        },
        {} as Record<MapConsumerId, number>,
      )
      const revenueById = mapConsumerIds.reduce(
        (acc, id) => {
          const consumer = consumptionUpgradesById.get(id)
          acc[id] = consumer ? getConsumerRevenuePerMinute(consumer) : 0
          return acc
        },
        {} as Record<MapConsumerId, number>,
      )
      const total = mapConsumerIds.reduce((sum, id) => sum + byId[id], 0)
      const totalRevenue = mapConsumerIds.reduce((sum, id) => sum + revenueById[id], 0)
      return { byId, revenueById, total, totalRevenue }
    },
    [consumptionUpgradesById],
  )

  const totalConsumptionFlows = useMemo(
    () => resolveConsumptionFlows(),
    [resolveConsumptionFlows],
  )

  const totalPowerConsumption = useMemo(() => Math.round(totalConsumptionFlows.total), [totalConsumptionFlows.total])
  const totalConsumerRevenue = useMemo(
    () => Math.round(totalConsumptionFlows.totalRevenue),
    [totalConsumptionFlows.totalRevenue],
  )

  // Clicking Click Power
  const clickPowerVal = useMemo(() => {
    const clickUpgradeLvl = techUpgradesById.get('click')?.level ?? 1
    return getClickPowerForLevel(clickUpgradeLvl)
  }, [techUpgradesById])

  const gridSellRateBonus = useMemo(
    () => 1 + (techUpgradesById.get('gridSell')?.level ?? 0) * 0.2,
    [techUpgradesById],
  )
  const getTechUpgradeCurrentValueLabel = useCallback((upgrade: UpgradeState) => {
    if (upgrade.id === 'click') return `Actuel: +${formatEnergy(clickPowerVal)}/clic`
    if (upgrade.id === 'gridSell') return `Actuel: +${Math.round((gridSellRateBonus - 1) * 100)}%`
    if (upgrade.id === 'storage') {
      const capacity = getStorageCapacity(upgrade.level)
      return `Actuel: ${getStorageTierLabel(upgrade.level)} (${formatEnergy(capacity)})`
    }
    if (upgrade.id === 'smartAI') return `Actuel: +${upgrade.level * 10}%`
  if (upgrade.id === 'chartUnlock') return upgrade.level > 0 ? 'Actuel: Débloqué' : 'Actuel: Bloqué'
    return ''
  }, [clickPowerVal, gridSellRateBonus])
  const marketSellRate = MARKET_BASE_SELL_RATE * marketPriceMultiplier * gridSellRateBonus

  const visibleShopGenerators = useMemo(
    () => (isDemoMode ? mapGenerators : generators),
    [generators, isDemoMode, mapGenerators],
  )

  const sortedShopGenerators = useMemo(
    () => sortCompletedLast(visibleShopGenerators, (generator) => getGeneratorLevelInfo(generator).isMaxLevel),
    [visibleShopGenerators],
  )

  const sortedConsumptionUpgrades = useMemo(
    () => sortCompletedLast(mapConsumptionUpgrades, (consumer) => !getNextConsumerLevel(consumer)),
    [mapConsumptionUpgrades],
  )

  const centralNodeUpgrades = useMemo(
    () => techUpgrades.filter((upgrade) => centralNodeUpgradeIds.has(upgrade.id)),
    [techUpgrades],
  )

  const researchUpgrades = useMemo(
    () => techUpgrades.filter((upgrade) => !centralNodeUpgradeIds.has(upgrade.id)),
    [techUpgrades],
  )

  const isInteractiveMode = isPlayingMode
  const displayWatts = isDemoMode ? demoWatts : watts
  const displayMoney = money

  const mapGeneratorStats = useMemo(
    () =>
      mapProducerIds.reduce(
        (acc, id) => {
          acc[id] = generatorsById.get(id)
          return acc
        },
        {} as Record<MapProducerId, GeneratorState | undefined>,
      ),
    [generatorsById],
  )

  const mapGeneratorFlows = useMemo(() => {
    return mapProducerIds.reduce(
      (acc, id) => {
        const generator = mapGeneratorStats[id]
        acc[id] = generator ? getGeneratorProduction(generator, activeMultiplier) : 0
        return acc
      },
      {} as Record<MapProducerId, number>,
    )
  }, [mapGeneratorStats, activeMultiplier])

  const mapConsumptionFlows = useMemo(
    () => resolveConsumptionFlows(),
    [resolveConsumptionFlows],
  )
  const mapConsumerFlows = mapConsumptionFlows.byId
  const mapConsumerCentralFlows = useMemo(() => {
    const totalDemand = mapConsumptionFlows.total
    const availableToServe = Math.max(0, totalPassivePowerRate + displayWatts)
    const centralShareRate = totalDemand > 0 ? Math.min(1, availableToServe / totalDemand) : 0

    const central: Record<MapConsumerId, number> = mapConsumerIds.reduce(
      (acc, id) => {
        const demand = mapConsumptionFlows.byId[id] ?? 0
        acc[id] = Math.max(0, demand * centralShareRate)
        return acc
      },
      {} as Record<MapConsumerId, number>,
    )

    const market: Record<MapConsumerId, number> = mapConsumerIds.reduce(
      (acc, id) => {
        const demand = mapConsumptionFlows.byId[id] ?? 0
        const marketFlow = demand - central[id]
        acc[id] = isMarketUnlocked ? Math.max(0, marketFlow) : 0
        return acc
      },
      {} as Record<MapConsumerId, number>,
    )

    return { central, market }
  }, [mapConsumptionFlows, totalPassivePowerRate, displayWatts, isMarketUnlocked])

  const mapConsumerHubFlows = mapConsumerCentralFlows.central
  const mapConsumerMarketFlows = mapConsumerCentralFlows.market
  const effectiveFlowPerfLevel: FlowPerformanceLevel = isPerformanceMode ? 'minimal' : flowPerfLevel
  const storageFlowRate = useMemo(() => {
    const rawStorageFlowRate = totalPassivePowerRate - totalPowerConsumption
    const availableToChargePerMinute = Math.max(0, storageCapacity - displayWatts) / SIMULATED_MINUTES_PER_TICK
    const availableToDischargePerMinute = displayWatts / SIMULATED_MINUTES_PER_TICK

    if (rawStorageFlowRate > 0) {
      return Math.min(rawStorageFlowRate, availableToChargePerMinute)
    }

    if (rawStorageFlowRate < 0) {
      return -Math.min(-rawStorageFlowRate, availableToDischargePerMinute)
    }

    return 0
  }, [displayWatts, storageCapacity, totalPassivePowerRate, totalPowerConsumption])
  const flowParticleCaps = useMemo<Record<string, number>>(() => {
    const baseGlobalBudget = isPerformanceMode ? FLOW_PARTICLE_GLOBAL_BUDGET_LOW_PERF : FLOW_PARTICLE_GLOBAL_BUDGET
    const adaptiveGlobalBudget = Math.max(24, Math.floor(baseGlobalBudget * FLOW_PERF_BUDGET_SCALE[effectiveFlowPerfLevel]))

    const requestedCaps = [
      ...mapProducerIds.map((id) => getFlowParticleDemand(Math.abs(mapGeneratorFlows[id]))),
      getFlowParticleDemand(Math.abs(manualGridFlow)),
      getFlowParticleDemand(Math.abs(autoMarketFlow)),
      getFlowParticleDemand(Math.abs(storageFlowRate)),
      getFlowParticleDemand(Math.abs(manualStorageFlow)),
      ...mapConsumerIds.map((id) => getFlowParticleDemand(Math.abs(mapConsumerHubFlows[id] ?? 0))),
      ...mapConsumerIds.map((id) => getFlowParticleDemand(Math.abs(mapConsumerMarketFlows[id] ?? 0))),
    ]

    const distributed = distributeParticleBudget(requestedCaps, adaptiveGlobalBudget)

    const producerCaps = mapProducerIds.reduce(
      (acc, id, index) => {
        acc[id] = distributed[index] ?? 0
        return acc
      },
      {} as Record<MapProducerId, number>,
    )
    const offset = mapProducerIds.length
    const manualGridFlowOffset = offset
    const autoMarketFlowOffset = manualGridFlowOffset + 1
    const storageOffset = autoMarketFlowOffset + 1
    const manualStorageOffset = storageOffset + 1
    const consumerCentralOffset = manualStorageOffset + 1
    const consumerMarketOffset = consumerCentralOffset + mapConsumerIds.length

    const consumerCentralCaps = mapConsumerIds.reduce(
      (acc, id, index) => {
        acc[id] = distributed[consumerCentralOffset + index] ?? 0
        return acc
      },
      {} as Record<MapConsumerId, number>,
    )
    const consumerMarketCaps = mapConsumerIds.reduce(
      (acc, id, index) => {
        acc[`${id}-market`] = distributed[consumerMarketOffset + index] ?? 0
        return acc
      },
      {} as Record<string, number>,
    )

    return {
      ...producerCaps,
      grid: distributed[manualGridFlowOffset] ?? 0,
      autoMarket: distributed[autoMarketFlowOffset] ?? 0,
      storage: distributed[storageOffset] ?? 0,
      manualStorage: distributed[manualStorageOffset] ?? 0,
      ...consumerCentralCaps,
      ...consumerMarketCaps,
    }
  }, [
    mapGeneratorFlows,
    manualGridFlow,
    autoMarketFlow,
    manualStorageFlow,
    mapConsumerHubFlows,
    mapConsumerMarketFlows,
    effectiveFlowPerfLevel,
    isPerformanceMode,
    storageFlowRate,
  ])

  const pixiNetworkFlows = useMemo<PixiEnergyFlow[]>(
    () => [
      ...mapProducerIds.map((id) => ({
        id: `${id}-flow`,
        path: pixiFlowPaths[id],
        color: 0x22c55e,
        value: mapGeneratorFlows[id],
        arrivalLabel: `+${formatEnergy(mapGeneratorFlows[id])}`,
        width: getFlowPathWidth(mapGeneratorFlows[id], 6),
        maxParticles: flowParticleCaps[id],
        visible: mapGeneratorFlows[id] > 0,
      })),
      {
        id: 'market-flow',
        path: manualGridFlowDirection === 'hubToGrid' ? pixiFlowPaths.hubToMarket : pixiFlowPaths.marketToHub,
        color: 0xfacc15,
        value: manualGridFlow,
        arrivalLabel: manualGridFlowDirection === 'hubToGrid'
          ? `-${formatEnergy(manualGridFlow)}\n+${formatMoney(manualGridFlowRevenue)}`
          : `-${formatEnergy(manualGridFlow)}`,
        width: getFlowPathWidth(manualGridFlow, 8),
        maxParticles: flowParticleCaps.grid,
        visible: manualGridFlow > 0,
        loop: false,
        speedMultiplier: 2.8,
      },
      {
        id: 'auto-market-flow',
        path: pixiFlowPaths.hubToMarket,
        color: 0xf59e0b,
        value: autoMarketFlow,
        arrivalLabel: `-${formatEnergy(autoMarketFlow)}\n+${formatMoney(autoMarketFlow * marketSellRate)}`,
        width: getFlowPathWidth(autoMarketFlow, 6),
        maxParticles: flowParticleCaps.autoMarket ?? 0,
        visible: autoMarketFlow > 0,
        speedMultiplier: 1.6,
      },
      {
        id: 'storage-click-flow',
        path: pixiFlowPaths.hubToStorage,
        color: 0x38bdf8,
        value: manualStorageFlow,
        arrivalLabel: `+${formatEnergy(manualStorageFlowLabel || manualStorageFlow)}`,
        width: getFlowPathWidth(manualStorageFlow, 7),
        maxParticles: flowParticleCaps.manualStorage,
        visible: manualStorageFlow > 0,
        loop: false,
        speedMultiplier: 1.9,
      },
      {
        id: 'storage-flow',
        path: storageFlowRate >= 0 ? pixiFlowPaths.hubToStorage : pixiFlowPaths.storageToHub,
        color: 0x38bdf8,
        value: Math.abs(storageFlowRate),
        arrivalLabel: storageFlowRate > 0
          ? `+${formatEnergy(storageFlowRate)}`
          : `-${formatEnergy(Math.abs(storageFlowRate))}`,
        width: getFlowPathWidth(Math.abs(storageFlowRate), 6),
        maxParticles: flowParticleCaps.storage,
        visible: Math.abs(storageFlowRate) > 0,
      },
      ...mapConsumerIds.map((id) => {
        const centralFlow = mapConsumerHubFlows[id] ?? 0
        const marketFlow = mapConsumerMarketFlows[id] ?? 0
        const flows: PixiEnergyFlow[] = []

        if (centralFlow > 0) {
          flows.push({
            id: `${id}-flow`,
            path: pixiFlowPaths[id],
            color: 0xfb923c,
            value: centralFlow,
            arrivalLabel: `-${formatEnergy(centralFlow)}`,
            width: getFlowPathWidth(centralFlow, 6),
            maxParticles: flowParticleCaps[id],
            visible: centralFlow > 0,
          })
        }

        if (marketFlow > 0) {
          flows.push({
            id: `${id}-market-flow`,
            path: marketToConsumerFlowPaths[id],
            color: 0xfacc15,
            value: marketFlow,
            arrivalLabel: `-${formatEnergy(marketFlow)}`,
            width: getFlowPathWidth(marketFlow, 6),
            maxParticles: flowParticleCaps[`${id}-market`] ?? 0,
            visible: marketFlow > 0,
          })
        }

        return flows
      }).flat(),
    ],
    [
      mapGeneratorFlows,
      manualGridFlowDirection,
      manualGridFlow,
      manualGridFlowRevenue,
      autoMarketFlow,
      marketSellRate,
      manualStorageFlow,
      manualStorageFlowLabel,
      mapConsumerHubFlows,
      mapConsumerMarketFlows,
      storageFlowRate,
      flowParticleCaps,
    ],
  )

  const generatorIndexById = useMemo(() => {
    const map = new Map<string, number>()
    generators.forEach((generator, index) => {
      map.set(generator.id, index)
    })
    return map
  }, [generators])

  const energyObjectiveInput = useMemo<EnergyObjectiveInput>(() => {
    const hasSecondarySource = generators.filter((gen) => gen.level > 0).length >= 2
    const totalGeneratorLevels = generators.reduce((acc, gen) => acc + getEffectiveGeneratorLevel(gen), 0)
    const improvedResearchCount = techUpgrades.reduce((count, upgrade) => {
      if (upgrade.id === 'click') {
        return count + (upgrade.level > 1 ? 1 : 0)
      }
      return count + (upgrade.level > 0 ? 1 : 0)
    }, 0)
    const advancedGeneratorCount = generators.reduce(
      (count, generator) =>
        count + (!mapGeneratorIds.has(generator.id) && generator.level > 0 ? 1 : 0),
      0,
    )
    const nextAdvancedSource = generators.find((gen) => !mapGeneratorIds.has(gen.id) && gen.level === 0)
    const nextAdvancedSourceName = nextAdvancedSource ? getGeneratorDisplayName(nextAdvancedSource) : 'une source avancée'
    const upgradedGeneratorCount = generators.reduce((count, generator) => count + (generator.level > 0 ? 1 : 0), 0)
    const chartUnlockedLevel = techUpgradesById.get('chartUnlock')?.level ?? 0
    const clickUpgradeLevel = techUpgradesById.get('click')?.level ?? 1
    const storageUpgradeLevel = techUpgradesById.get('storage')?.level ?? 0
    const consumptionOptimizationCount = mapConsumptionUpgrades.reduce(
      (highestLevel, upgrade) => Math.max(highestLevel, upgrade.level),
      0,
    )

    return {
      isDemoMode,
      isPlayingMode,
      generators,
      generationRate: totalPassivePowerRate,
      storedEnergy: displayWatts,
      isChartUnlocked,
      manualSellCount,
      hasSecondarySource,
      totalGeneratorLevels,
      improvedResearchCount,
      chartUnlockedLevel,
      advancedGeneratorCount,
      upgradedGeneratorCount,
      nextAdvancedSourceName,
      clickUpgradeLevel,
      storageUpgradeLevel,
      consumptionOptimizationCount,
    }
  }, [
    isDemoMode,
    isPlayingMode,
    displayWatts,
    isChartUnlocked,
    manualSellCount,
    totalPassivePowerRate,
    generators,
    techUpgrades,
    techUpgradesById,
    mapConsumptionUpgrades,
  ])

  const objectiveCandidates = useMemo(
    () => buildEnergyObjectiveCandidates(energyObjectiveInput),
    [energyObjectiveInput],
  )

  const energyObjective = useMemo(
    () => buildEnergyObjective({
      ...energyObjectiveInput,
      completedObjectiveKeys,
    }),
    [completedObjectiveKeys, energyObjectiveInput],
  )

  const productionObjectiveProgress = useMemo(() => {
    const target = energyObjective.progressTarget
    const fallbackTarget = 1000
    const targetValue = target ?? fallbackTarget
    const currentValue = energyObjective.progressCurrent ?? totalPassivePowerRate
    const current = Math.min(currentValue, targetValue)
    const percent = Math.min(Math.round((current / targetValue) * 100), 100)
    const progressUnit = energyObjective.progressUnit ?? 'Wh/min'
    const valueLabel = `${formatObjectiveValue(current, progressUnit)} / ${formatObjectiveValue(targetValue, progressUnit)}`
    const completedCount = energyObjective.completedCount ?? 0
    const totalCount = energyObjective.totalCount ?? 0

    return {
      title: 'Objectif actuel',
      countLabel: totalCount > 0 ? `${completedCount} / ${totalCount} atteints` : '',
      text: energyObjective.focus,
      action: energyObjective.action,
      value: valueLabel,
      percent,
    }
  }, [
    energyObjective.action,
    energyObjective.completedCount,
    energyObjective.focus,
    energyObjective.progressCurrent,
    energyObjective.progressTarget,
    energyObjective.progressUnit,
    energyObjective.totalCount,
    totalPassivePowerRate,
  ])

  useEffect(() => {
    if (!isPlayingMode) return

    const updateHandle = window.setTimeout(() => {
      setCompletedObjectiveKeys((previousKeys) => {
        let hasChanged = false
        const nextKeys = new Set(previousKeys)

        objectiveCandidates.forEach((candidate) => {
          if (candidate.isComplete && !nextKeys.has(candidate.key)) {
            nextKeys.add(candidate.key)
            hasChanged = true
          }
        })

        return hasChanged ? nextKeys : previousKeys
      })
    }, 0)

    return () => {
      clearTimeout(updateHandle)
    }
  }, [isPlayingMode, objectiveCandidates])

  useEffect(() => {
    if (!isPlayingMode) return
    if (currentObjectiveRef.current === energyObjective.key) return
    currentObjectiveRef.current = energyObjective.key
    addLog(`🎯 Objectif: ${energyObjective.title}`)
  }, [addLog, isPlayingMode, energyObjective.key, energyObjective.title])

  useEffect(() => {
    if (!isPlayingMode) return

    const nextFact = getNextMilestoneFact(totalPassivePowerRate, shownMilestoneFactIdsRef.current)

    if (!nextFact) return

    shownMilestoneFactIdsRef.current.add(nextFact.id)
    console.info(`💡 Repère énergie : ${nextFact.title} — ${nextFact.text}`)
  }, [isPlayingMode, totalPassivePowerRate])

  useEffect(() => {
    if (!isPlayingMode) {
      objectiveCompletionRef.current = false
      return
    }

    if (!energyObjective.isFinalObjective) {
      objectiveCompletionRef.current = false
      return
    }

    if (objectiveCompletionRef.current) return

    objectiveCompletionRef.current = true
    setObjectiveFireworksToken((prev) => prev + 1)
    setShowObjectiveFireworks(true)
    addLog('🎆 Objectifs complets — Félicitations ! Les objectifs ont été franchis.')

    if (objectiveFireworksTimeoutRef.current) {
      clearTimeout(objectiveFireworksTimeoutRef.current)
    }
    objectiveFireworksTimeoutRef.current = window.setTimeout(() => {
      setShowObjectiveFireworks(false)
    }, 2400)

    return () => {
      if (objectiveFireworksTimeoutRef.current) {
        clearTimeout(objectiveFireworksTimeoutRef.current)
      }
      objectiveFireworksTimeoutRef.current = null
    }
  }, [addLog, isPlayingMode, energyObjective.key, energyObjective.isFinalObjective])

  // Handle background music lifecycle
  useEffect(() => {
    if (!muted) {
      MusicSequencer.start()
    } else {
      MusicSequencer.stop()
    }
    return () => MusicSequencer.stop()
  }, [muted])

  useEffect(() => {
    if (muted) return undefined

    const startMusicFromGesture = () => {
      MusicSequencer.start()
    }

    window.addEventListener('pointerdown', startMusicFromGesture)
    window.addEventListener('keydown', startMusicFromGesture)

    return () => {
      window.removeEventListener('pointerdown', startMusicFromGesture)
      window.removeEventListener('keydown', startMusicFromGesture)
    }
  }, [muted])

  useEffect(() => {
    upgradePanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (manualGridFlowTimeoutRef.current) {
        clearTimeout(manualGridFlowTimeoutRef.current)
      }
      manualGridFlowTimeoutRef.current = null
      if (manualStorageFlowTimeoutRef.current) {
        clearTimeout(manualStorageFlowTimeoutRef.current)
      }
      manualStorageFlowTimeoutRef.current = null
      if (objectiveFireworksTimeoutRef.current) {
        clearTimeout(objectiveFireworksTimeoutRef.current)
      }
      objectiveFireworksTimeoutRef.current = null
      if (hubClickFlushFrameRef.current) {
        cancelAnimationFrame(hubClickFlushFrameRef.current)
        hubClickFlushFrameRef.current = null
      }
      setManualGridFlowDirection('gridToHub')
    }
  }, [])

  // Sync refs with current state values for gameTick
  useEffect(() => { marketPriceMultiplierRef.current = marketPriceMultiplier }, [marketPriceMultiplier])
  useEffect(() => { totalPassivePowerRateRef.current = totalPassivePowerRate }, [totalPassivePowerRate])
  useEffect(() => { totalPowerConsumptionRef.current = totalPowerConsumption }, [totalPowerConsumption])
  useEffect(() => { totalConsumerRevenueRef.current = totalConsumerRevenue }, [totalConsumerRevenue])
  useEffect(() => { gridSellRateBonusRef.current = gridSellRateBonus }, [gridSellRateBonus])
  useEffect(() => { storageWattsRef.current = displayWatts }, [displayWatts])
  useEffect(() => { storageCapacityRef.current = storageCapacity }, [storageCapacity])
  useEffect(() => { isMarketUnlockedRef.current = isMarketUnlocked }, [isMarketUnlocked])
  useEffect(() => { marketTrendRef.current = marketTrend }, [marketTrend])
  useEffect(() => { isPerformanceModeRef.current = isPerformanceMode }, [isPerformanceMode])

  // Game active logic ticker
  useEffect(() => {
    if (appMode === 'menu') return

    const gameTick = setInterval(() => {
      if (isDocumentHiddenRef.current) return

      gameTickCounterRef.current += 1
      const shouldUpdateChart = gameTickCounterRef.current % CHART_UPDATE_TICK_DIVISOR === 0
      const shouldUpdateMarketHistory = gameTickCounterRef.current % MARKET_HISTORY_UPDATE_TICK_DIVISOR === 0

      const currentIsDemoMode = appMode === 'monitor'
      const currentIsPlayingMode = appMode === 'playing'
      const currentMarketPriceMultiplier = marketPriceMultiplierRef.current
      const currentTotalPassivePowerRate = totalPassivePowerRateRef.current
      const currentTotalPowerConsumption = totalPowerConsumptionRef.current
      const currentStoredWatts = storageWattsRef.current
      const currentTotalConsumerRevenue = totalConsumerRevenueRef.current
      const currentGridSellRateBonus = gridSellRateBonusRef.current
      const currentIsMarketUnlocked = isMarketUnlockedRef.current
      const currentStorageCapacity = storageCapacityRef.current

      const simulationMarketUnlocked = currentIsDemoMode ? false : currentIsMarketUnlocked

      const nextMarketMultiplier = simulationMarketUnlocked
        ? Math.max(
            0.4,
            Math.min(2.5, currentMarketPriceMultiplier + (Math.random() - 0.46) * 0.16),
          )
        : 1.0

      if (simulationMarketUnlocked && currentIsPlayingMode) {
        const nextTrend =
          nextMarketMultiplier > currentMarketPriceMultiplier ? 'up' : nextMarketMultiplier < currentMarketPriceMultiplier ? 'down' : 'stable'

        if (nextMarketMultiplier !== currentMarketPriceMultiplier) {
          setMarketPriceMultiplier(nextMarketMultiplier)
        }

        if (marketTrendRef.current !== nextTrend) {
          marketTrendRef.current = nextTrend
          setMarketTrend(nextTrend)
        }
      } else if (currentIsPlayingMode) {
        if (currentMarketPriceMultiplier !== 1.0) {
          setMarketPriceMultiplier(1.0)
        }
        if (marketTrendRef.current !== 'stable') {
          marketTrendRef.current = 'stable'
          setMarketTrend('stable')
        }
      }

      // Values are Wh/min. Each real tick simulates one in-game minute.
      const productionWhPerMinute = currentTotalPassivePowerRate
      const consumptionWhPerMinute = currentTotalPowerConsumption
      const netWhPerMinute = productionWhPerMinute - consumptionWhPerMinute
      const netEnergy = netWhPerMinute * SIMULATED_MINUTES_PER_TICK
      const deliveredConsumptionWh = Math.max(
        0,
        Math.min(consumptionWhPerMinute, productionWhPerMinute + currentStoredWatts),
      )
      const consumptionSatisfactionRate = consumptionWhPerMinute > 0
        ? Math.min(1, deliveredConsumptionWh / consumptionWhPerMinute)
        : 0
      const effectiveConsumerRevenue = currentTotalConsumerRevenue * consumptionSatisfactionRate * SIMULATED_MINUTES_PER_TICK

      // Passive cash flow: sell surplus automatically. Deficits can be sourced from the market without charging the player.
      const marketCashFlow = Math.max(0, netEnergy) * MARKET_BASE_SELL_RATE * (simulationMarketUnlocked ? nextMarketMultiplier : 1.0) * (currentIsDemoMode ? 1 : currentGridSellRateBonus)
      const consumerCashFlow = currentIsPlayingMode ? effectiveConsumerRevenue : 0
      const autoMarketSaleEnergy = currentIsPlayingMode && simulationMarketUnlocked ? Math.max(0, netEnergy) : 0
      setAutoMarketFlow(autoMarketSaleEnergy)

      // Store net energy in the buffer for manual grid sales.
      if (netEnergy !== 0 && currentIsPlayingMode) {
        setWatts((prevWatts) => clampToStorage(prevWatts + netEnergy, currentStorageCapacity))
      } else if (netEnergy !== 0) {
        setDemoWatts((prevWatts) => clampToStorage(prevWatts + netEnergy, currentStorageCapacity))
      }

      const totalCashFlow = currentIsPlayingMode ? marketCashFlow + consumerCashFlow : 0
      if (totalCashFlow !== 0) {
        setMoney((prevMoney) => prevMoney + totalCashFlow)
      }

      if (shouldUpdateChart) {
        // Add one simulated minute to the rolling 24h signal.
        const chartMinuteRef = currentIsPlayingMode ? gameChartMinuteRef : demoChartMinuteRef
        const chartMinute = chartMinuteRef.current
        chartMinuteRef.current += SIMULATED_MINUTES_PER_TICK
        const batteryUsage = Math.min(100, Math.max(0, (productionWhPerMinute / (consumptionWhPerMinute || 1)) * 100))
        const updatedPoint = createChartPoint(
          chartMinute,
          productionWhPerMinute,
          consumptionWhPerMinute,
          batteryUsage,
          Math.round(marketCashFlow),
        )

        if (currentIsPlayingMode) {
          appendToCircularHistory(gameChartHistoryRef.current, updatedPoint)
          setGameChartHistory(snapshotCircularHistory(gameChartHistoryRef.current))
        } else {
          appendToCircularHistory(demoChartHistoryRef.current, updatedPoint)
          setDemoChartHistory(snapshotCircularHistory(demoChartHistoryRef.current))
        }
      }

      // Record market history for line chart visualization
      if (shouldUpdateMarketHistory && simulationMarketUnlocked && currentIsPlayingMode) {
        const timeStr = new Date().toLocaleTimeString('fr-FR', { minute: '2-digit', second: '2-digit' })
        appendToCircularHistory(marketHistoryRef.current, {
          time: timeStr,
          cours: parseFloat((MARKET_BASE_SELL_RATE * nextMarketMultiplier * currentGridSellRateBonus).toFixed(4)),
        })
        setMarketHistory(snapshotCircularHistory(marketHistoryRef.current))
      }
    }, FLOW_TICK_INTERVAL_MS)

    return () => clearInterval(gameTick)
  }, [appMode]) // Stable dependency — refs handle volatile values

  const triggerHubClickFlow = useCallback((addedEnergy: number) => {
    if (addedEnergy <= 0) return

    setManualStorageFlow((prev) => prev + addedEnergy)
    setManualStorageFlowLabel(addedEnergy)

    if (manualStorageFlowTimeoutRef.current) {
      clearTimeout(manualStorageFlowTimeoutRef.current)
    }

    manualStorageFlowTimeoutRef.current = window.setTimeout(() => {
      setManualStorageFlow(0)
      setManualStorageFlowLabel(0)
    }, MANUAL_GRID_FLOW_VISUAL_DURATION_MS)
  }, [])

  const applyHubClickToStorage = useCallback(
    (addedEnergy: number) => {
      const apply = (setStorage: Dispatch<SetStateAction<number>>) => {
        setStorage((prev) => {
          const next = clampToStorage(prev + addedEnergy, storageCapacity)
          const added = next - prev
          triggerHubClickFlow(added)
          return next
        })
      }

      if (isDemoMode) {
        apply(setDemoWatts)
      } else {
        apply(setWatts)
      }
    },
    [isDemoMode, storageCapacity, triggerHubClickFlow],
  )

  const flushPendingHubClicks = useCallback(() => {
    const queuedEnergy = pendingHubEnergyRef.current
    pendingHubEnergyRef.current = 0
    hubClickFlushFrameRef.current = null

    if (queuedEnergy <= 0) return
    applyHubClickToStorage(queuedEnergy)
  }, [applyHubClickToStorage])

  // Click on Center Hub handler
  const handleHubClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (clickPowerVal <= 0) return

    clickCountRef.current += 1
    SoundEffects.click(clickCountRef.current)
    pendingHubEnergyRef.current += clickPowerVal
    setClickPulseToken((prev) => prev + 1)

    if (hubClickFlushFrameRef.current !== null) return
    hubClickFlushFrameRef.current = window.requestAnimationFrame(() => {
      flushPendingHubClicks()
    })

  }, [clickPowerVal, flushPendingHubClicks])

  // Buy Generator Upgrade
  const buyGenerator = useCallback((genId: string) => {
    if (!isInteractiveMode) return

    const genIndex = generatorIndexById.get(genId)
    if (genIndex === undefined) return

    const generator = generatorsById.get(genId)
    if (!generator) return

    const levelInfo = getGeneratorLevelInfo(generator)
    if (levelInfo.isMaxLevel || !levelInfo.nextName || !levelInfo.nextLevel) {
      SoundEffects.error()
      return
    }

    const cost = Math.round(generator.baseCost * Math.pow(generator.costMultiplier, generator.level))

    if (money >= cost) {
      SoundEffects.upgrade()
      setMoney(prev => prev - cost)
      setGenerators(prev =>
        prev.map((g, idx) => (idx === genIndex ? { ...g, level: g.level + 1 } : g))
      )
      if (genId === 'solar' && showSolarLaunchPulse) {
        if (launchPulseTimeoutRef.current) {
          window.clearTimeout(launchPulseTimeoutRef.current)
          launchPulseTimeoutRef.current = null
        }
        setShowSolarLaunchPulse(false)
      }
      addLog(`🛠️ Production : ${levelInfo.nextName} Level ${levelInfo.nextLevel}`)
    } else {
      SoundEffects.error()
    }
  }, [addLog, generatorIndexById, generatorsById, isInteractiveMode, money, showSolarLaunchPulse])

  // Buy Tech Upgrade
  const buyTechUpgrade = useCallback((techId: string) => {
    if (!isInteractiveMode) return

    const techIndex = techUpgradeIndexById.get(techId)
    if (techIndex === undefined) return

    const upgrade = techUpgradesById.get(techId)
    if (!upgrade) return

    if (upgrade.level >= getTechUpgradeMaxLevel(techId)) {
      SoundEffects.error()
      return
    }

    const cost = Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level))

    if (money >= cost) {
      SoundEffects.upgrade()
      setMoney(prev => prev - cost)
      setTechUpgrades(prev =>
        prev.map((u, idx) => (idx === techIndex ? { ...u, level: u.level + 1 } : u))
      )
      addLog(`${centralNodeUpgradeIds.has(techId) ? '🔷 Nœud central' : '💡 Recherches'} : Acheté ${upgrade.name} Niveau ${upgrade.level + 1}`)
    } else {
      SoundEffects.error()
    }
  }, [addLog, isInteractiveMode, money, techUpgradeIndexById, techUpgradesById])

  const buyConsumptionUpgrade = useCallback((upgradeId: ConsumptionUpgradeState['id']) => {
    if (!isInteractiveMode) return

    const upgradeIndex = consumptionUpgradeIndexById.get(upgradeId)
    if (upgradeIndex === undefined) return

    const upgrade = consumptionUpgradesById.get(upgradeId)
    if (!upgrade) return
    const nextLevel = getNextConsumerLevel(upgrade)
    if (!nextLevel) {
      SoundEffects.error()
      return
    }

    const cost = Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level))

    if (money >= cost) {
      SoundEffects.upgrade()
      setMoney((prev) => prev - cost)
      setConsumptionUpgrades((prev) =>
        prev.map((item, index) => (index === upgradeIndex ? { ...item, level: item.level + 1 } : item)),
      )
      addLog(`🏙️ Consommation : ${upgrade.name} évolue vers ${nextLevel.name} Level ${upgrade.level + 1}`)
    } else {
      SoundEffects.error()
    }
  }, [addLog, consumptionUpgradeIndexById, consumptionUpgradesById, isInteractiveMode, money])

  const sellEnergy = useCallback(() => {
    if (!isInteractiveMode) return

    if (displayWatts > MINIMUM_MARKET_SELL_AMOUNT) {
      const cashEarned = Math.round(displayWatts * marketSellRate)
      if (cashEarned > 0) {
        const soldAmount = displayWatts
        if (manualGridFlowTimeoutRef.current) {
          clearTimeout(manualGridFlowTimeoutRef.current)
        }

        setManualGridFlow(soldAmount)
        setManualGridFlowDirection('hubToGrid')
        setManualGridFlowRevenue(cashEarned)
        manualGridFlowTimeoutRef.current = window.setTimeout(() => {
          setManualGridFlow(0)
          setManualGridFlowDirection('gridToHub')
          setManualGridFlowRevenue(0)
        }, MANUAL_GRID_FLOW_VISUAL_DURATION_MS)
        setManualSellCount((prevCount) => prevCount + 1)

        SoundEffects.upgrade()
        setMoney(prev => prev + cashEarned)
        setWatts(0)
        addLog(`📈 Ordre exécuté : ${formatEnergy(displayWatts)} vendu sur la Bourse énergie pour ${formatMoney(cashEarned)}`)
      } else {
        SoundEffects.error()
      }
    } else {
      SoundEffects.error()
    }
  }, [addLog, displayWatts, isInteractiveMode, marketSellRate])

  const latestSignalPoint = isDemoMode ? demoChartHistory.at(-1) : gameChartHistory.at(-1)
  const signalProduction = latestSignalPoint?.productionEnergy ?? totalPassivePowerRate
  const signalConsumption = latestSignalPoint?.consumptionEnergy ?? totalPowerConsumption
  const isManualExportActive = manualGridFlow > 0 && manualGridFlowDirection === 'hubToGrid'
  const isStorageCapReached = storageCapacity > 0 ? displayWatts >= storageCapacity : false
  const exportNodeColor = displayWatts > MINIMUM_MARKET_SELL_AMOUNT || isStorageCapReached || isManualExportActive ? '#facc15' : '#60a5fa'
  const networkBalance = totalPassivePowerRate - totalPowerConsumption
  const networkEfficiency = totalPassivePowerRate > 0
    ? Math.round((networkBalance / totalPassivePowerRate) * 100)
    : 0
  const networkBalanceLabel = `Solde : ${formatSignedEnergyRate(networkBalance)}`
  const consumerRevenuePerMinute = totalConsumerRevenue * (totalPowerConsumption > 0 ? Math.min(1, (totalPassivePowerRate + displayWatts) / totalPowerConsumption) : 0)
  const netSalesEnergyPerMinute = totalPassivePowerRate - totalPowerConsumption
  const passiveSalesEnergyPerMinute = Math.max(0, netSalesEnergyPerMinute)
  const passiveSalesRevenuePerMinute = passiveSalesEnergyPerMinute * marketSellRate
  const marketAutoSaleEnabled = isMarketUnlocked && isPlayingMode
  const marketLabel = marketAutoSaleEnabled
    ? `Tarif ${formatMoney(marketSellRate)}/Wh`
    : 'Marché verrouillé'
  const marketAutoSaleInfo = marketAutoSaleEnabled
    ? `Vente auto : ${formatEnergy(passiveSalesEnergyPerMinute)}/min • ${formatMoney(passiveSalesRevenuePerMinute)}/min`
    : 'Mode démo / verrouillé'
  const introWordmark = (sizeClass = 'text-[clamp(2.2rem,8vw,4.8rem)]') => (
    <div className="relative inline-flex flex-col">
      <span className="relative inline-block">
        <motion.span
          className="pointer-events-none absolute -inset-8 rounded-full bg-cyan-300/12 blur-[26px] saturate-150"
          animate={{ opacity: [0.16, 0.38, 0.16], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <motion.span
          className="pointer-events-none absolute -left-16 right-0 top-1/2 h-[2px] w-[120%] -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent blur-sm"
          initial={{ scaleX: 0, opacity: 0, y: 8 }}
          animate={{ scaleX: 1, opacity: 0.7, y: 0 }}
          transition={{ duration: 1.4, delay: 0.2, ease: 'easeOut' }}
        />
        <h1
          className={`relative ${sizeClass} font-black tracking-tight text-cyan-100`}
          style={{ textShadow: '0 0 18px rgba(103, 232, 249, 0.45), 0 0 34px rgba(16, 185, 129, 0.28)' }}
        >
          Energy
          <span className="relative inline-block overflow-hidden">
            Flux
            <motion.span
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent"
              animate={{ x: ['0%', '300%'] }}
              transition={{ duration: 1.1, ease: 'easeInOut', repeat: 0 }}
            />
            <motion.span
              className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-r from-transparent via-white/16 to-transparent"
              animate={{ opacity: [0, 0.35, 0] }}
              transition={{ duration: 1.1, repeat: 0 }}
            />
          </span>
        </h1>
      </span>
    </div>
  )
  return (
    <main className="energy-shell relative isolate min-h-screen overflow-y-auto bg-[#02040b] text-slate-100 lg:h-screen lg:overflow-hidden">
      <AnimatePresence>
        {appMode === 'menu' ? (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overflow-x-hidden bg-slate-950/78 px-4 py-6 backdrop-blur-md sm:py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={introStep === 'menu' ? undefined : skipStartIntro}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                skipStartIntro()
              }
            }}
            tabIndex={0}
          >
            <motion.div
              className="pointer-events-none absolute -left-1/4 top-10 h-[40vh] w-[55vw] rounded-full bg-cyan-300/12 blur-[90px]"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 0.4, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
            <motion.div
              className="pointer-events-none absolute -right-1/4 bottom-8 h-[35vh] w-[52vw] rounded-full bg-emerald-300/10 blur-[90px]"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 0.3, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
            <motion.div
              className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent"
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 1.1 }}
            />
            <motion.button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                toggleMute()
              }}
              className={`absolute left-4 top-4 z-20 inline-flex h-8 items-center gap-2 rounded border px-3 text-xs font-bold transition-colors ${
                muted
                  ? 'border-white/10 bg-slate-950/70 text-slate-300 hover:bg-slate-950/90'
                  : 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.18)] hover:bg-emerald-500/20'
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.4 }}
              aria-label={muted ? 'Réactiver la musique' : 'Couper la musique'}
              title={muted ? 'Réactiver la musique' : 'Couper la musique'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{muted ? 'Son coupé' : 'Mute'}</span>
            </motion.button>
            <motion.div
              className="relative z-10 flex min-h-[calc(100svh-3rem)] w-full max-w-[760px] flex-col items-center justify-start pt-[10svh] sm:pt-[12svh]"
              animate={launchingStartMode
                ? { opacity: 0, scale: 1.14, y: -18, filter: 'blur(8px)' }
                : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
              }
              transition={{ duration: launchingStartMode ? 0.46 : 0.28, ease: 'easeInOut' }}
            >
              <motion.div
                className="text-center"
                initial={{ opacity: 0, scale: 0.96, y: 4 }}
                animate={{ opacity: 1, scale: 1.02, y: 0 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              >
                {introWordmark()}
              </motion.div>

              <AnimatePresence mode="wait">
                {introStep === 'tagline' || introStep === 'menu' ? (
                  <motion.div
                    key="start-step-2"
                    className="w-full text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8, filter: 'blur(2px)' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    <motion.p
                      className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-relaxed text-cyan-50 md:text-lg"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.12 }}
                    >
                      Bâtissez le réseau. Maîtrisez le flux. Alimentez la ville.
                    </motion.p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {introStep === 'menu' ? (
                  <motion.div
                    key="start-step-3"
                    className="w-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  >
                    <motion.div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="start-mode-title"
                      className="relative mt-6 w-full overflow-hidden rounded-lg border border-cyan-300/30 bg-slate-950/96 p-4 shadow-[0_0_42px_rgba(103,232,249,0.22)] sm:p-5"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent" />
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-cyan-300/30 bg-cyan-500/12 text-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.18)]">
                          <Eye className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 id="start-mode-title" className="text-base font-black text-white">
                            Bienvenue dans EnergyFlux.
                          </h2>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">
                            Construisez un réseau énergétique, pilotez les flux en temps réel et alimentez la ville sans rupture.
                          </p>
                          <p className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-50">
                            Votre mission : équilibrer production, consommation et stockage pour maintenir le réseau stable, générer des revenus et faire évoluer votre infrastructure.
                          </p>
                          <div className="mt-3 grid gap-2 text-xs leading-relaxed text-slate-300 sm:grid-cols-2">
                            <p className="border-l border-cyan-300/35 pl-3">
                              <span className="font-semibold text-cyan-200">Les producteurs</span> injectent l’énergie dans le Cœur du réseau.
                            </p>
                            <p className="border-l border-cyan-300/35 pl-3">
                              <span className="font-semibold text-cyan-200">Le Cœur du réseau</span> répartit l’énergie vers les consommateurs.
                            </p>
                            <p className="border-l border-sky-300/35 pl-3">
                              <span className="font-semibold text-sky-200">Les consommateurs</span> utilisent l’énergie disponible et génèrent des revenus.
                            </p>
                            <p className="border-l border-emerald-300/35 pl-3">
                              <span className="font-semibold text-emerald-200">Le stockage</span> absorbe les surplus et les restitue en cas de besoin.
                            </p>
                            <p className="border-l border-yellow-300/35 pl-3">
                              <span className="font-semibold text-yellow-200">La bourse</span> vend l’énergie excédentaire et transforme le surplus en revenus.
                            </p>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs leading-relaxed text-slate-300 sm:grid-cols-2">
                            <p>
                              <span className="font-semibold text-cyan-200">Mode Jeu :</span> construisez, optimisez et développez votre réseau étape par étape.
                            </p>
                            <p>
                              <span className="font-semibold text-cyan-200">Mode Démo :</span> observez un réseau avancé déjà en fonctionnement.
                            </p>
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                            Choisissez votre mode de départ
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <motion.button
                          type="button"
                          onClick={startGameMode}
                          disabled={launchingStartMode !== null}
                          whileTap={{ scale: 0.95 }}
                          animate={launchingStartMode === 'playing'
                            ? { scale: 1.08, boxShadow: '0 0 28px rgba(103, 232, 249, 0.42)' }
                            : { scale: 1, boxShadow: '0 0 0 rgba(103, 232, 249, 0)' }
                          }
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-500/18 px-4 text-sm font-black text-cyan-100 transition-colors hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <Play className="h-4 w-4" />
                          Mode Jeu
                        </motion.button>
                        <motion.button
                          type="button"
                          onClick={startDemoMode}
                          disabled={launchingStartMode !== null}
                          whileTap={{ scale: 0.95 }}
                          animate={launchingStartMode === 'monitor'
                            ? { scale: 1.08, boxShadow: '0 0 28px rgba(226, 232, 240, 0.24)' }
                            : { scale: 1, boxShadow: '0 0 0 rgba(226, 232, 240, 0)' }
                          }
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200/25 bg-slate-100/10 px-4 text-sm font-bold text-slate-100 transition-colors hover:bg-slate-100/20 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <Eye className="h-4 w-4" />
                          Mode Démo
                        </motion.button>
                      </div>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
            {introStep !== 'menu' && (
              <motion.button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  skipStartIntro()
                }}
                className="absolute right-4 top-4 z-20 rounded border border-cyan-300/30 bg-slate-950/70 px-3 py-1 text-xs font-bold text-cyan-100 transition-colors hover:bg-slate-950/90"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.4 }}
              >
                Passer
              </motion.button>
            )}
          </motion.div>
        ) : null}
        {showResetConfirm ? (
          <motion.div
            className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/78 px-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeResetConfirm}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="reset-confirm-title"
              className="relative w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-red-300/30 bg-slate-950/96 p-4 shadow-[0_0_42px_rgba(239,68,68,0.22)]"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-300/80 to-transparent" />
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-red-300/30 bg-red-500/12 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.18)]">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 id="reset-confirm-title" className="text-base font-black text-white">
                    Réinitialiser la partie ?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Cette action remet à zéro la progression, les objectifs, les cœurs d’IA, la bourse,
                    l’historique et toutes les améliorations.
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-300">
                    Action irréversible
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeResetConfirm}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={resetGame}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-300/35 bg-red-500/18 px-4 text-sm font-black text-red-100 transition-colors hover:bg-red-500/28"
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-3 p-3 lg:h-screen lg:min-h-0 lg:p-4 xl:p-5">
        
        {/* HEADER */}
        <header className="grid shrink-0 grid-cols-1 gap-3 border-b border-white/5 pb-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="energy-brand"
          >
            <div className="energy-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_0_12px_rgba(34,211,238,0.45)]">
                <defs>
                  <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00f2fe" />
                    <stop offset="100%" stopColor="#8af700" />
                  </linearGradient>
                </defs>
                <path
                  d="M 28 10 L 72 10 L 94 50 L 72 90 L 28 90 L 6 50 Z"
                  fill="none"
                  stroke="url(#brandGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 32 18 L 68 18 L 86 50 L 68 82 L 32 82 L 14 50 Z"
                  fill="none"
                  stroke="rgba(0, 242, 254, 0.25)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="30" r="2.5" fill="#00f2fe" />
                <path d="M 16 30 L 28 30" stroke="#00f2fe" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="10" cy="50" r="2.5" fill="#00f2fe" />
                <circle cx="84" cy="30" r="2.5" fill="#00f2fe" />
                <circle cx="80" cy="65" r="2.5" fill="#8af700" />
                <circle cx="62" cy="82" r="2.5" fill="#8af700" />
                <path d="M 62 82 L 48 82" stroke="#8af700" strokeWidth="1.5" strokeLinecap="round" />
                <path
                  d="M 54 22 L 36 50 L 48 50 L 44 78 L 64 48 L 52 48 Z"
                  fill="#ffffff"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="energy-brand-title" aria-label="EnergyFlux">
                <span className="energy-brand-title-main">Energy</span>
                <span className="energy-brand-title-accent">Flux</span>
              </h1>
              <div className="energy-brand-divider">
                <div className="energy-brand-divider-line" />
                <div className="energy-brand-divider-dot" />
              </div>
              <p className="energy-brand-tagline">
                Bâtis le réseau. Gère l'énergie. Construis demain.
              </p>
            </div>
          </motion.div>

          <motion.div
            className="relative flex flex-wrap items-center gap-2 lg:justify-end"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
          >
            {showDebugControls ? (
              <button
                onClick={addTenThousandEuros}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-100 transition-all hover:bg-emerald-500/25"
                title="devenez riche"
              >
                +10 000€
              </button>
            ) : null}
            <button
              onClick={toggleMute}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-all ${
                !muted
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'border-white/10 bg-white/[0.055] text-slate-300 hover:bg-white/10'
              }`}
              title="Toggle Audio"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              {!muted ? (
                <span className="flex items-center gap-1.5">
                  Musique active
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </span>
              ) : (
                <span>Mute</span>
              )}
            </button>

            {appMode === 'monitor' ? (
              <button
                onClick={() => {
                  SoundEffects.click()
                  setAppMode('playing')
                }}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-4 text-sm text-slate-300 hover:bg-white/10"
              >
                Lancer le jeu
              </button>
            ) : (
              <button
                onClick={() => {
                  SoundEffects.click()
                  setAppMode('monitor')
                }}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-400/30 bg-amber-500/15 px-4 text-sm text-amber-100 hover:bg-amber-500/25"
              >
                Voir la démo
              </button>
            )}

            {isDemoMode ? null : (
              <button
                type="button"
                onClick={openResetConfirm}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 text-xs font-semibold text-red-100 transition-all hover:bg-red-500/20 hover:text-red-50"
                title="Réinitialiser la partie"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}

            <p
              className="group relative inline-flex h-9 items-center gap-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-100"
              title="Defend Inteligence hackathon 2026"
            >
              <span>Développé avec</span>
              <Heart className="h-4 w-4" />
              <span>par Etienne Fongue</span>
              <span className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-max max-w-[260px] rounded-md border border-rose-300/25 bg-slate-950/95 px-3 py-2 text-[11px] font-semibold text-slate-100 opacity-0 shadow-[0_14px_34px_rgba(0,0,0,0.45)] transition-opacity duration-150 group-hover:opacity-100">
                Defend Inteligence hackathon 2026
              </span>
            </p>
          </motion.div>
        </header>

        {/* -------------------- GAME VIEW (PLAY + DEMO) -------------------- */}
        {appMode !== 'menu' && (
          <>
            {/* TOP MULTI-METRIC HUD - Stretching across the whole top line */}
            <section className="top-hud-grid grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6 lg:gap-3">
              {/* Current Objective - Cyan Tone */}
              <motion.div
                className="hud-card hud-card-cyan hud-card-objective control-panel col-span-2 md:col-span-2 lg:col-span-2"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                <div className="hud-card-accent" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="hud-card-label">Objectif actuel</p>
                      {productionObjectiveProgress.countLabel ? (
                        <span className="hud-card-chip">
                          {productionObjectiveProgress.countLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="hud-card-value hud-objective-value" title={productionObjectiveProgress.title}>
                      {productionObjectiveProgress.value}
                    </div>
                  </div>
                  <div className="hud-card-icon">
                    <Target className="h-4 w-4" />
                  </div>
                </div>
                <p
                  className="hud-objective-title"
                  title={productionObjectiveProgress.text}
                >
                  {productionObjectiveProgress.text}
                </p>
                <p
                  className="hud-objective-action line-clamp-2"
                  title={productionObjectiveProgress.action}
                >
                  {productionObjectiveProgress.action}
                </p>
                <div className="hud-progress-row">
                  <div className="hud-progress-track">
                    <div
                      className="hud-progress-fill"
                      style={{ width: `${productionObjectiveProgress.percent}%` }}
                    />
                  </div>
                  <span className="hud-progress-value">
                    {productionObjectiveProgress.percent}%
                  </span>
                </div>
              </motion.div>
              
              {/* Total Generated Energy - Yellow Tone */}
              <HudStatCard
                label="Production"
                value={formatSignedEnergyRate(totalPassivePowerRate)}
                valueTitle={`Production : ${formatSignedEnergyRate(totalPassivePowerRate)}`}
                detail="Flux entrant"
                icon={<Zap className="h-4 w-4" />}
                tone="yellow"
              />

              {/* Energy Grid Status - Blue/Cyan Tone */}
              <HudStatCard
                label="Consommation"
                value={formatSignedEnergyRate(-totalPowerConsumption)}
                valueTitle={`Consommation : ${formatSignedEnergyRate(-totalPowerConsumption)}`}
                detail={networkBalanceLabel}
                detailClassName={networkBalance >= 0 ? 'hud-card-detail-positive' : 'hud-card-detail-negative'}
                subdetail={`Net ${networkEfficiency}%`}
                icon={<BatteryCharging className="h-4 w-4" />}
                tone={networkBalance >= 0 ? 'cyan' : 'orange'}
              />

              {/* Cash Balance - Green Tone */}
              <HudStatCard
                label="Trésorerie"
                className="hud-card-treasury"
                value={<span className="text-2xl font-black leading-none">{formatMoney(displayMoney)}</span>}
                valueTitle={`Trésorerie : ${formatMoney(displayMoney)}`}
                detail={`Conso : +${formatMoney(consumerRevenuePerMinute)}/min`}
                detailTitle="Revenus par minute depuis les consommateurs."
                subdetail={`Bourse : +${formatMoney(passiveSalesRevenuePerMinute)}/min`}
                subdetailTitle="Revenus automatiques via la vente de surplus à la bourse."
                icon={<Coins className="h-4 w-4" />}
                tone="yellow"
              />

              <SignalEnergyGaugeCard
                productionWhPerMinute={signalProduction}
                consumptionWhPerMinute={signalConsumption}
              />

            </section>

            {/* Split layout below the full width KPI line */}
            <section className={mapGridClassName}>
              
              {/* LEFT COLUMN: MAP + CHARTS */}
              <div className="flex flex-col gap-3 min-h-0 lg:overflow-y-auto lg:pr-1.5 scrollbar-thin">
                {/* LEFT SIDE: CLICKABLE CITY MAP */}
                <div
                  className={mapPanelClassName}
                >
                <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 w-fit select-none">
                  {/* Fil d'ariane (Breadcrumb) */}
                  <div className="flex items-center rounded-lg border border-white/12 bg-slate-950/70 px-3 py-2 text-[10px] font-semibold text-slate-100 h-9">
                    <div className="flex items-center gap-1.5">
                      <span>Produire</span>
                      <span className="text-cyan-300/70 font-bold">›</span>
                      <span>Stocker</span>
                      <span className="text-cyan-300/70 font-bold">›</span>
                      <span>Vendre</span>
                      <span className="text-cyan-300/70 font-bold">›</span>
                      <span>Encaisser</span>
                      <span className="text-cyan-300/70 font-bold">›</span>
                      <span>Améliorer</span>
                    </div>
                  </div>
                  {/* Légende */}
                  <FlowLegend className="relative right-auto top-auto" />
                </div>

                <div className="energy-map-bg absolute inset-0" />
                <div className="energy-grid absolute inset-0" />
                {isPlayingMode && showObjectiveFireworks ? (
                  <ObjectiveFireworksOverlay token={objectiveFireworksToken} />
                ) : null}

                <PixiEnergyNetwork
                  flows={pixiNetworkFlows}
                  performanceLevel={effectiveFlowPerfLevel}
                  clickPulseToken={clickPulseToken}
                  clickPowerLabel={formatEnergy(clickPowerVal)}
                />

                {/* Nodes positions */}
                {mapProducerIds.map((producerId) => {
                  const generator = mapGeneratorStats[producerId]
                  if (!generator) return null
                  const shouldPulseStarter = showSolarLaunchPulse && producerId === 'solar'

                  return (
                    <EnergyNode
                      key={producerId}
                      icon={generator.icon}
                      label={`${generator.name} - Level ${getEffectiveGeneratorLevel(generator)}`}
                      value={<GeneratorNodeValue generator={generator} multiplier={multiplier} />}
                      color={generator.color}
                      className={`${mapNodePositions[producerId]} energy-node-producer ${shouldPulseStarter ? 'energy-node-starter-pulse' : ''}`}
                      isEmphasized={generator.level > 0 || shouldPulseStarter}
                    />
                  )
                })}
                <EnergyNode
                  icon={<BatteryCharging className="h-4 w-4" />}
                  label="Stockage"
                  value={
                    <>
                      <StorageNodeValue
                        storedEnergy={displayWatts}
                        capacity={storageCapacity}
                        storageTierName={storageTierLabel}
                      />
                      {displayWatts >= storageCapacity ? (
                        <span className="mt-1 block rounded-full border border-amber-200/70 bg-amber-300/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                          Stockage plein
                        </span>
                      ) : null}
                    </>
                  }
                  color="#38bdf8"
                  className={`${mapNodePositions.storage} energy-node-producer energy-node-storage`}
                  isEmphasized={storageUpgradeLevel > 0}
                  onClick={sellEnergy}
                  actionLabel="Vendre le stock"
                  actionDisabled={!isInteractiveMode || displayWatts <= MINIMUM_MARKET_SELL_AMOUNT}
                  disabledReason={
                    displayWatts <= MINIMUM_MARKET_SELL_AMOUNT
                      ? 'Stock vide'
                      : !isInteractiveMode
                        ? 'Action indisponible en mode démonstration'
                        : ''
                  }
                />
                <EnergyNode
                  icon={<Euro className="h-4 w-4" />}
                  label="Bourse énergie"
                  value={
                    <span className="block text-[10px] leading-tight text-slate-200">
                      <span className="font-black">{marketLabel}</span>
                      <span className="mt-1 block text-[9px] font-semibold text-slate-300">{marketAutoSaleInfo}</span>
                    </span>
                  }
                  color={exportNodeColor}
                  className={mapNodePositions.export}
                />
                
                {mapConsumerIds.map((consumerId) => {
                  const consumer = consumptionUpgradesById.get(consumerId)
                  if (!consumer) return null
                  const ConsumerIcon = consumer.icon

                  return (
                    <EnergyNode
                      key={consumerId}
                      icon={<ConsumerIcon className="h-4 w-4" />}
                      label={`${consumer.name} - Level ${consumer.level}`}
                      value={
                      <ConsumptionNodeValue
                          consumption={mapConsumerFlows[consumerId] ?? 0}
                          consumer={consumer}
                          currentRevenue={getConsumerRevenuePerMinute(consumer)}
                        />
                      }
                      color={consumer.color}
                      className={`${mapNodePositions[consumerId]} energy-node-consumer`}
                      isEmphasized={consumer.level > 0}
                    />
                  )
                })}


                {/* Clickable interactive Center Hub */}
                <motion.button
                  type="button"
                  onClick={handleHubClick}
                  className={`${mapHubClassName} central-node-button cursor-pointer select-none overflow-visible`}
                  style={mapHubMotionStyle}
                  aria-label={`Nœud central, produire ${formatEnergy(clickPowerVal)} par clic`}
                  animate={{
                    scale: [1, 1.025, 1],
                  }}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    duration: 1.9,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {isDemoMode ? (
                    <span className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 rounded-md border border-fuchsia-300/55 bg-fuchsia-900/65 px-3 py-1 text-sm font-black uppercase tracking-[0.2em] text-fuchsia-100 shadow-[0_0_20px_rgba(232,121,249,0.45)]">
                      Mode démo
                    </span>
                  ) : null}
                  <span className="central-node-shell" aria-hidden="true" />
                  <span className="central-node-orbit central-node-orbit-a" aria-hidden="true" />
                  <span className="central-node-orbit central-node-orbit-b" aria-hidden="true" />
                  <span className="central-node-rail central-node-rail-left" aria-hidden="true" />
                  <span className="central-node-rail central-node-rail-right" aria-hidden="true" />
                  <span className="relative z-10 flex w-full flex-col items-center justify-center px-1 text-center">
                    <span className="central-node-core mb-1.5" aria-hidden="true">
                      <CircuitBoard className="h-7 w-7 text-cyan-50 drop-shadow-[0_0_8px_rgba(165,243,252,0.85)]" />
                    </span>
                    <span className="mt-0.5 text-[13px] font-black uppercase leading-none tracking-wide text-white">
                      NŒUD CENTRAL
                    </span>
                    <span className="mt-1 flex w-[86px] flex-col items-center overflow-hidden rounded border border-cyan-300/20 bg-slate-950/42 py-1 text-center shadow-[inset_0_0_12px_rgba(34,211,238,0.08)]">
                      <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-cyan-300/70">Clic</span>
                      <span className="block truncate font-mono text-[10px] font-black leading-tight text-cyan-100">
                        +{formatEnergy(clickPowerVal)}
                      </span>
                    </span>
                    <span className="mt-1 rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200">
                      Cliquer pour produire
                    </span>
                  </span>
                </motion.button>
                </div>
              </div>

              {/* RIGHT AREA: INCREMENTAL SHOP PANELS */}
              <div className="flex flex-col gap-3 min-h-0">
                <div className="control-panel shop-tab-bar rounded-lg border border-white/10 p-2.5 shrink-0">
                  {shopTabs.map((tab) => {
                    const TabIcon = tab.icon
                    return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        SoundEffects.click()
                        setActiveTab(tab.id)
                      }}
                      className={`shop-tab ${activeTab === tab.id ? 'shop-tab-active' : ''}`}
                    >
                      <TabIcon aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                    )
                  })}
                </div>

                {/* ACTIVE TAB CONTENT */}
                <div ref={upgradePanelRef} className="control-panel upgrade-panel flex-1 rounded-lg border border-white/10 p-3 overflow-y-auto">
                  {activeTab === 'generators' && (
                    <div className="space-y-2.5">
                      <ShopSectionHeader
                        eyebrow="Production"
                        tone="cyan"
                        meta={`${visibleShopGenerators.filter((gen) => gen.level > 0).length}/${visibleShopGenerators.length} actifs`}
                      />
                      
                      {sortedShopGenerators.map((gen) => {
                        const levelInfo = getGeneratorLevelInfo(gen)
                        const cost = levelInfo.isMaxLevel ? 0 : Math.round(gen.baseCost * Math.pow(gen.costMultiplier, gen.level))
                        const isAffordable = isInteractiveMode && !levelInfo.isMaxLevel && displayMoney >= cost
                        const currentProduction = getGeneratorProduction(gen, multiplier)
                        const nextProductionGain = getGeneratorNextProductionGain(gen, multiplier)
                        const shouldPulseStarter = isInteractiveMode && showSolarLaunchPulse && gen.id === 'solar'

                        if (levelInfo.isMaxLevel) {
                          return (
                            <div
                              key={gen.id}
                              className="shop-item shop-item-cyan shop-item-complete shop-item-collapsed text-xs"
                            >
                              <div className="shop-complete-row">
                                <span className="shop-item-icon text-xl leading-none">{gen.icon}</span>
                                <div className="shop-item-copy">
                                  <div className="shop-item-title-row">
                                    <span className="shop-item-title" title={levelInfo.currentName}>
                                      {levelInfo.currentName}
                                    </span>
                                    <span className="shop-level-chip">Niveau max</span>
                                  </div>
                                  <p className="shop-complete-summary">
                                    {gen.name} terminé · {formatEnergyRate(currentProduction)}
                                  </p>
                                </div>
                                <span className="shop-complete-badge">Terminé</span>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            key={gen.id}
                            className={`shop-item shop-item-cyan text-xs ${shouldPulseStarter ? 'shop-item-launch-pulse' : ''}`}
                          >
                            <div className="shop-item-main">
                              <span className="shop-item-icon text-xl leading-none">{gen.icon}</span>
                              <div className="shop-item-copy">
                                <div className="shop-item-title-row">
                                  <span className="shop-item-title" title={levelInfo.shopName}>
                                    {levelInfo.shopName}
                                  </span>
                                  <span className="shop-level-chip">
                                    {levelInfo.nextLevel ? `Niveau ${levelInfo.nextLevel}` : 'Niveau max'}
                                  </span>
                                </div>
                                <p className="shop-item-description">
                                  {levelInfo.shopLabel}
                                </p>
                                <div className="shop-metric-grid">
                                  <span className="shop-metric">
                                    <span>Production actuelle</span>
                                    <strong>{formatEnergyRate(currentProduction)}</strong>
                                  </span>
                                  <span className="shop-metric shop-metric-positive">
                                    <span>Prochaine amélioration</span>
                                    <strong>{levelInfo.isMaxLevel ? 'Max' : formatSignedEnergyRate(nextProductionGain)}</strong>
                                  </span>
                                  <span className="shop-metric">
                                    <span>Niveau actuel</span>
                                    <strong title={levelInfo.currentName}>
                                      {levelInfo.currentName}
                                    </strong>
                                  </span>
                                  <span className="shop-metric shop-metric-cost">
                                    <span>Coût</span>
                                    <strong>{levelInfo.isMaxLevel ? 'Complet' : formatMoney(cost)}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="shop-item-actions">
                              <span className="shop-action-hint">
                                {levelInfo.isMaxLevel
                                  ? 'Niveau max atteint'
                                : !isAffordable
                                    ? (!isInteractiveMode ? 'Mode démo' : 'Fonds insuffisants')
                                    : ''}
                              </span>
                              <button
                                disabled={!isAffordable}
                                onClick={() => buyGenerator(gen.id)}
                                className="shop-action-button shop-action-cyan"
                              >
                                {levelInfo.isMaxLevel ? 'Complet' : gen.level === 0 ? 'Débloquer' : 'Améliorer'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {activeTab === 'consumption' && (
                    <div className="space-y-2.5">
                      <ShopSectionHeader
                        eyebrow="Consommation"
                        tone="orange"
                        meta={`${mapConsumptionUpgrades.filter((consumer) => consumer.level > 0).length}/${mapConsumptionUpgrades.length} actifs`}
                      />

                      {sortedConsumptionUpgrades.map((consumer) => {
                        const nextLevel = getNextConsumerLevel(consumer)
                        const isComplete = !nextLevel
                        const cost = isComplete ? 0 : Math.round(consumer.baseCost * Math.pow(consumer.costMultiplier, consumer.level))
                        const isAffordable = isInteractiveMode && !isComplete && displayMoney >= cost
                        const currentConsumption = totalConsumptionFlows.byId[consumer.id] ?? 0
                        const currentRevenue = getConsumerRevenuePerMinute(consumer)
                        const activeLevelName = getConsumerLevelSummary(consumer)
                        const ConsumerIcon = consumer.icon

                        if (isComplete) {
                          return (
                            <div
                              key={consumer.id}
                              className="shop-item shop-item-orange shop-item-complete shop-item-collapsed text-xs"
                            >
                              <div className="shop-complete-row">
                                <div
                                  className="shop-item-icon"
                                  style={{
                                    borderColor: `${consumer.color}44`,
                                    backgroundColor: `${consumer.color}14`,
                                    color: consumer.color,
                                  }}
                                >
                                  <ConsumerIcon className="h-4 w-4" />
                                </div>
                                <div className="shop-item-copy">
                                  <div className="shop-item-title-row">
                                    <span className="shop-item-title" title={consumer.name}>
                                      {consumer.name}
                                    </span>
                                    <span className="shop-level-chip">Niveau max</span>
                                  </div>
                                <p className="shop-complete-summary">
                                  {activeLevelName} · {formatSignedEnergyRate(-currentConsumption)} · {formatMoney(currentRevenue)}/min
                                </p>
                                </div>
                              <span className="shop-complete-badge">Terminé</span>
                            </div>
                          </div>
                          )
                        }

                        return (
                          <div
                            key={consumer.id}
                            className="shop-item shop-item-orange text-xs"
                          >
                            <div className="shop-item-main">
                              <div
                                className="shop-item-icon"
                                style={{
                                  borderColor: `${consumer.color}44`,
                                  backgroundColor: `${consumer.color}14`,
                                  color: consumer.color,
                                }}
                              >
                                <ConsumerIcon className="h-4 w-4" />
                              </div>
                              <div className="shop-item-copy">
                                <div className="shop-item-title-row">
                                  <span className="shop-item-title" title={consumer.name}>
                                    {consumer.name}
                                  </span>
                                  <span className="shop-level-chip">Niveau {consumer.level}</span>
                                </div>
                                <p className="shop-item-description">{consumer.description}</p>
                                <div className="shop-metric-grid">
                                  <span className="shop-metric shop-metric-negative">
                                    <span>Consommation</span>
                                    <strong>{formatSignedEnergyRate(-currentConsumption)}</strong>
                                  </span>
                                  <span className="shop-metric shop-metric-positive">
                                    <span>Revenu actuel</span>
                                    <strong>{formatMoney(currentRevenue)}/min</strong>
                                  </span>
                                  <span className="shop-metric">
                                    <span>Niveau actuel</span>
                                    <strong title={activeLevelName}>{activeLevelName}</strong>
                                  </span>
                                  <span className="shop-metric shop-metric-cost">
                                    <span>Coût</span>
                                    <strong>{isComplete ? 'Complet' : formatMoney(cost)}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="shop-item-actions">
                              <span className="shop-action-hint">
                                {isComplete
                                  ? 'Niveau max atteint'
                                  : !isAffordable
                                    ? (!isInteractiveMode ? 'Mode démo' : 'Fonds insuffisants')
                                    : ''}
                              </span>
                              <button
                                disabled={!isAffordable}
                                onClick={() => buyConsumptionUpgrade(consumer.id)}
                                className="shop-action-button shop-action-orange"
                              >
                                {isComplete ? 'Complet' : 'Améliorer'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

      {activeTab === 'hub' && (
                    <div className="space-y-2.5">
                      <ShopSectionHeader
                        eyebrow="Nœud central"
                        tone="cyan"
                        meta={`${centralNodeUpgrades.length} modules`}
                      />

                      {centralNodeUpgrades.map((upgrade) => {
                        const cost = Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level))
                        const isMaxed = upgrade.level >= getTechUpgradeMaxLevel(upgrade.id)
                        const isAffordable = isInteractiveMode && !isMaxed && displayMoney >= cost
                        const normalizedCost = isMaxed ? 0 : cost

                        return (
                          <UpgradeRow
                            key={upgrade.id}
                            upgrade={upgrade}
                            cost={normalizedCost}
                            isAffordable={isAffordable}
                            isInteractiveMode={isInteractiveMode}
                            currentValueLabel={getTechUpgradeCurrentValueLabel(upgrade)}
                            tone="cyan"
                            isDisabled={isMaxed}
                            isMaxed={isMaxed}
                            disabledReason={isMaxed ? `Niveau max atteint (${upgrade.level}/${getTechUpgradeMaxLevel(upgrade.id)})` : undefined}
                            onBuy={() => buyTechUpgrade(upgrade.id)}
                          />
                        )
                      })}
                    </div>
                  )}

                  {activeTab === 'upgrades' && (
                    <div className="space-y-2.5">
                      <ShopSectionHeader
                        eyebrow="R&D"
                        tone="violet"
                        meta={`${researchUpgrades.filter((upgrade) => upgrade.level > 0).length}/${researchUpgrades.length} actives`}
                      />

                      {researchUpgrades.map((upgrade) => {
                        const cost = Math.round(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level))
                        const isMaxed = upgrade.level >= getTechUpgradeMaxLevel(upgrade.id)
                        const isAffordable = isInteractiveMode && !isMaxed && displayMoney >= cost

                        if (upgrade.id === 'chartUnlock' && upgrade.level > 0) {
                          return (
                            <div key={upgrade.id} className="shop-item shop-item-violet text-xs">
                              <Suspense fallback={<MarketChartFallback />}><MarketChart data={marketHistory} variant="compact" /></Suspense>
                            </div>
                          )
                        }

                        return (
                          <UpgradeRow
                            key={upgrade.id}
                            upgrade={upgrade}
                            cost={cost}
                            isAffordable={isAffordable}
                            isInteractiveMode={isInteractiveMode}
                            currentValueLabel={getTechUpgradeCurrentValueLabel(upgrade)}
                            tone="violet"
                            isDisabled={isMaxed}
                            isMaxed={isMaxed}
                            disabledReason={isMaxed ? `Niveau max atteint (${upgrade.level}/${getTechUpgradeMaxLevel(upgrade.id)})` : undefined}
                            onBuy={() => buyTechUpgrade(upgrade.id)}
                          />
                        )
                      })}
                    </div>
                  )}

                </div>

                {/* LOGS SCREEN */}
                <div className="control-panel h-[210px] lg:h-[220px] rounded-lg border border-white/10 p-3 flex flex-col shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 block border-b border-white/5 pb-1 mb-2">
                    Console Réseau
                  </span>
                  <div className="flex-1 overflow-y-auto space-y-1 font-mono text-xs text-slate-300 leading-normal scrollbar-thin">
                    {logs.map((log, index) => (
                      <div
                        key={`${log.id}-${index}`}
                        className={log.text.startsWith('🚨') ? 'text-red-400' : log.text.startsWith('🛠️') ? 'text-cyan-400' : log.text.startsWith('💡') ? 'text-violet-400' : 'text-slate-300'}
                      >
                        {log.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}


const ObjectiveFireworksOverlay = memo(function ObjectiveFireworksOverlay({ token }: { token: number }) {
  const particles = useMemo(() => buildObjectiveFireworks(token), [token])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-visible">
      <motion.div
        className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.95) 0%, rgba(251, 146, 60, 0.8) 50%, rgba(6, 182, 212, 0.2) 100%)',
          boxShadow: '0 0 16px rgba(251,191,36,0.9)',
        }}
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 3.5, opacity: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 rounded-md border border-cyan-300/60 bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-cyan-100 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_16px_rgba(34,211,238,0.55)]"
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: -4, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        Objectifs complets 🎉
      </motion.div>

      {particles.map((particle) => {
        const x = Math.cos(particle.angle) * particle.distance
        const y = Math.sin(particle.angle) * particle.distance
        const color = `hsl(${particle.hue} 95% 68%)`

        return (
          <motion.span
            key={`${token}-${particle.id}`}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x,
              y,
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
})

const FlowLegend = memo(function FlowLegend({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const colorRows = [
    { color: '#22c55e', label: 'Production' },
    { color: '#fb923c', label: 'Consommation' },
    { color: '#38bdf8', label: 'Stockage' },
    { color: '#facc15', label: 'Bourse' },
  ]

  return (
    <div className={`w-[178px] select-none text-[10px] text-slate-300 relative ${className ?? 'absolute right-3 top-3 z-30'}`}>
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-950/90 px-2.5 py-2 text-left font-bold uppercase tracking-wide text-slate-300 shadow-lg transition-colors hover:border-cyan-300/40 hover:text-cyan-100 h-9"
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-flex gap-0.5">
            {colorRows.slice(0, 3).map((row) => (
              <span
                key={row.label}
                className="h-1.5 w-1.5 rounded-full shadow-[0_0_6px_currentColor]"
                style={{ backgroundColor: row.color, color: row.color }}
              />
            ))}
          </span>
          Légende
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-cyan-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      {isExpanded ? (
        <div className="absolute top-full left-0 right-0 mt-1.5 grid gap-2 rounded-lg border border-white/10 bg-slate-950/90 p-2.5 shadow-lg z-50">
          <section>
            <span className="block border-b border-white/5 pb-1 font-bold uppercase tracking-wide text-slate-400">
              Couleurs des flux
            </span>
            <div className="mt-1 grid grid-cols-1 gap-1">
              {colorRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: row.color, color: row.color }}
                  />
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <span className="block border-b border-white/5 pb-1 font-bold uppercase tracking-wide text-slate-400">
              Particules
            </span>
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400" />
                <span>Wh/min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 origin-center rotate-45 bg-cyan-300" />
                <span>kWh/min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 bg-cyan-400 shadow-[0_0_8px_currentColor]"
                  style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
                />
                <span>MWh/min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 bg-cyan-300 shadow-[0_0_8px_currentColor]"
                  style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
                />
                <span>GWh/min</span>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
})

const hudStatToneClassNames: Record<HudStatTone, string> = {
  cyan: 'hud-card-cyan',
  yellow: 'hud-card-yellow',
  emerald: 'hud-card-emerald',
  violet: 'hud-card-violet',
  orange: 'hud-card-orange',
}

const HudStatCard = memo(function HudStatCard({
  label,
  value,
  detail,
  icon,
  tone,
  className = '',
  detailClassName = '',
  detailTitle,
  subdetail,
  subdetailTitle,
  valueTitle,
}: HudStatCardProps) {
  return (
    <motion.div
      className={`hud-card ${hudStatToneClassNames[tone]} control-panel ${className}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="hud-card-accent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hud-card-label">{label}</p>
          <div className="hud-card-value" title={valueTitle}>
            {value}
          </div>
        </div>
        <div className="hud-card-icon">
          {icon}
        </div>
      </div>
      <div className="hud-card-footer">
        <span className={`hud-card-detail ${detailClassName}`} title={detailTitle}>
          {detail}
        </span>
        {subdetail ? (
          <span className="hud-card-subdetail" title={subdetailTitle}>
            {subdetail}
          </span>
        ) : null}
      </div>
    </motion.div>
  )
})

const getSignalStatus = (ratio: number) =>
  ratio >= 1.08 ? 'Surplus' : ratio >= 0.92 ? 'Équilibre' : 'Déficit'

const SignalEnergyGaugeCard = memo(function SignalEnergyGaugeCard({
  productionWhPerMinute,
  consumptionWhPerMinute,
}: {
  productionWhPerMinute: number
  consumptionWhPerMinute: number
}) {
  const ratio = consumptionWhPerMinute > 0
    ? productionWhPerMinute / consumptionWhPerMinute
    : productionWhPerMinute > 0
      ? 2
      : 1
  const percentage = Math.max(0, Math.round(ratio * 100))
  const percentageForDisplay = Math.max(0, Math.min(200, percentage))
  const needleAngle = Math.max(-90, Math.min(90, Math.max(0, Math.min(1, ratio / 2)) * 180 - 90))
  const status = getSignalStatus(ratio)

  return (
    <motion.div
      className="hud-card hud-card-cyan control-panel"
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className="hud-card-accent" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hud-card-label">Signal énergétique</p>
        </div>
        <div className="hud-card-icon">
          <Gauge className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1 h-20">
        <div
          className="energy-gauge h-full"
          role="meter"
          aria-label="Taux de couverture production consommation"
          aria-valuemin={0}
          aria-valuemax={200}
          aria-valuenow={percentageForDisplay}
          aria-valuetext={`${percentageForDisplay}% de couverture, ${status.toLowerCase()}`}
        >
          <svg
            className="energy-gauge-svg h-full w-full"
            style={{ minHeight: 0 }}
            viewBox="0 0 220 142"
            aria-hidden="true"
          >
            <path className="energy-gauge-track" d="M24 118A86 86 0 0 1 196 118" pathLength={100} />
            <path
              className="energy-gauge-zone energy-gauge-zone-deficit"
              d="M24 118A86 86 0 0 1 196 118"
              pathLength={100}
              strokeDasharray="42 58"
            />
            <path
              className="energy-gauge-zone energy-gauge-zone-balance"
              d="M24 118A86 86 0 0 1 196 118"
              pathLength={100}
              strokeDasharray="16 84"
              strokeDashoffset={-42}
            />
            <path
              className="energy-gauge-zone energy-gauge-zone-surplus"
              d="M24 118A86 86 0 0 1 196 118"
              pathLength={100}
              strokeDasharray="42 58"
              strokeDashoffset={-58}
            />
            <g className="energy-gauge-needle" transform={`rotate(${needleAngle} 110 118)`}>
              <line x1="110" y1="118" x2="110" y2="50" />
              <circle cx="110" cy="118" r="4" />
            </g>
          </svg>
          <div className="energy-gauge-readout">
            <span>{status}</span>
            <strong>{percentageForDisplay}%</strong>
          </div>
        </div>
      </div>
    </motion.div>
  )
})

const GeneratorNodeValue = memo(function GeneratorNodeValue({
  generator,
  multiplier,
}: {
  generator?: GeneratorState
  multiplier: number
}) {
  const level = generator ? getEffectiveGeneratorLevel(generator) : 0
  const currentProduction = generator ? getGeneratorProduction(generator, multiplier) : 0
  const levelInfo = generator ? getGeneratorLevelInfo(generator) : null
  const levelProgress = generator && generator.level > 0
    ? `${Math.min(100, Math.max(18, (level / generator.levels.length) * 100))}%`
    : '8%'

  return (
    <div className="producer-node-body">
      <div className="producer-node-meta">
        <span className="producer-node-tier" title={levelInfo?.currentName}>
          {levelInfo?.currentName ?? 'À débloquer'}
        </span>
        <span className="producer-node-power">{formatEnergyRate(currentProduction)}</span>
      </div>
      <div className="producer-node-progress" style={{ '--producer-progress': levelProgress } as CSSProperties}>
        <span />
      </div>
    </div>
  )
})

const StorageNodeValue = memo(function StorageNodeValue({
  storedEnergy,
  capacity,
  storageTierName,
}: {
  storedEnergy: number
  capacity: number
  storageTierName: string
}) {
  const progress = capacity > 0 ? Math.min(100, Math.max(0, (storedEnergy / capacity) * 100)) : 0

  return (
    <div className="producer-node-body storage-node-body">
      <div className="producer-node-meta storage-node-meta">
        <span className="producer-node-tier storage-node-tier" title={storageTierName}>
          {storageTierName}
        </span>
        <span className="producer-node-power storage-node-power">{formatEnergy(storedEnergy)} / {formatEnergy(capacity)}</span>
      </div>
      <div className="producer-node-progress storage-node-progress" style={{ '--producer-progress': `${progress}%` } as CSSProperties}>
        <span />
      </div>
    </div>
  )
})

const ConsumptionNodeValue = memo(function ConsumptionNodeValue({
  consumption,
  consumer,
  currentRevenue,
}: {
  consumption: number
  consumer?: ConsumptionUpgradeState
  currentRevenue: number
}) {
  const level = consumer?.level ?? 0
  const levelSummary = consumer ? getConsumerLevelSummary(consumer) : 'À débloquer'
  const consumerProgress = level > 0
    ? `${Math.min(100, Math.max(18, (level / (consumer?.levels.length ?? 3)) * 100))}%`
    : '8%'

  return (
    <div className="consumer-node-body">
      <div className="consumer-node-meta">
        <span className="consumer-node-status" title={levelSummary}>
          {levelSummary}
        </span>
        <span className="consumer-node-power">{formatSignedEnergyRate(-consumption)}</span>
      </div>
      <div className="consumer-node-meta">
        <span className="consumer-node-status">Revenu</span>
        <span className="consumer-node-power">{formatMoney(currentRevenue)}/min</span>
      </div>
      <div className="consumer-node-progress" style={{ '--consumer-progress': consumerProgress } as CSSProperties}>
        <span />
      </div>
    </div>
  )
})

function ShopSectionHeader({
  eyebrow,
  title,
  tone,
  meta,
}: ShopSectionHeaderProps) {
  return (
    <div className={`shop-section-header shop-section-${tone}`}>
      <div className="shop-section-header-content">
        <div className="shop-section-copy">
          <h3 className="shop-section-eyebrow">{eyebrow}</h3>
          {title && <span className="shop-section-title">{title}</span>}
        </div>
        {meta ? (
          <span className="shop-section-meta">
            {meta}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const UpgradeRow = memo(function UpgradeRow({
  upgrade,
  cost,
  isAffordable,
  isInteractiveMode,
  currentValueLabel,
  tone,
  children,
  isDisabled = false,
  disabledReason,
  isMaxed = false,
  onBuy,
}: UpgradeRowProps) {
  const UpgradeIcon = upgrade.icon
  const effectLabel = currentValueLabel.replace(/^Actuel:\s*/, '')
  const buttonDisabled = !isAffordable || isDisabled
  const actionLabel = buttonDisabled
    ? isMaxed
      ? 'Complet'
      : 'Améliorer'
    : upgrade.level === 0
      ? 'Débloquer'
      : 'Améliorer'
  const hint =
    disabledReason ??
    (!isInteractiveMode
      ? 'Mode démo'
      : !isAffordable
        ? isMaxed
          ? 'Niveau max atteint'
          : 'Fonds insuffisants'
        : '')

  return (
    <div className={`shop-item shop-item-${tone} text-xs`}>
      <div className="shop-item-main">
        <div className="shop-item-icon">
          <UpgradeIcon className="h-4 w-4" />
        </div>
        <div className="shop-item-copy">
          <div className="shop-item-title-row">
            <span className="shop-item-title" title={upgrade.name}>
              {upgrade.name}
            </span>
            <span className="shop-level-chip">Niveau {upgrade.level}</span>
          </div>
          <p className="shop-item-description">{upgrade.description}</p>
          <div className="shop-metric-grid">
            <span className="shop-metric">
              <span>Niveau actuel</span>
              <strong>{`Niveau ${upgrade.level}`}</strong>
            </span>
            <span className="shop-metric">
              <span>Effet actuel</span>
              <strong>{effectLabel}</strong>
            </span>
            <span className="shop-metric shop-metric-cost">
              <span>Coût</span>
              <strong>{formatMoney(cost)}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="shop-item-actions">
        <span className="shop-action-hint">
          {buttonDisabled ? hint : ''}
        </span>
        <button
          disabled={buttonDisabled}
          onClick={onBuy}
          className={`shop-action-button ${tone === 'cyan' ? 'shop-action-cyan' : 'shop-action-violet'}`}
        >
          {actionLabel}
        </button>
      </div>

      {children ? (
        <div className="shop-item-extra">
          {children}
        </div>
      ) : null}
    </div>
  )
})

export const EnergyNode = memo(function EnergyNode({
  icon,
  label,
  value,
  color,
  className,
  isEmphasized = false,
  onClick,
  actionLabel,
  actionDisabled = false,
  disabledReason,
}: EnergyNodeProps) {
  const renderedIcon = typeof icon === 'string' || typeof icon === 'number' ? (
    <span className="text-lg leading-none">{icon}</span>
  ) : (
    icon
  )

  return (
    <motion.div
      className={`energy-node absolute z-20 flex flex-col justify-center gap-0.5 rounded-lg border bg-slate-950/75 p-2 ${className} ${
        onClick ? 'cursor-pointer hover:border-cyan-300' : ''
      }`}
      style={{ '--node-color': color } as CSSProperties}
      animate={{
        boxShadow: isEmphasized
          ? `0 0 28px ${color}55`
          : `0 0 16px ${color}1a`,
        borderColor: isEmphasized ? `${color}aa` : `${color}33`,
      }}
      onClick={onClick}
      transition={{ duration: 0.45 }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="energy-node-icon grid h-7 w-7 shrink-0 place-items-center rounded-md border text-lg"
          style={{
            borderColor: `${color}66`,
            backgroundColor: `${color}14`,
            color,
          }}
        >
          {renderedIcon}
        </span>
        <div className="min-w-0 flex-1">
          <span className="energy-node-label block truncate text-xs font-bold leading-none text-slate-300" title={label}>
            {label}
          </span>
          <div className="energy-node-value mt-0.5 text-xs font-extrabold leading-none text-white">
            {value}
          </div>
        </div>
      </div>
      
      {actionLabel && (
        <button
          disabled={actionDisabled}
          onClick={(e) => {
            e.stopPropagation()
            if (onClick) onClick()
          }}
          className="mt-1.5 w-full truncate rounded bg-cyan-500 px-2 py-1 text-[10px] font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500"
        >
          {actionLabel}
        </button>
      )}
      {actionDisabled && disabledReason ? (
          <p className="truncate text-center text-[9px] font-medium text-slate-400">
          {disabledReason}
        </p>
      ) : null}
    </motion.div>
  )
})

export const AiAdvisor = memo(function AiAdvisor({ isOptimized, pulseKey }: AiAdvisorProps) {
  return (
    <motion.aside
      className="advisor-panel relative min-h-0 overflow-hidden rounded-lg border border-violet-200/15 bg-slate-950/62 p-4"
      animate={{
        borderColor: isOptimized
          ? 'rgba(196, 181, 253, 0.46)'
          : 'rgba(196, 181, 253, 0.16)',
        boxShadow: isOptimized
          ? '0 0 46px rgba(139, 92, 246, 0.22)'
          : '0 18px 42px rgba(0, 0, 0, 0.24)',
      }}
      transition={{ duration: 0.45 }}
    >
      <AnimatePresence>
        {pulseKey > 0 ? (
          <motion.div
            key={pulseKey}
            className="pointer-events-none absolute inset-0 border border-violet-300/50"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85 }}
          />
        ) : null}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md border border-violet-200/20 bg-violet-300/10 text-violet-100">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold leading-none text-white">
              Conseiller IA
            </h2>
            <p className="mt-1 text-xs text-slate-400">moteur d'optimisation</p>
          </div>
        </div>
        {isOptimized ? (
          <span className="rounded-md border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
            Appliqué
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        <section className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-orange-100">
            <Activity className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Alerte</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Pic de consommation prévu à 18:00
          </p>
        </section>

        <section className="border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-violet-100">
            <Zap className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Recommandation</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Décharger la batterie entre 18:00 et 20:00 pour réduire la dépendance au réseau.
          </p>
        </section>

        <section className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold text-white">Impact estimé</h3>
          <div className="mt-3 grid gap-2">
            <ImpactRow label="Coûts" value="-12%" tone="violet" />
            <ImpactRow label="CO₂" value="-18%" tone="green" />
            <ImpactRow label="Dépendance réseau" value="-23%" tone="cyan" />
          </div>
        </section>
      </div>
    </motion.aside>
  )
})

const ImpactRow = memo(function ImpactRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: Tone
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm last:border-b-0 last:pb-0">
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${toneStyles[tone].split(' ')[2]}`}>
        {value}
      </span>
    </div>
  )
})

export const EnergyChart = memo(function EnergyChart({ data, emptyLabel = 'Aucune donnée énergétique' }: EnergyChartProps) {
  const chartSummary = useMemo(() => {
    if (data.length === 0) {
      return {
        maxSurplus: 0,
        maxSurplusHour: '--',
        maxDeficit: 0,
        maxDeficitHour: '--',
        peakConsumption: 0,
        peakConsumptionHour: '--',
        latestProduction: 0,
        latestConsumption: 0,
        latestBalance: 0,
        latestBattery: 0,
        latestCost: 0,
      }
    }

    const summary = data.reduce(
      (summary, point) => {
        const balance = point.productionEnergy - point.consumptionEnergy
        return {
          maxSurplus: Math.max(summary.maxSurplus, balance),
          maxSurplusHour: balance > summary.maxSurplus ? point.hour : summary.maxSurplusHour,
          maxDeficit: Math.min(summary.maxDeficit, balance),
          maxDeficitHour: balance < summary.maxDeficit ? point.hour : summary.maxDeficitHour,
          peakConsumption: Math.max(summary.peakConsumption, point.consumptionEnergy),
          peakConsumptionHour: point.consumptionEnergy > summary.peakConsumption ? point.hour : summary.peakConsumptionHour,
        }
      },
      {
        maxSurplus: 0,
        maxSurplusHour: '--',
        maxDeficit: 0,
        maxDeficitHour: '--',
        peakConsumption: 0,
        peakConsumptionHour: '--',
      },
    )
    const latestPoint = data[data.length - 1]

    return {
      ...summary,
      latestProduction: latestPoint.productionEnergy,
      latestConsumption: latestPoint.consumptionEnergy,
      latestBalance: latestPoint.productionEnergy - latestPoint.consumptionEnergy,
      latestBattery: latestPoint.battery,
      latestCost: latestPoint.cost,
    }
  }, [data])

  const coverageRatio = chartSummary.latestConsumption > 0
    ? chartSummary.latestProduction / chartSummary.latestConsumption
    : chartSummary.latestProduction > 0
      ? 2
      : 1
  const gaugeRatio = Math.max(0, Math.min(1, coverageRatio / 2))
  const coveragePercent = Math.max(0, Math.round(coverageRatio * 100))
  const needleAngle = gaugeRatio * 180 - 90
  const gaugeStatus = coverageRatio >= 1.08
    ? 'Surplus'
    : coverageRatio >= 0.92
      ? 'Équilibre'
      : 'Déficit'
  const latestBalanceLabel = `Solde ${formatSignedEnergyRate(chartSummary.latestBalance)}`
  const latestBalanceClassName = chartSummary.latestBalance >= 0
    ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
    : 'border-red-300/25 bg-red-400/10 text-red-200'
  const formatGaugeRate = (value: number) => formatSignedEnergyRate(value).replace(' ', '').replace('/min', '/m')

  return (
    <motion.section
      className={chartPanelClassName}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 shrink-0 text-cyan-200" />
            <h2 className="text-sm font-semibold leading-none text-white">Signal énergétique</h2>
            <span className="hidden rounded border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100 md:inline-flex">
              Jauge live
            </span>
            <span className={`hidden rounded border px-2 py-0.5 text-[10px] font-bold md:inline-flex ${latestBalanceClassName}`}>
              {latestBalanceLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
            <span className="inline-flex items-center gap-1 text-yellow-200">
              <span className="h-1.5 w-4 rounded-full bg-yellow-300 shadow-[0_0_8px_rgba(250,204,21,0.55)]" />
              Prod {formatSignedEnergyRate(chartSummary.latestProduction)}
            </span>
            <span className="inline-flex items-center gap-1 text-orange-200">
              <span className="h-1.5 w-4 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.55)]" />
              Conso {formatSignedEnergyRate(-chartSummary.latestConsumption)}
            </span>
          </div>
        </div>
        <div className="hidden min-w-0 flex-wrap justify-end gap-1.5 text-[10px] md:flex">
          <span className="energy-signal-chip text-emerald-200">
            Surplus max {formatSignedEnergyRate(chartSummary.maxSurplus)}
            {chartSummary.maxSurplusHour !== '--' ? ` · ${chartSummary.maxSurplusHour}` : ''}
          </span>
          <span className={`energy-signal-chip ${chartSummary.maxDeficit < 0 ? 'text-red-200' : 'text-slate-400'}`}>
            Déficit max {formatSignedEnergyRate(chartSummary.maxDeficit)}
            {chartSummary.maxDeficitHour !== '--' ? ` · ${chartSummary.maxDeficitHour}` : ''}
          </span>
          <span className="energy-signal-chip text-orange-100">
            Pic conso {formatSignedEnergyRate(-chartSummary.peakConsumption)} · {chartSummary.peakConsumptionHour}
          </span>
          <span className="energy-signal-chip text-sky-200">Réserve {Math.round(chartSummary.latestBattery)}%</span>
          <span className="energy-signal-chip text-violet-200">Gain {formatMoney(chartSummary.latestCost)}</span>
        </div>
      </div>
      <div className={chartBodyClassName}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-white/10 bg-slate-950/30 text-xs font-medium text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          <div className="energy-gauge-body">
            <div
              className="energy-gauge"
              role="meter"
              aria-label="Taux de couverture production consommation"
              aria-valuemin={0}
              aria-valuemax={200}
              aria-valuenow={Math.min(200, coveragePercent)}
              aria-valuetext={`${coveragePercent}% de couverture, ${gaugeStatus.toLowerCase()}`}
            >
              <svg className="energy-gauge-svg" viewBox="0 0 220 142" aria-hidden="true">
                <path className="energy-gauge-track" d="M24 118A86 86 0 0 1 196 118" pathLength={100} />
                <path
                  className="energy-gauge-zone energy-gauge-zone-deficit"
                  d="M24 118A86 86 0 0 1 196 118"
                  pathLength={100}
                  strokeDasharray="42 58"
                />
                <path
                  className="energy-gauge-zone energy-gauge-zone-balance"
                  d="M24 118A86 86 0 0 1 196 118"
                  pathLength={100}
                  strokeDasharray="16 84"
                  strokeDashoffset={-42}
                />
                <path
                  className="energy-gauge-zone energy-gauge-zone-surplus"
                  d="M24 118A86 86 0 0 1 196 118"
                  pathLength={100}
                  strokeDasharray="42 58"
                  strokeDashoffset={-58}
                />
                <g className="energy-gauge-needle" transform={`rotate(${needleAngle} 110 118)`}>
                  <line x1="110" y1="118" x2="110" y2="48" />
                  <circle cx="110" cy="118" r="6" />
                </g>
                <text x="24" y="138" className="energy-gauge-scale" textAnchor="start">0%</text>
                <text x="110" y="36" className="energy-gauge-scale energy-gauge-scale-center" textAnchor="middle">100%</text>
                <text x="196" y="138" className="energy-gauge-scale" textAnchor="end">200%+</text>
              </svg>
              <div className="energy-gauge-readout">
                <span>{gaugeStatus}</span>
                <strong>{coveragePercent}%</strong>
              </div>
            </div>

            <div className="energy-gauge-metrics">
              <div className="energy-gauge-metric energy-gauge-metric-prod">
                <span>Prod.</span>
                <strong>{formatGaugeRate(chartSummary.latestProduction)}</strong>
              </div>
              <div className="energy-gauge-metric energy-gauge-metric-consumption">
                <span>Conso</span>
                <strong>{formatGaugeRate(-chartSummary.latestConsumption)}</strong>
              </div>
              <div className={`energy-gauge-metric ${chartSummary.latestBalance >= 0 ? 'energy-gauge-metric-surplus' : 'energy-gauge-metric-deficit'}`}>
                <span>Solde</span>
                <strong>{formatGaugeRate(chartSummary.latestBalance)}</strong>
              </div>
              <div className="energy-gauge-metric energy-gauge-metric-reserve">
                <span>Réserve</span>
                <strong>{Math.round(chartSummary.latestBattery)}%</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  )
})
