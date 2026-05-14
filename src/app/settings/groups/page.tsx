'use client'

import { useEffect, useState } from 'react'
import { createStockGroup, getStockGroups, updateStockGroup } from '../../../lib/api'
import type { StockGroup } from '../../../types'

export default function GroupSettingsPage() {
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadGroups = async () => {
    setLoading(true)
    try {
      const result = await getStockGroups(true)
      setGroups(result.data || [])
    } catch (err) {
      console.error('Failed to load groups:', err)
      setError('获取分组失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await createStockGroup(newName.trim())
      if (result.success) {
        setNewName('')
        await loadGroups()
      } else {
        setError(result.error || '创建失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async (group: StockGroup) => {
    if (!editingName.trim()) return
    setSaving(true)
    setError('')
    try {
      const result = await updateStockGroup(group.id, { name: editingName.trim() })
      if (result.success) {
        setEditingId('')
        setEditingName('')
        await loadGroups()
      } else {
        setError(result.error || '更新失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (group: StockGroup) => {
    setSaving(true)
    setError('')
    try {
      const result = await updateStockGroup(group.id, { is_active: !group.is_active })
      if (result.success) {
        await loadGroups()
      } else {
        setError(result.error || '更新失败')
      }
    } finally {
      setSaving(false)
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
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
          股票池分组
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">管理上传、对比和连续榜单使用的独立股票池时间线</p>
      </div>

      <div className="card p-6">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">新增分组</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input-field flex-1"
            placeholder="例如：启动股票池"
          />
          <button
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            className="px-5 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            创建
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      <div className="card p-6">
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col md:flex-row md:items-center gap-3 justify-between p-4 bg-[var(--bg-dark)] rounded-lg">
              <div className="flex-1">
                {editingId === group.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="input-field"
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{group.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${group.is_active ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-[var(--text-muted)]'}`}>
                        {group.is_active ? '启用中' : '已停用'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">ID: {group.id}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === group.id ? (
                  <>
                    <button
                      onClick={() => handleRename(group)}
                      disabled={saving || !editingName.trim()}
                      className="px-3 py-1.5 text-sm bg-[var(--primary-color)] text-black rounded-lg disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingId('')
                        setEditingName('')
                      }}
                      className="px-3 py-1.5 text-sm bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(group.id)
                        setEditingName(group.name)
                      }}
                      className="px-3 py-1.5 text-sm bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)]"
                    >
                      重命名
                    </button>
                    <button
                      onClick={() => handleToggleActive(group)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg hover:text-[var(--text-primary)] disabled:opacity-50"
                    >
                      {group.is_active ? '停用' : '启用'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
