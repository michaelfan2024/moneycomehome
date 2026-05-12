import * as XLSX from 'xlsx'
import csvParser from 'csv-parser'
import { Readable } from 'stream'
import * as iconv from 'iconv-lite'

export interface ParsedStock {
  stock_code: string
  stock_name: string
  source?: string
  note?: string
}

export async function parseExcelFile(file: Buffer): Promise<ParsedStock[]> {
  let buffer = file
  
  console.log('Excel file first 20 bytes:', buffer.slice(0, 20).toString('hex'))
  
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    console.log('Excel file has UTF-8 BOM')
    buffer = buffer.slice(3)
  }

  const workbook = XLSX.read(buffer, { 
    type: 'buffer',
    cellText: true,
    cellDates: false,
    raw: false,
    codepage: 936,
    WTF: true,
    cellStyles: true
  })
  
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  const data = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  }) as (string | number)[][]

  console.log('Excel data rows:', data.length)
  if (data.length > 0) {
    console.log('Header row:', data[0].slice(0, 5))
    if (data.length > 1 && data[1].length > 1) {
      console.log('First data row:', data[1])
      console.log('First name raw:', typeof data[1][1], String(data[1][1]))
      console.log('First name bytes:', Buffer.from(String(data[1][1]), 'utf8').toString('hex'))
    }
  }

  const fixedData = fixExcelDataEncoding(data)
  
  return processExcelData(fixedData)
}

function fixExcelDataEncoding(data: (string | number)[][]): (string | number)[][] {
  let hasGarbage = false
  
  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      const cell = String(data[i][j])
      if (containsGarbageChars(cell)) {
        hasGarbage = true
        break
      }
    }
    if (hasGarbage) break
  }
  
  if (!hasGarbage) {
    return data
  }
  
  console.log('Detected garbage characters in Excel data, attempting fix...')
  
  const fixedData: (string | number)[][] = []
  
  for (let i = 0; i < data.length; i++) {
    const row: (string | number)[] = []
    for (let j = 0; j < data[i].length; j++) {
      const cell = String(data[i][j])
      if (containsGarbageChars(cell)) {
        const fixed = fixChineseEncoding(cell)
        row.push(fixed)
      } else {
        row.push(data[i][j])
      }
    }
    fixedData.push(row)
  }
  
  return fixedData
}

function containsGarbageChars(text: string): boolean {
  const garbageChars = ['脤', '脦', '脨', '脪', '脫', '路', '垄', '脜', '脧', '赂', 
                        '脽', '脗', '芦', '虏', '帽', '露', '炉', '脕', '娄', '脰', 
                        '脴', '脵', '脿', '脣', '脭', '脮', '脯', '脲', '脳']
  
  for (const char of garbageChars) {
    if (text.includes(char)) {
      return true
    }
  }
  return false
}

