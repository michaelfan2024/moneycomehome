'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

const navItems = [
  { name: '仪表盘', href: '/', icon: '📊' },
  { name: '上传数据', href: '/upload', icon: '📤' },
  { name: '每日对比', href: '/compare', icon: '📈' },
  { name: 'AI报告', href: '/report', icon: '🤖' },
  { name: '公众号排版', href: '/wechat-editor', icon: '✍️' },
  { name: '连续榜单', href: '/ranking', icon: '🏆' },
  { name: '设置', href: '/settings', icon: '⚙️' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const toggleTheme = () => {
    const themes: ('auto' | 'light' | 'dark')[] = ['auto', 'light', 'dark']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const getThemeIcon = () => {
    if (!hydrated) return '🔄'
    switch (theme) {
      case 'light': return '☀️'
      case 'dark': return '🌙'
      default: return '🔄'
    }
  }

  const getThemeTooltip = () => {
    if (!hydrated) return '加载中...'
    switch (theme) {
      case 'light': return '浅色模式'
      case 'dark': return '深色模式'
      default: return '自动模式'
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideInFromLeft {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          60% {
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes glowPulse {
          0%, 100% {
            filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.8));
          }
        }
        
        .animate-slide-in {
          animation: slideInFromLeft 1.2s ease-out forwards;
        }
        
        .text-gradient-container {
          animation: glowPulse 2s ease-in-out infinite;
        }
      `}</style>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => router.push('/')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-color)] to-red-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                <span className="text-xl">📈</span>
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
                  火车每日股票池
                </h1>
                <p className="text-xs text-[var(--text-muted)]">Stock Pool Tracker</p>
              </div>
            </div>

            <div className="hidden md:flex items-center space-x-0.5">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative overflow-hidden px-4 py-2.5 bg-gradient-to-r from-red-600/25 via-red-500/20 to-red-600/15 rounded-xl border border-red-500/40 shadow-lg shadow-red-500/10">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-75"></div>
                  </div>
                  <div className="text-gradient-container">
                    <span className="text-sm font-bold bg-gradient-to-r from-red-300 via-red-400 to-red-500 bg-clip-text text-transparent tracking-wide animate-slide-in whitespace-nowrap">
                      All Money Come Home
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl bg-gradient-to-br from-[var(--bg-dark)] to-[var(--bg-darker)] border border-[var(--border-color)]/50 hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 ${hydrated ? 'opacity-100' : 'hidden'}`}
                title={hydrated ? getThemeTooltip() : ''}
              >
                <span className="text-lg">{getThemeIcon()}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  )
}
