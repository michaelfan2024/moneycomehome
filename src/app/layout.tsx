import type { Metadata } from 'next'
import './globals.css'
import Layout from '../components/Layout'

export const metadata: Metadata = {
  title: '火车每日股票池',
  description: '轻量级股票池追踪分析平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
