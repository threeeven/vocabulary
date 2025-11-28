// app/dashboard/word-lists/[wordListId]/words/page.js
'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {  
  exportToCSVWords, 
  exportToTXTWords,
  PDFDirection,
  DictationOption,
  exportToPDFWithOptions,
  exportToPDFWithPronunciation
} from '@/utils/exportUtils'

// 定义 OrderOption（如果 utils/exportUtils 中没有导出）
const OrderOption = {
  DEFAULT: '1',
  ALPHABETICAL: '2',
  RANDOM: '3'
}

export default function WordListWords() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const wordListId = params.wordListId
  const [words, setWords] = useState([])
  const [wordListInfo, setWordListInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    showDefinition: true
  })
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const supabase = createClient()

  // 在状态管理中添加排序选项
  const [sortOption, setSortOption] = useState('id_asc') // 默认按词库顺序

  // 排序选项
  const sortOptions = [
    { value: 'word_asc', label: '单词 A-Z' },
    { value: 'word_desc', label: '单词 Z-A' },
    { value: 'id_asc', label: '词库顺序' },
    { value: 'created_at_desc', label: '最近添加' }
  ]

  // 修改获取单词函数，支持动态排序
  const fetchWords = async (sortBy = sortOption) => {
    try {
      setLoading(true)
      setError('')

      let orderBy = 'id'
      let ascending = true
      
      // 根据排序选项设置排序参数
      switch (sortBy) {
        case 'word_asc':
          orderBy = 'word'
          ascending = true
          break
        case 'word_desc':
          orderBy = 'word'
          ascending = false
          break
        case 'id_asc':
          orderBy = 'id'
          ascending = true
          break
        case 'created_at_desc':
          orderBy = 'created_at'
          ascending = false
          break
        default:
          orderBy = 'word'
          ascending = true
      }
      
      // 获取词库的所有单词，并关联学习状态 - 通用分页方案
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
                review_count
              )
            `)
            .eq('word_list_id', wordListId)
            .order(orderBy, { ascending })
            .range(page * limit, (page + 1) * limit - 1)

          // 处理可能的范围错误
          if (error) {
            if (error.code === 'PGRST103' || error.message?.includes('Range Not Satisfiable')) {
              console.log('没有更多数据，分页完成')
              hasMore = false
              break
            } else {
              throw error
            }
          }

          if (data && data.length > 0) {
            allWords = [...allWords, ...data]
            console.log(`已获取第 ${page + 1} 页，${data.length} 个单词，累计 ${allWords.length} 个`)
            
            // 如果获取的数据少于限制，说明没有更多数据了
            if (data.length < limit) {
              hasMore = false
              console.log('数据量不足限制，分页完成')
            } else {
              page += 1
            }
          } else {
            hasMore = false
            console.log('没有更多数据，分页完成')
          }

          // 防止无限循环的安全措施
          if (page > 50) {
            console.warn('达到安全限制，停止获取数据')
            hasMore = false
          }
        } catch (pageError) {
          // 如果是范围错误，说明没有更多数据了
          if (pageError.code === 'PGRST103' || pageError.message?.includes('Range Not Satisfiable')) {
            console.log('没有更多数据，分页完成')
            hasMore = false
            break
          }
          console.error('分页获取失败:', pageError)
          throw pageError
        }
      }

      // 处理数据...
      const processedWords = allWords.map(word => ({
        ...word,
        learned: word.study_records && word.study_records.length > 0,
        familiarity: word.study_records?.[0]?.familiarity || 0,
        last_studied_at: word.study_records?.[0]?.last_studied_at,
        review_count: word.study_records?.[0]?.review_count || 0
      }))

      setWords(processedWords)
      console.log(`成功获取 ${processedWords.length} 个单词`)
      
    } catch (err) {
      console.error('获取单词列表失败:', err)
      setError('获取单词列表失败，请刷新页面重试')
    } finally {
      setLoading(false)
    }
  }

  // 选择对话框函数
  const selectPDFDirection = async () => {
    return new Promise((resolve) => {
      const direction = window.prompt(
        '请选择页面方向：\n1. 纵向\n2. 横向\n3. 紧凑模式\n\n请输入数字：',
        '1'
      )
      
      switch (direction) {
        case '1':
          resolve(PDFDirection.LONGITUDINAL)
          break
        case '2':
          resolve(PDFDirection.HORIZONTAL)
          break
        case '3':
          resolve(PDFDirection.COMPACT)
          break
        default:
          resolve(PDFDirection.LONGITUDINAL) // 默认纵向
      }
    })
  }

  const selectDictationMode = async () => {
    return new Promise((resolve) => {
      const mode = window.prompt(
        '请选择默写模式：\n1. 关闭默写\n2. 默写英文\n3. 默写中文\n\n请输入数字：',
        '1'
      )
      
      switch (mode) {
        case '1':
          resolve(DictationOption.DICTATION_OFF)
          break
        case '2':
          resolve(DictationOption.DICTATION_EN)
          break
        case '3':
          resolve(DictationOption.DICTATION_CH)
          break
        default:
          resolve(DictationOption.DICTATION_OFF) // 默认关闭
      }
    })
  }

  // 发音功能
  const playPronunciation = (word, type = 'us') => {
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === 'uk' ? 1 : 2}`
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放发音失败:', error)
    })
  }

  useEffect(() => {
    if (user && wordListId) {
      fetchWordListInfo()
      fetchWords()
    }
  }, [user, wordListId])

  const fetchWordListInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('word_lists')
        .select('*')
        .eq('id', wordListId)
        .single()

      if (!error && data) {
        setWordListInfo(data)
      } else {
        setError('词库不存在或已被删除')
      }
    } catch (error) {
      console.error('获取词库信息失败:', error)
      setError('获取词库信息失败')
    }
  }

  // 过滤单词
  const filteredWords = words.filter(word => {
    if (filters.status === 'learned') return word.learned
    if (filters.status === 'unlearned') return !word.learned
    return true
  })

  // 处理单词选择
  const handleWordSelect = (wordId) => {
    const newSelected = new Set(selectedWords)
    if (newSelected.has(wordId)) {
      newSelected.delete(wordId)
    } else {
      newSelected.add(wordId)
    }
    setSelectedWords(newSelected)
    setSelectAll(newSelected.size === filteredWords.length)
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWords(new Set())
    } else {
      const allWordIds = new Set(filteredWords.map(word => word.id))
      setSelectedWords(allWordIds)
    }
    setSelectAll(!selectAll)
  }

  // PDF导出处理函数
  const handlePDFExport = async (selectedWordData) => {
    try {
      // 选择页面方向
      const direction = await selectPDFDirection()
      
      let dictationMode = DictationOption.DICTATION_OFF
      // 如果不是紧凑模式，让用户选择默写模式
      if (direction !== PDFDirection.COMPACT) {
        dictationMode = await selectDictationMode()
      }
      
      // 使用默认排序
      const orderChoice = OrderOption.DEFAULT
      
      await exportToPDFWithOptions(
        selectedWordData, 
        wordListInfo?.name || 'wordlist', 
        direction, 
        dictationMode, 
        orderChoice
      )
      
    } catch (error) {
      console.error('PDF导出失败:', error)
      throw error
    }
  }

