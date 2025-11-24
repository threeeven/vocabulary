// components/WordCard.js
'use client'
import { useState } from 'react'

export default function WordCard({ word, onAnswer }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true)
      // 延迟显示答案，增加一点悬念
      setTimeout(() => setShowAnswer(true), 300)
    }
  }

  const handleAnswer = (familiarity) => {
    onAnswer(familiarity)
    setIsFlipped(false)
    setShowAnswer(false)
  }

  const getFamiliarityLabel = (level) => {
    const labels = {
      1: '忘记',
      2: '困难',
      3: '模糊', 
      4: '记得',
      5: '熟练'
    }
    return labels[level] || '未知'
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 单词卡片 */}
      <div 
        className={`relative w-full h-64 cursor-pointer transition-all duration-500 ${isFlipped ? 'scale-95' : 'scale-100'}`}
        onClick={handleFlip}
      >
        {/* 卡片正面 - 单词 */}
        <div className={`absolute inset-0 bg-white border-2 border-gray-200 rounded-xl shadow-lg p-6 flex flex-col items-center justify-center transition-opacity duration-500 ${isFlipped ? 'opacity-0' : 'opacity-100'}`}>
          <div className="text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{word.word}</h2>
            {word.pronunciation && (
              <p className="text-lg text-gray-600 mb-2">/{word.pronunciation}/</p>
            )}
            <p className="text-sm text-gray-500">点击卡片查看释义</p>
          </div>
        </div>

        {/* 卡片背面 - 释义 */}
        <div className={`absolute inset-0 bg-blue-50 border-2 border-blue-200 rounded-xl shadow-lg p-6 flex flex-col items-center justify-center transition-opacity duration-500 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
          {showAnswer && (
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">{word.word}</h2>
              {word.pronunciation && (
                <p className="text-lg text-gray-600 mb-2">/{word.pronunciation}/</p>
              )}
              <p className="text-2xl text-blue-600 font-medium mb-6">{word.definition}</p>
              <p className="text-sm text-gray-500">选择记忆程度</p>
            </div>
          )}
        </div>
      </div>

      {/* 答案按钮 - 只在翻转后显示 */}
      {isFlipped && showAnswer && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => handleAnswer(level)}
              className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                level <= 2 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : level <= 4 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {getFamiliarityLabel(level)}
            </button>
          ))}
        </div>
      )}

      {/* 学习统计 */}
      {!isFlipped && (
        <div className="mt-6 text-center text-sm text-gray-500">
          {word.review_count > 0 ? (
            <p>已学习 {word.review_count} 次 • 熟悉度: {word.familiarity || 0}/5</p>
          ) : (
            <p>新单词 • 首次学习</p>
          )}
        </div>
      )}
    </div>
  )
}