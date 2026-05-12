interface StatsCardProps {
  title: string
  value: number
  change?: number
  icon: string
  trend?: 'up' | 'down' | 'stable'
  onClick?: () => void
}

export default function StatsCard({ title, value, change, icon, trend = 'stable', onClick }: StatsCardProps) {
  const trendColor = {
    up: 'text-green-400',
    down: 'text-red-400',
    stable: 'text-[var(--text-muted)]'
  }

  return (
    <div 
      className={`stat-card group cursor-pointer transition-all duration-200 ${onClick ? 'hover:scale-[1.02] hover:shadow-lg hover:shadow-[var(--primary-color)]/10' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
          <p className="text-4xl font-bold text-white">
            {value.toLocaleString()}
          </p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${trendColor[trend]}`}>
              <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
              <span>{change >= 0 ? '+' : ''}{change}</span>
            </div>
          )}
        </div>
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--primary-color)]/20 to-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--primary-color)] to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-xl" />
    </div>
  )
}
