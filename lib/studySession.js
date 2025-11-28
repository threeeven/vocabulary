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
          id,
          familiarity,
          review_count,
          ease_factor,
          interval_days,
          last_studied_at,
          next_review_at,
          word_list_words (
            id,
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

      if (reviewError) {
        console.error('获取复习单词失败:', reviewError)
        throw reviewError
      }

      // 获取已学习单词的ID，用于排除已学习的单词
      const learnedWordIds = reviewWords?.map(w => w.word_list_words.id) || []

      // 计算需要获取的新单词数量
      const newWordsNeeded = Math.max(0, dailyGoal - (reviewWords?.length || 0))
      
      console.log(`需要 ${newWordsNeeded} 个新单词，已有 ${reviewWords?.length || 0} 个复习单词`)

      // 获取新单词（还没有学习记录的）
      let newWords = []
      if (newWordsNeeded > 0) {
        let newWordsQuery = supabase
          .from('word_list_words')
          .select('*')
          .eq('word_list_id', this.wordListId)
          .order('created_at', { ascending: true })

        // 如果有已学习的单词，排除它们
        if (learnedWordIds.length > 0) {
          newWordsQuery = newWordsQuery.not('id', 'in', `(${learnedWordIds.join(',')})`)
        }

        const { data: newWordsData, error: newError } = await newWordsQuery.limit(newWordsNeeded)

        if (newError) {
          console.error('获取新单词失败:', newError)
          throw newError
        }
        
        newWords = newWordsData || []
      }

      console.log('复习单词:', reviewWords?.length, '新单词:', newWords.length)

      // 合并单词列表，复习单词在前，新单词在后
      const studyWords = [
        ...(reviewWords || []).map(record => ({
          ...record.word_list_words,
          study_record_id: record.id,
          familiarity: record.familiarity,
          review_count: record.review_count,
          ease_factor: record.ease_factor,
          interval_days: record.interval_days,
          last_studied_at: record.last_studied_at,
          next_review_at: record.next_review_at
        })),
        ...newWords.map(word => ({
          ...word,
          study_record_id: null,
          familiarity: 0,
          review_count: 0,
          ease_factor: 2.5,
          interval_days: 1,
          last_studied_at: null,
          next_review_at: null
        }))
      ]

      console.log('最终学习单词:', studyWords.length)
      return studyWords

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
      localStorage.setItem(this.storageKey, JSON.stringify(progress))
      console.log('进度已保存:', progress)
    }
  }

  getProgress() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey)
      const progress = saved ? JSON.parse(saved) : null
      console.log('恢复的进度:', progress)
      return progress
    }
    return null
  }

  clearProgress() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey)
      console.log('进度已清除')
    }
  }
}