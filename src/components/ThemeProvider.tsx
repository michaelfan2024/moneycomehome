'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

interface ThemeContextType {
  theme: Theme
  actualTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('auto')
  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('dark')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme
    setThemeState(saved || 'auto')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const getTimeBasedTheme = () => {
      const hour = new Date().getHours()
      return hour >= 19 || hour < 7 ? 'dark' : 'light'
    }

    const updateTheme = () => {
      const resolvedTheme = theme === 'auto' ? getTimeBasedTheme() : theme
      setActualTheme(resolvedTheme)
      localStorage.setItem('theme', theme)
    }

    updateTheme()

    if (theme === 'auto') {
      const interval = setInterval(updateTheme, 60000)
      return () => clearInterval(interval)
    }
  }, [theme, hydrated])

  useEffect(() => {
    if (actualTheme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [actualTheme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
