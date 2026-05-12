'use client'

import { useState, useEffect } from 'react'

interface WeChatAccount {
  appId: string
  appSecret: string
  name?: string
  boundAt: string
}

interface WeChatConfig {
  accounts: WeChatAccount[]
  defaultAccount?: string
}

export default function WeChatSettingsPage() {
  const [config, setConfig] = useState<WeChatConfig>({ accounts: [], defaultAccount: undefined })
  const [loading, setLoading] = useState(true)
  const [binding, setBinding] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAccount, setNewAccount] = useState({ appId: '', appSecret: '' })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/wechat')
      const data = await res.json()
      if (data.success) {
        setConfig(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBind = async () => {
    if (!newAccount.appId || !newAccount.appSecret) {
      setMessage({ type: 'error', text: '请填写完整的AppID和AppSecret' })
      return
    }

    setBinding(true)
    setMessage(null)
    try {
      const res = await fetch('/api/config/wechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bind', account: newAccount })
      })
      const data = await res.json()
      setMessage({ type: data.success ? 'success' : 'error', text: data.message })
      if (data.success) {
        setNewAccount({ appId: '', appSecret: '' })
        setShowAddForm(false)
        fetchConfig()
      }
    } catch (error) {
      setMessage({ type: 'error', text: '绑定失败' })
    } finally {
      setBinding(false)
    }
  }

  const handleUnbind = async (appId: string) => {
    if (!confirm('确定要解绑此公众号吗？')) return

    try {
      const res = await fetch('/api/config/wechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unbind', account: { appId } })
      })
      const data = await res.json()
      setMessage({ type: data.success ? 'success' : 'error', text: data.message })
      if (data.success) {
        fetchConfig()
      }
    } catch (error) {
      setMessage({ type: 'error', text: '解绑失败' })
    }
  }

  const handleSetDefault = async (appId: string) => {
    try {
      const res = await fetch('/api/config/wechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setDefault', account: { appId } })
      })
      const data = await res.json()
      setMessage({ type: data.success ? 'success' : 'error', text: data.message })
      if (data.success) {
        fetchConfig()
      }
    } catch (error) {
      setMessage({ type: 'error', text: '设置失败' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[var(--border-color)] rounded-full"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
            公众号设置
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">绑定微信公众号，用于发布分析报告</p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
          >
            添加公众号
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="card p-6 space-y-4 border border-[var(--primary-color)]/30">
          <h3 className="font-medium">绑定新公众号</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                AppID
              </label>
              <input
                type="text"
                value={newAccount.appId}
                onChange={(e) => setNewAccount({ ...newAccount, appId: e.target.value })}
                placeholder="wx1234567890abcdef"
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                AppSecret
              </label>
              <input
                type="password"
                value={newAccount.appSecret}
                onChange={(e) => setNewAccount({ ...newAccount, appSecret: e.target.value })}
                placeholder="输入AppSecret"
                className="input-field w-full"
              />
            </div>
          </div>
          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {message.text}
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleBind}
              disabled={binding}
              className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
            >
              {binding ? '绑定中...' : '确认绑定'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewAccount({ appId: '', appSecret: '' }); setMessage(null); }}
              className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {config.accounts.length === 0 && !showAddForm ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">📱</div>
          <p className="text-[var(--text-secondary)]">暂无绑定的公众号</p>
          <p className="text-sm text-[var(--text-secondary)] mt-2">点击上方按钮添加第一个公众号</p>
        </div>
      ) : (
        <div className="space-y-4">
          {config.accounts.map(account => (
            <div key={account.appId} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center">
                  <span className="text-xl">📢</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{account.name || '未命名公众号'}</p>
                    {config.defaultAccount === account.appId && (
                      <span className="px-2 py-0.5 text-xs bg-[var(--primary-color)] text-black rounded">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">
                    AppID: {account.appId.substring(0, 10)}...{account.appId.substring(account.appId.length - 4)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    绑定时间: {new Date(account.boundAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {config.defaultAccount !== account.appId && (
                  <button
                    onClick={() => handleSetDefault(account.appId)}
                    className="px-3 py-1 text-sm border border-[var(--border-color)] text-[var(--text-primary)] rounded hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    设为默认
                  </button>
                )}
                <button
                  onClick={() => handleUnbind(account.appId)}
                  className="px-3 py-1 text-sm border border-red-500/50 text-red-400 rounded hover:bg-red-500/10 transition-colors"
                >
                  解绑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4 bg-[var(--bg-secondary)]/50">
        <h4 className="font-medium mb-2">💡 说明</h4>
        <ul className="text-sm text-[var(--text-secondary)] space-y-1">
          <li>• 需要在微信公众平台获取AppID和AppSecret</li>
          <li>• 绑定后可以使用报告自动发布功能</li>
          <li>• 支持绑定多个公众号，选择其中一个作为默认发布目标</li>
        </ul>
      </div>
    </div>
  )
}