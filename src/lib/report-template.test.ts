import { describe, expect, it } from 'vitest'
import { normalizeReportTemplateInput, reportTemplateRecordToAnalysisTemplate } from './report-template'

describe('normalizeReportTemplateInput', () => {
  it('trims a valid template name and content', () => {
    expect(normalizeReportTemplateInput({
      name: '  D5 模板  ',
      content: '\n角色设定和文章结构\n'
    })).toEqual({
      name: 'D5 模板',
      content: '角色设定和文章结构'
    })
  })

  it('rejects templates without a name or content', () => {
    expect(normalizeReportTemplateInput({ name: '', content: '内容' })).toBeNull()
    expect(normalizeReportTemplateInput({ name: 'D5', content: '' })).toBeNull()
  })
})

describe('reportTemplateRecordToAnalysisTemplate', () => {
  it('converts a saved database template into an AI template', () => {
    expect(reportTemplateRecordToAnalysisTemplate({
      id: 'report_template_1',
      name: 'D5 模板',
      content: '整块模板内容',
      created_at: '2026-05-12T00:00:00.000Z',
      updated_at: '2026-05-12T00:00:00.000Z'
    })).toMatchObject({
      id: 'report_template_1',
      name: 'D5 模板',
      description: '自定义模板',
      customPrompt: '整块模板内容'
    })
  })
})
