import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATE,
  buildPromptFromTemplate,
  getEditableTemplateContent,
  isSystemTemplateId,
  type AnalysisTemplate
} from './analysis-template'

describe('buildPromptFromTemplate', () => {
  it('uses a custom prompt as one block while keeping stock context', () => {
    const template: AnalysisTemplate = {
      id: 'report_template_1',
      name: 'D5 模板',
      description: '自定义模板',
      customPrompt: '你是 D5 分析师。\n写作风格：直接。\n标题使用 {{DATE}}，股票数量 {{STOCK_COUNT}}。'
    }

    const prompt = buildPromptFromTemplate(
      template,
      [
        { stock_code: '000001', stock_name: '平安银行' },
        { stock_code: '600000', stock_name: '浦发银行' }
      ],
      '2026-05-12'
    )

    expect(prompt).toContain('2026-05-12')
    expect(prompt).toContain('今日新增股票**：2只')
    expect(prompt).toContain('000001 平安银行')
    expect(prompt).toContain('600000 浦发银行')
    expect(prompt).toContain('你是 D5 分析师。')
    expect(prompt).toContain('股票数量 2')
    expect(prompt).not.toContain('undefined')
    expect(prompt).not.toContain('核心投资理念')
  })

  it('appends fetched finance context to the prompt', () => {
    const prompt = buildPromptFromTemplate(
      DEFAULT_TEMPLATE,
      [{ stock_code: '000001', stock_name: '平安银行' }],
      '2026-05-12',
      '东方财富公开财报数据（仅可引用以下已核验数据，禁止编造未提供数值）：\n- 000001 平安银行：报告期：2026-03-31（ 一季报 ）；净利润：14523000000'
    )

    expect(prompt).toContain('东方财富公开财报数据')
    expect(prompt).toContain('14523000000')
  })

  it('keeps the default style readable in mobile WeChat output', () => {
    const prompt = buildPromptFromTemplate(
      DEFAULT_TEMPLATE,
      [{ stock_code: '600110', stock_name: '诺德股份' }],
      '2026-05-13'
    )

    expect(prompt).toContain('禁止把个股正文写成一级、二级或三级标题')
    expect(prompt).toContain('正文不要整段加粗')
    expect(prompt).toContain('每个自然段不超过80个中文字符')
  })

  it('builds a ranking report prompt without daily-new-stock wording', () => {
    const prompt = buildPromptFromTemplate(
      DEFAULT_TEMPLATE,
      [
        {
          stock_code: '688001',
          stock_name: '半导体A',
          continuous_count: 5,
          total_appear_count: 8,
          industry: '半导体',
          concepts: ['芯片'],
          finance: { netProfit: 120000000, netProfitYoy: 60 }
        }
      ],
      '2026-05-15',
      undefined,
      {
        sourceType: 'ranking',
        title: '连续3天+股票AI分析报告',
        filterSummary: '连续3天+；行业=半导体'
      }
    )

    expect(prompt).toContain('连续榜单')
    expect(prompt).toContain('连续3天+；行业=半导体')
    expect(prompt).toContain('半导体A')
    expect(prompt).toContain('连续5天')
    expect(prompt).toContain('净利润120000000')
    expect(prompt).not.toContain('今日新增股票')
    expect(prompt).toContain('禁止凭空声称')
  })
})

describe('template editing helpers', () => {
  it('recognizes built-in system templates by id', () => {
    expect(isSystemTemplateId('default')).toBe(true)
    expect(isSystemTemplateId('professional')).toBe(true)
    expect(isSystemTemplateId('report_template_1')).toBe(false)
  })

  it('serializes a system template into editable full prompt content', () => {
    const content = getEditableTemplateContent(DEFAULT_TEMPLATE)

    expect(content).toContain('你是奶员外公众号的特约股票分析师')
    expect(content).toContain('核心投资理念声明')
    expect(content).toContain('文章结构')
    expect(content).not.toContain('undefined')
  })

  it('uses custom prompt content directly when editing a saved override', () => {
    expect(getEditableTemplateContent({
      id: 'default',
      name: '奶员外风格',
      description: '覆盖模板',
      customPrompt: '覆盖后的完整提示词'
    })).toBe('覆盖后的完整提示词')
  })
})
