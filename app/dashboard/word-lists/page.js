// app/dashboard/word-lists/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WordListsClient from './WordListsClient'

export default async function WordLists() {
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 并行获取数据
  const [wordListsData, userSelectedListsData] = await Promise.all([
    fetchWordLists(supabase),
    fetchUserSelectedLists(supabase, user.id)
  ])

  return (
    <WordListsClient 
      user={user}
      initialWordLists={wordListsData}
      initialUserSelectedLists={userSelectedListsData}
    />
  )
}

// 获取所有公共词库
async function fetchWordLists(supabase) {
  try {
    const { data, error } = await supabase
      .from('word_lists')
      .select('*')
      .eq('is_public', true)
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('获取词库失败:', error)
    return []
  }
}

// 获取用户已选择的词库
async function fetchUserSelectedLists(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('user_word_lists')
      .select('word_list_id')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (error) throw error
    return data?.map(item => item.word_list_id) || []
  } catch (error) {
    console.error('获取用户词库失败:', error)
    return []
  }
}