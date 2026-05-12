import type { AnalysisTemplate } from './analysis-template'

export interface ReportTemplateRecord {
  id: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

export interface ReportTemplateInput {
  name: string
  content: string
}

const MAX_TEMPLATE_NAME_LENGTH = 100
const MAX_TEMPLATE_CONTENT_LENGTH = 30000

export function normalizeReportTemplateInput(input: unknown): ReportTemplateInput | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const data = input as Record<string, unknown>
  if (typeof data.name !== 'string' || typeof data.content !== 'string') {
    return null
  }

  const name = data.name.trim()
  const content = data.content.trim()

  if (!name || !content) {
    return null
  }

  if (name.length > MAX_TEMPLATE_NAME_LENGTH || content.length > MAX_TEMPLATE_CONTENT_LENGTH) {
    return null
  }

  return { name, content }
}

export function reportTemplateRecordToAnalysisTemplate(template: ReportTemplateRecord): AnalysisTemplate {
  return {
    id: template.id,
    name: template.name,
    description: '自定义模板',
    customPrompt: template.content
  }
}
