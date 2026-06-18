import { type CSSProperties, memo } from 'react'

interface GeneratorVisualAssetProps {
  id: string
  level: number
  color: string
  className?: string
  style?: CSSProperties
}

export const GeneratorVisualAsset = memo(function GeneratorVisualAsset({
  id,
  level,
  color,
  className = '',
  style,
}: GeneratorVisualAssetProps) {
  const isLocked = level === 0
  const tier = Math.min(Math.max(level, 0), 3)

  // Locked State (Shared across all generators)
  if (isLocked) {
    return (
      <svg
        viewBox="0 0 64 64"
        className={`w-full h-full text-slate-600 ${className}`}
        style={style}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.4" />
        <circle cx="32" cy="32" r="16" fill="rgba(15, 23, 42, 0.4)" stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <rect x="25" y="27" width="14" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
        <path d="M28 27 V23 C28 20.8 29.8 19 32 19 C34.2 19 36 20.8 36 23 V27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <circle cx="32" cy="32" r="1.5" fill="currentColor" opacity="0.8" />
      </svg>
    )
  }

  // Active States
  switch (id) {
    case 'solar':
      return <SolarAsset tier={tier} color={color} className={className} style={style} />
    case 'wind':
      return <WindAsset tier={tier} color={color} className={className} style={style} />
    case 'biomass':
      return <BiomassAsset tier={tier} color={color} className={className} style={style} />
    case 'hydro':
      return <HydroAsset tier={tier} color={color} className={className} style={style} />
    case 'geothermal':
      return <GeothermalAsset tier={tier} color={color} className={className} style={style} />
    case 'gas':
      return <GasAsset tier={tier} color={color} className={className} style={style} />
    case 'coal':
      return <CoalAsset tier={tier} color={color} className={className} style={style} />
    case 'nuclear':
      return <NuclearAsset tier={tier} color={color} className={className} style={style} />
    case 'fusion':
      return <FusionAsset tier={tier} color={color} className={className} style={style} />
    default:
      return null
  }
})

/* ==========================================
   1. SOLAR (☀️ / fde047)
   ========================================== */
function SolarAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="solar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="solar-panel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
      </defs>
      <style>{`
        @keyframes solar-pulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes sun-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sun-rays {
          transform-origin: 32px 20px;
          animation: sun-rotate 16s linear infinite;
        }
        .sun-core {
          transform-origin: 32px 20px;
          animation: solar-pulse 2.2s ease-in-out infinite;
        }
        .battery-pulse {
          animation: solar-pulse 1.4s ease-in-out infinite;
        }
      `}</style>
      <circle cx="32" cy="20" r="18" fill="url(#solar-glow)" />

      {tier === 1 && (
        <>
          {/* House Roof with Solar Panel */}
          <path d="M14 48 L32 30 L50 48 H42 V56 H22 V48 Z" fill="#1e293b" stroke={color} strokeWidth="1.5" />
          {/* Panel */}
          <polygon points="26,38 38,38 35,46 23,46" fill="url(#solar-panel)" stroke={color} strokeWidth="1" />
          <line x1="29" y1="38" x2="29" y2="46" stroke={color} strokeWidth="0.8" />
          <line x1="32" y1="38" x2="32" y2="46" stroke={color} strokeWidth="0.8" />
          <line x1="35" y1="38" x2="35" y2="46" stroke={color} strokeWidth="0.8" />
          {/* Sun */}
          <circle cx="32" cy="18" r="4.5" fill={color} className="sun-core" />
          <path d="M32 10 V12 M32 24 V26 M24 18 H26 M38 18 H40 M26.3 12.3 L27.8 13.8 M36.2 22.2 L37.7 23.7 M26.3 23.7 L27.8 22.2 M36.2 12.3 L37.7 13.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" className="sun-rays" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Ground Racks of Panels */}
          <rect x="12" y="38" width="40" height="18" rx="2" fill="url(#solar-panel)" stroke={color} strokeWidth="1.5" />
          {/* Grid lines */}
          <line x1="22" y1="38" x2="22" y2="56" stroke={color} strokeWidth="1" />
          <line x1="32" y1="38" x2="32" y2="56" stroke={color} strokeWidth="1" />
          <line x1="42" y1="38" x2="42" y2="56" stroke={color} strokeWidth="1" />
          <line x1="12" y1="47" x2="52" y2="47" stroke={color} strokeWidth="1" />
          {/* Support racks */}
          <line x1="16" y1="56" x2="16" y2="60" stroke="#475569" strokeWidth="2" />
          <line x1="48" y1="56" x2="48" y2="60" stroke="#475569" strokeWidth="2" />
          {/* Sun */}
          <circle cx="32" cy="18" r="6" fill={color} className="sun-core" />
          <path d="M32 6 V10 M32 26 V30 M20 18 H24 M40 18 H44 M23.5 9.5 L26.3 12.3 M37.7 23.7 L40.5 26.5 M23.5 26.5 L26.3 23.7 M37.7 9.5 L40.5 12.3" stroke={color} strokeWidth="1.8" strokeLinecap="round" className="sun-rays" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* Tracking Station & Smart Battery */}
          {/* Base */}
          <rect x="6" y="44" width="30" height="14" rx="2" fill="url(#solar-panel)" stroke={color} strokeWidth="1.5" />
          <line x1="16" y1="44" x2="16" y2="58" stroke={color} strokeWidth="1" />
          <line x1="26" y1="44" x2="26" y2="58" stroke={color} strokeWidth="1" />
          <line x1="6" y1="51" x2="36" y2="51" stroke={color} strokeWidth="1" />
          <path d="M21 58 V62 M12 62 H30" stroke="#475569" strokeWidth="2" />
          
          {/* Glowing Smart Battery Unit */}
          <rect x="42" y="32" width="16" height="26" rx="3" fill="#020617" stroke={color} strokeWidth="1.5" />
          <rect x="46" y="38" width="8" height="4" rx="1" fill={color} className="battery-pulse" opacity="0.8" />
          <rect x="46" y="45" width="8" height="4" rx="1" fill={color} className="battery-pulse" opacity="0.6" />
          <rect x="46" y="52" width="8" height="4" rx="1" fill={color} className="battery-pulse" opacity="0.4" />
          
          {/* Big pulsing Sun */}
          <circle cx="32" cy="18" r="7" fill={color} className="sun-core" />
          <path d="M32 4 V9 M32 27 V32 M18 18 H23 M41 18 H46 M22.1 8.1 L25.6 11.6 M38.4 24.4 L41.9 27.9 M22.1 27.9 L25.6 24.4 M38.4 8.1 L41.9 11.6" stroke={color} strokeWidth="2" strokeLinecap="round" className="sun-rays" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   2. WIND (🌬️ / 60a5fa)
   ========================================== */
function WindAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wind-waves" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#172554" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <style>{`
        @keyframes wind-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes wind-spin-fast {
          from { transform: rotate(15deg); }
          to { transform: rotate(375deg); }
        }
        @keyframes wind-waves-move {
          0%, 100% { transform: translateY(0) scaleY(1); }
          50% { transform: translateY(1.5px) scaleY(1.08); }
        }
        .blades-1 {
          transform-origin: 32px 22px;
          animation: wind-spin-slow 2.6s linear infinite;
        }
        .blades-2a {
          transform-origin: 20px 24px;
          animation: wind-spin-slow 3s linear infinite;
        }
        .blades-2b {
          transform-origin: 44px 28px;
          animation: wind-spin-fast 2.2s linear infinite;
        }
        .waves {
          animation: wind-waves-move 2.5s ease-in-out infinite;
          transform-origin: bottom;
        }
      `}</style>

      {tier === 1 && (
        <>
          {/* Single Wind Turbine */}
          {/* Tower */}
          <path d="M30 22 L27 58 H37 L34 22 Z" fill="#1e293b" stroke={color} strokeWidth="1.5" />
          {/* Generator nacelle */}
          <rect x="29" y="19" width="7" height="5" rx="1.5" fill="#475569" stroke={color} strokeWidth="1" />
          {/* Blades */}
          <g className="blades-1">
            <circle cx="32" cy="22" r="2.5" fill={color} />
            <path d="M32 22 L32 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M32 22 L16.4 31" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <path d="M32 22 L47.6 31" stroke={color} strokeWidth="2" strokeLinecap="round" />
          </g>
        </>
      )}

      {tier === 2 && (
        <>
          {/* Two Wind Turbines on Landscape */}
          {/* Hill outline */}
          <path d="M4 52 Q28 44 60 52 L60 60 L4 60 Z" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
          
          {/* Left Tower */}
          <path d="M19 24 L17 50 H23 L21 24 Z" fill="#1e293b" stroke={color} strokeWidth="1.2" />
          <rect x="18" y="21" width="5" height="4" rx="1" fill="#475569" stroke={color} strokeWidth="0.8" />
          
          {/* Right Tower */}
          <path d="M43 28 L41 53 H47 L45 28 Z" fill="#1e293b" stroke={color} strokeWidth="1.2" />
          <rect x="42" y="25" width="5" height="4" rx="1" fill="#475569" stroke={color} strokeWidth="0.8" />
          
          {/* Left Blades */}
          <g className="blades-2a">
            <circle cx="20" cy="24" r="2" fill={color} />
            <path d="M20 24 L20 8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M20 24 L6.1 32" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M20 24 L33.9 32" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          </g>
          
          {/* Right Blades */}
          <g className="blades-2b">
            <circle cx="44" cy="28" r="2" fill={color} />
            <path d="M44 28 L44 14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M44 28 L31.9 35" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M44 28 L56.1 35" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        </>
      )}

      {tier === 3 && (
        <>
          {/* Offshore Wind Turbines (3 turbines + Ocean waves + power connection lines) */}
          <path d="M4 48 Q18 45 32 48 T60 48 L60 62 L4 62 Z" fill="url(#wind-waves)" stroke={color} strokeWidth="1" className="waves" />
          
          {/* Central Main Tower */}
          <path d="M31 16 L29 50 H33 L32 16 Z" fill="#0f172a" stroke={color} strokeWidth="1.2" />
          <rect x="30" y="13" width="4" height="3.5" rx="0.8" fill="#334155" stroke={color} strokeWidth="0.8" />
          
          {/* Left Tower */}
          <path d="M15 22 L13.5 50 H16.5 L15 22 Z" fill="#0f172a" stroke={color} strokeWidth="1" />
          
          {/* Right Tower */}
          <path d="M49 22 L47.5 50 H50.5 L49 22 Z" fill="#0f172a" stroke={color} strokeWidth="1" />

          {/* Central Blades */}
          <g className="blades-1" style={{ transformOrigin: '32px 16px' } as CSSProperties}>
            <circle cx="32" cy="16" r="1.8" fill={color} />
            <path d="M32 16 L32 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M32 16 L19.9 23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M32 16 L44.1 23" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          </g>

          {/* Left Blades */}
          <g className="blades-2a" style={{ transformOrigin: '15px 22px' } as CSSProperties}>
            <circle cx="15" cy="22" r="1.5" fill={color} />
            <path d="M15 22 L15 10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M15 22 L4.6 28" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M15 22 L25.4 28" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Right Blades */}
          <g className="blades-2b" style={{ transformOrigin: '49px 22px' } as CSSProperties}>
            <circle cx="49" cy="22" r="1.5" fill={color} />
            <path d="M49 22 L49 10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M49 22 L38.6 28" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M49 22 L59.4 28" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          </g>

          {/* Spark connections in the water */}
          <circle cx="32" cy="56" r="2.5" fill={color} opacity="0.6" />
          <path d="M15 50 Q23 54 32 56 T49 50" stroke={color} strokeWidth="1.2" strokeDasharray="3 3" fill="none" opacity="0.8" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   3. BIOMASS (🪵 / 34d399)
   ========================================== */
function BiomassAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bio-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes bio-breathe {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes bubble {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          20% { opacity: 0.8; }
          80% { opacity: 0.8; }
          100% { transform: translateY(-16px) scale(1); opacity: 0; }
        }
        .bio-pulse {
          animation: bio-breathe 2.4s ease-in-out infinite;
        }
        .bubble-1 {
          animation: bubble 1.6s infinite ease-in;
        }
        .bubble-2 {
          animation: bubble 2.2s infinite ease-in 0.6s;
        }
        .bubble-3 {
          animation: bubble 1.8s infinite ease-in 1.1s;
        }
      `}</style>
      <circle cx="32" cy="32" r="22" fill="url(#bio-glow)" />

      {tier === 1 && (
        <>
          {/* Organic Wood bin / sprout */}
          {/* Sprout */}
          <path d="M32 32 C30 24 24 20 24 20 C24 20 30 20 32 26 C34 20 40 20 40 20 C40 20 34 24 32 32 Z" fill={color} />
          {/* Pot/Log */}
          <path d="M20 38 H44 L41 54 H23 Z" fill="#1e293b" stroke={color} strokeWidth="1.5" />
          <line x1="26" y1="38" x2="28" y2="54" stroke={color} strokeWidth="1" />
          <line x1="32" y1="38" x2="32" y2="54" stroke={color} strokeWidth="1" />
          <line x1="38" y1="38" x2="36" y2="54" stroke={color} strokeWidth="1" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Bioreactor Tank */}
          <rect x="18" y="24" width="28" height="30" rx="3" fill="#0f172a" stroke={color} strokeWidth="1.8" />
          {/* Window */}
          <circle cx="32" cy="38" r="9" fill="#020617" stroke={color} strokeWidth="1.2" />
          {/* Bubbles inside window */}
          <circle cx="29" cy="42" r="1.5" fill={color} className="bubble-1" />
          <circle cx="35" cy="44" r="1" fill={color} className="bubble-2" />
          <circle cx="32" cy="41" r="1.2" fill={color} className="bubble-3" />
          {/* Pipework */}
          <path d="M18 30 H12 V54 H18" stroke="#475569" strokeWidth="2.5" fill="none" />
          <path d="M46 34 H52 V54" stroke="#475569" strokeWidth="2.5" fill="none" />
          <circle cx="32" cy="18" r="3" fill={color} className="bio-pulse" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* Biosphere Eco-dome complex */}
          {/* Dome structure */}
          <path d="M12 52 C12 28 52 28 52 52 Z" fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 2" />
          {/* Inner biological tree core */}
          <path d="M32 52 V32 M32 40 L24 32 M32 36 L39 28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="24" cy="32" r="3" fill={color} className="bio-pulse" />
          <circle cx="39" cy="28" r="3" fill={color} className="bio-pulse" />
          <circle cx="32" cy="24" r="4.5" fill={color} className="bio-pulse" />
          {/* Base generator tanks */}
          <rect x="14" y="46" width="36" height="8" rx="1" fill="#0f172a" stroke={color} strokeWidth="1.5" />
          <line x1="26" y1="46" x2="26" y2="54" stroke={color} strokeWidth="1.2" />
          <line x1="38" y1="46" x2="38" y2="54" stroke={color} strokeWidth="1.2" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   4. HYDRO (💧 / 38bdf8)
   ========================================== */
function HydroAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hydro-river" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>
      <style>{`
        @keyframes hydro-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes water-flow {
          0% { strokeDashoffset: 0; }
          100% { strokeDashoffset: -20; }
        }
        .turbine-rotate {
          transform-origin: 32px 32px;
          animation: hydro-spin 2.8s linear infinite;
        }
        .river-flow {
          stroke-dasharray: 6 4;
          animation: water-flow 1.5s linear infinite;
        }
        .river-flow-fast {
          stroke-dasharray: 4 3;
          animation: water-flow 0.8s linear infinite;
        }
      `}</style>

      {tier === 1 && (
        <>
          {/* Water wheel */}
          <path d="M4 46 H60" stroke="#475569" strokeWidth="3" />
          <path d="M4 48 H60" stroke={color} strokeWidth="1.5" className="river-flow" />
          {/* Wheel structure */}
          <g className="turbine-rotate">
            <circle cx="32" cy="32" r="14" fill="none" stroke={color} strokeWidth="1.5" />
            <circle cx="32" cy="32" r="4" fill="#1e293b" stroke={color} strokeWidth="1" />
            <line x1="32" y1="18" x2="32" y2="46" stroke={color} strokeWidth="1.5" />
            <line x1="18" y1="32" x2="46" y2="32" stroke={color} strokeWidth="1.5" />
            <line x1="22.1" y1="22.1" x2="41.9" y2="41.9" stroke={color} strokeWidth="1.2" />
            <line x1="22.1" y1="41.9" x2="41.9" y2="22.1" stroke={color} strokeWidth="1.2" />
            {/* Paddles */}
            <rect x="30" y="14" width="4" height="5" rx="0.5" fill={color} />
            <rect x="30" y="45" width="4" height="5" rx="0.5" fill={color} />
            <rect x="14" y="30" width="5" height="4" rx="0.5" fill={color} />
            <rect x="45" y="30" width="5" height="4" rx="0.5" fill={color} />
          </g>
        </>
      )}

      {tier === 2 && (
        <>
          {/* River run station (concrete spillways & generator) */}
          <rect x="10" y="24" width="44" height="20" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="2" />
          {/* Water channel */}
          <path d="M4 44 H60" stroke="url(#hydro-river)" strokeWidth="6" />
          <path d="M4 44 H60" stroke="#ffffff" strokeWidth="1.2" className="river-flow" />
          {/* Spigots / Spillway columns */}
          <rect x="18" y="28" width="6" height="16" fill="#1e293b" stroke={color} strokeWidth="1" />
          <rect x="40" y="28" width="6" height="16" fill="#1e293b" stroke={color} strokeWidth="1" />
          {/* Small Turbine indicator */}
          <circle cx="32" cy="18" r="5" fill="#020617" stroke={color} strokeWidth="1.5" />
          <g className="turbine-rotate" style={{ transformOrigin: '32px 18px' } as CSSProperties}>
            <line x1="32" y1="15" x2="32" y2="21" stroke={color} strokeWidth="1.2" />
            <line x1="29" y1="18" x2="35" y2="18" stroke={color} strokeWidth="1.2" />
          </g>
        </>
      )}

      {tier === 3 && (
        <>
          {/* Dam structure with animated rushing waterfall */}
          <path d="M8 20 Q32 16 56 20 L50 56 H14 Z" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          {/* Waterfall streams */}
          <line x1="22" y1="20" x2="22" y2="56" stroke={color} strokeWidth="3" className="river-flow-fast" />
          <line x1="32" y1="18" x2="32" y2="56" stroke={color} strokeWidth="4.5" className="river-flow-fast" />
          <line x1="42" y1="20" x2="42" y2="56" stroke={color} strokeWidth="3" className="river-flow-fast" />
          {/* Turbines house at the base */}
          <rect x="10" y="50" width="44" height="10" rx="1" fill="#0f172a" stroke={color} strokeWidth="1.5" />
          <circle cx="22" cy="55" r="2" fill={color} className="river-flow-fast" />
          <circle cx="32" cy="55" r="2" fill={color} className="river-flow-fast" />
          <circle cx="42" cy="55" r="2" fill={color} className="river-flow-fast" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   5. GEOTHERMAL (🔥 / fb923c)
   ========================================== */
function GeothermalAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="magma-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes heat-pulse {
          0%, 100% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes steam-rise {
          0% { transform: translateY(8px) scaleX(0.7); opacity: 0; }
          30% { opacity: 0.8; }
          100% { transform: translateY(-16px) scaleX(1.4); opacity: 0; }
        }
        .heat-core {
          animation: heat-pulse 1.8s ease-in-out infinite;
        }
        .steam-vector {
          animation: steam-rise 2s infinite ease-out;
          stroke: #94a3b8;
          stroke-width: 1.5;
          fill: none;
        }
        .steam-delay {
          animation-delay: 0.8s;
        }
      `}</style>
      <circle cx="32" cy="46" r="16" fill="url(#magma-glow)" />

      {tier === 1 && (
        <>
          {/* Simple Drill rig + steam vent */}
          {/* Earth / Cracks */}
          <path d="M6 50 H58 M24 50 L20 62 M40 50 L44 62" stroke="#475569" strokeWidth="2.5" />
          {/* Drilling Dect */}
          <path d="M26 50 L32 20 L38 50 Z" fill="none" stroke={color} strokeWidth="1.8" />
          {/* Steam */}
          <path d="M32 20 Q30 14 32 8 T30 2" className="steam-vector" />
          <circle cx="32" cy="54" r="5" fill="#ef4444" className="heat-core" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Geothermal plant with heat exchanger & piping */}
          <rect x="14" y="32" width="36" height="20" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.8" />
          {/* Glowing hot piping */}
          <path d="M24 52 V40 H40 V52" stroke={color} strokeWidth="2.5" fill="none" />
          {/* Vapor vent */}
          <rect x="29" y="22" width="6" height="10" fill="#1e293b" stroke="#475569" strokeWidth="1" />
          <path d="M32 22 Q30 15 32 10 T30 2" className="steam-vector" />
          <path d="M34 22 Q36 15 34 10 T36 2" className="steam-vector steam-delay" />
          {/* Magma tap indicator */}
          <circle cx="32" cy="52" r="6" fill="#ef4444" className="heat-core" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* Tectonic thermal core power complex */}
          {/* Structural ring */}
          <circle cx="32" cy="36" r="18" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="6 3" />
          <circle cx="32" cy="36" r="14" fill="none" stroke="#ef4444" strokeWidth="1.5" />
          
          {/* pulsing magma power core */}
          <circle cx="32" cy="36" r="8" fill="#ef4444" className="heat-core" />
          
          {/* Extractors */}
          <path d="M32 18 V6" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 6 Q30 0 32 -4" className="steam-vector" />
          <path d="M16 48 L8 56" stroke="#475569" strokeWidth="2.5" />
          <path d="M48 48 L56 56" stroke="#475569" strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   6. GAS (⛽ / f97316)
   ========================================== */
function GasAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="flame-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="50%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes flame-dance {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.95; }
          25% { transform: scaleY(1.08) scaleX(0.92) skewX(-1.5deg); }
          50% { transform: scaleY(0.95) scaleX(1.05); }
          75% { transform: scaleY(1.04) scaleX(0.95) skewX(1.5deg); }
        }
        .gas-flame {
          transform-origin: 32px 36px;
          animation: flame-dance 0.7s infinite alternate ease-in-out;
        }
      `}</style>
      <circle cx="32" cy="32" r="18" fill="url(#flame-glow)" />

      {tier === 1 && (
        <>
          {/* Tank + burner flame */}
          <rect x="22" y="38" width="20" height="18" rx="3" fill="#1e293b" stroke={color} strokeWidth="1.5" />
          <path d="M28 38 V32 H36 V38" stroke="#475569" strokeWidth="2" fill="none" />
          {/* Flame */}
          <path d="M32 32 C30 26 32 18 32 18 C32 18 34 26 32 32 Z" fill="#38bdf8" className="gas-flame" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Turbine housing with hot combustion chamber */}
          <rect x="12" y="28" width="40" height="24" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="2" />
          {/* Combustion window */}
          <rect x="20" y="34" width="24" height="12" rx="1" fill="#020617" stroke={color} strokeWidth="1.2" />
          {/* Multi flames */}
          <g className="gas-flame" style={{ transformOrigin: '32px 40px' } as CSSProperties}>
            <path d="M26 42 C24 38 26 32 26 32 C26 32 28 38 26 42 Z" fill="#60a5fa" />
            <path d="M32 42 C30 36 32 30 32 30 C32 30 34 36 32 42 Z" fill="#38bdf8" />
            <path d="M38 42 C36 38 38 32 38 32 C38 32 40 38 38 42 Z" fill="#60a5fa" />
          </g>
          {/* Exhaust piping */}
          <path d="M52 32 H58 V12" stroke="#475569" strokeWidth="2.5" fill="none" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* High efficiency combined cycle plant */}
          <rect x="8" y="34" width="36" height="20" rx="3" fill="#0f172a" stroke={color} strokeWidth="1.8" />
          {/* Big Exhaust Chimney */}
          <path d="M14 34 L16 10 H22 L24 34 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {/* Heat Recovery Steam Generator */}
          <rect x="46" y="22" width="12" height="32" rx="1" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <path d="M36 40 H46" stroke={color} strokeWidth="2" />
          
          {/* Combustion window & big hot flame */}
          <circle cx="26" cy="44" r="6" fill="#020617" stroke={color} strokeWidth="1.2" />
          <path d="M26 45 C24 39 26 32 26 32 C26 32 28 39 26 45 Z" fill="#38bdf8" className="gas-flame" style={{ transformOrigin: '26px 45px' } as CSSProperties} />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   7. COAL (⬛ / 94a3b8)
   ========================================== */
function CoalAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="coal-fire" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.75" />
          <stop offset="70%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes smoke-float {
          0% { transform: translate(0, 0) scale(0.6); opacity: 0; }
          20% { opacity: 0.6; }
          100% { transform: translate(-6px, -18px) scale(1.5); opacity: 0; }
        }
        @keyframes fire-glow {
          0%, 100% { opacity: 0.62; }
          50% { opacity: 1; }
        }
        .smoke-puff-1 {
          animation: smoke-float 2.5s infinite linear;
        }
        .smoke-puff-2 {
          animation: smoke-float 2.5s infinite linear 1.2s;
        }
        .coal-glow {
          animation: fire-glow 1.4s ease-in-out infinite;
        }
      `}</style>

      {tier === 1 && (
        <>
          {/* Boiler furnace box */}
          <rect x="18" y="34" width="28" height="22" rx="2" fill="#1e293b" stroke={color} strokeWidth="1.8" />
          <rect x="23" y="39" width="18" height="12" rx="1" fill="#020617" stroke="#ef4444" strokeWidth="1" />
          {/* Glowing hot coal bed */}
          <circle cx="32" cy="45" r="7" fill="url(#coal-fire)" className="coal-glow" />
          <rect x="25" y="47" width="14" height="2" fill="#f97316" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Power plant with cooling tower and chimney */}
          {/* Base */}
          <rect x="14" y="38" width="36" height="18" rx="2" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          {/* Chimney */}
          <path d="M18 38 L19 14 H23 L24 38 Z" fill="#1e293b" stroke={color} strokeWidth="1.2" />
          {/* Smoke puffs */}
          <circle cx="21" cy="8" r="3" fill="#cbd5e1" className="smoke-puff-1" />
          <circle cx="21" cy="8" r="4" fill="#94a3b8" className="smoke-puff-2" />
          {/* Cooling Tower */}
          <path d="M34 38 L37 20 H45 L48 38 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {/* Furnace window */}
          <circle cx="25" cy="47" r="3.5" fill="#ef4444" className="coal-glow" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* Supercritical high efficiency plant with carbon capture */}
          {/* Cooling towers (2) */}
          <path d="M10 52 L13 26 H21 L24 52 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          <path d="M26 52 L29 26 H37 L40 52 Z" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
          
          {/* Carbon capture sphere */}
          <circle cx="48" cy="38" r="10" fill="#0f172a" stroke={color} strokeWidth="2" />
          <circle cx="48" cy="38" r="6" fill="url(#coal-fire)" className="coal-glow" />
          <path d="M38 48 H48" stroke={color} strokeWidth="2.5" />
          
          <rect x="8" y="48" width="46" height="8" rx="1" fill="#1e293b" stroke={color} strokeWidth="1.2" />
        </>
      )}
    </svg>
  )
}

