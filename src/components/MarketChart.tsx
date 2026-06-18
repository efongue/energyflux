import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'

type MarketChartPoint = {
  time: string
  cours: number
}

type MarketChartProps = {
  data: MarketChartPoint[]
  variant?: 'panel' | 'compact'
}

type ElementSize = {
  width: number
  height: number
}

const chartPanelClassName = 'rounded-2xl border border-yellow-300/20 bg-slate-950/70 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.42)]'
const chartBodyClassName = 'h-64 min-w-0'

const formatMoney = (value: number) => {
  const absoluteValue = Math.abs(value)
  const maximumFractionDigits = absoluteValue < 1 ? 4 : absoluteValue < 10 ? 3 : 2

  return `${value.toLocaleString('fr-FR', {
    maximumFractionDigits,
    minimumFractionDigits: absoluteValue > 0 && absoluteValue < 1 ? 4 : 0,
  })} €`
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setSize((current) => {
        const width = Math.round(rect.width)
        const height = Math.round(rect.height)

        if (current.width === width && current.height === height) return current
        return { width, height }
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

export const MarketChart = memo(function MarketChart({ data, variant = 'panel' }: MarketChartProps) {
  const [chartRef, chartSize] = useElementSize<HTMLDivElement>()
  const latestPrice = data[data.length - 1]?.cours ?? 0
  const isCompact = variant === 'compact'

  return (
    <motion.section
      className={isCompact ? 'market-chart-compact flex min-w-0 flex-col rounded-md border border-yellow-300/20 bg-slate-950/45 p-2' : chartPanelClassName}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.12 }}
    >
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 animate-pulse text-yellow-300" />
          <h2 className={isCompact ? 'text-xs font-black text-white' : 'text-sm font-semibold text-white'}>
            Cours de la Bourse de l'Énergie (€/Wh)
          </h2>
        </div>
        <span className={isCompact ? 'hidden text-[10px] font-semibold text-yellow-400 sm:inline' : 'hidden text-xs font-semibold text-yellow-400 md:inline'}>
          Dernier cours {formatMoney(latestPrice)}/Wh
        </span>
      </div>

      <div ref={chartRef} className={isCompact ? 'min-h-[136px] min-w-0 flex-1' : chartBodyClassName}>
        {chartSize.width > 0 && chartSize.height > 0 && data.length > 0 ? (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={data}
            margin={{ top: 6, right: 8, left: -26, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fill: '#fbbf24', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(251, 191, 36, 0.35)' }}
              formatter={(value, name) => [`${formatMoney(Number(value))}/Wh`, name]}
              contentStyle={{
                background: 'rgba(2, 6, 23, 0.94)',
                border: '1px solid rgba(251, 191, 36, 0.22)',
                borderRadius: 8,
                color: '#e2e8f0',
              }}
              labelStyle={{ color: '#f8fafc' }}
            />
            <Legend
              iconType="circle"
              iconSize={7}
              wrapperStyle={{ fontSize: 11, color: '#94a3b8', bottom: -2 }}
            />
            <Line
              type="monotone"
              dataKey="cours"
              name="Prix de vente"
              stroke="#facc15"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: '#facc15', strokeWidth: 0 }}
              activeDot={{ r: 4, fill: '#fde68a', stroke: '#f59e0b', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <div className="flex h-full min-h-[136px] items-center justify-center rounded border border-slate-700/40 bg-slate-950/35 text-xs font-semibold text-slate-400">
            En attente du marché...
          </div>
        )}
      </div>
    </motion.section>
  )
})