function directGbkFix(text: string): string {
  try {
    const utf8Buffer = Buffer.from(text, 'utf8')
    
    if (utf8Buffer.length % 2 === 1) {
      return text
    }
    
    const gbkBuffer = Buffer.alloc(utf8Buffer.length / 2)
    
    for (let i = 0; i < utf8Buffer.length; i += 2) {
      const highByte = utf8Buffer[i]
      const lowByte = utf8Buffer[i + 1]
      
      if (highByte >= 0xC0 && highByte <= 0xDF && lowByte >= 0x80 && lowByte <= 0xBF) {
        const originalHigh = 0x80 + (highByte - 0xC0)
        const originalLow = lowByte
        gbkBuffer[i / 2] = originalHigh
        if (i / 2 + 1 < gbkBuffer.length) {
          gbkBuffer[i / 2 + 1] = originalLow
        }
      } else {
        return text
      }
    }
    
    const decoded = iconv.decode(gbkBuffer, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('Direct GBK fix failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const reencoded = iconv.encode(text, 'UTF-8')
    const decoded = iconv.decode(reencoded, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('Re-encode GBK fix failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const corrected = []
    
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i]
      if (byte >= 0x80) {
        corrected.push(byte ^ 0x80)
      } else {
        corrected.push(byte)
      }
    }
    
    const correctedBuffer = Buffer.from(corrected)
    const decoded = iconv.decode(correctedBuffer, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('XOR 0x80 GBK fix failed:', e)
  }
  
  return text
}

export async function parseCsvFile(file: Buffer): Promise<ParsedStock[]> {
  return new Promise((resolve, reject) => {
    let buffer = file
    
    console.log('CSV file first 20 bytes:', buffer.slice(0, 20).toString('hex'))
    
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      console.log('CSV file has UTF-8 BOM')
      buffer = buffer.slice(3)
    }
    
    const encoding = detectEncoding(buffer)
    console.log('Detected encoding:', encoding)
    
    if (encoding !== 'utf8') {
      try {
        const decoded = iconv.decode(buffer, encoding)
        buffer = Buffer.from(decoded, 'utf8')
        console.log('Converted to UTF-8')
      } catch (error) {
        console.error(`${encoding} conversion error:`, error)
      }
    }
    
    const readable = Readable.from(buffer)
    const results: Record<string, string>[] = []
    
    readable
      .pipe(csvParser({
        separator: ','
      }))
      .on('data', (data) => {
        const cleanedData: Record<string, string> = {}
        for (const key of Object.keys(data)) {
          const cleanedKey = sanitizeText(key)
          const cleanedValue = sanitizeText(String(data[key]))
          cleanedData[cleanedKey] = cleanedValue
        }
        results.push(cleanedData)
      })
      .on('end', () => resolve(processParsedData(results)))
      .on('error', (error) => {
        console.error('CSV parsing error:', error)
        reject(error)
      })
  })
}

function detectEncoding(buffer: Buffer): string {
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf8'
  }
  
  let gbkScore = 0
  let utf8Score = 0
  let otherScore = 0
  
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]
    
    if (byte === 0x00) {
      otherScore++
    } else if (byte < 0x80) {
      utf8Score++
    } else if (i + 1 < buffer.length) {
      const nextByte = buffer[i + 1]
      
      if (byte >= 0x81 && byte <= 0xFE && nextByte >= 0x40 && nextByte <= 0xFE && nextByte !== 0x7F) {
        gbkScore++
        i++
      } else if (byte >= 0xE0 && byte <= 0xEF && nextByte >= 0x80 && nextByte <= 0xBF) {
        if (i + 2 < buffer.length && buffer[i + 2] >= 0x80 && buffer[i + 2] <= 0xBF) {
          utf8Score++
          i += 2
        } else {
          otherScore++
        }
      } else if (byte >= 0xC0 && byte <= 0xDF && nextByte >= 0x80 && nextByte <= 0xBF) {
        utf8Score++
        i++
      } else {
        otherScore++
      }
    }
  }
  
  console.log('Encoding detection scores - GBK:', gbkScore, 'UTF-8:', utf8Score, 'Other:', otherScore)
  
  if (gbkScore > utf8Score * 2) {
    return 'GBK'
  }
  
  return 'utf8'
}

