import { describe, expect, it } from 'vitest'
import { buildWechatEditorUrl, getSafeThemeId } from './themeSelection'

describe('getSafeThemeId', () => {
  it('returns a valid theme id unchanged', () => {
    expect(getSafeThemeId('claude')).toBe('claude')
  })

  it('falls back to the default theme for invalid or missing ids', () => {
    const fallback = getSafeThemeId()

    expect(getSafeThemeId('missing-theme')).toBe(fallback)
    expect(getSafeThemeId('')).toBe(fallback)
    expect(getSafeThemeId(null)).toBe(fallback)
  })
})

describe('buildWechatEditorUrl', () => {
  it('includes report id and safe theme id', () => {
    expect(buildWechatEditorUrl('report 1', 'claude')).toBe('/wechat-editor?reportId=report+1&theme=claude')
  })

  it('falls back to the default theme in URLs', () => {
    expect(buildWechatEditorUrl('r1', 'missing-theme')).toContain(`theme=${getSafeThemeId()}`)
  })
})
