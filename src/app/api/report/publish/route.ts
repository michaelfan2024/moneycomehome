import { NextResponse } from 'next/server'
import { getWeChatConfig, getWeChatAccessToken, type WeChatAccount } from '../../../../lib/config-store'
import { getReport, updateReportPublishStatus } from '../../../../lib/report-store'

function markdownToHtml(markdown: string): string {
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/^# (.*$)/gm, '<h1 style="color:#333;font-size:18px;font-weight:bold;margin:16px 0;">$1</h1>')
    .replace(/^## (.*$)/gm, '<h2 style="color:#333;font-size:16px;font-weight:bold;margin:12px 0;">$1</h2>')
    .replace(/^### (.*$)/gm, '<h3 style="color:#333;font-size:14px;font-weight:bold;margin:10px 0;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e74c3c;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/\n\n/g, '</p><p style="color:#333;font-size:14px;line-height:1.8;margin:8px 0;">')
    .replace(/\n/g, '<br/>')

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; padding: 16px; color: #333;"><p style="color:#333;font-size:14px;line-height:1.8;margin:8px 0;">${html}</p></div>`
}

async function checkAccessToken(accessToken: string): Promise<{ valid: boolean; info?: any; error?: string }> {
  try {
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/get_api_domain_ip?access_token=${accessToken}`,
      {
        method: 'GET'
      }
    )
    const result = await response.json()
    console.log('access_token验证API响应:', JSON.stringify(result))
    if (result.errcode === 0 || result.ip_list) {
      return { valid: true, info: result }
    } else {
      const errMsg = result.errmsg || '未知错误'
      return { valid: false, error: `access_token无效 [${result.errcode}]: ${errMsg}` }
    }
  } catch (error: any) {
    return { valid: false, error: `检查失败: ${error.message}` }
  }
}

async function testWeChatDraft(appId: string): Promise<Response> {
  let config = getWeChatConfig()
  if (!config) {
    return NextResponse.json({ success: false, error: '未配置公众号' }, { status: 400 })
  }

  let targetAccount: WeChatAccount | undefined
  if (appId) {
    targetAccount = config.accounts.find(a => a.appId === appId)
    if (!targetAccount) {
      return NextResponse.json({ success: false, error: '未找到指定的公众号' }, { status: 404 })
    }
  } else {
    targetAccount = config.accounts[0]
  }

  if (!targetAccount) {
    return NextResponse.json({ success: false, error: '没有已绑定的公众号' }, { status: 400 })
  }

  const tokenResult = await getWeChatAccessToken(targetAccount.appId, targetAccount.appSecret)
  if (!tokenResult.success) {
    return NextResponse.json({ success: false, error: tokenResult.error || '获取access_token失败' }, { status: 500 })
  }
  const accessToken = tokenResult.accessToken!

  console.log('开始验证access_token...')
  const tokenCheck = await checkAccessToken(accessToken)
  console.log('access_token验证结果:', JSON.stringify(tokenCheck))
  
  if (!tokenCheck.valid) {
    return NextResponse.json({
      success: false,
      error: `access_token验证失败: ${tokenCheck.error}`
    }, { status: 500 })
  }

  const testData = {
    articles: [
      {
        title: '测试文章标题',
        author: '测试作者',
        content: '<div style="padding: 10px;"><p>这是一篇测试文章。</p></div>'
      }
    ]
  }

  console.log('测试数据:', JSON.stringify(testData))

  // 尝试使用永久素材接口
  console.log('尝试使用永久素材接口...')
  const materialResponse = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_news?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(testData)
    }
  )

  const materialResult = await materialResponse.json()
  console.log('永久素材接口响应:', JSON.stringify(materialResult))

  if (materialResult.errcode === 0) {
    return NextResponse.json({
      success: true,
      message: '测试成功！永久素材已创建',
      data: {
        mediaId: materialResult.media_id
      }
    })
  }

  // 如果永久素材接口也失败，尝试草稿接口
  console.log('尝试使用草稿接口...')
  const draftResponse = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=utf-8'
      },
      body: JSON.stringify(testData)
    }
  )

  const draftResult = await draftResponse.json()
  console.log('草稿接口响应:', JSON.stringify(draftResult))

  if (draftResult.errcode !== 0) {
    let errorMsg = `创建草稿失败 [${draftResult.errcode}]: ${draftResult.errmsg}`
    if (draftResult.errcode === 40007) {
      errorMsg = `【发布失败】\n\n错误码: ${draftResult.errcode}\n错误信息: ${draftResult.errmsg}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ 最可能的原因：\n\n1️⃣ 公众号类型不正确\n   - 草稿箱接口需要【认证服务号】\n   - 订阅号没有此权限\n\n2️⃣ 公众号未认证或权限不足\n   - 请登录微信公众平台检查\n   - 路径：开发 → 接口权限\n\n3️⃣ access_token权限范围不够\n   - 获取access_token时可能缺少必要权限\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 临时解决方案：\n\n请使用【公众号排版】→【复制排版后内容】功能，\n手动粘贴到微信公众号后台发布。\n\n如果您确认公众号是认证服务号，请检查：\n• AppID和AppSecret是否正确\n• 公众号是否已完成认证\n• 接口权限是否已开通`
    }
    return NextResponse.json({
      success: false,
      error: errorMsg
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: '测试成功！草稿已创建',
    data: {
      mediaId: draftResult.media_id
    }
  })
}

async function createWeChatDraft(accessToken: string, title: string, author: string, content: string): Promise<any> {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
  
  const cleanContent = content
    .replace(/[\u0000-\u001F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
  
  const postData = {
    articles: [
      {
        title: title,
        author: author,
        content: cleanContent
      }
    ]
  }
  
  const jsonString = JSON.stringify(postData)
  console.log('请求体长度:', jsonString.length)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8'
    },
    body: jsonString
  })
  
  const result = await response.json()
  console.log('HTTP状态码:', response.status)
  console.log('响应头:', JSON.stringify(Object.fromEntries(response.headers.entries())))
  
  return result
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { reportId, appId, content, testMode } = body
    
    if (testMode) {
      return await testWeChatDraft(appId)
    }

    if (!reportId) {
      return NextResponse.json({ success: false, error: '缺少报告ID' }, { status: 400 })
    }

    const report = getReport(reportId)
    if (!report) {
      return NextResponse.json({ success: false, error: '报告不存在' }, { status: 404 })
    }

    let config = getWeChatConfig()
    if (!config) {
      return NextResponse.json({ success: false, error: '未配置公众号' }, { status: 400 })
    }

    let targetAccount: WeChatAccount | undefined
    if (appId) {
      targetAccount = config.accounts.find(a => a.appId === appId)
      if (!targetAccount) {
        return NextResponse.json({ success: false, error: '未找到指定的公众号' }, { status: 404 })
      }
    } else if (config.defaultAccount) {
      targetAccount = config.accounts.find(a => a.appId === config.defaultAccount)
    } else {
      targetAccount = config.accounts[0]
    }

    if (!targetAccount) {
      return NextResponse.json({ success: false, error: '没有已绑定的公众号' }, { status: 400 })
    }

    const tokenResult = await getWeChatAccessToken(targetAccount.appId, targetAccount.appSecret)
    if (!tokenResult.success) {
      return NextResponse.json({ success: false, error: tokenResult.error || '获取access_token失败' }, { status: 500 })
    }
    const accessToken = tokenResult.accessToken!
    
    console.log('获取到的access_token:', accessToken.substring(0, 20) + '...')

    const reportContent = content || report.content
    const htmlContent = markdownToHtml(reportContent)

    console.log('开始创建微信草稿...')
    console.log('标题:', report.title)
    console.log('内容长度:', htmlContent.length)
    
    const MAX_CONTENT_LENGTH = 65536
    if (htmlContent.length > MAX_CONTENT_LENGTH) {
      console.log('内容过长，正在截断...')
      const truncatedContent = htmlContent.substring(0, MAX_CONTENT_LENGTH - 100) + '<p>...</p></div>'
      console.log('截断后长度:', truncatedContent.length)
      return NextResponse.json({
        success: false,
        error: `文章内容过长（${htmlContent.length}字符），超过微信公众号限制（${MAX_CONTENT_LENGTH}字符），请精简内容后再发布`
      }, { status: 400 })
    }

    const createDraftData = await createWeChatDraft(accessToken, report.title, '火车每日股票池', htmlContent)
    console.log('微信API响应:', JSON.stringify(createDraftData, null, 2))

    if (createDraftData.errcode !== 0) {
      let errorMsg = `创建草稿失败 [${createDraftData.errcode}]: ${createDraftData.errmsg}`
      if (createDraftData.errcode === 40001) {
        errorMsg += ' (access_token无效或已过期，请重新绑定公众号)'
      } else if (createDraftData.errcode === 40003) {
        errorMsg += ' (公众号类型错误，需使用认证服务号)'
      } else if (createDraftData.errcode === 48001) {
        errorMsg += ' (公众号未授权相关权限，请检查公众号权限设置)'
      } else if (createDraftData.errcode === 40164) {
        errorMsg += ' (IP白名单问题，请检查公众号IP配置)'
      } else if (createDraftData.errcode === 41001) {
        errorMsg += ' (缺少access_token)'
      }
      return NextResponse.json({
        success: false,
        error: errorMsg
      }, { status: 500 })
    }

    updateReportPublishStatus(reportId, targetAccount.appId)

    return NextResponse.json({
      success: true,
      message: '已推送到公众号草稿箱，请在公众号后台发布',
      data: {
        mediaId: createDraftData.media_id
      }
    })
  } catch (error) {
    console.error('Publish to WeChat error:', error)
    return NextResponse.json({ success: false, error: '发布失败' }, { status: 500 })
  }
}