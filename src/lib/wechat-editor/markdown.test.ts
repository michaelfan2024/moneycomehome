import { describe, expect, it } from 'vitest'
import { applyTheme, md, preprocessMarkdown } from './markdown'
import { stripIndexMarkers } from './markdownIndexer'
import { makeWeChatCompatible } from './wechatCompat'
import { THEMES } from './themes'

function renderMarkdown(markdown: string) {
  return md.render(preprocessMarkdown(markdown))
}

describe('wechat editor markdown rendering', () => {
  it('ships all Raphael themes into Money Come Home', () => {
    expect(THEMES).toHaveLength(30)
    expect(THEMES.map((theme) => theme.id)).toContain('wechat')
    expect(THEMES.map((theme) => theme.id)).toContain('bloomberg')
  })

  it('renders punctuation-adjacent bold text without leaking markdown markers', () => {
    const html = renderMarkdown('利率一度升至**5%**。')

    expect(html).toContain('<strong>5%</strong>。')
    expect(html).not.toContain('**5%**')
  })

  it('applies Raphael theme styles and image grid grouping', () => {
    const rawHtml = renderMarkdown('![](a.png)\n\n![](b.png)')
    const themed = applyTheme(rawHtml, 'apple')
    const doc = new DOMParser().parseFromString(themed, 'text/html')

    expect(doc.querySelector('body > div')?.getAttribute('style')).toContain('font-family')
    expect(doc.querySelector('.image-grid')?.querySelectorAll('img')).toHaveLength(2)
  })

  it('strips editor-only index markers before copy or export', () => {
    const html = '<p data-md-type="paragraph" data-md-index="0">hello</p>'

    expect(stripIndexMarkers(html)).toBe('<p>hello</p>')
  })

  it('produces clean WeChat-compatible HTML for clipboard copy', async () => {
    const rawHtml = renderMarkdown('# 标题\n\n正文 **重点**。')
    const themed = applyTheme(rawHtml, 'wechat')
    const indexed = themed.replace('<h1', '<h1 data-md-type="heading" data-md-index="0"')
    const compatible = await makeWeChatCompatible(indexed, 'wechat')
    const doc = new DOMParser().parseFromString(compatible, 'text/html')

    expect(doc.body.firstElementChild?.tagName).toBe('SECTION')
    expect(doc.querySelector('section')?.getAttribute('style')).toContain('font-family')
    expect(doc.querySelector('strong')?.textContent).toBe('重点。')
    expect(compatible).not.toContain('data-md-')
  })
})
