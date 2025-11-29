// app/dashboard/word-lists/WordListsClient.js
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function WordListsClient({ 
  user, 
  initialWordLists = [], 
  initialUserSelectedLists = [] 
}) {
  const [wordLists, setWordLists] = useState(initialWordLists)
  const [userSelectedLists, setUserSelectedLists] = useState(initialUserSelectedLists)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // 切换词库选择状态
  const toggleWordList = async (wordListId) => {
    try {
      const isSelected = userSelectedLists.includes(wordListId)
      
      if (isSelected) {
        // 取消选择
        const { error } = await supabase
          .from('user_word_lists')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('word_list_id', wordListId)

        if (error) throw error

        setUserSelectedLists(prev => prev.filter(id => id !== wordListId))
      } else {
        // 选择词库
        const { error } = await supabase
          .from('user_word_lists')
          .upsert({
            user_id: user.id,
            word_list_id: wordListId,
            is_active: true
          }, {
            onConflict: 'user_id,word_list_id'
          })

        if (error) throw error

        setUserSelectedLists(prev => [...prev, wordListId])
        console.log(`已选择词库 ${wordListId}，学习记录将在学习时按需创建`)
      }
    } catch (error) {
      console.error('切换词库失败:', error)
      alert('操作失败，请重试')
    }
  }

  // 检查是否有学习进度
  const hasProgress = (wordListId) => {
    if (typeof window === 'undefined') return false
    const progress = localStorage.getItem(`study_progress_${user.id}_${wordListId}`)
    return !!progress
  }

  // 错误提示组件
  const ErrorAlert = () => (
    error && (
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              {error}
              <button onClick={refreshData} className="ml-2 text-yellow-700 underline">
                重新加载
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  )

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">词库选择</h1>
          <p className="text-gray-600 mt-2">
            选择你想要学习的词库，系统会自动为你创建学习计划
          </p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-sm text-gray-500">
              已选择 {userSelectedLists.length} 个词库
            </p>
          </div>
        </div>
      </div>

      <ErrorAlert />

      {/* 词库网格 */}
      {wordLists.length === 0 ? (
        <EmptyState />
      ) : (
        <WordListsGrid 
          wordLists={wordLists}
          userSelectedLists={userSelectedLists}
          toggleWordList={toggleWordList}
          hasProgress={hasProgress}
          user={user}
        />
      )}
    </div>
  )
}

// 空状态组件
function EmptyState() {
  return (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <div className="text-gray-400 mb-4">
        <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-2">暂无词库</h3>
      <p className="text-gray-500 mb-6">系统管理员正在准备词库，请稍后再来查看。</p>
    </div>
  )
}

// 词库网格组件
function WordListsGrid({ wordLists, userSelectedLists, toggleWordList, hasProgress, user }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {wordLists.map((list) => {
        const isSelected = userSelectedLists.includes(list.id)
        
        return (
          <div key={list.id} className={`bg-white shadow rounded-lg overflow-hidden border-2 transition-all ${
            isSelected ? 'border-blue-500' : 'border-gray-200'
          }`}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate" title={list.name}>
                    {list.name}
                  </h3>
                  {list.description && (
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{list.description}</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  单词: {list.word_count}
                </span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  {list.language === 'english' ? '英语' : list.language}
                </span>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleWordList(list.id)}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {isSelected ? '取消选择' : '选择学习'}
                </button>
                
                {isSelected && (
                  <div className="flex space-x-2">
                    <Link
                      href={`/dashboard/study/${list.id}`}
                      className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                    >
                      {hasProgress(list.id) ? '继续学习' : '开始学习'}
                    </Link>
                    <Link
                      href={`/dashboard/word-lists/${list.id}/words`}
                      className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
                      title="查看单词详情"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}