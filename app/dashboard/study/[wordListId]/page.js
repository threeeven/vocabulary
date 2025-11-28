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
  const [pageError, setPageError] = useState('')
  const supabase = createClient()

  // 初始化学习会话
  const [studySession] = useState(new StudySession(user?.id, wordListId))

  // 发音功能
  const playPronunciation = (word, type = 'us') => {
    // 有道发音API
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === 'uk' ? 1 : 2}`
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放发音失败:', error)
    })
  }

  useEffect(() => {
    if (user && wordListId) {
      fetchUserSettings()
      fetchWordListInfo()
      fetchStudyWords()
      debugStudyRecords() // 添加调试查询
    }
  }, [user, wordListId])

  // 在学习页面中添加调试函数
  const debugStudyRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('study_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('word_list_id', wordListId)
      
      if (error) {
        console.error('查询学习记录失败:', error)
      } else {
        console.log('当前用户的学习记录:', data)
      }
    } catch (error) {
      console.error('调试查询失败:', error)
    }
  }

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
  

// 修改 fetchStudyWords 函数，确保使用最新的 dailyGoal
  const fetchStudyWords = async () => {
    try {
      setLoading(true)
      setPageError('')

      // 检查用户是否选择了这个词库
      const { data: userWordList, error: checkError } = await supabase
        .from('user_word_lists')
        .select('*')
        .eq('user_id', user.id)
        .eq('word_list_id', wordListId)
        .eq('is_active', true)
        .single()

      if (checkError || !userWordList) {
        setPageError('您还没有选择这个词库，请先选择词库')
        return
      }

      // 直接调用 StudySession 的 getStudyWords 方法，传入最新的 dailyGoal
      const studyWords = await studySession.getStudyWords(dailyGoal)
      
      console.log('获取学习单词，目标:', dailyGoal, '实际获取:', studyWords.length)

      // 检查是否有保存的进度
      const savedProgress = studySession.getProgress()
      console.log('恢复的进度:', savedProgress)
      
      if (savedProgress && savedProgress.words) {
        // 有保存的进度，恢复进度
        console.log('恢复保存的学习进度')
        
        // 确保我们只恢复当前词库的单词
        const restoredWords = savedProgress.words.map(savedWord => {
          // 在当前的studyWords中查找对应的单词
          const currentWord = studyWords.find(w => 
            w.id === savedWord.id || 
            w.word_list_word_id === savedWord.word_list_word_id
          )
          
          if (currentWord) {
            // 合并保存的进度和当前单词信息
            return {
              ...currentWord,
              study_record_id: savedWord.study_record_id,
              familiarity: savedWord.familiarity,
              review_count: savedWord.review_count,
              ease_factor: savedWord.ease_factor,
              interval_days: savedWord.interval_days,
              last_studied_at: savedWord.last_studied_at,
              next_review_at: savedWord.next_review_at,
              needs_review: savedWord.needs_review || false
            }
          }
          return currentWord
        }).filter(Boolean) // 过滤掉未找到的单词
        
        console.log('恢复后的单词:', restoredWords)
        
        if (restoredWords.length > 0) {
          setWords(restoredWords)
          setCurrentIndex(savedProgress.currentIndex)
          
          setStats({
            total: restoredWords.length,
            learned: restoredWords.filter(word => word.last_studied_at).length,
            reviewing: restoredWords.filter(word => !word.last_studied_at).length
          })
          
          setLoading(false)
          return
        }
      }

      // 没有保存的进度或恢复失败，使用新的学习单词
      if (studyWords.length === 0) {
        setSessionComplete(true)
        setLoading(false)
        return
      }

      setWords(studyWords)
      setCurrentIndex(0)

      setStats({
        total: studyWords.length,
        learned: studyWords.filter(word => word.last_studied_at).length,
        reviewing: studyWords.filter(word => !word.last_studied_at).length
      })

    } catch (error) {
      console.error('获取学习单词失败:', error)
      setPageError('获取学习单词失败: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

// 修改 useEffect，确保在 dailyGoal 变化时重新获取学习单词
useEffect(() => {
  if (user && wordListId) {
    fetchWordListInfo()
    fetchStudyWords()
  }
}, [user, wordListId])

// 添加 dailyGoal 作为依赖，当每日目标变化时重新获取学习单词
useEffect(() => {
  if (user && wordListId && words.length === 0) {
    // 只有在没有学习单词时才重新获取
    fetchStudyWords()
  }
}, [dailyGoal])

  // 基于记忆科学和Anki算法的复习间隔计算
  const calculateNextReview = (familiarity, currentInterval = 1, easeFactor = 2.5, reviewCount = 0) => {
    let newInterval
    let newEaseFactor = easeFactor

    // 对于新单词（reviewCount = 0）的特殊处理
    if (reviewCount === 0) {
      switch (familiarity) {
        case 1: // 忘记 - 立即重新学习（在当前会话中）
          newInterval = 1 // 1天后复习（如果用户完成当前会话）
          newEaseFactor = Math.max(1.3, easeFactor - 0.2)
          break
        case 2: // 困难 - 短间隔
          newInterval = 1 // 1天后复习
          newEaseFactor = Math.max(1.3, easeFactor - 0.15)
          break
        case 3: // 一般 - 中等间隔
          newInterval = 3 // 3天后复习
          newEaseFactor = easeFactor
          break
        case 4: // 简单 - 长间隔
          newInterval = 7 // 7天后复习
          newEaseFactor = easeFactor + 0.1
          break
        default:
          newInterval = 1
          newEaseFactor = 2.5
      }
    } else {
      // 对于已学习单词的标准Anki算法
      switch (familiarity) {
        case 1: // 忘记 - 重置学习进度
          newInterval = 1 // 重置为1天
          newEaseFactor = Math.max(1.3, easeFactor - 0.2)
          break
        case 2: // 困难
          newInterval = Math.max(1, Math.round(currentInterval * 1.2))
          newEaseFactor = Math.max(1.3, easeFactor - 0.15)
          break
        case 3: // 一般
          newInterval = Math.round(currentInterval * easeFactor)
          newEaseFactor = easeFactor
          break
        case 4: // 简单
          newInterval = Math.round(currentInterval * easeFactor * 1.3)
          newEaseFactor = easeFactor + 0.1
          break
        default:
          newInterval = 1
          newEaseFactor = 2.5
      }
    }

    // 限制最小间隔为1天，最大间隔为365天
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
      let studyRecordId = currentWord.study_record_id
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
        studySession.saveProgress(currentIndex, updatedWords)
        
        return // 提前返回，不进行数据库操作
      }

      // 对于非"忘记"的情况，正常保存学习记录
      if (!studyRecordId) {
        // 这是一个新单词，还没有学习记录，需要创建
        const { data: newRecord, error: createError } = await supabase
          .from('study_records')
          .upsert({
            user_id: user.id,
            word_list_id: parseInt(wordListId),
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
        needs_review: false // 清除重新学习标记
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
      console.error('保存学习记录失败:', error)
      setPageError('保存学习进度失败: ' + error.message)
    }
  }

  // 修改暂停会话函数
  const pauseSession = () => {
    // 保存当前进度
    studySession.saveProgress(currentIndex, words)
    console.log('学习已暂停，进度已保存')
    router.push('/dashboard/study')
  }

  // 修改继续学习函数（在词库列表页面添加继续学习按钮）
  // 在词库列表页面，如果有保存的进度，显示继续学习按钮

  // 添加重新开始会话函数
  const restartSession = () => {
    // 清除进度并重新开始
    studySession.clearProgress()
    setCurrentIndex(0)
    setSessionComplete(false)
    setWords([]) // 清空当前单词，强制重新获取
    fetchStudyWords()
  }

  // 修改继续学习逻辑，确保能够正确恢复
  const continueSession = () => {
    // 直接调用 fetchStudyWords，它会自动检测并恢复进度
    fetchStudyWords()
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
        .delete()
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

  // ... 渲染部分保持不变，但WordCard组件需要更新 ...
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