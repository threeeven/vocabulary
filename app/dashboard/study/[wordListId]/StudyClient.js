// app/dashboard/study/[wordListId]/StudyClient.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import WordCard from '@/components/WordCard'

export default function StudyClient({ 
  user,
  wordListId,
  initialUserSettings = { daily_goal: 10 },
  initialWordListInfo = null
}) {
  const { user: authUser } = useAuth()
  const params = useParams()
  const router = useRouter()
  const currentWordListId = wordListId || params.wordListId
  
  // 状态管理
  const [words, setWords] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    learned: 0,
    reviewing: 0
  })
  const [sessionComplete, setSessionComplete] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(initialUserSettings.daily_goal)
  const [wordListInfo, setWordListInfo] = useState(initialWordListInfo)
  const [pageError, setPageError] = useState('')
  const [isReloading, setIsReloading] = useState(false) // 防止重复刷新
  const supabase = createClient()

  // 获取学习数据 - 简化版本
  const fetchStudyData = useCallback(async () => {
    try {
      setLoading(true)
      setPageError('')

      const currentUser = user || authUser
      if (!currentUser || !currentWordListId) {
        return
      }
      
      // 使用数据库函数获取学习单词
      const { data: studyWords, error } = await supabase
        .rpc('get_today_study_words', {
          p_user_id: currentUser.id,
          p_word_list_id: parseInt(currentWordListId),
          p_daily_goal: dailyGoal,
          p_sort_method: 'id'
        })

      if (error) {
        console.error('❌ 获取学习数据失败:', error)
        setPageError('获取学习数据失败: ' + error.message)
        return
      }

      // 处理没有单词的情况
      if (studyWords.length === 0) {
        setSessionComplete(true)
        setLoading(false)
        return
      }

      // 从本地存储恢复进度（如果有）
      const savedProgress = getProgressFromStorage(currentUser.id, currentWordListId)
      let startIndex = 0
      if (savedProgress && savedProgress.currentIndex > 0) {
        startIndex = Math.min(savedProgress.currentIndex, studyWords.length - 1)
      }

      setWords(studyWords)
      setCurrentIndex(startIndex)

      // 计算统计信息
      const learnedCount = studyWords.filter(word => word.study_record_id).length
      const reviewingCount = studyWords.filter(word => !word.study_record_id).length
      
      setStats({
        total: studyWords.length,
        learned: learnedCount,
        reviewing: reviewingCount
      })

      // 保存当前状态到本地存储
      if (startIndex > 0) {
        saveProgressToStorage(currentUser.id, currentWordListId, startIndex, studyWords)
      }

    } catch (error) {
      setPageError('获取学习数据失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [dailyGoal, user, authUser, currentWordListId, supabase])

  // 从本地存储获取进度
  const getProgressFromStorage = (userId, wordListId) => {
    if (typeof window === 'undefined') return null
    const storageKey = `study_progress_${userId}_${wordListId}`
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : null
  }

  // 保存进度到本地存储
  const saveProgressToStorage = (userId, wordListId, currentIndex, words) => {
    if (typeof window === 'undefined') return
    const storageKey = `study_progress_${userId}_${wordListId}`
    const progress = {
      currentIndex,
      words: words.map(word => ({
        id: word.id,
        word_list_word_id: word.word_list_word_id || word.id,
        study_record_id: word.study_record_id,
        familiarity: word.familiarity,
        review_count: word.review_count,
        ease_factor: word.ease_factor,
        interval_days: word.interval_days,
        last_studied_at: word.last_studied_at,
        next_review_at: word.next_review_at,
        needs_review: word.needs_review || false
      }))
    }
    localStorage.setItem(storageKey, JSON.stringify(progress))
  }

  // 清除本地存储进度
  const clearProgressFromStorage = (userId, wordListId) => {
    if (typeof window === 'undefined') return
    const storageKey = `study_progress_${userId}_${wordListId}`
    localStorage.removeItem(storageKey)
  }

  // 强制刷新整个页面
  const manualReloadPage = useCallback(() => {
    if (isReloading) {
      return
    }
    
    setIsReloading(true)
    
    // 添加一个小的延迟，确保状态已更新
    setTimeout(() => {
      window.location.reload()
    }, 100)
  }, [isReloading])

  // 页面可见性检测 - 强制刷新版本
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isReloading) {
        setIsReloading(true)
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isReloading])

  // 初始化效果 - 首次进入时强制刷新
  useEffect(() => {
    
    // 检查是否已经刷新过（防止无限循环）
    const hasRefreshed = sessionStorage.getItem('study_page_refreshed')
    
    if (!hasRefreshed) {
      sessionStorage.setItem('study_page_refreshed', 'true')
      manualReloadPage()
    } else {
      fetchStudyData()
    }
  }, [fetchStudyData, manualReloadPage])

  // 处理学习答案 - 简化版本
  const handleAnswer = async (familiarity) => {
    if (words.length === 0) {
      return
    }

    const currentWord = words[currentIndex]
    const currentUser = user || authUser

    try {
      // 如果是"忘记"（familiarity=1），重新加入学习队列
      if (familiarity === 1) {
        
        const updatedWords = [...words]
        updatedWords[currentIndex] = {
          ...currentWord,
          needs_review: true
        }
        
        // 将当前单词移到队列末尾
        const currentWordCopy = {...updatedWords[currentIndex]}
        updatedWords.splice(currentIndex, 1)
        updatedWords.push(currentWordCopy)
        
        setWords(updatedWords)
        saveProgressToStorage(currentUser.id, currentWordListId, currentIndex, updatedWords)
        
        return
      }

      // 使用数据库函数更新学习记录
      const { data, error } = await supabase
        .rpc('update_study_record', {
          p_user_id: currentUser.id,
          p_word_list_id: parseInt(currentWordListId),
          p_word_list_word_id: currentWord.id,
          p_familiarity: familiarity
        })

      if (error) {
        console.error('❌ 更新学习记录失败:', error)
        throw error
      }

      const result = data[0]
      if (!result.success) {
        throw new Error(result.message)
      }


      // 更新本地状态
      const updatedWords = [...words]
      updatedWords[currentIndex] = {
        ...currentWord,
        study_record_id: currentWord.study_record_id, // 保持原记录ID
        familiarity,
        last_studied_at: new Date().toISOString(),
        next_review_at: result.next_review_at,
        review_count: (currentWord.review_count || 0) + 1,
        ease_factor: result.new_ease_factor,
        interval_days: result.new_interval_days,
        needs_review: false
      }
      
      setWords(updatedWords)

      // 移动到下一个单词或结束会话
      const nextIndex = currentIndex + 1
      
      if (nextIndex < words.length) {
        setCurrentIndex(nextIndex)
        saveProgressToStorage(currentUser.id, currentWordListId, nextIndex, updatedWords)
      } else {
        setSessionComplete(true)
        clearProgressFromStorage(currentUser.id, currentWordListId)
      }
    } catch (error) {
      console.error('💥 保存学习记录失败:', error)
      setPageError('保存学习进度失败: ' + error.message)
    }
  }

  // 发音功能
  const playPronunciation = useCallback((word, type = 'us') => {
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === 'uk' ? 1 : 2}`
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放发音失败:', error)
    })
  }, [])

  // 暂停会话
  const pauseSession = useCallback(() => {
    const currentUser = user || authUser
    if (words.length > 0) {
      saveProgressToStorage(currentUser.id, currentWordListId, currentIndex, words)
    }
    router.push('/dashboard/study')
  }, [words, currentIndex, router, user, authUser, currentWordListId])

  // 重新开始会话
  const restartSession = useCallback(async () => {
    const currentUser = user || authUser
    clearProgressFromStorage(currentUser.id, currentWordListId)
    setCurrentIndex(0)
    setSessionComplete(false)
    setWords([])
    setLoading(true)
    await fetchStudyData()
  }, [fetchStudyData, user, authUser, currentWordListId])

  // 切换词库
  const changeWordList = useCallback(() => {
    const currentUser = user || authUser
    if (words.length > 0) {
      saveProgressToStorage(currentUser.id, currentWordListId, currentIndex, words)
    }
    router.push('/dashboard/study')
  }, [words, currentIndex, router, user, authUser, currentWordListId])

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-lg text-gray-600">加载学习内容中...</div>
          <button
            onClick={manualReloadPage}
            disabled={isReloading}
            className="mt-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm"
          >
            {isReloading ? '刷新中...' : '刷新页面'}
          </button>
        </div>
      </div>
    )
  }

  // 错误状态
  if (pageError && words.length === 0) {
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
              onClick={manualReloadPage}
              disabled={isReloading}
              className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-6 py-3 rounded-lg font-medium"
            >
              {isReloading ? '刷新中...' : '刷新页面'}
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

  // 没有单词的情况
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
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={manualReloadPage}
              disabled={isReloading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-medium"
            >
              {isReloading ? '刷新中...' : '刷新页面'}
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

  // 会话完成
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
              onClick={restartSession}
              className="bg-red-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              重新开始
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
                <button 
                  onClick={manualReloadPage} 
                  disabled={isReloading}
                  className="ml-2 text-red-700 underline disabled:text-red-400"
                >
                  {isReloading ? '刷新中...' : '刷新页面'}
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
              onClick={restartSession}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              重新开始
            </button>
            <button
              onClick={changeWordList}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              切换词库
            </button>
            <button
              onClick={manualReloadPage}
              disabled={isReloading}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              {isReloading ? '刷新中...' : '刷新页面'}
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
        onPlayPronunciation={playPronunciation}
      />

      {/* 学习提示 */}
      {/* <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">学习提示</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 每日学习目标: {dailyGoal} 个新单词</li>
        </ul>
      </div> */}
    </div>   
  )
}