function sanitizeText(text: string): string {
  if (!text) return ''
  
  let cleaned = String(text)
  
  cleaned = cleaned.replace(/\u00A0/g, ' ')
  cleaned = cleaned.replace(/\uFEFF/g, '')
  cleaned = cleaned.replace(/\u200B/g, '')
  cleaned = cleaned.replace(/[\x00-\x1F]/g, '')
  
  console.log('Before sanitize:', text.length, 'chars, first 50:', text.substring(0, 50))
  console.log('Before sanitize hex:', Buffer.from(text, 'utf8').toString('hex').substring(0, 60))
  
  const originalText = cleaned
  
  const fixed = fixChineseEncoding(text)
  if (fixed !== text) {
    console.log('Fixed Chinese encoding:', fixed.substring(0, 50))
    return fixed
  }
  
  cleaned = tryFixDoubleEncoding(cleaned)
  
  if (cleaned !== originalText) {
    console.log('Fixed double encoding:', cleaned.substring(0, 50))
    return cleaned
  }
  
  if (isGarbageText(cleaned)) {
    console.log('Detected garbage text, trying conversion...')
    
    const conversions = [
      { encoding: 'GBK', label: 'GBK' },
      { encoding: 'GB2312', label: 'GB2312' },
      { encoding: 'CP1252', label: 'CP1252' },
      { encoding: 'ISO-8859-1', label: 'ISO-8859-1' },
      { encoding: 'Big5', label: 'Big5' }
    ]
    
    for (const { encoding, label } of conversions) {
      try {
        const decoded = iconv.decode(Buffer.from(cleaned, 'binary'), encoding)
        if (!isGarbageText(decoded)) {
          console.log(`${label} conversion succeeded:`, decoded.substring(0, 50))
          return decoded
        }
      } catch (e) {
        console.error(`${label} conversion failed:`, e)
      }
    }
    
    const advancedFixed = tryAdvancedFix(cleaned)
    if (advancedFixed !== cleaned && !isGarbageText(advancedFixed)) {
      console.log('Advanced fix succeeded:', advancedFixed.substring(0, 50))
      return advancedFixed
    }
  }
  
  if (looksLikeGbkMistakenAsUtf8(cleaned)) {
    const gbkFixed = fixGbkToUtf8Mistake(cleaned)
    if (gbkFixed !== cleaned && !isGarbageText(gbkFixed)) {
      console.log('Fixed GBK->UTF-8 mistake:', gbkFixed.substring(0, 50))
      return gbkFixed
    }
  }
  
  console.log('After sanitize:', cleaned.length, 'chars, first 50:', cleaned.substring(0, 50))
  return cleaned
}

