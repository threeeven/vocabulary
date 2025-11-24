// app/dashboard/study/[wordListId]/page.js
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import WordCard from '@/components/WordCard'
import { StudySession } from '@/lib/studySession'

export default function WordListStudy() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const wordListId = params.wordListId
  const [words, setWords] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    learned: 0,
    reviewing: 0
  })
  const [sessionComplete, setSessionComplete] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(10)
  const [wordListInfo, setWordListInfo] = useState(null)
  const [pageError, setPageError] = useState('') // 添加错误状态
  const supabase = createClient()

  // 初始化学习会话
  const [studySession] = useState(new StudySession(user?.id, wordListId))

  useEffect(() => {
    if (user && wordListId) {
      fetchUserSettings()
      fetchWordListInfo()
      fetchStudyWords()
    }
  }, [user, wordListId])

  // 获取用户设置（每日学习目标）
  const fetchUserSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('daily_goal')
        .eq('id', user.id)
        .single()

      if (!error && data && data.daily_goal) {
        setDailyGoal(data.daily_goal)
      }
    } catch (error) {
      console.error('获取用户设置失败:', error)
    }
  }

  // 获取词库信息
  const fetchWordListInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('word_lists')
        .select('*')
        .eq('id', wordListId)
        .single()

      if (!error && data) {
        setWordListInfo(data)
      } else {
        setPageError('词库不存在或已被删除')
      }
    } catch (error) {
      console.error('获取词库信息失败:', error)
      setPageError('获取词库信息失败')
    }
  }

  const fetchStudyWords = async () => {
    try {
      setLoading(true)
      setPageError('') // 清除错误
      const studyWords = await studySession.getStudyWords(dailyGoal)
      
      console.log('获取到的学习单词:', studyWords) // 调试信息

      // 恢复进度
      const savedProgress = studySession.getProgress()
      if (savedProgress && savedProgress.currentIndex < studyWords.length) {
        setCurrentIndex(savedProgress.currentIndex)
      } else {
        setCurrentIndex(0)
      }

      setWords(studyWords)
      setStats({
        total: studyWords.length,
        learned: studyWords.filter(word => word.last_studied_at).length,
        reviewing: studyWords.filter(word => !word.last_studied_at).length
      })

      // 如果没有学习任务，显示完成页面
      if (studyWords.length === 0) {
        setSessionComplete(true)
      }
    } catch (error) {
      console.error('获取学习单词失败:', error)
      setPageError('获取学习单词失败: ' + error.message) // 使用正确的错误状态
    } finally {
      setLoading(false)
    }
  }

  const calculateNextReview = (familiarity, currentInterval = 1, easeFactor = 2.5) => {
    let newInterval
    let newEaseFactor = easeFactor

    if (familiarity >= 4) {
      newInterval = Math.round(currentInterval * newEaseFactor)
      newEaseFactor = Math.max(1.3, newEaseFactor + 0.1)
    } else if (familiarity >= 2) {
      newInterval = Math.max(1, Math.round(currentInterval / 2))
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2)
    } else {
      newInterval = 1
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.3)
    }

    newInterval = Math.min(newInterval, 90)

    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

    return {
      interval: newInterval,
      easeFactor: newEaseFactor,
      nextReviewAt: nextReviewDate.toISOString()
    }
  }

  const handleAnswer = async (familiarity) => {
    if (words.length === 0) return

    const currentWord = words[currentIndex]
    const now = new Date().toISOString()

    const reviewData = calculateNextReview(
      familiarity,
      currentWord.interval_days || 1,
      currentWord.ease_factor || 2.5
    )

    try {
      const { error } = await supabase
        .from('study_records')
        .update({
          familiarity: familiarity,
          last_studied_at: now,
          next_review_at: reviewData.nextReviewAt,
          review_count: (currentWord.review_count || 0) + 1,
          ease_factor: reviewData.easeFactor,
          interval_days: reviewData.interval
        })
        .eq('id', currentWord.id)

      if (error) throw error

      // 更新本地状态
      const updatedWords = [...words]
      updatedWords[currentIndex] = {
        ...currentWord,
        familiarity,
        last_studied_at: now,
        next_review_at: reviewData.nextReviewAt,
        review_count: (currentWord.review_count || 0) + 1,
        ease_factor: reviewData.easeFactor,
        interval_days: reviewData.interval
      }
      setWords(updatedWords)

      // 移动到下一个单词或结束会话
      const nextIndex = currentIndex + 1
      if (nextIndex < words.length) {
        setCurrentIndex(nextIndex)
        studySession.saveProgress(nextIndex, updatedWords)
      } else {
        setSessionComplete(true)
        studySession.clearProgress()
      }
    } catch (error) {
      console.error('更新学习记录失败:', error)
      setPageError('保存学习进度失败')
    }
  }

  const restartSession = () => {
    studySession.clearProgress()
    setCurrentIndex(0)
    setSessionComplete(false)
    fetchStudyWords()
  }

  const pauseSession = () => {
    studySession.saveProgress(currentIndex, words)
    router.push('/dashboard/study')
  }

  const changeWordList = () => {
    studySession.saveProgress(currentIndex, words)
    router.push('/dashboard/study')
  }

  // 强制重置学习进度（调试用）
  const forceResetProgress = async () => {
    if (!confirm('确定要重置这个词库的所有学习进度吗？这将删除所有学习记录。')) {
      return
    }

    try {
      const { error } = await supabase
        .from('study_records')
        .update({
          familiarity: 0,
          review_count: 0,
          ease_factor: 2.5,
          interval_days: 1,
          last_studied_at: null,
          next_review_at: null
        })
        .eq('user_id', user.id)
        .eq('word_list_id', wordListId)

      if (error) throw error

      studySession.clearProgress()
      alert('重置成功！现在可以重新学习这个词库了。')
      fetchStudyWords()
    } catch (error) {
      console.error('重置学习进度失败:', error)
      alert('重置失败，请重试')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">出错了</h3>
          <p className="text-red-700 mb-4">{pageError}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={fetchStudyWords}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              重新加载
            </button>
            <button
              onClick={() => router.push('/dashboard/study')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              返回词库列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (words.length === 0 && !loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="text-green-500 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">太棒了！</h3>
          <p className="text-gray-600 mb-4">今天没有需要学习的单词了</p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-medium text-blue-800 mb-2">可能的原因：</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 所有单词都已经学习过了</li>
              <li>• 今日复习任务已完成</li>
              <li>• 新单词学习已达到每日上限</li>
              <li>• 词库中没有单词数据</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={restartSession}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              重新检查
            </button>
            <button
              onClick={() => router.push('/dashboard/study')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              选择其他词库
            </button>
            <button
              onClick={forceResetProgress}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              重置学习进度
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (sessionComplete) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg p-8 text-center">
          <div className="text-blue-500 mb-4">
            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">学习完成！</h3>
          <p className="text-gray-600 mb-6">你已经完成了今天的学习任务</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={restartSession}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              继续学习
            </button>
            <button
              onClick={() => router.push('/dashboard/study')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              选择其他词库
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentWord = words[currentIndex]

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 错误提示 */}
      {pageError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {pageError}
                <button onClick={fetchStudyWords} className="ml-2 text-red-700 underline">
                  重试
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 学习头部信息 */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {wordListInfo?.name || '学习词库'}
            </h1>
            {wordListInfo?.description && (
              <p className="text-gray-600 mt-1">{wordListInfo.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={pauseSession}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              暂停学习
            </button>
            <button
              onClick={changeWordList}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              切换词库
            </button>
          </div>
        </div>

        {/* 学习进度 */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              进度: {currentIndex + 1} / {words.length}
            </span>
            <span className="text-sm text-gray-500">
              {stats.learned} 复习 • {stats.reviewing} 新学
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 单词卡片 */}
      <WordCard 
        word={currentWord} 
        onAnswer={handleAnswer}
      />

      {/* 学习提示 */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">学习提示</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 根据记忆程度选择相应的选项</li>
          <li>• 系统会根据你的选择智能安排复习时间</li>
          <li>• 进度会自动保存，可以随时暂停和继续</li>
          <li>• 每日学习目标: {dailyGoal} 个新单词</li>
        </ul>
      </div>
    </div>
  )
}