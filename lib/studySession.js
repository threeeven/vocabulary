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
      wordIds: words.map(word => word.id),
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
    const savedProgress = this.getProgress() // 现在这个方法存在了

    try {
      // 获取需要复习的单词
      const { data: reviewWords, error: reviewError } = await this.supabase
        .from('study_records')
        .select('*')
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .lte('next_review_at', today)
        .not('last_studied_at', 'is', null)

      if (reviewError) {
        console.error('获取复习单词失败:', reviewError)
        return []
      }

      // 获取新单词（限制数量）
      const { data: newWords, error: newError } = await this.supabase
        .from('study_records')
        .select('*')
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .is('last_studied_at', null)
        .limit(dailyGoal)

      if (newError) {
        console.error('获取新单词失败:', newError)
        return reviewWords || []
      }

      // 合并单词，复习单词优先
      let allWords = [...(reviewWords || []), ...(newWords || [])]

      // 如果有保存的进度，恢复进度
      if (savedProgress && savedProgress.wordIds) {
        // 按照保存的顺序重新排列单词
        const wordMap = new Map(allWords.map(word => [word.id, word]))
        allWords = savedProgress.wordIds
          .map(id => wordMap.get(id))
          .filter(word => word) // 移除可能已被删除的单词
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
        .not('last_studied_at', 'is', null)

      if (reviewError) {
        console.error('检查复习单词失败:', reviewError)
        return false
      }

      // 检查是否有新单词
      const { count: newCount, error: newError } = await this.supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .is('last_studied_at', null)
        .limit(dailyGoal)

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