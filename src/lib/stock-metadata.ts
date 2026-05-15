import type { StockMetadata } from '../types'

const EASTMONEY_DATACENTER = 'https://datacenter-web.eastmoney.com/api/data/v1/get'

export const STOCK_METADATA_STALE_DAYS = 7

type StockMetadataInput = Omit<StockMetadata, 'fetched_at' | 'updated_at'>

function splitConcepts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(splitConcepts)
  }

  if (value === undefined || value === null) {
    return []
  }

  return String(value)
    .split(/[;,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getStringValue(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim()
    }
  }

  return ''
}

function getIndustryLeaf(value: string): string {
  const parts = value.split(/[-/]/).map((item) => item.trim()).filter(Boolean)
  return parts[parts.length - 1] || value.trim()
}

export function normalizeStockMetadata(input: StockMetadataInput): StockMetadataInput {
  const concepts = [...new Set(splitConcepts(input.concepts))]

  return {
    stock_code: String(input.stock_code).trim(),
    stock_name: String(input.stock_name).trim(),
    industry: input.industry?.trim() || null,
    concepts,
    source: input.source || null,
  }
}

export function isStockMetadataStale(fetchedAt?: string | null, now = new Date()): boolean {
  if (!fetchedAt) {
    return true
  }

  const fetched = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetched)) {
    return true
  }

  return now.getTime() - fetched > STOCK_METADATA_STALE_DAYS * 24 * 60 * 60 * 1000
}

export function parseEastmoneyMetadataPayload(
  stockCode: string,
  stockName: string,
  payload: Record<string, unknown>
): StockMetadataInput | null {
  const industry = getStringValue(payload, [
    'BOARD_NAME_3LEVEL',
    'BOARD_NAME_2LEVEL',
    'BOARD_NAME_1LEVEL',
    'EM2016',
    'CSRC_INDUSTRY_NAME',
    'INDUSTRY',
    'INDUSTRY_NAME',
  ])
  const concepts = splitConcepts(getStringValue(payload, ['BLGAINIAN', 'CONCEPT', 'CONCEPTS', 'CONCEPT_NAME']))

  if (!industry && concepts.length === 0) {
    return null
  }

  return normalizeStockMetadata({
    stock_code: stockCode,
    stock_name: stockName,
    industry: industry ? getIndustryLeaf(industry) : null,
    concepts,
    source: 'eastmoney',
  })
}

export async function fetchStockMetadata(stockCode: string, stockName: string): Promise<StockMetadataInput | null> {
  const url = `${EASTMONEY_DATACENTER}?${new URLSearchParams({
    reportName: 'RPT_F10_ORG_BASICINFO',
    columns: 'ALL',
    sortColumns: '',
    sortTypes: '',
    source: 'WEB',
    client: 'WEB',
    filter: `(SECURITY_CODE="${stockCode}")`,
    pageSize: '1',
    pageNumber: '1',
  }).toString()}`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const row = data?.result?.data?.[0]
    if (!row || typeof row !== 'object') {
      return null
    }

    return parseEastmoneyMetadataPayload(stockCode, stockName, row)
  } catch (error) {
    console.error('Failed to fetch stock metadata:', error)
    return null
  }
}
