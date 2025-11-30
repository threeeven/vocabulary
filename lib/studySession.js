// lib/studySession.js
import { createClient } from '@/lib/supabase/client'

// 添加单例缓存 - 使用 WeakMap 避免内存泄漏
const studySessionCache = new Map()

export class StudySession {
  constructor(userId, wordListId) {
    console.log('🔧 StudySession 构造函数被调用', { userId, wordListId })
    
    // 确保参数有效
    if (!userId || !wordListId) {
      console.error('❌ StudySession 初始化失败: 缺少必要的参数')
      throw new Error('StudySession 需要有效的 userId 和 wordListId')
    }
    
    // 检查缓存中是否已存在相同参数的实例
    const cacheKey = `${userId}_${wordListId}`
    if (studySessionCache.has(cacheKey)) {
      console.log('✅ 从缓存返回已存在的 StudySession 实例')
      const cachedInstance = studySessionCache.get(cacheKey)
      // 确保返回的实例是有效的
      if (cachedInstance && typeof cachedInstance === 'object') {
        return cachedInstance
      }
    }
    
    this.userId = userId
    this.wordListId = wordListId
    this.storageKey = `study_progress_${userId}_${wordListId}`
    this.supabase = createClient()
    this.cache = {}
    this.isInitialized = true
    
    // 连接管理
    this.connectionRetryCount = 0
    this.maxRetries = 3
    this.isOnline = true
    
    // 监听在线状态
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
    
    // 将实例存入缓存
    studySessionCache.set(cacheKey, this)
    
    console.log('✅ StudySession 初始化完成', { 
      userId: this.userId, 
      wordListId: this.wordListId
    })
    
    return this
  }

  // 添加静态方法获取或创建实例
  static getInstance(userId, wordListId) {
    const cacheKey = `${userId}_${wordListId}`
    
    // 先检查缓存
    if (studySessionCache.has(cacheKey)) {
      const instance = studySessionCache.get(cacheKey)
      // 验证实例是否有效
      if (instance && instance.userId === userId && instance.wordListId === wordListId) {
        console.log('✅ 从缓存获取有效的 StudySession 实例')
        return instance
      } else {
        // 无效实例，从缓存中移除
        studySessionCache.delete(cacheKey)
      }
    }
    
    console.log('🔧 创建新的 StudySession 实例')
    return new StudySession(userId, wordListId)
  }

  // 清理特定实例
  static clearInstance(userId, wordListId) {
    const cacheKey = `${userId}_${wordListId}`
    studySessionCache.delete(cacheKey)
    console.log('✅ 清理 StudySession 实例:', cacheKey)
  }

  // 验证实例是否有效
  isValid() {
    return this.userId && this.wordListId && this.supabase && this.isInitialized
  }

  // 处理在线状态变化
  handleOnline() {
    console.log('🌐 网络恢复在线')
    this.isOnline = true
    this.connectionRetryCount = 0
  }

  handleOffline() {
    console.log('📵 网络离线')
    this.isOnline = false
  }

  // 检查Supabase连接状态
  async checkConnection() {
    try {
      const { data, error } = await this.supabase
        .from('study_records')
        .select('id')
        .limit(1)
        
      return !error
    } catch (error) {
      console.error('连接检查失败:', error)
      return false
    }
  }

