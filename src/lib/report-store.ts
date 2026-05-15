import fs from 'fs'
import path from 'path'

const REPORTS_DIR = path.join(process.cwd(), '.reports')

export interface Report {
  id: string
  date: string
  title: string
  content: string
  stockCount: number
  createdAt: string
  sourceType?: 'compare' | 'ranking'
  filterSummary?: string
  publishedAt?: string
  publishedTo?: string
  financeSources?: Array<{
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
  }>
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

export function saveReport(report: Report): boolean {
  try {
    ensureReportsDir()
    const filePath = path.join(REPORTS_DIR, `${report.id}.json`)
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2))
    return true
  } catch (error) {
    console.error('Error saving report:', error)
    return false
  }
}

export function getReport(id: string): Report | null {
  try {
    ensureReportsDir()
    const filePath = path.join(REPORTS_DIR, `${id}.json`)
    if (!fs.existsSync(filePath)) {
      return null
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    console.error('Error reading report:', error)
    return null
  }
}

export function getAllReports(): Report[] {
  try {
    ensureReportsDir()
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'))
    const reports = files.map(file => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8')
      return JSON.parse(content) as Report
    })
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error('Error reading reports:', error)
    return []
  }
}

export function deleteReport(id: string): boolean {
  try {
    ensureReportsDir()
    const filePath = path.join(REPORTS_DIR, `${id}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch (error) {
    console.error('Error deleting report:', error)
    return false
  }
}

export async function updateReportPublishStatus(id: string, publishedTo: string): Promise<boolean> {
  try {
    const report = getReport(id)
    if (!report) return false

    report.publishedAt = new Date().toISOString()
    report.publishedTo = publishedTo

    return saveReport(report)
  } catch (error) {
    console.error('Error updating report publish status:', error)
    return false
  }
}
