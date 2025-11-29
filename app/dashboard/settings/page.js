// app/dashboard/settings/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient.js'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 获取用户设置
  const userSettings = await fetchUserSettings(supabase, user.id)

  return (
    <SettingsClient 
      user={user}
      initialSettings={userSettings}
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