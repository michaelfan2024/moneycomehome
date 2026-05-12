import { Suspense } from 'react'
import RankingContent from './RankingContent'

export default function RankingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64">Loading...</div>}>
      <RankingContent />
    </Suspense>
  )
}
