import { THEMES } from './themes'

export function getSafeThemeId(themeId?: string | null): string {
  if (themeId && THEMES.some((theme) => theme.id === themeId)) {
    return themeId
  }

  return THEMES[0].id
}

export function buildWechatEditorUrl(reportId: string, themeId?: string | null): string {
  const params = new URLSearchParams({
    reportId,
    theme: getSafeThemeId(themeId)
  })

  return `/wechat-editor?${params.toString()}`
}