function fixChineseEncoding(text: string): string {
  const garbageChars = ['脤', '脦', '脨', '脪', '脫', '路', '垄', '脜', '脧', '赂', 
                        '脽', '脗', '芦', '虏', '帽', '露', '炉', '脕', '娄', '脰', 
                        '脴', '脵', '脿', '脣', '脭', '脮', '脯', '脰', '脱', '脲',
                        '脳', '脴', '脵', '脶', '脷', '脸', '脹', '脺', '脻', '脼',
                        '脽', '脾', '脿', '嗀', '嗁', '嗂', '嗃', '嗄', '嗅', '嗆',
                        '嗇', '嗈', '嗉', '嗊', '嗋', '嗝', '嗌', '嗍', '嗎', '嗏',
                        '嗐', '嗑', '嗒', '嗓', '嗕', '嗖', '嗗', '嗘', '嗙', '嗚',
                        '嗅', '嗛', '嗜', '嗽', '嗞', '嗟', '嗠', '嗡', '嗢', '嗣',
                        '嗤', '嗥', '嗧', '嗨', '嗩', '嗪', '嗫', '嗬', '嗭', '嗮',
                        '嗰', '嗱', '嗲', '嗳', '嗴', '嗵', '嗷', '嗸', '嗹', '嗺',
                        '嗻', '嗼', '嗽', '嗾', '嗿', '嘀', '嘁', '嘂', '嘃', '嘄',
                        '嘅', '嘆', '嘇', '嘈', '嘉', '嘋', '嘌', '嘍', '嘎', '嘏',
                        '嘐', '嘑', '嘒', '嘓', '嘔', '嘕', '嘖', '嘗', '嘘', '嘙',
                        '嘚', '嘛', '嘜', '嘝', '嘞', '嘟', '嘠', '嘡', '嘢', '嘣',
                        '嘤', '嘥', '嘦', '嘧', '嘨', '哗', '嘪', '嘫', '嘬', '嘭',
                        '嘮', '嘯', '嘰', '嘶', '嘳', '嘴', '嘵', '嘷', '嘸', '嘻',
                        '嘺', '嘻', '嘼', '嘽', '嘾', '嘿', '噀', '噁', '噂', '噃']
  
  let hasGarbage = false
  for (const char of garbageChars) {
    if (text.includes(char)) {
      hasGarbage = true
      break
    }
  }
  
  if (!hasGarbage) {
    return text
  }
  
  console.log('Attempting Chinese encoding fix...')
  
  const directFix = directGbkFix(text)
  if (directFix !== text) {
    console.log('Direct GBK fix succeeded:', directFix.substring(0, 20))
    return directFix
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const windows1252Bytes = utf8Bytes.toString('binary')
    const gbkDecoded = iconv.decode(Buffer.from(windows1252Bytes, 'binary'), 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(gbkDecoded)) {
      console.log('Fixed via Windows-1252 -> GBK:', gbkDecoded.substring(0, 20))
      return gbkDecoded
    }
  } catch (e) {
    console.error('Windows-1252 -> GBK failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const shifted = []
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i]
      if (byte >= 0xC0 && byte <= 0xDF) {
        shifted.push(0x80 + (byte - 0xC0))
      } else if (byte >= 0x80 && byte <= 0xBF) {
        shifted.push(byte)
      } else {
        shifted.push(byte)
      }
    }
    const shiftedBuffer = Buffer.from(shifted)
    const decoded = iconv.decode(shiftedBuffer, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      console.log('Fixed via shifted GBK:', decoded.substring(0, 20))
      return decoded
    }
  } catch (e) {
    console.error('Shifted GBK failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const corrected = []
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i]
      if (byte >= 0x80) {
        corrected.push(byte ^ 0x40)
      } else {
        corrected.push(byte)
      }
    }
    const correctedBuffer = Buffer.from(corrected)
    const decoded = iconv.decode(correctedBuffer, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      console.log('Fixed via XOR 0x40 GBK:', decoded.substring(0, 20))
      return decoded
    }
  } catch (e) {
    console.error('XOR 0x40 GBK failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const recoded = iconv.encode(text, 'UTF-8')
    const windows1252Decoded = iconv.decode(recoded, 'windows-1252')
    const gbkEncoded = iconv.encode(windows1252Decoded, 'GBK')
    const final = iconv.decode(gbkEncoded, 'GBK')
    
    if (/[\u4e00-\u9fa5]/.test(final)) {
      console.log('Fixed via UTF-8 -> Windows-1252 -> GBK:', final.substring(0, 20))
      return final
    }
  } catch (e) {
    console.error('UTF-8 -> Windows-1252 -> GBK failed:', e)
  }
  
  return text
}

function looksLikeGbkMistakenAsUtf8(text: string): boolean {
  const garbageChars = ['脤', '脦', '脨', '脪', '脫', '脫', '脫', '脫', '脫', '脫',
                        '脫', '脫', '脫', '脫', '脫', '脫', '脫', '脫', '脫', '脫',
                        '路', '垄', '脜', '脧', '赂', '脽', '脗', '芦', '虏', '帽',
                        '露', '炉', '脕', '娄', '脰', '脴', '脵', '脿', '脫', '脫']
  
  let garbageCount = 0
  for (const char of garbageChars) {
    if (text.includes(char)) {
      garbageCount++
    }
  }
  
  return garbageCount >= 3
}

