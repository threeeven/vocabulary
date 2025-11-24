// app/dashboard/page.js
'use client'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [wordLists, setWordLists] = useState([])
  const [stats, setStats] = useState({
    totalWords: 0,
    learnedWords: 0,
    todayReview: 0,
    learnedToday: 0,
    streak: 0
  })
  const [dashboardError, setDashboardError] = useState('') // 重命名为 dashboardError 避免冲突
  const [loadingStats, setLoadingStats] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    } else if (user) {
      fetchWordLists()
      fetchStats()
    }
  }, [user, loading, router])

  // app/dashboard/page.js - 更新 fetchWordLists 函数
  const fetchWordLists = async () => {
    try {
      console.log('开始获取词库，用户ID:', user?.id)
      
      const { data, error } = await supabase
        .from('word_lists')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (error) {
        console.error('获取词库失败:', error.message || error)
        setDashboardError('获取词库失败，请刷新页面重试')
        setWordLists([]) // 确保设置为空数组而不是 undefined
        return
      }

      console.log('获取到的词库数据:', data)
      setWordLists(data || []) // 确保即使 data 为 null 也设置为空数组
    } catch (err) {
      console.error('获取词库时发生错误:', err)
      setDashboardError('获取词库时发生错误')
      setWordLists([]) // 错误时也设置为空数组
    }
  }

  const fetchStats = async () => {
    try {
      if (!user) return

      // 获取总单词数
      const { count: totalWords, error: totalError } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (totalError) {
        console.error('获取总单词数失败:', totalError)
      }

      // 获取今日需要复习的单词数
      const today = new Date().toISOString().split('T')[0]
      const { count: todayReview, error: todayError } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review_at', today)
        .not('last_studied_at', 'is', null)

      if (todayError) {
        console.error('获取今日复习数失败:', todayError)
      }

      // 获取已学习的单词数（至少学习过一次）
      const { count: learnedWords, error: learnedError } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .not('last_studied_at', 'is', null)

      if (learnedError) {
        console.error('获取已学习单词数失败:', learnedError)
      }

      // 获取今日已学习的单词数
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date()
      endOfToday.setHours(23, 59, 59, 999)

      const { count: learnedToday, error: learnedTodayError } = await supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('last_studied_at', startOfToday.toISOString())
        .lte('last_studied_at', endOfToday.toISOString())

      if (learnedTodayError) {
        console.error('获取今日学习数失败:', learnedTodayError)
      }

      setStats({
        totalWords: totalWords || 0,
        learnedWords: learnedWords || 0,
        todayReview: todayReview || 0,
        learnedToday: learnedToday || 0,
        streak: 0
      })
    } catch (error) {
      console.error('获取统计信息失败:', error)
      setDashboardError('获取统计信息失败')
    } finally {
      setLoadingStats(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 欢迎横幅 */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-8 text-white">
        <h1 className="text-2xl font-bold mb-2">
          欢迎回来，{user.email?.split('@')[0]}！
        </h1>
        <p className="text-blue-100">
          继续你的单词学习之旅，坚持就是胜利！
        </p>
      </div>

      {/* 错误提示 */}
      {dashboardError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {dashboardError}
                <button onClick={() => { fetchWordLists(); fetchStats(); }} className="ml-2 text-red-700 underline">
                  重试
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 统计卡片 */}
      {loadingStats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-500 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">总单词数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWords}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-500 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">已学习</p>
                <p className="text-2xl font-bold text-gray-900">{stats.learnedWords}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-500 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">今日复习</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayReview}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-500 mr-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">连续打卡</p>
                <p className="text-2xl font-bold text-gray-900">{stats.streak} 天</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 快速入口区域 */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">快速开始</h2>
        <p className="text-gray-600 mb-6">选择你想要进行的操作：</p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 管理词库按钮 */}
          <Link
            href="/dashboard/word-lists"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            管理词库
          </Link>

          {/* 开始学习按钮 - 只在有词库时显示 */}
          {wordLists.length > 0 && (
            <Link
              href={`/dashboard/study?wordListId=${wordLists[0].id}`}
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-500 hover:bg-green-600 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              开始学习
            </Link>
          )}

          {/* 导入词库按钮 - 在没有词库时显示 */}
          {wordLists.length === 0 && (
            <Link
              href="/dashboard/word-lists"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              导入第一个词库
            </Link>
          )}
        </div>
      </div>

      {/* 最近词库显示 */}
      {wordLists.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">最近词库</h2>
            <Link 
              href="/dashboard/word-lists" 
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              查看全部
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wordLists.slice(0, 3).map((list) => (
              <div key={list.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
                {list.description && (
                  <p className="text-gray-600 text-sm mt-1 line-clamp-2">{list.description}</p>
                )}
                <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                  <span>{list.word_count} 个单词</span>
                  <Link 
                    href={`/dashboard/study?wordListId=${list.id}`}
                    className="text-blue-500 hover:text-blue-600 font-medium"
                  >
                    学习
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 学习提示 */}
      {wordLists.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-yellow-800 mb-2">还没有词库</h3>
          <p className="text-yellow-700 mb-4">
            导入你的第一个词库，开始高效学习单词吧！
          </p>
          <Link
            href="/dashboard/word-lists"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            立即导入词库
          </Link>
        </div>
      )}
    </div>
  )
}