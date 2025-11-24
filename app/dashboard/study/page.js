// app/dashboard/study/page.js - 简化版本
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StudyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [userWordLists, setUserWordLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (user) {
      fetchUserWordLists()
    }
  }, [user])

  const fetchUserWordLists = async () => {
    try {
      setError('')
      // 获取用户选择的词库
      const { data, error } = await supabase
        .from('user_word_lists')
        .select(`
          word_list_id,
          word_lists (
            id,
            name,
            description,
            word_count,
            level,
            language
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('added_at', { ascending: false })

      if (error) throw error

      setUserWordLists(data || [])
    } catch (err) {
      console.error('获取用户词库失败:', err)
      setError('获取学习词库失败，请刷新页面重试')
    } finally {
      setLoading(false)
    }
  }

  const startStudy = (wordListId) => {
    router.push(`/dashboard/study/${wordListId}`)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (userWordLists.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">还没有选择词库</h3>
          <p className="text-gray-500 mb-6">请先选择你想要学习的词库</p>
          <Link
            href="/dashboard/word-lists"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium inline-flex items-center"
          >
            选择词库
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">开始学习</h1>
        <p className="text-gray-600 mt-2">选择要学习的词库</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {userWordLists.map((item) => {
          const list = item.word_lists
          return (
            <div key={list.id} className="bg-white shadow rounded-lg p-6 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{list.name}</h3>
              {list.description && (
                <p className="text-gray-600 mb-4">{list.description}</p>
              )}
              <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                <span>{list.word_count} 个单词</span>
                <span>{list.level === 'beginner' ? '初级' : list.level === 'intermediate' ? '中级' : '高级'}</span>
              </div>
              <button
                onClick={() => startStudy(list.id)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                开始学习
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}