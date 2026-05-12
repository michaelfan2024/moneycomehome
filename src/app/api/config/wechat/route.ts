import { NextResponse } from 'next/server'
import { getWeChatConfig, saveWeChatConfig, getWeChatAccessToken, type WeChatConfig, type WeChatAccount } from '../../../../lib/config-store'

export async function GET() {
  try {
    const config = getWeChatConfig()
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Get WeChat config error:', error)
    return NextResponse.json({ success: false, error: '获取配置失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, account } = body

    if (action === 'bind') {
      const tokenResult = await getWeChatAccessToken(account.appId, account.appSecret)
      if (!tokenResult.success) {
        return NextResponse.json({ success: false, message: tokenResult.error || '获取access_token失败，请检查AppID和AppSecret' })
      }

      const config = getWeChatConfig() || { accounts: [], defaultAccount: undefined }
      const newAccount: WeChatAccount = {
        ...account,
        boundAt: new Date().toISOString()
      }

      const existingIndex = config.accounts.findIndex(a => a.appId === account.appId)
      if (existingIndex >= 0) {
        config.accounts[existingIndex] = newAccount
      } else {
        config.accounts.push(newAccount)
      }

      if (!config.defaultAccount) {
        config.defaultAccount = account.appId
      }

      const success = saveWeChatConfig(config)
      return NextResponse.json({
        success,
        message: success ? '绑定成功' : '绑定失败',
        data: { appId: account.appId }
      })
    }

    if (action === 'unbind') {
      const config = getWeChatConfig() || { accounts: [], defaultAccount: undefined }
      config.accounts = config.accounts.filter(a => a.appId !== account.appId)
      if (config.defaultAccount === account.appId) {
        config.defaultAccount = config.accounts[0]?.appId
      }
      const success = saveWeChatConfig(config)
      return NextResponse.json({ success, message: success ? '解绑成功' : '解绑失败' })
    }

    if (action === 'setDefault') {
      const config = getWeChatConfig() || { accounts: [], defaultAccount: undefined }
      config.defaultAccount = account.appId
      const success = saveWeChatConfig(config)
      return NextResponse.json({ success, message: success ? '设置成功' : '设置失败' })
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('WeChat config error:', error)
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 })
  }
}