function fixGbkToUtf8Mistake(text: string): string {
  console.log('Attempting GBK fix for:', text.substring(0, 20))
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    console.log('UTF-8 bytes:', utf8Bytes.toString('hex'))
    
    const latin1Str = utf8Bytes.toString('latin1')
    const gbkDecoded = iconv.decode(Buffer.from(latin1Str, 'binary'), 'GBK')
    
    console.log('GBK decoded:', gbkDecoded.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(gbkDecoded)) {
      return gbkDecoded
    }
  } catch (e) {
    console.error('GBK conversion failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const corrected = []
    
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i]
      
      if (byte >= 0x80 && byte <= 0xFF) {
        corrected.push(byte ^ 0x80)
      } else {
        corrected.push(byte)
      }
    }
    
    const correctedBuffer = Buffer.from(corrected)
    const decoded = iconv.decode(correctedBuffer, 'GBK')
    
    console.log('XOR GBK decoded:', decoded.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('XOR GBK conversion failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const shifted = []
    
    for (let i = 0; i < utf8Bytes.length; i++) {
      let byte = utf8Bytes[i]
      if (byte >= 0xC0 && byte <= 0xDF) {
        shifted.push(0x80 + (byte - 0xC0))
      } else if (byte >= 0xE0 && byte <= 0xEF) {
        shifted.push(0xA0 + (byte - 0xE0))
      } else {
        shifted.push(byte)
      }
    }
    
    const shiftedBuffer = Buffer.from(shifted)
    const decoded = iconv.decode(shiftedBuffer, 'GBK')
    
    console.log('Shifted GBK decoded:', decoded.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('Shifted GBK conversion failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const reencoded = iconv.decode(utf8Bytes, 'UTF-8')
    console.log('Re-encoded UTF-8:', reencoded.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(reencoded)) {
      return reencoded
    }
  } catch (e) {
    console.error('UTF-8 re-encoding failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const recoded = iconv.encode(text, 'GBK')
    const decoded = iconv.decode(recoded, 'GBK')
    console.log('Recoded GBK:', decoded.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(decoded)) {
      return decoded
    }
  } catch (e) {
    console.error('Recoded GBK failed:', e)
  }
  
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    const windows1252Decoded = iconv.decode(utf8Bytes, 'windows-1252')
    const gbkDecoded = iconv.encode(windows1252Decoded, 'GBK')
    const final = iconv.decode(gbkDecoded, 'GBK')
    console.log('Windows-1252 -> GBK:', final.substring(0, 20))
    
    if (/[\u4e00-\u9fa5]/.test(final)) {
      return final
    }
  } catch (e) {
    console.error('Windows-1252 -> GBK failed:', e)
  }
  
  return text
}

function tryFixDoubleEncoding(text: string): string {
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    
    if (utf8Bytes.length === 0) {
      return text
    }
    
    if (hasDoubleEncodingPattern(utf8Bytes)) {
      console.log('Detected double UTF-8 encoding pattern')
      
      try {
        const latin1Decoded = utf8Bytes.toString('latin1')
        const gbkDecoded = iconv.decode(Buffer.from(latin1Decoded, 'binary'), 'GBK')
        
        if (!isGarbageText(gbkDecoded) && gbkDecoded !== text) {
          console.log('Fixed via Latin1->GBK:', gbkDecoded.substring(0, 50))
          return gbkDecoded
        }
      } catch (e) {
        console.error('Latin1->GBK conversion failed:', e)
      }
      
      try {
        const latin1Decoded = utf8Bytes.toString('latin1')
        const utf8Decoded = Buffer.from(latin1Decoded, 'latin1').toString('utf8')
        
        if (!isGarbageText(utf8Decoded) && utf8Decoded !== text) {
          console.log('Fixed via Latin1->UTF-8:', utf8Decoded.substring(0, 50))
          return utf8Decoded
        }
      } catch (e) {
        console.error('Latin1->UTF-8 conversion failed:', e)
      }
      
      try {
        const encoded = encodeURIComponent(text)
        const doubleEncoded = encoded.replace(/%C3%([89A-F][0-9A-F])/g, '%$1').replace(/%C2%([89A-F][0-9A-F])/g, '%$1')
        const fixed = decodeURIComponent(doubleEncoded)
        
        if (!isGarbageText(fixed) && fixed !== text) {
          console.log('Fixed via URI encoding:', fixed.substring(0, 50))
          return fixed
        }
      } catch (e) {
        console.error('URI encoding fix failed:', e)
      }
    }
  } catch (e) {
    console.error('Double encoding fix failed:', e)
  }
  
  return text
}

function tryAdvancedFix(text: string): string {
  try {
    const utf8Bytes = Buffer.from(text, 'utf8')
    
    const patterns = [
      { pattern: /%C3%A4/g, replace: '%E4', label: 'ä' },
      { pattern: /%C3%A5/g, replace: '%E5', label: 'å' },
      { pattern: /%C3%A9/g, replace: '%E9', label: 'é' },
      { pattern: /%C3%BC/g, replace: '%FC', label: 'ü' },
      { pattern: /%C3%B6/g, replace: '%F6', label: 'ö' },
      { pattern: /%C3%84/g, replace: '%C4', label: 'Ä' },
      { pattern: /%C3%85/g, replace: '%C5', label: 'Å' },
      { pattern: /%C3%89/g, replace: '%C9', label: 'É' },
      { pattern: /%C3%9C/g, replace: '%DC', label: 'Ü' },
      { pattern: /%C3%96/g, replace: '%D6', label: 'Ö' },
      { pattern: /%C3%BC/g, replace: '%FC', label: 'ü' },
      { pattern: /%C3%A7/g, replace: '%E7', label: 'ç' },
      { pattern: /%C3%A8/g, replace: '%E8', label: 'è' },
      { pattern: /%C3%AA/g, replace: '%EA', label: 'ê' },
      { pattern: /%C3%AF/g, replace: '%EF', label: 'ï' },
      { pattern: /%C3%AC/g, replace: '%EC', label: 'ì' },
      { pattern: /%C3%A2/g, replace: '%E2', label: 'â' },
      { pattern: /%C3%A3/g, replace: '%E3', label: 'ã' },
      { pattern: /%C3%A6/g, replace: '%E6', label: 'æ' },
      { pattern: /%C3%A1/g, replace: '%E1', label: 'á' },
      { pattern: /%C3%AD/g, replace: '%ED', label: 'í' },
      { pattern: /%C3%B3/g, replace: '%F3', label: 'ó' },
      { pattern: /%C3%BA/g, replace: '%FA', label: 'ú' },
      { pattern: /%C3%B1/g, replace: '%F1', label: 'ñ' },
      { pattern: /%C2%A0/g, replace: '%A0', label: 'nbsp' },
      { pattern: /%C2%BC/g, replace: '%BC', label: '1/4' },
      { pattern: /%C2%BD/g, replace: '%BD', label: '1/2' },
      { pattern: /%C2%BE/g, replace: '%BE', label: '3/4' },
      { pattern: /%C2%A9/g, replace: '%A9', label: '©' },
      { pattern: /%C2%AE/g, replace: '%AE', label: '®' },
      { pattern: /%C2%AB/g, replace: '%AB', label: '«' },
      { pattern: /%C2%BB/g, replace: '%BB', label: '»' },
      { pattern: /%C2%80/g, replace: '%80', label: '€' },
    ]
    
    let encoded = encodeURIComponent(text)
    let changed = false
    
    for (const { pattern, replace } of patterns) {
      if (pattern.test(encoded)) {
        encoded = encoded.replace(pattern, replace)
        changed = true
      }
    }
    
    if (changed) {
      const fixed = decodeURIComponent(encoded)
      console.log('Advanced fix via URI patterns:', fixed.substring(0, 50))
      return fixed
    }
    
    const latin1Bytes = utf8Bytes.toString('latin1')
    
    try {
      const doubleDecode = iconv.decode(Buffer.from(latin1Bytes, 'binary'), 'UTF-8')
      if (!isGarbageText(doubleDecode) && doubleDecode !== text) {
        console.log('Advanced fix via Latin1->UTF-8:', doubleDecode.substring(0, 50))
        return doubleDecode
      }
    } catch (e) {
      console.error('Latin1->UTF-8 advanced failed:', e)
    }
    
    const gbkBytes = Buffer.from(latin1Bytes, 'binary')
    if (gbkBytes.length % 2 === 0) {
      try {
        const gbkDecode = iconv.decode(gbkBytes, 'GBK')
        if (!isGarbageText(gbkDecode) && gbkDecode !== text) {
          console.log('Advanced fix via direct GBK:', gbkDecode.substring(0, 50))
          return gbkDecode
        }
      } catch (e) {
        console.error('Direct GBK decode failed:', e)
      }
    }
    
    const shiftedBytes = Buffer.alloc(gbkBytes.length)
    for (let i = 0; i < gbkBytes.length; i++) {
      shiftedBytes[i] = gbkBytes[i] ^ 0x80
    }
    try {
      const shiftedDecode = iconv.decode(shiftedBytes, 'GBK')
      if (!isGarbageText(shiftedDecode) && shiftedDecode !== text) {
        console.log('Advanced fix via XOR GBK:', shiftedDecode.substring(0, 50))
        return shiftedDecode
      }
    } catch (e) {
      console.error('XOR GBK decode failed:', e)
    }
    
  } catch (e) {
    console.error('Advanced fix failed:', e)
  }
  
  return text
}

function hasDoubleEncodingPattern(buffer: Buffer): boolean {
  let c3Count = 0
  let c2Count = 0
  
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === 0xC3 && buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0xBF) {
      c3Count++
    } else if (buffer[i] === 0xC2 && buffer[i + 1] >= 0x80 && buffer[i + 1] <= 0xBF) {
      c2Count++
    }
  }
  
  const totalSpecial = c3Count + c2Count
  const threshold = buffer.length * 0.1
  
  console.log(`Double encoding pattern - C3: ${c3Count}, C2: ${c2Count}, threshold: ${threshold}`)
  
  return totalSpecial > threshold
}

