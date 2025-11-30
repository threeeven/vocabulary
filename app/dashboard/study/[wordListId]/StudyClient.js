// app/dashboard/study/[wordListId]/StudyClient.js
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
  const supabase = createClient()

  // 使用 useRef 来持久化
  const studySessionRef = useRef(null)
  const isMountedRef = useRef(false)

  // 简单的初始化函数
  const initializeStudySession = useCallback(() => {
    const currentUser = user || authUser
    if (!currentUser || !currentWordListId) {
      console.log('⏳ 等待用户信息或词库ID...')
      return
    }

    console.log('🔧 开始初始化 StudySession', {
      userId: currentUser.id,
      wordListId: currentWordListId
    })

    try {
      const session = StudySession.getInstance(currentUser.id, currentWordListId)
      studySessionRef.current = session
      console.log('✅ StudySession 初始化成功')
    } catch (error) {
      console.error('❌ StudySession 初始化失败:', error)
      setPageError('学习会话初始化失败: ' + error.message)
      setLoading(false)
    }
  }, [user, authUser, currentWordListId])

  // 获取学习数据
  const fetchStudyData = useCallback(async () => {
    if (!studySessionRef.current) {
      console.log('⏳ 等待 StudySession 初始化...')
      return
    }

    try {
      setLoading(true)
      setPageError('')

      console.log('🔍 开始获取学习数据...')
      
      const [studyWords, savedProgress] = await Promise.all([
        studySessionRef.current.getStudyWords(dailyGoal),
        studySessionRef.current.getProgress()
      ])

      console.log('✅ 获取学习数据完成:', {
        wordsCount: studyWords.length,
        hasProgress: !!savedProgress
      })

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
        await studySessionRef.current.saveProgress(startIndex, studyWords)
      }

    } catch (error) {
      console.error('❌ 获取学习数据失败:', error)
      setPageError('获取学习数据失败: ' + error.message)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [dailyGoal])

  // 页面可见性检测 - 强制刷新版本
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible'
      console.log(`🔄 页面可见性变化: ${visible ? '可见' : '隐藏'}`)
      
      if (visible) {
        // 页面从隐藏变为可见，强制刷新整个页面
        console.log('🔄 页面恢复可见，强制刷新整个页面')
        window.location.reload()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

    // 在组件内部添加日期检查
  const [todayDate, setTodayDate] = useState('')

  // 获取今天日期（北京时间）
  const getTodayBeijingDate = useCallback(() => {
    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingTime = new Date(now.getTime() + beijingOffset)
    return beijingTime.toISOString().split('T')[0]
  }, [])

  // 检查是否是新的学习日
  const checkNewDay = useCallback(() => {
    const currentDate = getTodayBeijingDate()
    const lastStudyDate = localStorage.getItem('last_study_date')
    
    console.log('📅 日期检查:', {
      当前日期: currentDate,
      上次学习日期: lastStudyDate,
      是否新的一天: currentDate !== lastStudyDate
    })
    
    if (currentDate !== lastStudyDate) {
      // 新的一天，清除昨天的进度
      console.log('🎉 新的一天开始，清除昨日进度')
      localStorage.setItem('last_study_date', currentDate)
      setTodayDate(currentDate)
      
      // 清除学习进度
      if (studySessionRef.current) {
        studySessionRef.current.clearProgress()
      }
      
      return true
    }
    
    setTodayDate(currentDate)
    return false
  }, [getTodayBeijingDate])

  // 修改主初始化效果
  useEffect(() => {
    isMountedRef.current = true
    console.log('🏁 组件挂载')

    // 检查是否是新的学习日
    const isNewDay = checkNewDay()
    
    if (isNewDay) {
      console.log('🔄 新的一天，重新初始化')
      // 新的一天，强制重新初始化
      setTimeout(() => {
        if (isMountedRef.current) {
          initializeStudySession()
        }
      }, 100)
    } else {
      // 同一天，正常初始化
      initializeStudySession()
    }

    return () => {
      console.log('🧹 组件卸载')
      isMountedRef.current = false
    }
  }, [initializeStudySession, checkNewDay])

  // 当 StudySession 初始化完成后获取数据
  useEffect(() => {
    if (studySessionRef.current && isMountedRef.current) {
      fetchStudyData()
    }
  }, [studySessionRef.current, fetchStudyData])

  // 基于记忆科学和Anki算法的复习间隔计算
  const calculateNextReview = useCallback((familiarity, currentInterval = 1, easeFactor = 2.5, reviewCount = 0) => {
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
  }, [])

  const handleAnswer = async (familiarity) => {
    if (words.length === 0 || !studySessionRef.current) {
      console.error('❌ 无法处理答案: 单词列表为空或StudySession未初始化')
      return
    }

    const currentWord = words[currentIndex]
    const now = new Date().toISOString()

    console.log('🎯 处理学习记录:', { 
      studyRecordId: currentWord.study_record_id, 
      wordId: currentWord.id,
      word: currentWord.word,
      familiarity,
      reviewCount: currentWord.review_count || 0
    })

    try {
      let studyRecordId = currentWord.study_record_id || null
      let reviewData

      // 计算复习数据
      reviewData = calculateNextReview(
        familiarity,
        currentWord.interval_days || 1,
        currentWord.ease_factor || 2.5,
        currentWord.review_count || 0
      )

      console.log('📊 计算的复习数据:', reviewData)

      // 如果是"忘记"（familiarity=1），重新加入学习队列
      if (familiarity === 1) {
        console.log('❌ 用户选择"忘记"，单词将重新加入学习队列')
        
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
        await studySessionRef.current.saveProgress(currentIndex, updatedWords)
        
        console.log('✅ 单词已重新加入队列')
        return
      }

      // 对于非"忘记"的情况，正常保存学习记录
      const currentUser = user || authUser
      if (!studyRecordId) {
        console.log('🆕 创建新学习记录...')
        const { data: newRecord, error: createError } = await supabase
          .from('study_records')
          .upsert({
            user_id: currentUser?.id,
            word_list_id: parseInt(currentWordListId),
            word_list_word_id: currentWord.id,
            familiarity: familiarity,
            review_count: 1,
            ease_factor: reviewData.easeFactor,
            interval_days: reviewData.interval,
            last_studied_at: now,
            next_review_at: reviewData.nextReviewAt
          }, {
            onConflict: 'user_id,word_list_id,word_list_word_id'
          })
          .select()
          .single()

        if (createError) {
          console.error('❌ 创建学习记录失败:', createError)
          throw createError
        }

        studyRecordId = newRecord.id
        console.log('✅ 创建新学习记录成功:', newRecord)
      } else {
        console.log('📝 更新学习记录...')
        const { error: updateError } = await supabase
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

        if (updateError) {
          console.error('❌ 更新学习记录失败:', updateError)
          throw updateError
        }
        console.log('✅ 更新学习记录成功')
      }

      // 更新本地状态
      console.log('🔄 更新本地状态...')
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
      console.log('✅ 本地状态更新完成')

      // 移动到下一个单词或结束会话
      const nextIndex = currentIndex + 1
      console.log(`➡️ 准备移动到下一个单词: ${nextIndex}/${words.length}`)
      
      if (nextIndex < words.length) {
        setCurrentIndex(nextIndex)
        await studySessionRef.current.saveProgress(nextIndex, updatedWords)
        console.log('✅ 已移动到下一个单词')
      } else {
        console.log('🎉 学习会话完成')
        setSessionComplete(true)
        await studySessionRef.current.clearProgress()
      }
    } catch (error) {
      console.error('💥 保存学习记录失败:', error)
      setPageError('保存学习进度失败: ' + error.message)
      
      // 显示更详细的错误信息
      if (error.code) {
        setPageError(`保存学习进度失败: ${error.message} (错误代码: ${error.code})`)
      }
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
    if (studySessionRef.current && words.length > 0) {
      studySessionRef.current.saveProgress(currentIndex, words)
      console.log('学习已暂停，进度已保存')
    }
    router.push('/dashboard/study')
  }, [words, currentIndex, router])

  // 重新开始会话
  const restartSession = useCallback(async () => {
    if (studySessionRef.current) {
      await studySessionRef.current.clearProgress()
    }
    setCurrentIndex(0)
    setSessionComplete(false)
    setWords([])
    setLoading(true)
    await fetchStudyData()
  }, [fetchStudyData])

  // 切换词库
  const changeWordList = useCallback(() => {
    if (studySessionRef.current && words.length > 0) {
      studySessionRef.current.saveProgress(currentIndex, words)
    }
    router.push('/dashboard/study')
  }, [words, currentIndex, router])

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

      if (studySessionRef.current) {
        await studySessionRef.current.clearProgress()
        studySessionRef.current.clearAllCache()
        StudySession.clearInstance(currentUser.id, currentWordListId)
      }
      
      alert('重置成功！现在可以重新学习这个词库了。')
      restartSession()
    } catch (error) {
      console.error('重置学习进度失败:', error)
      alert('重置失败，请重试')
    }
  }, [user, authUser, supabase, currentWordListId, restartSession])

  // 手动刷新整个页面
  const manualReloadPage = useCallback(() => {
    console.log('🔄 手动刷新整个页面')
    window.location.reload()
  }, [])

  // 加载状态
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <div className="text-lg text-gray-600">加载学习内容中...</div>
          <div className="text-sm text-gray-500 mt-2">
            如果长时间未加载，请尝试刷新页面
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={manualReloadPage}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              刷新整个页面
            </button>
          </div>
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
              重新加载数据
            </button>
            <button
              onClick={manualReloadPage}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              刷新整个页面
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
      {/* 调试信息 - 只在开发环境显示 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs">
          <div className="font-medium text-yellow-800 mb-2">调试信息:</div>
          <div className="text-yellow-700 space-y-1">
            <div>当前日期: {todayDate}</div>
            <div>当前单词: {currentWord?.word} (ID: {currentWord?.id})</div>
            <div>学习记录ID: {currentWord?.study_record_id || 'null'}</div>
            <div>复习次数: {currentWord?.review_count || 0}</div>
            <div>熟悉度: {currentWord?.familiarity || 0}</div>
            <div>用户ID: {user?.id || authUser?.id}</div>
            <div>词库ID: {currentWordListId}</div>
          </div>
        </div>
      )}

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
            <button
              onClick={manualReloadPage}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium text-sm"
            >
              刷新页面
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
          <li>• 每天从0开始新的学习进度</li>
          <li>• 包含今天及之前所有需要复习的单词</li>
          <li>• 每日学习目标: {dailyGoal} 个新单词</li>
          <li>• 页面切换时会自动刷新，确保数据最新</li>
          <li>• 遇到问题时可以手动刷新页面</li>
        </ul>
      </div>
    </div>
  )
}