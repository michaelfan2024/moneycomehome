'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, FileText, PenLine, Eye } from 'lucide-react'
import { md, preprocessMarkdown, applyTheme } from '../../lib/wechat-editor/markdown'
import { markElementIndexes } from '../../lib/wechat-editor/markdownIndexer'
import { makeWeChatCompatible, cleanInternalAttributes } from '../../lib/wechat-editor/wechatCompat'
import { defaultContent } from '../../lib/wechat-editor/defaultContent'
import { findImagePosition, selectTextAreaRange } from '../../lib/wechat-editor/imageSelector'
import { findElementPosition, type ElementLocation } from '../../lib/wechat-editor/markdownLocator'
import { getSafeThemeId } from '../../lib/wechat-editor/themeSelection'
import ThemeSelector from '../../components/wechat-editor/ThemeSelector'
import Toolbar from '../../components/wechat-editor/Toolbar'
import EditorPanel from '../../components/wechat-editor/EditorPanel'
import PreviewPanel from '../../components/wechat-editor/PreviewPanel'

interface ReportPayload {
  id: string
  date: string
  title: string
  content: string
}

export default function WechatEditorContent() {
  const searchParams = useSearchParams()
  const reportId = searchParams.get('reportId')
  const [markdownInput, setMarkdownInput] = useState<string>(defaultContent)
  const [renderedHtml, setRenderedHtml] = useState<string>('')
  const [activeTheme, setActiveTheme] = useState(() => getSafeThemeId(searchParams.get('theme')))
  const [copied, setCopied] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'pc'>('pc')
  const [activePanel, setActivePanel] = useState<'editor' | 'preview'>('editor')
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true)
  const [sourceReport, setSourceReport] = useState<ReportPayload | null>(null)
  const [loadMessage, setLoadMessage] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const editorScrollRef = useRef<HTMLTextAreaElement>(null)
  const previewOuterScrollRef = useRef<HTMLDivElement>(null)
  const previewInnerScrollRef = useRef<HTMLDivElement>(null)
  const scrollSyncLockRef = useRef<'editor' | 'preview' | null>(null)
  const scrollLockReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!reportId) return

    let cancelled = false
    setLoadMessage('正在载入 AI 报告...')

    fetch(`/api/report?id=${encodeURIComponent(reportId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.success && data.data?.content) {
          const report = data.data as ReportPayload
          setSourceReport(report)
          setMarkdownInput(report.content)
          setLoadMessage(`已载入报告：${report.title}`)
        } else {
          setLoadMessage(data.error || '报告载入失败，已使用默认示例内容')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadMessage('报告载入失败，已使用默认示例内容')
      })

    return () => {
      cancelled = true
    }
  }, [reportId])

  useEffect(() => {
    const rawHtml = md.render(preprocessMarkdown(markdownInput))
    const styledHtml = applyTheme(rawHtml, activeTheme)
    setRenderedHtml(markElementIndexes(styledHtml))
  }, [markdownInput, activeTheme])

  useEffect(() => {
    if (!scrollSyncEnabled) {
      scrollSyncLockRef.current = null
      if (scrollLockReleaseTimeoutRef.current) {
        clearTimeout(scrollLockReleaseTimeoutRef.current)
        scrollLockReleaseTimeoutRef.current = null
      }
    }
  }, [scrollSyncEnabled])

  useEffect(() => {
    scrollSyncLockRef.current = null
    if (scrollLockReleaseTimeoutRef.current) {
      clearTimeout(scrollLockReleaseTimeoutRef.current)
      scrollLockReleaseTimeoutRef.current = null
    }
  }, [previewDevice])

  useEffect(() => {
    return () => {
      if (scrollLockReleaseTimeoutRef.current) {
        clearTimeout(scrollLockReleaseTimeoutRef.current)
      }
    }
  }, [])

  const getActivePreviewScrollElement = () => {
    if (previewDevice === 'pc') return previewOuterScrollRef.current
    return previewInnerScrollRef.current
  }

  const syncScrollPosition = (
    sourceElement: HTMLElement,
    targetElement: HTMLElement,
    sourcePanel: 'editor' | 'preview'
  ) => {
    if (!scrollSyncEnabled) return
    if (scrollSyncLockRef.current && scrollSyncLockRef.current !== sourcePanel) return

    const sourceMaxScroll = sourceElement.scrollHeight - sourceElement.clientHeight
    const targetMaxScroll = targetElement.scrollHeight - targetElement.clientHeight
    if (sourceMaxScroll <= 0) {
      targetElement.scrollTop = 0
      return
    }

    const scrollRatio = sourceElement.scrollTop / sourceMaxScroll
    scrollSyncLockRef.current = sourcePanel
    targetElement.scrollTop = scrollRatio * Math.max(targetMaxScroll, 0)

    if (scrollLockReleaseTimeoutRef.current) {
      clearTimeout(scrollLockReleaseTimeoutRef.current)
    }

    scrollLockReleaseTimeoutRef.current = setTimeout(() => {
      if (scrollSyncLockRef.current === sourcePanel) {
        scrollSyncLockRef.current = null
      }
      scrollLockReleaseTimeoutRef.current = null
    }, 50)
  }

  const handleEditorScroll = () => {
    const editorElement = editorScrollRef.current
    const previewElement = getActivePreviewScrollElement()
    if (!editorElement || !previewElement) return
    syncScrollPosition(editorElement, previewElement, 'editor')
  }

  const handlePreviewOuterScroll = () => {
    if (previewDevice !== 'pc') return
    const previewElement = previewOuterScrollRef.current
    const editorElement = editorScrollRef.current
    if (!previewElement || !editorElement) return
    syncScrollPosition(previewElement, editorElement, 'preview')
  }

  const handlePreviewInnerScroll = () => {
    if (previewDevice === 'pc') return
    const previewElement = previewInnerScrollRef.current
    const editorElement = editorScrollRef.current
    if (!previewElement || !editorElement) return
    syncScrollPosition(previewElement, editorElement, 'preview')
  }

  const handleCopy = async () => {
    if (!previewRef.current) return
    setIsCopying(true)
    try {
      const finalHtmlForCopy = await makeWeChatCompatible(renderedHtml, activeTheme)
      const plainText = previewRef.current.innerText

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([finalHtmlForCopy], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
        await navigator.clipboard.write([clipboardItem])
      } else {
        await navigator.clipboard.writeText(plainText)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
      alert('复制格式失败，请检查浏览器剪贴板权限')
    } finally {
      setIsCopying(false)
    }
  }

  const handleExportHtml = () => {
    const cleanHtml = cleanInternalAttributes(renderedHtml)
    const blob = new Blob([cleanHtml], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MoneyComeHome_Wechat_${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportPdf = async () => {
    if (!previewRef.current) return
    const html2pdf = (await import('html2pdf.js')).default
    const clonedElement = previewRef.current.cloneNode(true) as HTMLElement
    clonedElement.querySelectorAll('*').forEach((el) => {
      el.removeAttribute('data-md-type')
      el.removeAttribute('data-md-index')
    })

    const cloneContainer = document.createElement('div')
    cloneContainer.style.background = document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff'
    cloneContainer.appendChild(clonedElement)
    document.body.appendChild(cloneContainer)

    const opt = {
      margin: 10,
      filename: `MoneyComeHome_Wechat_${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#000000' : '#ffffff'
      },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
    }

    html2pdf().set(opt).from(cloneContainer).save().then(() => {
      document.body.removeChild(cloneContainer)
    })
  }

  const handleElementClick = useCallback((info: { type: string; index: number; src?: string; alt?: string }) => {
    if (!editorScrollRef.current) return

    let location: ElementLocation | null = null

    if (info.type === 'image' && info.src) {
      const match = findImagePosition(markdownInput, info.src, info.alt || '')
      if (match) {
        location = {
          start: match.start,
          end: match.end,
          type: 'image'
        }
      }
    } else {
      location = findElementPosition(markdownInput, info.type, '', info.index)
    }

    if (location) {
      selectTextAreaRange(editorScrollRef.current, location.start, location.end)
      if (window.innerWidth < 768 && activePanel !== 'editor') {
        setActivePanel('editor')
      }
    }
  }, [markdownInput, activePanel])

  const deviceWidthClass = () => {
    if (previewDevice === 'mobile') return 'w-[520px] max-w-full'
    if (previewDevice === 'tablet') return 'w-[800px] max-w-full'
    return 'w-[840px] xl:w-[1024px] max-w-[95%]'
  }

  const gridLayoutClass = () => {
    if (previewDevice === 'mobile') return 'md:grid-cols-[55fr_45fr]'
    if (previewDevice === 'tablet') return 'md:grid-cols-[45fr_55fr]'
    return 'md:grid-cols-[38.2fr_61.8fr]'
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-[#fbfbfd] text-[#1d1d1f] antialiased transition-colors duration-300 dark:bg-black dark:text-[#f5f5f7]">
      <div className="glass-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <a
            href={sourceReport ? `/report/${sourceReport.id}` : '/report'}
            className="hidden rounded-full p-2 text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white sm:block"
            title={sourceReport ? '返回报告详情' : '返回报告列表'}
          >
            <ArrowLeft size={18} />
          </a>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-black text-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] dark:bg-white dark:text-black">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-black dark:text-white sm:text-lg">
              公众号排版工作台
            </h1>
            <p className="truncate text-xs text-[#86868b] dark:text-[#a1a1a6]">
              {loadMessage || 'Raphael Publish 已集成，可直接复制到微信公众号后台'}
            </p>
          </div>
        </div>
      </div>

      <div className="md:hidden glass-toolbar flex items-center z-[90]">
        <button
          data-testid="tab-editor"
          onClick={() => setActivePanel('editor')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'editor' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
        >
          <PenLine size={15} />
          编辑
        </button>
        <button
          data-testid="tab-preview"
          onClick={() => setActivePanel('preview')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-[13px] font-semibold transition-colors border-b-2 ${activePanel === 'preview' ? 'text-[#0066cc] dark:text-[#0a84ff] border-[#0066cc] dark:border-[#0a84ff]' : 'text-[#86868b] dark:text-[#a1a1a6] border-transparent'}`}
        >
          <Eye size={15} />
          预览
        </button>
      </div>

      <div className={`glass-toolbar hidden md:grid grid-cols-1 ${gridLayoutClass()} px-0 z-[90] transition-all duration-500`}>
        <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
        <Toolbar
          previewDevice={previewDevice}
          onDeviceChange={setPreviewDevice}
          onExportPdf={handleExportPdf}
          onExportHtml={handleExportHtml}
          onCopy={handleCopy}
          copied={copied}
          isCopying={isCopying}
          scrollSyncEnabled={scrollSyncEnabled}
          onToggleScrollSync={() => setScrollSyncEnabled((prev) => !prev)}
        />
      </div>

      <div className="md:hidden glass-toolbar z-[90]">
        <div className="overflow-x-auto no-scrollbar border-b border-[#00000010] dark:border-[#ffffff10]">
          <ThemeSelector activeTheme={activeTheme} onThemeChange={setActiveTheme} />
        </div>
        <Toolbar
          previewDevice={previewDevice}
          onDeviceChange={setPreviewDevice}
          onExportPdf={handleExportPdf}
          onExportHtml={handleExportHtml}
          onCopy={handleCopy}
          copied={copied}
          isCopying={isCopying}
          scrollSyncEnabled={scrollSyncEnabled}
          onToggleScrollSync={() => setScrollSyncEnabled((prev) => !prev)}
        />
      </div>

      <main className={`flex-1 overflow-hidden grid grid-cols-1 ${gridLayoutClass()} relative transition-all duration-500`}>
        <div className={`${activePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
          <EditorPanel
            markdownInput={markdownInput}
            onInputChange={setMarkdownInput}
            editorScrollRef={editorScrollRef}
            onEditorScroll={handleEditorScroll}
            scrollSyncEnabled={scrollSyncEnabled}
          />
        </div>
        <div className={`${activePanel === 'preview' ? 'flex' : 'hidden'} md:flex flex-col overflow-hidden`}>
          <PreviewPanel
            renderedHtml={renderedHtml}
            deviceWidthClass={deviceWidthClass()}
            previewDevice={previewDevice}
            previewRef={previewRef}
            previewOuterScrollRef={previewOuterScrollRef}
            previewInnerScrollRef={previewInnerScrollRef}
            onPreviewOuterScroll={handlePreviewOuterScroll}
            onPreviewInnerScroll={handlePreviewInnerScroll}
            scrollSyncEnabled={scrollSyncEnabled}
            onImageClick={handleElementClick}
          />
        </div>
      </main>
    </div>
  )
}
