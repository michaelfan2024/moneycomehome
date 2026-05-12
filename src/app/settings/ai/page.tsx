'use client'

import { useState, useEffect } from 'react'

interface AIConfig {
  provider: 'deepseek' | 'wenxin' | 'tongyi' | 'openai' | 'huoshan'
  apiKey: string
  model: string
  maxDailyCalls: number
}

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek（推荐）', models: ['deepseek-chat', 'deepseek-coder'] },
  { value: 'huoshan', label: '火山引擎', models: ['doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260215', 'doubao-seed-2-0-code-preview-260215', 'doubao-seed-1.8', 'doubao-speed-character', 'doubao-speed-code', 'ZLM-4.7', 'DeepSeek-V3.2'] },
  { value: 'wenxin', label: '文心一言', models: ['ernie-4.0-8k-latest', 'ernie-3.5-8k-latest'] },
  { value: 'tongyi', label: '通义千问', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
  { value: 'openai', label: 'OpenAI (GPT)', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] }
]

export default function AISettingsPage() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    maxDailyCalls: 50
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/ai')
      const data = await res.json()
      if (data.success && data.data) {
        const configData = data.data
        const providerInfo = PROVIDERS.find(p => p.value === configData.provider)
        if (providerInfo && !providerInfo.models.includes(configData.model)) {
          configData.model = providerInfo.models[0]
        }
        setConfig(configData)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/config/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', config })
      })
      const data = await res.json()
      setMessage({ type: data.success ? 'success' : 'error', text: data.message })
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/config/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', config })
      })
      const data = await res.json()
      setMessage({ type: data.success ? 'success' : 'error', text: data.message })
    } catch (error) {
      setMessage({ type: 'error', text: '测试连接失败' })
    } finally {
      setTesting(false)
    }
  }

  const handleProviderChange = (provider: string) => {
    const providerInfo = PROVIDERS.find(p => p.value === provider)
    setConfig({
      ...config,
      provider: provider as AIConfig['provider'],
      model: providerInfo?.models[0] || ''
    })
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
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
          AI 分析设置
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">配置AI服务商API，用于生成股票分析报告</p>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            AI 服务商
          </label>
          <select
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="select-field w-full"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            API Key
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder="输入API密钥"
            className="input-field w-full"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            请前往对应AI平台申请API Key，密钥将加密存储
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            模型选择
          </label>
          <select
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            className="select-field w-full"
          >
            {PROVIDERS.find(p => p.value === config.provider)?.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            每日调用上限
          </label>
          <input
            type="number"
            value={config.maxDailyCalls}
            onChange={(e) => setConfig({ ...config, maxDailyCalls: parseInt(e.target.value) || 50 })}
            className="input-field w-full"
            min="1"
            max="1000"
          />
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            设置每日最大调用次数，用于成本控制
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleTest}
            disabled={testing || !config.apiKey}
            className="px-6 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] rounded-lg hover:bg-[var(--primary-color)]/10 transition-colors disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !config.apiKey}
            className="px-6 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}