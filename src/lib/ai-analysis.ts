import { getAIConfig } from './config-store'
import type { StockCompareResult } from '../types'
import { buildPromptFromTemplate, DEFAULT_TEMPLATE, type AnalysisTemplate } from './analysis-template'

interface StockAnalysis {
  stockCode: string
  stockName: string
  industry?: string
  marketCap?: number
  mainBusiness?: string
  highlights?: string
  risks?: string
}

interface AIAnalysisResult {
  success: boolean
  reportId?: string
  content?: string
  error?: string
}

export async function callAIAnalysis(
  stocks: StockCompareResult[], 
  date: string,
  template: AnalysisTemplate = DEFAULT_TEMPLATE,
  financeContext?: string
): Promise<AIAnalysisResult> {
  try {
    const config = getAIConfig()
    if (!config || !config.apiKey) {
      return { success: false, error: 'AI配置未设置，请先在设置页面配置API Key' }
    }

    const prompt = buildPromptFromTemplate(template, stocks, date, financeContext)

    let endpoint = ''
    let body: any = {}

    switch (config.provider) {
      case 'deepseek':
        endpoint = 'https://api.deepseek.com/v1/chat/completions'
        body = {
          model: config.model || 'deepseek-chat',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        }
        break
      case 'wenxin':
        endpoint = 'https://qwen.modelscope.cn/api/v1/services/aigc/text-generation/generation'
        body = {
          model: config.model || 'qwen-turbo',
          input: { prompt },
          parameters: { max_tokens: 4000, temperature: 0.7 }
        }
        break
      case 'tongyi':
        endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
        body = {
          model: config.model || 'qwen-turbo',
          input: { prompt },
          parameters: { max_tokens: 4000, temperature: 0.7 }
        }
        break
      case 'openai':
        endpoint = 'https://api.openai.com/v1/chat/completions'
        body = {
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        }
        break
      case 'huoshan':
        endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
        body = {
          model: config.model || 'doubao-seed-2-0-pro-260215',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4000
        }
        break
      default:
        return { success: false, error: '不支持的AI服务商' }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `API调用失败: ${errorText}` }
    }

    const data = await response.json()

    let content = ''
    if (config.provider === 'deepseek' || config.provider === 'openai' || config.provider === 'huoshan') {
      content = data.choices?.[0]?.message?.content || ''
    } else {
      content = data.output?.text || data.choices?.[0]?.message?.content || ''
    }

    if (!content) {
      return { success: false, error: 'AI返回内容为空' }
    }

    const reportId = `report_${date}_${Date.now()}`

    return {
      success: true,
      reportId,
      content
    }
  } catch (error: any) {
    console.error('AI analysis error:', error)
    return { success: false, error: `分析失败: ${error.message}` }
  }
}

export { DEFAULT_TEMPLATE, type AnalysisTemplate } from './analysis-template'