/* ==========================================
   8. NUCLEAR (⚛️ / a78bfa)
   ========================================== */
function NuclearAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="nuclear-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.75" />
          <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes atom-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cherenkov-pulse {
          0%, 100% { opacity: 0.65; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        .radiation-pulse {
          animation: cherenkov-pulse 2s ease-in-out infinite;
        }
        .atom-electrons {
          transform-origin: 32px 32px;
          animation: atom-spin 5s linear infinite;
        }
        .atom-electrons-reverse {
          transform-origin: 32px 32px;
          animation: atom-spin 6s linear infinite reverse;
        }
      `}</style>
      <circle cx="32" cy="32" r="20" fill="url(#nuclear-glow)" />

      {tier === 1 && (
        <>
          {/* Small modular reactor capsule */}
          <rect x="23" y="16" width="18" height="36" rx="9" fill="#0f172a" stroke={color} strokeWidth="2" />
          {/* Fuel rods inside */}
          <line x1="28" y1="24" x2="28" y2="44" stroke={color} strokeWidth="1.8" />
          <line x1="32" y1="24" x2="32" y2="44" stroke="#38bdf8" strokeWidth="1.8" className="radiation-pulse" />
          <line x1="36" y1="24" x2="36" y2="44" stroke={color} strokeWidth="1.8" />
          {/* Status grid */}
          <circle cx="32" cy="10" r="2" fill={color} />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Reactor dome + cooling tower */}
          {/* Cooling Tower */}
          <path d="M12 50 L15 22 H25 L28 50 Z" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
          {/* Steam */}
          <circle cx="20" cy="12" r="4" fill="#cbd5e1" opacity="0.6" className="radiation-pulse" />
          {/* Reactor containment dome */}
          <path d="M32 50 C32 30 56 30 56 50 Z" fill="#0f172a" stroke={color} strokeWidth="2" />
          <circle cx="44" cy="42" r="5" fill={color} className="radiation-pulse" />
          {/* Connectors */}
          <path d="M28 44 H32" stroke={color} strokeWidth="1.5" />
        </>
      )}

      {tier === 3 && (
        <>
          {/* Advanced plant with rotating atom orbitals */}
          {/* containment dome */}
          <path d="M14 52 C14 24 50 24 50 52 Z" fill="#0f172a" stroke={color} strokeWidth="2" />
          <circle cx="32" cy="38" r="8" fill={color} className="radiation-pulse" />
          
          {/* Atom orbitals */}
          <g className="atom-electrons">
            <ellipse cx="32" cy="32" rx="22" ry="7" fill="none" stroke="#38bdf8" strokeWidth="1.2" transform="rotate(30, 32, 32)" />
            <circle cx="54" cy="32" r="2" fill="#38bdf8" transform="rotate(30, 32, 32)" />
          </g>
          <g className="atom-electrons-reverse">
            <ellipse cx="32" cy="32" rx="22" ry="7" fill="none" stroke={color} strokeWidth="1.2" transform="rotate(-30, 32, 32)" />
            <circle cx="10" cy="32" r="2" fill={color} transform="rotate(-30, 32, 32)" />
          </g>
        </>
      )}
    </svg>
  )
}

/* ==========================================
   9. FUSION (🌀 / 67e8f9)
   ========================================== */
function FusionAsset({ tier, color, className, style }: { tier: number; color: string; className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" className={`w-full h-full ${className}`} style={style} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="fusion-plasma" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="25%" stopColor={color} stopOpacity="0.85" />
          <stop offset="65%" stopColor="#a78bfa" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes plasma-swirl {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes plasma-pulse {
          0%, 100% { transform: scale(0.88) rotate(0deg); opacity: 0.8; }
          50% { transform: scale(1.08) rotate(180deg); opacity: 1; }
        }
        .plasma-core {
          transform-origin: 32px 32px;
          animation: plasma-pulse 1.3s ease-in-out infinite;
        }
        .magnetic-ring {
          transform-origin: 32px 32px;
          animation: plasma-swirl 3.5s linear infinite;
        }
        .magnetic-ring-reverse {
          transform-origin: 32px 32px;
          animation: plasma-swirl 4.5s linear infinite reverse;
        }
      `}</style>
      <circle cx="32" cy="32" r="24" fill="url(#fusion-plasma)" className="plasma-core" />

      {tier === 1 && (
        <>
          {/* Prototype chamber */}
          <circle cx="32" cy="32" r="15" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="32" cy="32" r="3" fill="#ffffff" />
          <path d="M12 32 H17 M47 32 H52 M32 12 V17 M32 47 V52" stroke="#475569" strokeWidth="2" />
        </>
      )}

      {tier === 2 && (
        <>
          {/* Tokamak chamber */}
          <circle cx="32" cy="32" r="19" fill="none" stroke="#475569" strokeWidth="3.5" />
          <circle cx="32" cy="32" r="19" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="8 6" className="magnetic-ring" />
          <circle cx="32" cy="32" r="13" fill="none" stroke="#a78bfa" strokeWidth="1.2" />
          {/* swirling plasma nodes */}
          <g className="magnetic-ring">
            <circle cx="47" cy="23" r="2" fill="#ffffff" />
            <circle cx="17" cy="41" r="2" fill="#ffffff" />
          </g>
        </>
      )}

      {tier === 3 && (
        <>
          {/* Hyper stellarator reactor */}
          <circle cx="32" cy="32" r="24" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="14 8" className="magnetic-ring" />
          <circle cx="32" cy="32" r="20" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="10 6" className="magnetic-ring-reverse" />
          <circle cx="32" cy="32" r="15" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
          
          {/* Injection coils */}
          <path d="M32 4 L32 10 M32 60 L32 54 M4 32 L10 32 M60 32 L54 32" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="4" r="2" fill={color} />
          <circle cx="32" cy="60" r="2" fill={color} />
          <circle cx="4" cy="32" r="2" fill={color} />
          <circle cx="60" cy="32" r="2" fill={color} />
        </>
      )}
    </svg>
  )
}
