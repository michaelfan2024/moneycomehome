'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider } from './ThemeProvider'
import Navbar from './Navbar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname()
  const isWechatEditor = pathname?.startsWith('/wechat-editor')

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--bg-dark)]">
        <Navbar />
        {isWechatEditor ? (
          <div className="pt-16">{children}</div>
        ) : (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6">
            {children}
          </main>
        )}
      </div>
    </ThemeProvider>
  )
}
