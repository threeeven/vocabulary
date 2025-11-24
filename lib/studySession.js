// lib/studySession.js
import { createClient } from '@/lib/supabase/client'

export class StudySession {
  constructor(userId, wordListId) {
    this.userId = userId
    this.wordListId = wordListId
    this.supabase = createClient()
    this.sessionKey = `study_session_${userId}_${wordListId}`
  }

  // 保存当前学习进度
  async saveProgress(currentIndex, words) {
    if (typeof window === 'undefined') return
    
    const sessionData = {
      currentIndex,
      wordIds: words.map(word => word.id || word.word_list_word_id), // 使用 word_list_word_id 作为备用
      timestamp: Date.now()
    }
    
    localStorage.setItem(this.sessionKey, JSON.stringify(sessionData))
  }

  // 获取保存的学习进度
  getProgress() {
    if (typeof window === 'undefined') return null
    
    const saved = localStorage.getItem(this.sessionKey)
    if (!saved) return null
    
    const data = JSON.parse(saved)
    // 检查会话是否过期（24小时）
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      this.clearProgress()
      return null
    }
    
    return data
  }

  // 清除学习进度
  clearProgress() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.sessionKey)
  }

  // 获取需要学习的单词（包含进度恢复）
  async getStudyWords(dailyGoal = 10) {
    const today = new Date().toISOString().split('T')[0]
    const savedProgress = this.getProgress()

    try {
      console.log('获取需要复习的单词...')
      // 获取需要复习的单词（已经学习过的）
      const { data: reviewWords, error: reviewError } = await this.supabase
        .from('study_records')
        .select('*')
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .lte('next_review_at', today)

      if (reviewError) {
        console.error('获取复习单词失败:', reviewError)
        return []
      }

      console.log('复习单词数量:', reviewWords?.length || 0)

      // 获取新单词 - 直接从词库中获取用户尚未学习过的单词
      const { data: newWords, error: newError } = await this.supabase
        .from('word_list_words')
        .select(`
          *,
          study_records!left(
            id,
            user_id
          )
        `)
        .eq('word_list_id', this.wordListId)
        .is('study_records.user_id', null) // 只获取没有学习记录的单词
        .limit(dailyGoal)

      if (newError) {
        console.error('获取新单词失败:', newError)
        return reviewWords || []
      }

      console.log('新单词数量:', newWords?.length || 0)

      // 转换新单词格式以匹配学习记录格式
      const formattedNewWords = newWords.map(word => ({
        word_list_word_id: word.id,
        word: word.word,
        definition: word.definition,
        pronunciation: word.pronunciation,
        familiarity: 0,
        review_count: 0,
        ease_factor: 2.5,
        interval_days: 1,
        last_studied_at: null,
        next_review_at: null,
        is_new: true // 标记为新单词
      }))

      // 合并单词，复习单词优先
      let allWords = [...(reviewWords || []), ...(formattedNewWords || [])]

      console.log('总学习单词数量:', allWords.length)

      // 如果有保存的进度，恢复进度
      if (savedProgress && savedProgress.wordIds && allWords.length > 0) {
        // 按照保存的顺序重新排列单词
        const wordMap = new Map()
        allWords.forEach(word => {
          const key = word.id || word.word_list_word_id
          wordMap.set(key, word)
        })
        
        const reorderedWords = savedProgress.wordIds
          .map(id => wordMap.get(id))
          .filter(word => word) // 移除可能已被删除的单词
        
        if (reorderedWords.length > 0) {
          allWords = reorderedWords
          console.log('恢复学习进度，单词顺序已调整')
        }
      }

      return allWords
    } catch (error) {
      console.error('获取学习单词失败:', error)
      return []
    }
  }

  // 检查词库中是否有学习任务
  async hasStudyTasks(dailyGoal = 10) {
    const today = new Date().toISOString().split('T')[0]
    
    try {
      // 检查是否有需要复习的单词
      const { count: reviewCount, error: reviewError } = await this.supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .lte('next_review_at', today)

      if (reviewError) {
        console.error('检查复习单词失败:', reviewError)
        return false
      }

      // 检查是否有新单词
      const { count: newCount, error: newError } = await this.supabase
        .from('word_list_words')
        .select('*', { count: 'exact', head: true })
        .eq('word_list_id', this.wordListId)
        .not('id', 'in', 
          this.supabase
            .from('study_records')
            .select('word_list_word_id')
            .eq('user_id', this.userId)
            .eq('word_list_id', this.wordListId)
        )

      if (newError) {
        console.error('检查新单词失败:', newError)
        return (reviewCount || 0) > 0
      }

      return (reviewCount || 0) + (newCount || 0) > 0
    } catch (error) {
      console.error('检查学习任务失败:', error)
      return false
    }
  }
}