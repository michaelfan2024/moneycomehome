export interface EastmoneyOrgBasicInfo {
  securityCode: string
  securityName: string
  orgTypeCode: string
  orgType: string
  sourceUrl: string
}

export interface EastmoneyFinanceSummary {
  stockCode: string
  stockName: string
  orgTypeCode: string
  orgType: string
  reportDate: string
  reportType: string
  reportDateName?: string
  noticeDate?: string
  updateDate?: string
  eps?: number | null
  bps?: number | null
  cashPerShare?: number | null
  roe?: number | null
  revenueYoy?: number | null
  netProfitYoy?: number | null
  grossMargin?: number | null
  revenue?: number | null
  totalProfit?: number | null
  netProfit?: number | null
  sourceUrl: string
  raw: Record<string, unknown>
}

export interface ReportFinanceSource {
  stockCode: string
  stockName: string
  orgType?: string
  reportPeriod: string
  reportType: string
  reportDateName?: string
  noticeDate?: string
  updateDate?: string
  eps?: number | null
  bps?: number | null
  cashPerShare?: number | null
  roe?: number | null
  revenueYoy?: number | null
  netProfitYoy?: number | null
  grossMargin?: number | null
  revenue?: number | null
  totalProfit?: number | null
  netProfit?: number | null
  sourceUrl: string
}

type EastmoneyJsonpResponse<T> = {
  result?: {
    data?: T[]
  }
  success?: boolean
  message?: string
  code?: number
}

const EASTMONEY_DATACENTER = 'https://datacenter.eastmoney.com/api/data/v1/get'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined
  return value.split(' ')[0]
}

