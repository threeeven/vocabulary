// app/dashboard/stats/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsClient from './StatsClient'

export default async function StatsPage() {
  const supabase = await createClient()
  
  // 获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 获取统计数据
  const [studyStats, dailyStats, streakData, wordListProgress] = await Promise.all([
    fetchStudyStats(supabase, user.id),
    fetchDailyStats(supabase, user.id),
    fetchStreakData(supabase, user.id),
    fetchWordListProgress(supabase, user.id)
  ])

  return (
    <StatsClient 
      user={user}
      studyStats={studyStats}
      dailyStats={dailyStats}
      streakData={streakData}
      wordListProgress={wordListProgress}
    />
  )
}

// 获取学习统计数据 - 修复跨词库统计
async function fetchStudyStats(supabase, userId) {
  try {
    // 获取总览数据
    const { data: overview, error: overviewError } = await supabase
      .from('user_study_overview')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (overviewError && overviewError.code !== 'PGRST116') throw overviewError

    // 获取各词库学习数据
    const { data: wordListStats, error: wordListError } = await supabase
      .from('word_list_progress')
      .select('*')
      .eq('user_id', userId)

    if (wordListError) throw wordListError

    // 修复时区问题
    const today = new Date();
    const todayLocal = today.toLocaleDateString('en-CA');
    
    // 获取今日学习数据 - 跨所有词库
    const { data: todayStats, error: todayError } = await supabase
      .from('study_daily_stats')
      .select('words_studied, new_words, review_words, study_time')
      .eq('user_id', userId)
      .eq('study_date', todayLocal)

    // 如果没有今日统计数据，从学习记录中统计所有词库
    let todayStudied = 0
    let todayNewWords = 0
    let todayReviewWords = 0
    let todayStudyTime = 0

    if (!todayStats || todayStats.length === 0) {
      const { data: todayRecords, error: recordsError } = await supabase
        .from('study_records')
        .select('review_count, last_studied_at')
        .eq('user_id', userId)
        .gte('last_studied_at', todayLocal + 'T00:00:00Z')
        .lte('last_studied_at', todayLocal + 'T23:59:59Z')
      
      if (!recordsError && todayRecords) {
        todayStudied = todayRecords.length
        todayNewWords = todayRecords.filter(record => record.review_count <= 1).length
        todayReviewWords = todayRecords.filter(record => record.review_count > 1).length
        // 估算学习时间：平均每个单词30秒
        todayStudyTime = todayStudied * 30
      }
    } else {
      // 汇总所有词库的今日数据
      todayStudied = todayStats.reduce((sum, stat) => sum + (stat.words_studied || 0), 0)
      todayNewWords = todayStats.reduce((sum, stat) => sum + (stat.new_words || 0), 0)
      todayReviewWords = todayStats.reduce((sum, stat) => sum + (stat.review_words || 0), 0)
      todayStudyTime = todayStats.reduce((sum, stat) => sum + (stat.study_time || 0), 0)
    }

    // 计算总学习单词数（所有词库）
    const totalWordsStudied = wordListStats?.reduce((sum, list) => sum + (list.learned_count || 0), 0) || 0

    return {
      totalStudyDays: overview?.total_study_days || 0,
      currentStreak: overview?.current_streak || 0,
      longestStreak: overview?.longest_streak || 0,
      totalWordsStudied,
      wordListCount: wordListStats?.length || 0,
      todayStudied,
      todayNewWords,
      todayReviewWords,
      todayStudyTime
    }
  } catch (error) {
    console.error('获取学习统计失败:', error)
    return {
      totalStudyDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalWordsStudied: 0,
      wordListCount: 0,
      todayStudied: 0,
      todayNewWords: 0,
      todayReviewWords: 0,
      todayStudyTime: 0
    }
  }
}

// 获取每日学习数据 - 修复跨词库统计
async function fetchDailyStats(supabase, userId) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toLocaleDateString('en-CA')

    // 获取所有词库的每日统计数据
    const { data, error } = await supabase
      .from('study_daily_stats')
      .select('study_date, words_studied, new_words, review_words, streak_days')
      .eq('user_id', userId)
      .gte('study_date', thirtyDaysAgoStr)
      .order('study_date', { ascending: true })

    if (error) throw error

    // 按日期分组，汇总所有词库的数据
    const groupedData = {}
    data?.forEach(stat => {
      const date = stat.study_date
      if (!groupedData[date]) {
        groupedData[date] = {
          study_date: date,
          words_studied: 0,
          new_words: 0,
          review_words: 0,
          streak_days: stat.streak_days || 0 // 取最大连续打卡天数
        }
      }
      groupedData[date].words_studied += stat.words_studied || 0
      groupedData[date].new_words += stat.new_words || 0
      groupedData[date].review_words += stat.review_words || 0
      groupedData[date].streak_days = Math.max(groupedData[date].streak_days, stat.streak_days || 0)
    })

    const aggregatedData = Object.values(groupedData)

    // 填充缺失的日期数据
    const filledData = []
    const currentDate = new Date(thirtyDaysAgo)
    const today = new Date()
    
    while (currentDate <= today) {
      const dateStr = currentDate.toLocaleDateString('en-CA')
      const existingData = aggregatedData.find(item => item.study_date === dateStr)
      
      filledData.push({
        date: dateStr,
        words_studied: existingData?.words_studied || 0,
        new_words: existingData?.new_words || 0,
        review_words: existingData?.review_words || 0,
        streak_days: existingData?.streak_days || 0,
        studied: existingData?.words_studied > 0
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }

    return filledData
  } catch (error) {
    console.error('获取每日统计失败:', error)
    return []
  }
}

// 获取连续打卡数据
async function fetchStreakData(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('study_daily_stats')
      .select('study_date, streak_days')
      .eq('user_id', userId)
      .order('study_date', { ascending: false })
      .limit(90) // 最近90天

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('获取打卡数据失败:', error)
    return []
  }
}

// 获取用户词库进度
async function fetchWordListProgress(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('word_list_progress')
      .select('*')
      .eq('user_id', userId)
      .order('word_list_id', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取词库进度失败:', error)
    return []
  }
}