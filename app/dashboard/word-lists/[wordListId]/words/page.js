// app/dashboard/word-lists/[wordListId]/words/page.js
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WordListWordsClient from './WordListWordsClient'

export default async function WordListWords({ params }) {
  // 使用 await 获取 params
  const { wordListId } = await params
  const supabase = await createClient()
  
  // 在服务端获取用户信息
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }

  // 并行获取数据
  const [wordListInfoData, wordsData] = await Promise.all([
    fetchWordListInfo(supabase, wordListId),
    fetchWords(supabase, wordListId, user.id)
  ])

  return (
    <WordListWordsClient 
      user={user}
      wordListId={wordListId}
      initialWordListInfo={wordListInfoData}
      initialWords={wordsData}
    />
  )
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

// 获取单词列表
async function fetchWords(supabase, wordListId, userId) {
  try {
    // 获取词库的所有单词，并关联学习状态
    let allWords = []
    const limit = 1000
    let page = 0
    let hasMore = true

    while (hasMore) {
      try {
        const { data, error } = await supabase
          .from('word_list_words')
          .select(`
            *,
            study_records (
              id,
              familiarity,
              last_studied_at,
              next_review_at,
              review_count,
              ease_factor,
              interval_days
            )
          `)
          .eq('word_list_id', wordListId)
          .eq('study_records.user_id', userId)  // 只获取当前用户的学习记录
          .order('id', { ascending: true })
          .range(page * limit, (page + 1) * limit - 1)

        // 处理可能的范围错误
        if (error) {
          if (error.code === 'PGRST103' || error.message?.includes('Range Not Satisfiable')) {
            hasMore = false
            break
          } else {
            throw error
          }
        }

        if (data && data.length > 0) {
          allWords = [...allWords, ...data]
          
          // 如果获取的数据少于限制，说明没有更多数据了
          if (data.length < limit) {
            hasMore = false
          } else {
            page += 1
          }
        } else {
          hasMore = false
        }

        // 防止无限循环的安全措施
        if (page > 50) {
          console.warn('达到安全限制，停止获取数据')
          hasMore = false
        }
      } catch (pageError) {
        // 如果是范围错误，说明没有更多数据了
        if (pageError.code === 'PGRST103' || pageError.message?.includes('Range Not Satisfiable')) {
          hasMore = false
          break
        }
        console.error('分页获取失败:', pageError)
        throw pageError
      }
    }

    // 处理数据，添加学习状态
    const processedWords = allWords.map(word => {
      const studyRecord = word.study_records && word.study_records.length > 0 ? word.study_records[0] : null
      return {
        ...word,
        learned: !!studyRecord,
        study_record_id: studyRecord?.id,
        familiarity: studyRecord?.familiarity || 0,
        last_studied_at: studyRecord?.last_studied_at,
        next_review_at: studyRecord?.next_review_at,
        review_count: studyRecord?.review_count || 0,
        ease_factor: studyRecord?.ease_factor || 2.5,
        interval_days: studyRecord?.interval_days || 1
      }
    })

    return processedWords
  } catch (error) {
    console.error('获取单词列表失败:', error)
    return []
  }
}