async function fetchEastmoneyJsonp<T>(url: string): Promise<EastmoneyJsonpResponse<T> | null> {
  const response = await fetch(url, {
    headers: {
      Accept: '*/*'
    }
  })

  if (!response.ok) {
    return null
  }

  const text = await response.text()
  const match = text.match(/^[^(]+\((.*)\);?$/s)
  const payload = match ? match[1] : text

  try {
    return JSON.parse(payload) as EastmoneyJsonpResponse<T>
  } catch {
    return null
  }
}

export function getFinanceReportNameByOrgTypeCode(orgTypeCode: string | number | null | undefined): string | null {
  const code = String(orgTypeCode ?? '').trim()
  if (!code) return null

  const suffixMap: Record<string, string> = {
    '1': 'S',
    '2': 'I',
    '3': 'B',
    '4': 'G'
  }

  const suffix = suffixMap[code]
  return suffix ? `RPT_CUSTOM_F10_FINANCE_${suffix}DATA` : null
}

export function buildEastmoneyFinanceSourceUrl(reportName: string, stockCode: string): string {
  const params = new URLSearchParams({
    reportName,
    columns: 'ALL',
    sortColumns: 'REPORT_DATE',
    sortTypes: '-1',
    source: 'WEB',
    client: 'WEB',
    pageSize: '1',
    pageNumber: '1',
    filter: `(SECURITY_CODE="${stockCode}")`,
    callback: 'cb'
  })

  return `${EASTMONEY_DATACENTER}?${params.toString()}`
}

export function normalizeEastmoneyFinanceSummary(
  row: Record<string, unknown>,
  reportName: string,
  sourceUrl: string
): EastmoneyFinanceSummary | null {
  const stockCode = typeof row.SECURITY_CODE === 'string' ? row.SECURITY_CODE : ''
  const stockName = typeof row.SECURITY_NAME_ABBR === 'string' ? row.SECURITY_NAME_ABBR : ''
  const orgTypeCode = String(row.ORG_TYPE_CODE ?? '')
  const orgType = typeof row.ORG_TYPE === 'string' ? row.ORG_TYPE : ''
  const reportDate = normalizeDate(row.REPORT_DATE)

  if (!stockCode || !stockName || !reportDate) {
    return null
  }

  return {
    stockCode,
    stockName,
    orgTypeCode,
    orgType,
    reportDate,
    reportType: typeof row.REPORT_TYPE === 'string' ? row.REPORT_TYPE : '',
    reportDateName: typeof row.REPORT_DATE_NAME === 'string' ? row.REPORT_DATE_NAME : undefined,
    noticeDate: normalizeDate(row.NOTICE_DATE),
    updateDate: normalizeDate(row.UPDATE_DATE),
    eps: toNumber(row.EPSJB),
    bps: toNumber(row.BPS),
    cashPerShare: toNumber(row.MGJYXJJE),
    roe: toNumber(row.ROEJQ),
    revenueYoy: toNumber(row.TOTALOPERATEREVETZ ?? row.OPERATE_INCOME_TZ),
    netProfitYoy: toNumber(row.PARENTNETPROFITTZ),
    grossMargin: toNumber(row.XSMLL),
    revenue: toNumber(row.TOTAL_OPERATE_INCOME ?? row.OPERATE_INCOME),
    totalProfit: toNumber(row.TOTAL_PROFIT),
    netProfit: toNumber(row.PARENT_NETPROFIT),
    sourceUrl,
    raw: row
  }
}

export function buildFinanceContext(summaries: EastmoneyFinanceSummary[]): string {
  if (!summaries.length) {
    return [
      '东方财富公开财报数据：',
      '未获取到已核验财报数据。',
      '禁止编造净利润、营收、同比、ROE 等财务数字。'
    ].join('\n')
  }

  const lines = summaries.map((summary) => {
    const metrics = [
      `报告期：${summary.reportDate}${summary.reportType ? `（${summary.reportType}）` : ''}`,
      `公告日期：${summary.noticeDate || '未知'}`,
      `营收：${summary.revenue ?? '未知'}`,
      `营收同比：${summary.revenueYoy ?? '未知'}%`,
      `净利润：${summary.netProfit ?? '未知'}`,
      `净利润同比：${summary.netProfitYoy ?? '未知'}%`,
      `基本每股收益：${summary.eps ?? '未知'}`,
      `ROE：${summary.roe ?? '未知'}%`,
      `每股净资产：${summary.bps ?? '未知'}`
    ].join('；')

    return `- ${summary.stockCode} ${summary.stockName}：${metrics}`
  })

  return [
    '东方财富公开财报数据（仅可引用以下已核验数据，禁止编造未提供数值）：',
    ...lines,
    '如果某项字段为“未知”，在正文中必须明确写“未获取到东方财富公开财报数据”，不得自行补数。'
  ].join('\n')
}

export function toReportFinanceSource(summary: EastmoneyFinanceSummary): ReportFinanceSource {
  return {
    stockCode: summary.stockCode,
    stockName: summary.stockName,
    orgType: summary.orgType || undefined,
    reportPeriod: summary.reportDate,
    reportType: summary.reportType,
    reportDateName: summary.reportDateName,
    noticeDate: summary.noticeDate,
    updateDate: summary.updateDate,
    eps: summary.eps,
    bps: summary.bps,
    cashPerShare: summary.cashPerShare,
    roe: summary.roe,
    revenueYoy: summary.revenueYoy,
    netProfitYoy: summary.netProfitYoy,
    grossMargin: summary.grossMargin,
    revenue: summary.revenue,
    totalProfit: summary.totalProfit,
    netProfit: summary.netProfit,
    sourceUrl: summary.sourceUrl
  }
}

export async function fetchLatestEastmoneyFinanceSummary(stockCode: string): Promise<EastmoneyFinanceSummary | null> {
  const basicInfoUrl = `${EASTMONEY_DATACENTER}?${new URLSearchParams({
    reportName: 'RPT_F10_ORG_BASICINFO',
    columns: 'ALL',
    sortColumns: '',
    sortTypes: '',
    source: 'WEB',
    client: 'WEB',
    filter: `(SECURITY_CODE="${stockCode}")`,
    pageSize: '1',
    pageNumber: '1',
    callback: 'cb'
  }).toString()}`

  const basicInfoResponse = await fetchEastmoneyJsonp<Record<string, unknown>>(basicInfoUrl)
  const basicInfo = basicInfoResponse?.result?.data?.[0]
  const orgTypeCode = basicInfo?.ORG_TYPE_CODE as string | number | null | undefined
  const reportName = getFinanceReportNameByOrgTypeCode(orgTypeCode)

  if (!basicInfo || !reportName) {
    return null
  }

  const financeUrl = buildEastmoneyFinanceSourceUrl(reportName, stockCode)
  const financeResponse = await fetchEastmoneyJsonp<Record<string, unknown>>(financeUrl)
  const row = financeResponse?.result?.data?.[0]

  if (!row) {
    return null
  }

  const normalized = normalizeEastmoneyFinanceSummary(row, reportName, financeUrl)
  if (!normalized) {
    return null
  }

  return normalized
}
