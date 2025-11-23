// app/test/page.js
import { supabase } from '@/lib/supabaseClient'

export default async function TestPage() {
  // 尝试从 word_lists 表查询数据
  const { data, error } = await supabase.from('word_lists').select('*')

  if (error) {
    return <div>查询失败: {error.message}</div>
  }

  return <pre>{JSON.stringify(data, null, 2)}</pre>
}