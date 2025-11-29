// app/dashboard/study/[wordListId]/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudyClient from './StudyClient'

export default async function WordListStudy({ params }) {
  // 使用 await 获取 params
  const { wordListId } = await params
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 并行获取基础数据
  const [userSettingsData, wordListInfoData, userWordListCheck] = await Promise.all([
    fetchUserSettings(supabase, user.id),
    fetchWordListInfo(supabase, wordListId),
    checkUserWordList(supabase, user.id, wordListId)
  ])

  // 检查用户是否选择了这个词库
  if (!userWordListCheck) {
    redirect('/dashboard/word-lists')
  }

  return (
    <StudyClient 
      user={user}
      wordListId={wordListId}
      initialUserSettings={userSettingsData}
      initialWordListInfo={wordListInfoData}
    />
  )
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

// 获取词库信息
async function fetchWordListInfo(supabase, wordListId) {
  try {
    const { data, error } = await supabase
      .from('word_lists')
      .select('*')
      .eq('id', wordListId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('获取词库信息失败:', error)
    return null
  }
}

// 检查用户是否选择了这个词库
async function checkUserWordList(supabase, userId, wordListId) {
  try {
    const { data, error } = await supabase
      .from('user_word_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('word_list_id', wordListId)
      .eq('is_active', true)
      .single()

    return !error && data
  } catch (error) {
    console.error('检查用户词库失败:', error)
    return false
  }
}