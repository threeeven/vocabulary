// app/dashboard/study/[wordListId]/StudyClient.js
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import WordCard from '@/components/WordCard'
import { StudySession } from '@/lib/studySession'

export default function StudyClient({ 
  user,
  wordListId,
  initialUserSettings = { daily_goal: 10 },
  initialWordListInfo = null,
  initialStudyWords = [] // 服务端传递的学习数据
}) {
  const { user: authUser } = useAuth()
  const params = useParams()
  const router = useRouter()
  const currentWordListId = wordListId || params.wordListId
  const [words, setWords] = useState(initialStudyWords) // 直接使用服务端数据
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(!initialStudyWords.length) // 如果有数据就不加载
  const [stats, setStats] = useState({
    total: 0,
    learned: 0,
    reviewing: 0
  })
  const [sessionComplete, setSessionComplete] = useState(false)
  const [dailyGoal, setDailyGoal] = useState(initialUserSettings.daily_goal)
  const [wordListInfo, setWordListInfo] = useState(initialWordListInfo)
  const [pageError, setPageError] = useState('')
  const [isVisible, setIsVisible] = useState(true)
  const supabase = createClient()

  // StudySession 实例
  const [studySession, setStudySession] = useState(null)

  // 初始化 StudySession
  useEffect(() => {
    const currentUser = user || authUser
    if (currentUser && currentWordListId) {
      console.log('🔧 初始化 StudySession', {
        userId: currentUser.id,
        wordListId: currentWordListId
      })
      try {
        const session = new StudySession(currentUser.id, currentWordListId)
        setStudySession(session)
      } catch (error) {
        console.error('❌ StudySession 初始化失败:', error)
        setPageError('学习会话初始化失败: ' + error.message)
        setLoading(false)
      }
    }
  }, [user, authUser, currentWordListId])

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      console.log(`🔄 页面可见性变化: ${visible ? '可见' : '隐藏'}`)
      setIsVisible(visible)
      
      if (visible && studySession) {
        // 页面重新可见时，静默刷新数据
        console.log('🔍 页面重新可见，静默刷新数据...')
        fetchStudyWords(false).then(newWords => {
          if (newWords && newWords.length > 0) {
            console.log('✅ 静默刷新完成')
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [studySession])

  // 发音功能
  const playPronunciation = useCallback((word, type = 'us') => {
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === 'uk' ? 1 : 2}`
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放发音失败:', error)
    })
  }, [])

  // 认证检查
  useEffect(() => {
    const currentUser = user || authUser
    if (!currentUser) {
      console.log('用户未登录，重定向到首页')
      window.location.href = '/'
      return
    }

    // 如果有服务端数据，直接使用
    if (initialStudyWords.length > 0 && studySession) {
      console.log('✅ 使用服务端学习数据:', initialStudyWords.length)
      initializeWithServerData(initialStudyWords)
    } else if (studySession) {
      // 没有服务端数据时才从客户端获取
      console.log('🔄 服务端无数据，从客户端获取...')
      fetchStudyWords(false)
    }
  }, [user, authUser, studySession, initialStudyWords])

  // 使用服务端数据初始化
  const initializeWithServerData = useCallback(async (studyWords) => {
    if (studyWords.length === 0) {
      setSessionComplete(true)
      setLoading(false)
      return
    }

    // 计算统计信息
    const learnedCount = studyWords.filter(word => word.last_studied_at).length
    const reviewingCount = studyWords.filter(word => !word.last_studied_at).length
    
    setStats({
      total: studyWords.length,
      learned: learnedCount,
      reviewing: reviewingCount
    })

    // 恢复进度
    await restoreProgress(studyWords)
    setLoading(false)
  }, [])

  // 恢复进度
  const restoreProgress = useCallback(async (studyWords) => {
    if (!studySession || studyWords.length === 0) return
    
    try {
      const savedProgress = await studySession.getProgress()
      if (savedProgress && savedProgress.currentIndex > 0) {
        const startIndex = Math.min(savedProgress.currentIndex, studyWords.length - 1)
        setCurrentIndex(startIndex)
        console.log('📊 从进度恢复:', startIndex)
        
        // 保存当前状态
        await studySession.saveProgress(startIndex, studyWords)
      }
    } catch (error) {
      console.warn('恢复进度失败:', error)
    }
  }, [studySession])

  // 获取学习单词（主要用于刷新）
  const fetchStudyWords = useCallback(async (useCache = true) => {
    // 如果页面不可见，延迟执行
    if (!isVisible) {
      console.log('⏸️ 页面不可见，延迟数据获取')
      return words
    }

    // 如果已经有数据且使用缓存，直接返回
    if (useCache && words.length > 0) {
      return words
    }

    try {
      setLoading(true)
      const currentUser = user || authUser
      if (!currentUser || !studySession) {
        setPageError('用户未登录或会话初始化失败')
        setLoading(false)
        return words
      }

      console.log('🔄 客户端获取学习数据...')
      const studyWords = await studySession.getStudyWords(dailyGoal)
      
      // 只有在确实需要更新时才设置状态
      if (studyWords.length !== words.length || JSON.stringify(studyWords) !== JSON.stringify(words)) {
        setWords(studyWords)
        
        // 更新统计信息
        const learnedCount = studyWords.filter(word => word.last_studied_at).length
        const reviewingCount = studyWords.filter(word => !word.last_studied_at).length
        
        setStats({
          total: studyWords.length,
          learned: learnedCount,
          reviewing: reviewingCount
        })

        // 恢复进度
        await restoreProgress(studyWords)
      }
      
      return studyWords
    } catch (error) {
      console.error('❌ 客户端获取学习数据失败:', error)
      setPageError('获取学习数据失败: ' + error.message)
      // 保持现有数据，不抛出错误
      return words
    } finally {
      setLoading(false)
    }
  }, [user, authUser, studySession, dailyGoal, words, isVisible, restoreProgress])

  // 获取词库信息（备用）
  const fetchWordListInfo = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('word_lists')
        .select('*')
        .eq('id', currentWordListId)
        .single()

      if (error) {
        console.error('获取词库信息失败:', error)
        setPageError('词库不存在或已被删除')
        return
      }

      setWordListInfo(data)
    } catch (error) {
      console.error('获取词库信息失败:', error)
      setPageError('获取词库信息失败')
    }
  }, [supabase, currentWordListId])

  // 基于记忆科学和Anki算法的复习间隔计算
  const calculateNextReview = (familiarity, currentInterval = 1, easeFactor = 2.5, reviewCount = 0) => {
    let newInterval
    let newEaseFactor = easeFactor

    if (reviewCount === 0) {
      switch (familiarity) {
        case 1:
          newInterval = 1
          newEaseFactor = Math.max(1.3, easeFactor - 0.2)
          break
        case 2:
          newInterval = 1
          newEaseFactor = Math.max(1.3, easeFactor - 0.15)
          break
        case 3:
          newInterval = 3
          newEaseFactor = easeFactor
          break
        case 4:
          newInterval = 7
          newEaseFactor = easeFactor + 0.1
          break
        default:
          newInterval = 1
          newEaseFactor = 2.5
      }
    } else {
      switch (familiarity) {
        case 1:
          newInterval = 1
          newEaseFactor = Math.max(1.3, easeFactor - 0.2)
          break
        case 2:
          newInterval = Math.max(1, Math.round(currentInterval * 1.2))
          newEaseFactor = Math.max(1.3, easeFactor - 0.15)
          break
        case 3:
          newInterval = Math.round(currentInterval * easeFactor)
          newEaseFactor = easeFactor
          break
        case 4:
          newInterval = Math.round(currentInterval * easeFactor * 1.3)
          newEaseFactor = easeFactor + 0.1
          break
        default:
          newInterval = 1
          newEaseFactor = 2.5
      }
    }

    newInterval = Math.max(1, Math.min(newInterval, 365))

    const nextReviewDate = new Date()
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval)

    return {
      interval: newInterval,
      easeFactor: parseFloat(newEaseFactor.toFixed(2)),
      nextReviewAt: nextReviewDate.toISOString()
    }
  }

  // 处理答案
  const handleAnswer = async (familiarity) => {
    if (words.length === 0) return

    const currentWord = words[currentIndex]
    const now = new Date().toISOString()

    try {
      let studyRecordId = currentWord.study_record_id || null
      let isNewRecord = false
      let reviewData

      console.log('处理学习记录:', { 
        studyRecordId, 
        wordId: currentWord.id,
        word: currentWord.word,
        reviewCount: currentWord.review_count || 0
      })

      // 计算复习数据
      reviewData = calculateNextReview(
        familiarity,
        currentWord.interval_days || 1,
        currentWord.ease_factor || 2.5,
        currentWord.review_count || 0
      )

      // 如果是"忘记"（familiarity=1），不立即保存到数据库，而是重新加入学习队列
      if (familiarity === 1) {
        console.log('用户选择"忘记"，单词将重新加入学习队列')
        
        // 更新本地状态，但不保存到数据库
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
        
        // 保持当前索引不变（因为移除了当前单词，下一个单词会自动补位）
        await studySession.saveProgress(currentIndex, updatedWords)
        
        return
      }

      // 对于非"忘记"的情况，正常保存学习记录
      if (!studyRecordId) {
        // 创建新学习记录
        const { data: newRecord, error: createError } = await supabase
          .from('study_records')
          .upsert({
            user_id: user?.id || authUser?.id,
            word_list_id: parseInt(currentWordListId),
            word_list_word_id: currentWord.id,
            familiarity: familiarity,
            review_count: 1,
            ease_factor: reviewData.easeFactor,
            interval_days: reviewData.interval,
            last_studied_at: now,
            next_review_at: reviewData.nextReviewAt
          }, {
            onConflict: 'user_id,word_list_id,word_list_word_id',
            ignoreDuplicates: false
          })
          .select()
          .single()

        if (createError) {
          console.error('创建学习记录失败:', createError)
          throw createError
        }

        studyRecordId = newRecord.id
        isNewRecord = true
        console.log('创建新学习记录成功:', newRecord)
      } else {
        // 更新学习记录
        const { data: updatedRecord, error: updateError } = await supabase
          .from('study_records')
          .update({
            familiarity: familiarity,
            last_studied_at: now,
            next_review_at: reviewData.nextReviewAt,
            review_count: (currentWord.review_count || 0) + 1,
            ease_factor: reviewData.easeFactor,
            interval_days: reviewData.interval
          })
          .eq('id', studyRecordId)
          .select()
          .single()

        if (updateError) {
          console.error('更新学习记录失败:', updateError)
          throw updateError
        }
        
        console.log('更新学习记录成功:', updatedRecord)
      }

      // 更新本地状态
      const updatedWords = [...words]
      updatedWords[currentIndex] = {
        ...currentWord,
        study_record_id: studyRecordId,
        familiarity,
        last_studied_at: now,
        next_review_at: reviewData.nextReviewAt,
        review_count: (currentWord.review_count || 0) + 1,
        ease_factor: reviewData.easeFactor,
        interval_days: reviewData.interval,
        needs_review: false
      }
      setWords(updatedWords)

      // 更新统计信息
      const learnedCount = updatedWords.filter(word => word.last_studied_at).length
      const reviewingCount = updatedWords.filter(word => !word.last_studied_at).length
      setStats({
        total: updatedWords.length,
        learned: learnedCount,
        reviewing: reviewingCount
      })

      // 移动到下一个单词或结束会话
      const nextIndex = currentIndex + 1
      if (nextIndex < updatedWords.length) {
        setCurrentIndex(nextIndex)
        await studySession.saveProgress(nextIndex, updatedWords)
      } else {
        setSessionComplete(true)
        await studySession.clearProgress()
      }
    } catch (error) {
      console.error('保存学习记录失败:', error)
      setPageError('保存学习进度失败: ' + error.message)
    }
  }

  // 暂停会话
  const pauseSession = useCallback(() => {
    if (studySession && words.length > 0) {
      studySession.saveProgress(currentIndex, words)
      console.log('学习已暂停，进度已保存')
    }
    router.push('/dashboard/study')
  }, [studySession, words, currentIndex, router])

  // 重新开始会话
  const restartSession = useCallback(async () => {
    if (studySession) {
      await studySession.clearProgress()
    }
    setCurrentIndex(0)
    setSessionComplete(false)
    setWords([])
    setLoading(true)
    await fetchStudyWords(false)
  }, [studySession, fetchStudyWords])

  // 切换词库
  const changeWordList = useCallback(() => {
    if (studySession && words.length > 0) {
      studySession.saveProgress(currentIndex, words)
    }
    router.push('/dashboard/study')
  }, [studySession, words, currentIndex, router])

  // 强制重置学习进度
  const forceResetProgress = useCallback(async () => {
    if (!confirm('确定要重置这个词库的所有学习进度吗？这将删除所有学习记录。')) {
      return
    }

    try {
      const currentUser = user || authUser
      const { error } = await supabase
        .from('study_records')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('word_list_id', currentWordListId)

      if (error) throw error

      if (studySession) {
        await studySession.clearProgress()
      }
      alert('重置成功！现在可以重新学习这个词库了。')
      restartSession()
    } catch (error) {
      console.error('重置学习进度失败:', error)
      alert('重置失败，请重试')
    }
  }, [user, authUser, supabase, currentWordListId, studySession, restartSession])

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-lg text-gray-600">加载学习内容中...</div>
          <div className="text-sm text-gray-500 mt-2">
            {!isVisible && '页面在后台运行，恢复后继续加载...'}
          </div>
          <button
            onClick={() => fetchStudyWords(false)}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            重新加载
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
              onClick={() => fetchStudyWords(false)}
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

  // 学习完成状态
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
                <button onClick={() => fetchStudyWords(false)} className="ml-2 text-red-700 underline">
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