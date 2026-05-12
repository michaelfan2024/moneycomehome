import { describe, expect, it } from 'vitest'
import { buildEastmoneyFinanceSourceUrl, buildFinanceContext, getFinanceReportNameByOrgTypeCode, normalizeEastmoneyFinanceSummary, toReportFinanceSource } from './eastmoney-finance'

describe('getFinanceReportNameByOrgTypeCode', () => {
  it('maps Eastmoney org type codes to the expected report names', () => {
    expect(getFinanceReportNameByOrgTypeCode('1')).toBe('RPT_CUSTOM_F10_FINANCE_SDATA')
    expect(getFinanceReportNameByOrgTypeCode('2')).toBe('RPT_CUSTOM_F10_FINANCE_IDATA')
    expect(getFinanceReportNameByOrgTypeCode('3')).toBe('RPT_CUSTOM_F10_FINANCE_BDATA')
    expect(getFinanceReportNameByOrgTypeCode('4')).toBe('RPT_CUSTOM_F10_FINANCE_GDATA')
  })
})

describe('normalizeEastmoneyFinanceSummary', () => {
  it('normalizes a raw Eastmoney finance row into a concise snapshot', () => {
    const snapshot = normalizeEastmoneyFinanceSummary(
      {
        SECURITY_CODE: '000001',
        SECURITY_NAME_ABBR: '平安银行',
        ORG_TYPE: '银行',
        REPORT_DATE: '2026-03-31 00:00:00',
        REPORT_TYPE: '一季报',
        NOTICE_DATE: '2026-04-25 00:00:00',
        UPDATE_DATE: '2026-04-25 00:00:00',
        EPSJB: 0.67,
        ROEJQ: 2.83,
        PARENTNETPROFITTZ: 3.03,
        TOTALOPERATEREVETZ: 4.65,
        XSMLL: null,
        OPERATE_INCOME: 35277000000,
        TOTAL_PROFIT: 17399000000,
        PARENT_NETPROFIT: 14523000000
      },
      'RPT_CUSTOM_F10_FINANCE_BDATA',
      buildEastmoneyFinanceSourceUrl('RPT_CUSTOM_F10_FINANCE_BDATA', '000001')
    )

    expect(snapshot?.stockCode).toBe('000001')
    expect(snapshot?.reportDate).toBe('2026-03-31')
    expect(snapshot?.reportType).toBe('一季报')
    expect(snapshot?.netProfit).toBe(14523000000)
    expect(snapshot?.revenueYoy).toBe(4.65)
    expect(snapshot?.sourceUrl).toContain('reportName=RPT_CUSTOM_F10_FINANCE_BDATA')
  })
})

describe('buildFinanceContext', () => {
  it('builds a prompt section that includes the fetched finance data and blocks hallucinated figures', () => {
    const section = buildFinanceContext([
      {
        stockCode: '000001',
        stockName: '平安银行',
        reportDate: '2026-03-31',
        reportType: '一季报',
        revenue: 35277000000,
        revenueYoy: 4.65,
        netProfit: 14523000000,
        netProfitYoy: 3.03,
        eps: 0.67,
        roe: 2.83,
        grossMargin: null,
        noticeDate: '2026-04-25',
        updateDate: '2026-04-25',
        sourceUrl: 'https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_CUSTOM_F10_FINANCE_BDATA'
      }
    ])

    expect(section).toContain('东方财富公开财报数据')
    expect(section).toContain('平安银行')
    expect(section).toContain('2026-03-31')
    expect(section).toContain('14523000000')
    expect(section).toContain('禁止编造')
  })
})

describe('toReportFinanceSource', () => {
  it('reduces a finance snapshot to the fields needed by report pages', () => {
    expect(toReportFinanceSource({
      stockCode: '000001',
      stockName: '平安银行',
      orgTypeCode: '3',
      orgType: '银行',
      reportDate: '2026-03-31',
      reportType: '一季报',
      reportDateName: '2026一季报',
      noticeDate: '2026-04-25',
      updateDate: '2026-04-25',
      eps: 0.67,
      bps: 23.91,
      cashPerShare: 1.94,
      roe: 2.83,
      revenueYoy: 4.65,
      netProfitYoy: 3.03,
      grossMargin: 32.1,
      revenue: 35277000000,
      totalProfit: 17399000000,
      netProfit: 14523000000,
      sourceUrl: 'https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_CUSTOM_F10_FINANCE_BDATA',
      raw: {}
    })).toMatchObject({
      stockCode: '000001',
      stockName: '平安银行',
      reportPeriod: '2026-03-31',
      reportType: '一季报',
      netProfit: 14523000000,
      sourceUrl: 'https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPT_CUSTOM_F10_FINANCE_BDATA'
    })
  })
})
