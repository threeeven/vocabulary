// app/dashboard/page.js
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
  const [userWordListsData, statsData] = await Promise.all([
    fetchUserWordLists(supabase, user.id),
    fetchStats(supabase, user.id)
  ])

  return (
    <DashboardClient 
      user={user}
      initialUserWordLists={userWordListsData}
      initialStats={statsData}
    />
  )
}

// 获取用户词库
async function fetchUserWordLists(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('user_word_lists')
      .select(`
        word_list_id,
        word_lists (
          id,
          name,
          description,
          word_count
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('added_at', { ascending: false })
      .limit(3)

    if (error) throw error
    return data?.map(item => item.word_lists) || []
  } catch (error) {
    console.error('获取用户词库失败:', error)
    return []
  }
}

// 获取统计数据
async function fetchStats(supabase, userId) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    // 并行执行所有查询
    const [
      totalWordsResult,
      todayReviewResult,
      learnedWordsResult,
      learnedTodayResult
    ] = await Promise.all([
      supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      
      supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('next_review_at', today)
        .not('last_studied_at', 'is', null),
      
      supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('last_studied_at', 'is', null),
      
      supabase
        .from('study_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('last_studied_at', startOfToday.toISOString())
        .lte('last_studied_at', endOfToday.toISOString())
    ])

    return {
      totalWords: totalWordsResult.count || 0,
      learnedWords: learnedWordsResult.count || 0,
      todayReview: todayReviewResult.count || 0,
      learnedToday: learnedTodayResult.count || 0,
      streak: 0
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