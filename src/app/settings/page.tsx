'use client'

import Link from 'next/link'

const SETTINGS_ITEMS = [
  {
    href: '/settings/ai',
    icon: '🤖',
    title: 'AI 分析设置',
    description: '配置AI服务商API密钥和模型选择'
  },
  {
    href: '/settings/wechat',
    icon: '📱',
    title: '公众号设置',
    description: '绑定微信公众号用于发布报告'
  }
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
          系统设置
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">配置AI分析和公众号发布功能</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SETTINGS_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className="card p-6 hover:border-[var(--primary-color)] transition-colors group">
            <div className="flex items-start gap-4">
              <div className="text-4xl">{item.icon}</div>
              <div className="flex-1">
                <h3 className="font-medium group-hover:text-[var(--primary-color)] transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {item.description}
                </p>
              </div>
              <div className="text-[var(--text-secondary)] group-hover:text-[var(--primary-color)] transition-colors">
                →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}