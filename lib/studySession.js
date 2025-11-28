// lib/studySession.js
import { createClient } from '@/lib/supabase/client'
export class StudySession {
  constructor(userId, wordListId) {
    this.userId = userId
    this.wordListId = wordListId
    this.storageKey = `study_progress_${userId}_${wordListId}`
  }

  async getStudyWords(dailyGoal = 10) {
    const supabase = createClient()
    
    try {
      // 获取需要复习的单词（今天到期的）
      const today = new Date().toISOString()
      
      const { data: reviewWords, error: reviewError } = await supabase
        .from('study_records')
        .select(`
          *,
          word_list_words (
            word,
            BrE,
            AmE,
            definition
          )
        `)
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .lte('next_review_at', today)
        .order('next_review_at', { ascending: true })

      if (reviewError) throw reviewError

      // 获取新单词（还没有学习记录的）
      const { data: newWords, error: newError } = await supabase
        .from('word_list_words')
        .select('*')
        .eq('word_list_id', this.wordListId)
        .not('id', 'in', `(${reviewWords?.map(w => w.word_list_word_id).join(',') || '0'})`)
        .order('created_at', { ascending: true })
        .limit(dailyGoal)

      if (newError) throw newError

      // 合并单词列表，复习单词在前，新单词在后
      const studyWords = [
        ...(reviewWords || []).map(record => ({
          ...record.word_list_words,
          id: record.id,
          word_list_word_id: record.word_list_word_id,
          familiarity: record.familiarity,
          review_count: record.review_count,
          ease_factor: record.ease_factor,
          interval_days: record.interval_days,
          last_studied_at: record.last_studied_at,
          next_review_at: record.next_review_at
        })),
        ...(newWords || []).map(word => ({
          ...word,
          word_list_word_id: word.id,
          familiarity: 0,
          review_count: 0,
          ease_factor: 2.5,
          interval_days: 1,
          last_studied_at: null,
          next_review_at: null
        }))
      ]

      return studyWords.slice(0, dailyGoal + (reviewWords?.length || 0))

    } catch (error) {
      console.error('获取学习单词失败:', error)
      throw error
    }
  }

  saveProgress(currentIndex, words) {
    if (typeof window !== 'undefined') {
      const progress = {
        currentIndex,
        words: words.map(word => ({
          id: word.id,
          word_list_word_id: word.word_list_word_id,
          familiarity: word.familiarity,
          review_count: word.review_count,
          ease_factor: word.ease_factor,
          interval_days: word.interval_days,
          last_studied_at: word.last_studied_at,
          next_review_at: word.next_review_at
        }))
      }
      localStorage.setItem(this.storageKey, JSON.stringify(progress))
    }
  }

  getProgress() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey)
      return saved ? JSON.parse(saved) : null
    }
    return null
  }

  clearProgress() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey)
    }
  }
}