import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATE, buildPromptFromTemplate, type AnalysisTemplate } from './analysis-template'

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
})