  // 带重试的查询执行
  async executeWithRetry(queryFn, operation = '查询') {
    let lastError
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 检查网络状态
        if (!this.isOnline && typeof navigator !== 'undefined') {
          this.isOnline = navigator.onLine
        }
        
        if (!this.isOnline) {
          throw new Error('网络连接不可用')
        }
        
        console.log(`🔄 ${operation} 尝试 ${attempt}/${this.maxRetries}`)
        const result = await queryFn()
        
        // 重置重试计数
        this.connectionRetryCount = 0
        return result
        
      } catch (error) {
        lastError = error
        console.warn(`❌ ${operation} 尝试 ${attempt} 失败:`, error.message)
        
        if (attempt < this.maxRetries) {
          // 指数退避延迟
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          console.log(`⏳ 等待 ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error(`${operation} 失败，已达到最大重试次数`)
  }

  // 本地缓存管理
  getLocalCache(key) {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(`cache_${key}`)
      if (!cached) return null
      
      const { data, timestamp, ttl } = JSON.parse(cached)
      return { data, timestamp, ttl }
    } catch (error) {
      console.error('读取本地缓存失败:', error)
      return null
    }
  }

  setLocalCache(key, data, ttl = 5 * 60 * 1000) { // 默认5分钟
    if (typeof window === 'undefined') return
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl
      }
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheData))
    } catch (error) {
      console.error('保存本地缓存失败:', error)
    }
  }

  isCacheValid(cache) {
    return Date.now() - cache.timestamp < (cache.ttl || 5 * 60 * 1000)
  }

  // 设置缓存
  setCache(key, data) {
    // 内存缓存
    if (!this.cache) this.cache = {}
    this.cache[key] = data
    
    // 本地存储缓存（5分钟有效期）
    this.setLocalCache(key, data, 5 * 60 * 1000)
  }

  // 后台更新缓存
  async updateCacheInBackground(dailyGoal) {
    if (!this.isOnline) return
    
    try {
      console.log('🔄 后台更新缓存...')
      const studyWords = await this.fetchStudyWordsFromNetwork(dailyGoal)
      this.setCache(`studyWords_${this.userId}_${this.wordListId}_${dailyGoal}`, studyWords)
      console.log('✅ 后台缓存更新完成')
    } catch (error) {
      console.warn('⚠️ 后台缓存更新失败:', error.message)
    }
  }

  // 获取学习单词 - 主入口
  async getStudyWords(dailyGoal = 10) {
    console.log('🔍 getStudyWords 开始执行', { 
      userId: this.userId, 
      wordListId: this.wordListId,
      dailyGoal 
    })
    
    const cacheKey = `studyWords_${this.userId}_${this.wordListId}_${dailyGoal}`
    
    // 1. 检查内存缓存
    if (this.cache && this.cache[cacheKey]) {
      console.log('✅ 从内存缓存获取学习单词')
      return this.cache[cacheKey]
    }

    // 2. 检查本地存储缓存（快速返回）
    const localCache = this.getLocalCache(cacheKey)
    if (localCache && this.isCacheValid(localCache)) {
      console.log('✅ 从本地缓存获取学习单词')
      // 异步更新缓存
      this.updateCacheInBackground(dailyGoal)
      return localCache.data
    }

    try {
      // 3. 执行网络查询（带重试）
      const studyWords = await this.executeWithRetry(
        () => this.fetchStudyWordsFromNetwork(dailyGoal),
        '获取学习单词'
      )
      
      // 缓存结果
      this.setCache(cacheKey, studyWords)
      console.log('🎉 网络获取学习单词成功:', studyWords.length)
      
      return studyWords

    } catch (error) {
      console.error('💥 获取学习单词失败:', error)
      
      // 4. 降级方案：返回本地缓存（即使过期）
      if (localCache) {
        console.log('🔄 使用过期的本地缓存作为降级方案')
        return localCache.data
      }
      
      throw error
    }
  }

  // 在 StudySession.js 的 fetchStudyWordsFromNetwork 方法中
  async fetchStudyWordsFromNetwork(dailyGoal) {
    console.time('fetchStudyWordsFromNetwork')
    
    console.log('📅 获取学习单词 - 包含今天及之前所有需要复习的单词')
    
    // 获取复习单词（包含今天及之前所有需要复习的）
    const reviewRecords = await this.getReviewWords()
    
    console.log('✅ 复习单词记录数量:', reviewRecords?.length || 0)
    
    const reviewWordIds = reviewRecords?.map(record => record.word_list_word_id) || []
    let reviewWords = []
    
    if (reviewWordIds.length > 0) {
      reviewWords = await this.getWordDetails(reviewWordIds, reviewRecords)
    }
    
    // 获取新单词
    const newWordsNeeded = Math.max(0, dailyGoal - reviewWords.length)
    let newWords = []
    
    if (newWordsNeeded > 0) {
      newWords = await this.getNewWords(newWordsNeeded, reviewWordIds)
    }
    
    const studyWords = [...reviewWords, ...newWords]
    console.log('🎉 最终学习单词数量:', studyWords.length, {
      复习单词: reviewWords.length,
      新单词: newWords.length
    })
    console.timeEnd('fetchStudyWordsFromNetwork')
    
    return studyWords
  }

  // 修改获取复习单词的方法
  async getReviewWords() {
    // 获取今天的时间范围（只使用结束时间）
    const todayRange = this.getTodayTimeRange()
    
    console.log('📅 复习单词时间范围: 不限开始时间，结束时间:', todayRange.end)
    
    // 只限制 next_review_at <= 今天结束时间，不限制开始时间
    const { data, error } = await this.supabase
      .from('study_records')
      .select(`
        id,
        word_list_word_id,
        familiarity,
        review_count,
        ease_factor,
        interval_days,
        last_studied_at,
        next_review_at
      `)
      .eq('user_id', this.userId)
      .eq('word_list_id', this.wordListId)
      .lte('next_review_at', todayRange.end) // 只限制结束时间
      .order('next_review_at', { ascending: true })

    if (error) throw error
    
    console.log('✅ 复习单词记录数量:', data?.length || 0)
    return data
  }

  // 获取新单词数量（优化查询）
  async getNewWordsCount(todayRange) {
    const { count, error } = await this.supabase
      .from('word_list_words')
      .select('*', { count: 'exact', head: true })
      .eq('word_list_id', this.wordListId)

    if (error) {
      console.error('获取新单词数量失败:', error)
      return 0
    }
    return count
  }

  // 获取单词详情
  async getWordDetails(wordIds, reviewRecords) {
    const { data: wordDetails, error } = await this.supabase
      .from('word_list_words')
      .select('*')
      .in('id', wordIds)

    if (error) throw error

    return reviewRecords.map(record => {
      const wordDetail = wordDetails.find(word => word.id === record.word_list_word_id)
      return wordDetail ? {
        ...wordDetail,
        study_record_id: record.id,
        familiarity: record.familiarity,
        review_count: record.review_count,
        ease_factor: record.ease_factor,
        interval_days: record.interval_days,
        last_studied_at: record.last_studied_at,
        next_review_at: record.next_review_at
      } : null
    }).filter(Boolean)
  }

  // 获取新单词
  async getNewWords(needed, excludeIds) {
    let query = this.supabase
      .from('word_list_words')
      .select('*')
      .eq('word_list_id', this.wordListId)

    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data, error } = await query
      .order('created_at', { ascending: true })
      .limit(needed)

    if (error) throw error

    return (data || []).map(word => ({
      ...word,
      study_record_id: null,
      familiarity: 0,
      review_count: 0,
      ease_factor: 2.5,
      interval_days: 1,
      last_studied_at: null,
      next_review_at: null
    }))
  }

  // 修改 getTodayTimeRange 方法
  getTodayTimeRange() {
    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000 // 北京时间 UTC+8
    
    // 北京时间的今天开始（00:00:00）
    const beijingStart = new Date(now.getTime() + beijingOffset)
    beijingStart.setHours(0, 0, 0, 0)
    const utcStart = new Date(beijingStart.getTime() - beijingOffset)
    
    // 北京时间的今天结束（23:59:59）
    const beijingEnd = new Date(now.getTime() + beijingOffset)
    beijingEnd.setHours(23, 59, 59, 999)
    const utcEnd = new Date(beijingEnd.getTime() - beijingOffset)
    
    return {
      start: utcStart.toISOString(),
      end: utcEnd.toISOString()
    }
  }

  // 添加获取今天日期字符串的方法（北京时间）
  getTodayBeijingDate() {
    const now = new Date()
    const beijingOffset = 8 * 60 * 60 * 1000
    const beijingTime = new Date(now.getTime() + beijingOffset)
    return beijingTime.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // 修改保存学习进度到数据库的方法
  async saveProgressToDB(currentIndex, totalWords) {
    try {
      // 使用北京时间的今天日期
      const today = this.getTodayBeijingDate()
      
      const { error } = await this.supabase
        .from('study_sessions')
        .upsert({
          user_id: this.userId,
          word_list_id: this.wordListId,
          current_index: currentIndex,
          total_words: totalWords,
          date: today, // 使用北京时间的日期
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,word_list_id,date'
        })

      if (error) {
        console.error('保存学习进度到数据库失败:', error)
        throw error
      }
      
      console.log('学习进度已保存到数据库，日期:', today)
    } catch (error) {
      console.error('保存学习进度失败:', error)
      throw error
    }
  }

  // 修改从数据库获取学习进度的方法
  async getProgressFromDB() {
    try {
      // 使用北京时间的今天日期
      const today = this.getTodayBeijingDate()
      
      const { data, error } = await this.supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .eq('date', today) // 只获取今天的学习进度
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('从数据库获取学习进度失败:', error)
        throw error
      }

      console.log('获取今天学习进度:', data ? '有进度' : '无进度', '日期:', today)
      return data || null
    } catch (error) {
      console.error('获取学习进度失败:', error)
      return null
    }
  }

  // 保存进度（同时保存到数据库和本地）
  async saveProgress(currentIndex, words) {
    try {
      // 保存到数据库
      await this.saveProgressToDB(currentIndex, words.length)
    } catch (error) {
      console.error('保存进度到数据库失败，仅保存到本地:', error)
    }
    
    // 同时保存到本地（作为备用）
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
      console.log('进度已保存到本地')
    }
  }

  // 获取进度（优先从数据库获取，失败则从本地获取）
  async getProgress() {
    try {
      // 先尝试从数据库获取
      const dbProgress = await this.getProgressFromDB()
      if (dbProgress) {
        console.log('从数据库恢复进度:', dbProgress)
        return {
          currentIndex: dbProgress.current_index,
          words: []
        }
      }
    } catch (error) {
      console.error('从数据库获取进度失败，尝试本地存储:', error)
    }
    
    // 数据库获取失败，尝试本地存储
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(this.storageKey)
      const progress = saved ? JSON.parse(saved) : null
      console.log('从本地存储恢复进度:', progress)
      return progress
    }
    
    return null
  }

  // 修改清除进度的方法
  async clearProgress() {
    try {
      // 使用北京时间的今天日期
      const today = this.getTodayBeijingDate()
      
      // 从数据库删除今天的学习会话
      const { error } = await this.supabase
        .from('study_sessions')
        .delete()
        .eq('user_id', this.userId)
        .eq('word_list_id', this.wordListId)
        .eq('date', today)

      if (error) {
        console.error('从数据库清除进度失败:', error)
      } else {
        console.log('✅ 已清除今天的学习进度，日期:', today)
      }
    } catch (error) {
      console.error('清除数据库进度失败:', error)
    }
    
    // 同时清除本地存储
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey)
      console.log('进度已从本地存储清除')
    }
  }

  // 清理所有缓存
  clearAllCache() {
    // 清理内存缓存
    this.cache = {}
    
    // 清理本地存储缓存
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('cache_studyWords_') || key.startsWith('study_progress_')) {
          localStorage.removeItem(key)
        }
      })
    }
    
    console.log('✅ 所有缓存已清理')
  }
}