// 在页面组件中的 handleExport 函数中添加新选项
const handleExport = async (format) => {
  const selectedWordData = words.filter(word => selectedWords.has(word.id))
  
  if (selectedWordData.length === 0) {
    alert('请先选择要导出的单词')
    return
  }

  try {
    switch (format) {
      case 'pdf':
        await handlePDFExport(selectedWordData)
        break
      case 'pdf_pronunciation':
        await exportToPDFWithPronunciation(selectedWordData, wordListInfo?.name || 'wordlist')
        break
      case 'csv':
        exportToCSVWords(selectedWordData, wordListInfo?.name || 'wordlist')
        break
      case 'txt':
        exportToTXTWords(selectedWordData, wordListInfo?.name || 'wordlist')
        break
      default:
        alert('不支持的导出格式')
    }
    
    alert(`成功导出 ${selectedWordData.length} 个单词`)
    
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败，请重试')
  }
}



  // 获取熟悉度颜色
  const getFamiliarityColor = (familiarity) => {
    if (familiarity >= 4) return 'text-green-600 bg-green-100'
    if (familiarity >= 2) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  // ... 其余代码保持不变（loading, error, return JSX 等）
  // 注意：这里省略了剩余的JSX代码，因为它不需要修改
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center min-h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">出错了</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={fetchWords}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              重新加载
            </button>
            <button
              onClick={() => router.push('/dashboard/word-lists')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              返回词库列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <Link href="/dashboard/word-lists" className="hover:text-gray-700">
                词库列表
              </Link>
              <span>›</span>
              <span>{wordListInfo?.name}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{wordListInfo?.name} - 单词列表</h1>
            <p className="text-gray-600 mt-2">
              {wordListInfo?.description} • 共 {words.length} 个单词
            </p>
          </div>
          <Link
            href={`/dashboard/study/${wordListId}`}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            开始学习
          </Link>
        </div>
      </div>

      {/* 控制面板 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* 筛选选项 */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学习状态</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全部单词 ({words.length})</option>
                <option value="learned">已学习 ({words.filter(w => w.learned).length})</option>
                <option value="unlearned">未学习 ({words.filter(w => !w.learned).length})</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={filters.showDefinition}
                  onChange={(e) => setFilters(prev => ({ ...prev, showDefinition: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">显示释义</span>
              </label>
            </div>
            {/* 在UI中添加排序下拉菜单 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排序方式</label>
              <select
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value)
                  fetchWords(e.target.value)
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 导出选项 */}
          {/* <div className="flex flex-wrap gap-3">
            <span className="text-sm text-gray-700 self-center">
              已选择 {selectedWords.size} 个单词
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf_pronunciation')}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出 PDF (音标版)
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出 PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出 CSV
              </button>
              <button
                onClick={() => handleExport('txt')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出 TXT
              </button>
            </div>
          </div> */}
        </div>
      </div>

      {/* 单词列表 */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* 表格头部 */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">全选</span>
            </label>
            <span className="text-sm text-gray-500">
              显示 {filteredWords.length} 个单词
            </span>
          </div>
        </div>

        {/* 单词表格 */}
        <div className="divide-y divide-gray-200">
          {filteredWords.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">没有找到匹配的单词</p>
            </div>
          ) : (
            filteredWords.map((word) => (
              <div key={word.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  {/* 选择框 */}
                  <div className="flex-shrink-0 pt-1">
                    <input
                      type="checkbox"
                      checked={selectedWords.has(word.id)}
                      onChange={() => handleWordSelect(word.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* 单词内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{word.word}</h3>
                          
                          {/* 发音按钮 */}
                          <div className="flex items-center space-x-2">
                            {word.BrE && (
                              <button
                                onClick={() => playPronunciation(word.word, 'uk')}
                                className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                                title="英式发音"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
                                </svg>
                                <span>英 {word.BrE}</span>
                              </button>
                            )}
                            {word.AmE && (
                              <button
                                onClick={() => playPronunciation(word.word, 'us')}
                                className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                title="美式发音"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
                                </svg>
                                <span>美 {word.AmE}</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {filters.showDefinition && (
                          <div className="text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">
                            {word.definition}
                          </div>
                        )}
                      </div>

                      {/* 学习状态 */}
                      <div className="flex-shrink-0 text-right">
                        {word.learned ? (
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFamiliarityColor(word.familiarity)}`}>
                              熟悉度: {word.familiarity}/5
                            </span>
                            <span className="text-xs text-gray-500">
                              复习 {word.review_count} 次
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            未学习
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {selectedWords.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg px-6 py-4 border border-gray-200">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              已选择 {selectedWords.size} 个单词
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleExport('pdf_pronunciation')}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF (音标版)
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => handleExport('txt')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                TXT
              </button>
              <button
                onClick={() => setSelectedWords(new Set())}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                取消选择
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}