function isGarbageText(text: string): boolean {
  const garbageChars = ['Ã', 'Â', 'Ã¢', 'Â¢', 'Ã©', 'Â©', 'Ã±', 'Â®', 'Ã¼', 'Â°', 
                       'Ã¡', 'Â±', 'Â¢', 'Âµ', 'Ã¤', 'Â¶', 'Ã¥', 'Â·', 'Ã¦', 'Â¸',
                       'Ã§', 'Â¹', 'Ã¨', 'Âº', 'Ãª', 'Â»', 'Ã«', 'Â¼', 'Ã¬', 'Â½',
                       'Ã®', 'Â¾', 'Ã¯', 'Â¿', 'Ã°', 'Ã', 'Ã±', 'Ã²', 'Ã³', 'Ã´',
                       'Ãµ', 'Ã¶', 'Ã·', 'Ã¸', 'Ã¹', 'Ãº', 'Ã»', 'Ã½', 'Ã¿',
                       'Ä', 'Å', 'Æ', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í',
                       'Î', 'Ï', 'Ð', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', '×',
                       'Ø', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'Þ', 'ß']
  
  let garbageCount = 0
  for (const char of garbageChars) {
    if (text.includes(char)) {
      garbageCount++
    }
  }
  
  const hasChinese = /[\u4e00-\u9fa5]/.test(text)
  
  return garbageCount > 2 && !hasChinese
}

