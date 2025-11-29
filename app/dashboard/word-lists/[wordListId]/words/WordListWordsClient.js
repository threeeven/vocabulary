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
  initialWordListInfo = null
}) {
  const { user: authUser } = useAuth()
  const params = useParams()
  const router = useRouter()
  const currentWordListId = wordListId || params.wordListId
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
  const [isVisible, setIsVisible] = useState(true)
  const supabase = createClient()

  // 修复：确保 studySession 正确初始化
  const [studySession, setStudySession] = useState(null)

  // 页面可见性检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      console.log(`🔄 页面可见性变化: ${visible ? '可见' : '隐藏'}`)
      setIsVisible(visible)
      
      if (visible && studySession) {
        // 页面重新可见时，检查连接并刷新数据
        checkConnectionAndRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [studySession])

  // 检查连接并刷新
  const checkConnectionAndRefresh = useCallback(async () => {
    if (!studySession) return
    
    try {
      console.log('🔍 检查连接状态...')
      const isConnected = await studySession.checkConnection()
      
      if (isConnected) {
        console.log('✅ 连接正常')
        // 可以在这里触发数据刷新，或者依赖现有的缓存机制
      } else {
        console.warn('⚠️ 连接异常，使用缓存数据')
      }
    } catch (error) {
      console.warn('⚠️ 连接检查失败:', error.message)
    }
  }, [studySession])

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

    // 如果已经有基础数据和 studySession，开始获取学习数据
    if (initialWordListInfo && studySession) {
      fetchStudyWords()
    } else if (studySession) {
      // 如果没有基础数据，先获取词库信息
      fetchWordListInfo()
    }
  }, [user, authUser, initialWordListInfo, studySession])

  // 获取词库信息
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
      // 获取词库信息后开始获取学习数据
      fetchStudyWords()
    } catch (error) {
      console.error('获取词库信息失败:', error)
      setPageError('获取词库信息失败')
      setLoading(false)
    }
  }, [supabase, currentWordListId])

  // 获取学习单词 - 优化版本
  const fetchStudyWords = useCallback(async () => {
    // 如果页面不可见，延迟执行或使用缓存
    if (!isVisible) {
      console.log('⏸️ 页面不可见，延迟数据获取')
      return
    }
    
    try {
      setLoading(true)
      setPageError('')

      const currentUser = user || authUser
      if (!currentUser || !studySession) {
        setPageError('用户未登录或会话初始化失败')
        setLoading(false)
        return
      }

      console.log('🔍 开始获取学习单词...')
      
      const [studyWords, savedProgress] = await Promise.all([
        studySession.getStudyWords(dailyGoal),
        studySession.getProgress()
      ])

      console.log('✅ 获取学习单词完成:', studyWords.length)
      console.log('📊 恢复的进度:', savedProgress)

      // 处理没有单词的情况
      if (studyWords.length === 0) {
        setSessionComplete(true)
        setLoading(false)
        return
      }

      // 计算开始索引
      let startIndex = 0
      if (savedProgress && savedProgress.currentIndex > 0) {
        startIndex = Math.min(savedProgress.currentIndex, studyWords.length - 1)
        console.log('📈 从进度恢复学习位置:', startIndex)
      }

      setWords(studyWords)
      setCurrentIndex(startIndex)

      // 计算统计信息
      const learnedCount = studyWords.filter(word => word.last_studied_at).length
      const reviewingCount = studyWords.filter(word => !word.last_studied_at).length
      
      setStats({
        total: studyWords.length,
        learned: learnedCount,
        reviewing: reviewingCount
      })

      // 如果有进度，保存当前状态
      if (startIndex > 0) {
        await studySession.saveProgress(startIndex, studyWords)
      }

    } catch (error) {
      console.error('❌ 获取学习单词失败:', error)
      setPageError('获取学习单词失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }, [user, authUser, studySession, dailyGoal, isVisible])

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

  const handleAnswer = async (familiarity) => {
    if (words.length === 0) return

    const currentWord = words[currentIndex]
    const now = new Date().toISOString()

    try {
        // 先定义变量，确保不会出现未定义错误
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
            // 不更新学习记录ID，保持原有状态
            // 不更新熟悉度，保持原样
            // 只标记为需要重新学习
            needs_review: true
        }
        
        // 将当前单词移到队列末尾
        const currentWordCopy = {...updatedWords[currentIndex]}
        updatedWords.splice(currentIndex, 1) // 移除当前位置的单词
        updatedWords.push(currentWordCopy) // 添加到队列末尾
        
        setWords(updatedWords)
        
        // 保持当前索引不变（因为移除了当前单词，下一个单词会自动补位）
        // 不需要保存进度到数据库
        await studySession.saveProgress(currentIndex, updatedWords)
        
        return // 提前返回，不进行数据库操作
        }

        // 对于非"忘记"的情况，正常保存学习记录
        if (!studyRecordId) {
        // 这是一个新单词，还没有学习记录，需要创建
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
        // 更新学习记录（如果是已存在的记录）
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

        // 移动到下一个单词或结束会话
        const nextIndex = currentIndex + 1
        if (nextIndex < words.length) {
        setCurrentIndex(nextIndex)
        // 保存进度到数据库和本地
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
    await fetchStudyWords()
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
        studySession.clearAllCache()
      }
      alert('重置成功！现在可以重新学习这个词库了。')
      restartSession()
    } catch (error) {
      console.error('重置学习进度失败:', error)
      alert('重置失败，请重试')
    }
  }, [user, authUser, supabase, currentWordListId, studySession, restartSession])

  // 手动刷新数据
  const manualRefresh = useCallback(async () => {
    if (studySession) {
      studySession.clearAllCache()
    }
    await fetchStudyWords()
  }, [studySession, fetchStudyWords])

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
          {/* 添加重试按钮 */}
          <button
            onClick={manualRefresh}
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
              onClick={manualRefresh}
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
                <button onClick={manualRefresh} className="ml-2 text-red-700 underline">
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
          <li>• 页面切换时数据会自动缓存，恢复后快速加载</li>
        </ul>
      </div>
    </div>
  )
}