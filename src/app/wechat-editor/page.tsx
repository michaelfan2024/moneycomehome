import { Suspense } from 'react'
import WechatEditorContent from './WechatEditorContent'

export default function WechatEditorPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-secondary)]">正在加载公众号排版工作台...</div>}>
      <WechatEditorContent />
    </Suspense>
  )
}
