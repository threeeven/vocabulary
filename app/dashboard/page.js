// app/dashboard/page.js - 修复版本
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function Dashboard() {
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 并行获取数据
  const [userWordListsData, statsData, userSettingsData] = await Promise.all([
    fetchUserWordLists(supabase, user.id),
    fetchUserStats(supabase, user.id),
    fetchUserSettings(supabase, user.id)
  ])

  return (
    <DashboardClient 
      user={user}
      initialUserWordLists={userWordListsData}
      initialStats={statsData}
      initialUserSettings={userSettingsData}
    />
  )
}

// 获取用户词库 - 使用视图
async function fetchUserWordLists(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('word_list_progress')
      .select('*')
      .eq('user_id', userId)
      .order('word_list_id', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取用户词库失败:', error)
    return []
  }
}

// 获取用户统计 - 使用视图
async function fetchUserStats(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('user_study_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) throw error

    // 获取今日学习数据
    // 修复时区问题：使用本地日期而不是UTC
    const today = new Date();
    const todayLocal = today.toLocaleDateString('en-CA'); // 格式: YYYY-MM-DD

    const { data: todayStats, error: todayError } = await supabase
      .from('study_daily_stats')
      .select('words_studied, new_words')
      .eq('user_id', userId)
      .eq('study_date', todayLocal)
      .single()

    return {
      totalWords: data.learned_words_count || 0,
      learnedWords: data.learned_words_count || 0,
      todayReview: data.today_review_count || 0,
      learnedToday: todayStats?.words_studied || 0,
      streak: data.current_streak || 0
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
    return {
      totalWords: 0,
      learnedWords: 0,
      todayReview: 0,
      learnedToday: 0,
      streak: 0
    }
  }
}

// 获取用户设置
async function fetchUserSettings(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('daily_goal')
      .eq('id', userId)
      .single()

    if (error) throw error
    return {
      daily_goal: data.daily_goal || 10
    }
  } catch (error) {
    console.error('获取用户设置失败:', error)
    return {
      daily_goal: 10
    }
  }
}