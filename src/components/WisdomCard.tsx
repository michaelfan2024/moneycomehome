import { useState, useEffect } from 'react'

const stockWisdom = [
  {
    quote: '真正的突破不是价格突破，而是成交量和价格的同步突破。',
    author: '《股票魔法师》',
    highlight: '量价突破'
  },
  {
    quote: '强势股在回调时，成交量应该萎缩，这表明筹码锁定良好。',
    author: '《股票魔法师》',
    highlight: '缩量回调'
  },
  {
    quote: '股票的相对强弱是判断其是否值得关注的关键指标。',
    author: '《股票魔法师》',
    highlight: '相对强弱'
  },
  {
    quote: '不要在股价跌破50日均线时买入，那是下跌趋势的开始。',
    author: '《股票魔法师》',
    highlight: '均线法则'
  },
  {
    quote: '专注于少数几只股票，比分散投资于很多股票更有效。',
    author: '《股票魔法师》',
    highlight: '集中投资'
  },
  {
    quote: '在正确的时机买入正确的股票，比频繁交易更重要。',
    author: '《股票魔法师》',
    highlight: '择时选股'
  },
  {
    quote: '市场永远是对的，当你的观点与市场冲突时，市场总是赢家。',
    author: '《股票魔法师》',
    highlight: '顺势而为'
  },
  {
    quote: '成功的交易员知道何时应该止损，并且果断执行。',
    author: '《股票魔法师》',
    highlight: '止损纪律'
  }
]

export default function WisdomCard() {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stockWisdom.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  const currentWisdom = stockWisdom[currentIndex]

  return (
    <div className="wisdom-card animate-fadeIn">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[var(--primary-color)] text-sm font-medium">
          📚 {currentWisdom.highlight}
        </span>
        <div className="flex gap-1">
          {stockWisdom.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-[var(--primary-color)] w-4'
                  : 'bg-[var(--border-color)] hover:bg-[var(--text-muted)]'
              }`}
            />
          ))}
        </div>
      </div>
      <p className="wisdom-quote">"{currentWisdom.quote}"</p>
      <p className="wisdom-author">—— {currentWisdom.author}</p>
    </div>
  )
}