function processExcelData(data: (string | number)[][]): ParsedStock[] {
  const stocks: ParsedStock[] = []
  
  if (data.length === 0) {
    return stocks
  }

  let codeColumnIndex = -1
  let nameColumnIndex = -1
  let sourceColumnIndex = -1
  let noteColumnIndex = -1

  const headerRow = data[0]
  
  console.log('Processing header row:', headerRow)
  
  for (let i = 0; i < headerRow.length; i++) {
    const header = String(headerRow[i] || '').toLowerCase().trim()
    
    if (header && codeColumnIndex === -1 && isCodeHeader(header)) {
      codeColumnIndex = i
      console.log('Found code column at index:', i, 'header:', header)
    } else if (header && nameColumnIndex === -1 && isNameHeader(header)) {
      nameColumnIndex = i
      console.log('Found name column at index:', i, 'header:', header)
    } else if (header && sourceColumnIndex === -1 && isSourceHeader(header)) {
      sourceColumnIndex = i
    } else if (header && noteColumnIndex === -1 && isNoteHeader(header)) {
      noteColumnIndex = i
    }
  }

  if (codeColumnIndex === -1) {
    console.warn('未找到代码列，尝试自动检测第一列是否为股票代码')
    
    for (let rowIndex = 1; rowIndex < Math.min(10, data.length); rowIndex++) {
      const row = data[rowIndex]
      if (row && row[0]) {
        const value = String(row[0]).trim()
        if (isValidStockCode(value)) {
          codeColumnIndex = 0
          console.log('自动检测到代码列在第1列')
          break
        }
      }
    }
    
    if (codeColumnIndex === -1) {
      console.warn('仍然未找到代码列')
      return stocks
    }
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex]
    if (!row || row.length === 0) continue

    const codeValue = row[codeColumnIndex]
    const code = String(codeValue || '').trim()

    if (!code || code === '0' || !isValidStockCode(code)) {
      continue
    }

    let name = ''
    if (nameColumnIndex >= 0 && row[nameColumnIndex]) {
      name = String(row[nameColumnIndex]).trim()
    } else if (row.length > codeColumnIndex + 1 && row[codeColumnIndex + 1]) {
      name = String(row[codeColumnIndex + 1]).trim()
    }

    name = sanitizeText(name)

    let source = ''
    if (sourceColumnIndex >= 0 && row[sourceColumnIndex]) {
      source = sanitizeText(String(row[sourceColumnIndex]).trim())
    }

    let note = ''
    if (noteColumnIndex >= 0 && row[noteColumnIndex]) {
      note = sanitizeText(String(row[noteColumnIndex]).trim())
    }

    stocks.push({
      stock_code: code,
      stock_name: name,
      ...(source && { source }),
      ...(note && { note })
    })
  }

  console.log('Parsed', stocks.length, 'stocks')
  if (stocks.length > 0) {
    console.log('First 5 stocks:', stocks.slice(0, 5))
  }
  return stocks
}

