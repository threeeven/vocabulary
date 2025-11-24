// app/dashboard/word-lists/page.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import UploadWordList from '@/components/UploadWordList'

export default function WordLists() {
  const { user } = useAuth()
  const [wordLists, setWordLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const supabase = createClient()

  // 使用 useCallback 避免重复创建函数
  const fetchWordLists = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setError('')
      const { data, error } = await supabase
        .from('word_lists')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('获取词库失败:', error)
        throw error
      }

      setWordLists(data || [])
    } catch (err) {
      console.error('获取词库错误:', err)
      setError('获取词库失败，请检查网络连接')
      // 自动重试机制
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
        }, 2000)
      }
    } finally {
      setLoading(false)
    }
  }, [user, supabase, retryCount])

  useEffect(() => {
    fetchWordLists()
  }, [fetchWordLists])

  const deleteWordList = async (id) => {
    if (!confirm('确定要删除这个词库吗？这将删除所有相关的学习记录。')) {
      return
    }

    try {
      const { error } = await supabase
        .from('word_lists')
        .delete()
        .eq('id', id)

      if (error) throw error

      // 乐观更新，立即从界面移除
      setWordLists(prev => prev.filter(list => list.id !== id))
      
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败，请重试')
      // 重新获取数据确保一致性
      fetchWordLists()
    }
  }

  const retryFetch = () => {
    setLoading(true)
    setRetryCount(0)
    fetchWordLists()
  }

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-lg text-gray-600">加载词库中...</div>
          {retryCount > 0 && (
            <div className="text-sm text-gray-500 mt-2">
              尝试第 {retryCount + 1} 次重连
            </div>
          )}
        </div>
      </div>
    )
  }

  // 错误状态
  if (error && wordLists.length === 0) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">加载失败</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={retryFetch}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md"
          >
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">词库管理</h1>
            <p className="text-gray-600 mt-2">
              管理你的单词库，共 {wordLists.length} 个词库
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium flex items-center shadow-sm"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            导入词库
          </button>
        </div>

        {/* 错误提示条 */}
        {error && wordLists.length > 0 && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  {error} - 显示的数据可能不是最新的
                  <button onClick={retryFetch} className="ml-2 text-yellow-700 underline">
                    重新加载
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 上传模态框 */}
      {showUpload && (
        <UploadWordList 
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            setRetryCount(0)
            fetchWordLists()
          }}
        />
      )}

      {/* 词库网格 */}
      {wordLists.length === 0 ? (
        <EmptyState onUpload={() => setShowUpload(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wordLists.map((list) => (
            <WordListCard 
              key={list.id} 
              list={list} 
              onDelete={deleteWordList}
              onRetry={fetchWordLists}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 空状态组件
function EmptyState({ onUpload }) {
  return (
    <div className="bg-white shadow rounded-lg p-8 text-center">
      <div className="text-gray-400 mb-4">
        <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-medium text-gray-900 mb-2">还没有词库</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        导入你的第一个词库开始学习吧！支持 CSV、JSON、TXT 格式，轻松管理你的单词库。
      </p>
      <button
        onClick={onUpload}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center shadow-sm"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        导入第一个词库
      </button>
      
      <div className="mt-8 text-sm text-gray-500">
        <p>不知道如何开始？</p>
        <div className="mt-2 flex justify-center space-x-4">
          <a href="#" className="text-blue-500 hover:text-blue-600">查看导入指南</a>
          <a href="#" className="text-blue-500 hover:text-blue-600">下载示例文件</a>
        </div>
      </div>
    </div>
  )
}

// 词库卡片组件
function WordListCard({ list, onDelete, onRetry }) {
  const [learning, setLearning] = useState(false)
  const [stats, setStats] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [list.id])

  const fetchStats = async () => {
    try {
      const { count, error } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('word_list_id', list.id)

      if (!error) {
        setStats({
          totalWords: count || 0,
          // 这里可以添加更多统计信息
        })
      }
    } catch (err) {
      console.error('获取统计信息失败:', err)
    }
  }

  const handleStudy = () => {
    setLearning(true)
    // 这里可以添加开始学习的逻辑
    setTimeout(() => {
      setLearning(false)
    }, 1000)
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
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
          <div className="flex space-x-2 ml-2">
            <Link
              href={`/dashboard/study?wordListId=${list.id}`}
              onClick={handleStudy}
              className="text-blue-500 hover:text-blue-600 p-1 rounded transition-colors"
              title="学习此词库"
            >
              {learning ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </Link>
            <button
              onClick={() => onDelete(list.id)}
              className="text-red-500 hover:text-red-600 p-1 rounded transition-colors"
              title="删除词库"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            单词: {stats?.totalWords || list.word_count || 0}
          </span>
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(list.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="flex space-x-2">
          <Link
            href={`/dashboard/study?wordListId=${list.id}`}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-center py-2 px-4 rounded-md text-sm font-medium transition-colors"
          >
            开始学习
          </Link>
          <button
            onClick={() => onRetry()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-3 rounded-md text-sm font-medium transition-colors"
            title="刷新统计"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// UploadWordList 组件保持不变，使用之前的代码