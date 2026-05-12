import { Suspense } from 'react'
import GenerateReportContent from './GenerateReportContent'

export default function GenerateReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <GenerateReportContent />
    </Suspense>
  )
}