function isCodeHeader(header: string): boolean {
  const codeKeywords = ['代码', 'code', 'stock_code', '证券代码', '股票代码', '代码号', 'stock code', 'stockcode']
  return codeKeywords.some(keyword => header.includes(keyword))
}

function isNameHeader(header: string): boolean {
  const nameKeywords = ['名称', 'name', 'stock_name', '证券名称', '股票名称', '股票', 'stock name', 'stockname']
  return nameKeywords.some(keyword => header.includes(keyword))
}

function isSourceHeader(header: string): boolean {
  const sourceKeywords = ['来源', 'source', '渠道', '数据来源']
  return sourceKeywords.some(keyword => header.includes(keyword))
}

function isNoteHeader(header: string): boolean {
  const noteKeywords = ['备注', 'note', '说明', '注释']
  return noteKeywords.some(keyword => header.includes(keyword))
}

function isValidStockCode(code: string): boolean {
  const codePattern = /^(\d{6})$/
  return codePattern.test(code)
}

function processParsedData(data: Record<string, string>[]): ParsedStock[] {
  const stocks: ParsedStock[] = []
  
  for (const row of data) {
    let code = ''
    let name = ''
    let source = ''
    let note = ''
    
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase().trim()
      const value = sanitizeText(String(row[key] || '').trim())
      
      if (!code && isCodeHeader(lowerKey)) {
        code = value
      } else if (!name && isNameHeader(lowerKey)) {
        name = value
      } else if (!source && isSourceHeader(lowerKey)) {
        source = value
      } else if (!note && isNoteHeader(lowerKey)) {
        note = value
      }
    }
    
    if (code && isValidStockCode(code)) {
      stocks.push({
        stock_code: code,
        stock_name: name,
        ...(source && { source }),
        ...(note && { note })
      })
    }
  }
  
  return stocks
}

export function parseTextData(text: string): ParsedStock[] {
  const lines = text.trim().split('\n')
  const stocks: ParsedStock[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    if (isValidStockCode(line)) {
      const code = line
      const name = sanitizeText(lines[i + 1]?.trim() || '')
      
      stocks.push({
        stock_code: code,
        stock_name: name
      })
      
      i++
    } else {
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        const potentialCode = parts[0].trim()
        if (isValidStockCode(potentialCode)) {
          stocks.push({
            stock_code: potentialCode,
            stock_name: sanitizeText(parts.slice(1).join(' ').trim())
          })
        }
      }
    }
  }
  
  return stocks
}
