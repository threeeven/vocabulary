// app/dashboard/study/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StudyClient from './StudyClient'

export default async function StudyPage() {
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 获取用户选择的词库
  const userWordLists = await fetchUserWordLists(supabase, user.id)

  return (
    <StudyClient 
      user={user}
      initialUserWordLists={userWordLists}
    />
  )
}

// 获取用户选择的词库
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
          word_count,
          language
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('added_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('获取用户词库失败:', error)
    return []
  }
}