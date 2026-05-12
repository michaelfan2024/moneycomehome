import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), '.config')
const AI_CONFIG_FILE = path.join(CONFIG_DIR, 'ai-config.json')
const WECHAT_CONFIG_FILE = path.join(CONFIG_DIR, 'wechat-config.json')

export interface AIConfig {
  provider: 'deepseek' | 'wenxin' | 'tongyi' | 'openai' | 'huoshan'
  apiKey: string
  model: string
  maxDailyCalls: number
}

export interface WeChatAccount {
  appId: string
  appSecret: string
  name?: string
  avatar?: string
  boundAt: string
}

export interface WeChatConfig {
  accounts: WeChatAccount[]
  defaultAccount?: string
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function encryptKey(key: string): string {
  return Buffer.from(key).toString('base64')
}

function decryptKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf8')
}

export function getAIConfig(): AIConfig | null {
  try {
    ensureConfigDir()
    if (!fs.existsSync(AI_CONFIG_FILE)) {
      return null
    }
    const data = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'))
    if (data.apiKey) {
      data.apiKey = decryptKey(data.apiKey)
    }
    return data
  } catch (error) {
    console.error('Error reading AI config:', error)
    return null
  }
}

export function saveAIConfig(config: AIConfig): boolean {
  try {
    ensureConfigDir()
    const data = { ...config }
    if (data.apiKey) {
      data.apiKey = encryptKey(data.apiKey)
    }
    fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error('Error saving AI config:', error)
    return false
  }
}

export function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  return new Promise(async (resolve) => {
    try {
      let endpoint = ''
      let body = {}
      
      switch (config.provider) {
        case 'deepseek':
          endpoint = 'https://api.deepseek.com/v1/chat/completions'
          body = {
            model: config.model || 'deepseek-chat',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          }
          break
        case 'wenxin':
          endpoint = 'https://qwen.modelscope.cn/api/v1/services/aigc/text-generation/generation'
          body = {
            model: config.model || 'qwen-turbo',
            input: { prompt: 'Hi' },
            parameters: { max_tokens: 10 }
          }
          break
        case 'tongyi':
          endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
          body = {
            model: config.model || 'qwen-turbo',
            input: { prompt: 'Hi' },
            parameters: { max_tokens: 10 }
          }
          break
        case 'openai':
          endpoint = 'https://api.openai.com/v1/chat/completions'
          body = {
            model: config.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          }
          break
        case 'huoshan':
          endpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
          body = {
            model: config.model || 'doubao-seed-2-0-pro-260215',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10
          }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        resolve({ success: true, message: '连接成功！' })
      } else {
        const error = await response.text()
        const status = response.status
        resolve({ success: false, message: `连接失败 [${status}]: ${error.slice(0, 200)}` })
      }
    } catch (error: any) {
      resolve({ success: false, message: `连接失败: ${error.message || error}` })
    }
  })
}

export function getWeChatConfig(): WeChatConfig | null {
  try {
    ensureConfigDir()
    if (!fs.existsSync(WECHAT_CONFIG_FILE)) {
      return { accounts: [], defaultAccount: undefined }
    }
    const data = JSON.parse(fs.readFileSync(WECHAT_CONFIG_FILE, 'utf8'))
    data.accounts = data.accounts.map((acc: any) => ({
      ...acc,
      appSecret: decryptKey(acc.appSecret)
    }))
    return data
  } catch (error) {
    console.error('Error reading WeChat config:', error)
    return { accounts: [], defaultAccount: undefined }
  }
}

export function saveWeChatConfig(config: WeChatConfig): boolean {
  try {
    ensureConfigDir()
    const data = {
      ...config,
      accounts: config.accounts.map(acc => ({
        ...acc,
        appSecret: encryptKey(acc.appSecret)
      }))
    }
    fs.writeFileSync(WECHAT_CONFIG_FILE, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error('Error saving WeChat config:', error)
    return false
  }
}

export interface AccessTokenResult {
  success: boolean
  accessToken?: string
  error?: string
  errorCode?: number
}

export async function getWeChatAccessToken(appId: string, appSecret: string): Promise<AccessTokenResult> {
  try {
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
    )
    const data = await response.json()
    if (data.access_token) {
      return { success: true, accessToken: data.access_token }
    }
    if (data.errcode) {
      let errorMsg = `获取access_token失败 [${data.errcode}]: ${data.errmsg}`
      if (data.errcode === 40001) {
        errorMsg += ' (AppSecret错误或已过期)'
      } else if (data.errcode === 40013) {
        errorMsg += ' (AppID无效)'
      } else if (data.errcode === 40164) {
        errorMsg += ' (IP白名单问题，请检查公众号IP配置)'
      }
      return { success: false, error: errorMsg, errorCode: data.errcode }
    }
    return { success: false, error: '获取access_token失败，未知原因' }
  } catch (error: any) {
    console.error('Error getting WeChat access token:', error)
    return { success: false, error: `网络请求失败: ${error.message}` }
  }
}