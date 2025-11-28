// components/WordCard.js
'use client'
import { useState } from 'react'

export default function WordCard({ word, onAnswer, onPlayPronunciation }) {
  const [showDefinition, setShowDefinition] = useState(false)

  const handleShowDefinition = () => {
    setShowDefinition(true)
  }

  const handleAnswer = (familiarity) => {
    onAnswer(familiarity)
    setShowDefinition(false)
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-8 mb-6">
      {/* 单词和发音 */}
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">{word.word}</h2>
        
        {/* 发音按钮 */}
        <div className="flex justify-center space-x-4 mb-4">
          {word.BrE && (
            <button
              onClick={() => onPlayPronunciation(word.word, 'uk')}
              className="flex items-center space-x-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
              </svg>
              <span>英音 {word.BrE}</span>
            </button>
          )}
          {word.AmE && (
            <button
              onClick={() => onPlayPronunciation(word.word, 'us')}
              className="flex items-center space-x-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
              </svg>
              <span>美音 {word.AmE}</span>
            </button>
          )}
        </div>

        {/* 显示释义按钮 */}
        {!showDefinition && (
          <button
            onClick={handleShowDefinition}
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
          >
            显示释义
          </button>
        )}
      </div>

      {/* 释义 */}
      {showDefinition && (
        <div className="mb-8">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-700 mb-3">释义：</h3>
            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {word.definition}
            </div>
          </div>
        </div>
      )}

      {/* 记忆程度选项 */}
      {showDefinition && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => handleAnswer(1)}
            className="bg-red-500 hover:bg-red-600 text-white py-4 px-4 rounded-lg font-medium transition-colors"
          >
            <div className="text-xl mb-1">😫</div>
            <div>忘记</div>
          </button>
          <button
            onClick={() => handleAnswer(2)}
            className="bg-orange-500 hover:bg-orange-600 text-white py-4 px-4 rounded-lg font-medium transition-colors"
          >
            <div className="text-xl mb-1">😕</div>
            <div>困难</div>
          </button>
          <button
            onClick={() => handleAnswer(3)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white py-4 px-4 rounded-lg font-medium transition-colors"
          >
            <div className="text-xl mb-1">😐</div>
            <div>一般</div>
          </button>
          <button
            onClick={() => handleAnswer(4)}
            className="bg-green-500 hover:bg-green-600 text-white py-4 px-4 rounded-lg font-medium transition-colors"
          >
            <div className="text-xl mb-1">😊</div>
            <div>记住</div>
          </button>
        </div>
      )}
    </div>
  )
}