// app/dashboard/word-lists/[wordListId]/words/WordListWordsClient.js
'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {  
  exportToCSVWords, 
  exportToTXTWords,
  PDFDirection,
  DictationOption,
  exportToPDFWithOptions,
  exportToPDFWithPronunciation
} from '@/utils/exportUtils'

// 定义 OrderOption
const OrderOption = {
  DEFAULT: '1',
  ALPHABETICAL: '2',
  RANDOM: '3'
}

export default function WordListWordsClient({ 
  user,
  wordListId,
  initialWordListInfo,
  initialWords = []
}) {
  const router = useRouter()
  const [words] = useState(initialWords)
  const [wordListInfo] = useState(initialWordListInfo)
  const [error] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    showDefinition: true
  })
  const [selectedWords, setSelectedWords] = useState(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [sortOption, setSortOption] = useState('id_asc')
  const [searchKeyword, setSearchKeyword] = useState('') // 新增搜索关键词状态
  const supabase = createClient()

  // 排序选项
  const sortOptions = [
    { value: 'word_asc', label: '单词 A-Z' },
    { value: 'word_desc', label: '单词 Z-A' },
    { value: 'id_asc', label: '词库顺序' },
    { value: 'created_at_desc', label: '最近添加' }
  ]

  // 客户端排序函数
  const sortedWords = useMemo(() => {
    const sorted = [...words]
    
    switch (sortOption) {
      case 'word_asc':
        return sorted.sort((a, b) => a.word.localeCompare(b.word))
      case 'word_desc':
        return sorted.sort((a, b) => b.word.localeCompare(a.word))
      case 'id_asc':
        return sorted.sort((a, b) => a.id - b.id)
      case 'created_at_desc':
        return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      default:
        return sorted
    }
  }, [words, sortOption])

  // 搜索过滤函数
  const searchFilteredWords = useMemo(() => {
    if (!searchKeyword.trim()) {
      return sortedWords
    }
    
    const keyword = searchKeyword.toLowerCase().trim()
    return sortedWords.filter(word => 
      word.word.toLowerCase().includes(keyword) ||
      (word.definition && word.definition.toLowerCase().includes(keyword)) ||
      (word.bre && word.bre.toLowerCase().includes(keyword)) ||
      (word.ame && word.ame.toLowerCase().includes(keyword))
    )
  }, [sortedWords, searchKeyword])

  // 状态过滤单词
  const filteredWords = useMemo(() => {
    return searchFilteredWords.filter(word => {
      if (filters.status === 'learned') return word.learned
      if (filters.status === 'unlearned') return !word.learned
      return true
    })
  }, [searchFilteredWords, filters.status])

  // 选择对话框函数（保持不变）
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
          resolve(PDFDirection.LONGITUDINAL)
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
          resolve(DictationOption.DICTATION_OFF)
      }
    })
  }

  // 发音功能（保持不变）
  const playPronunciation = (word, type = 'us') => {
    const audioUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type === 'uk' ? 1 : 2}`
    const audio = new Audio(audioUrl)
    audio.play().catch(error => {
      console.error('播放发音失败:', error)
    })
  }

  // 处理单词选择（保持不变）
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

  // 全选/取消全选（保持不变）
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedWords(new Set())
    } else {
      const allWordIds = new Set(filteredWords.map(word => word.id))
      setSelectedWords(allWordIds)
    }
    setSelectAll(!selectAll)
  }

  const handleClearSelection = () => {
    setSelectedWords(new Set())
    setSelectAll(false) // 添加这行
  }

  // PDF导出处理函数（保持不变）
  const handlePDFExport = async (selectedWordData) => {
    try {
      const direction = await selectPDFDirection()
      
      let dictationMode = DictationOption.DICTATION_OFF
      if (direction !== PDFDirection.COMPACT) {
        dictationMode = await selectDictationMode()
      }
      
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

  // 导出处理函数（保持不变）
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

  // 熟悉度颜色和文本函数（保持不变）
  const getFamiliarityColor = (familiarity) => {
    switch (familiarity) {
      case 4: return 'text-green-600 bg-green-100'
      case 3: return 'text-yellow-600 bg-yellow-100'
      case 2: return 'text-orange-600 bg-orange-100'
      case 1: return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getFamiliarityText = (familiarity) => {
    switch (familiarity) {
      case 4: return '简单'
      case 3: return '一般'
      case 2: return '困难'
      case 1: return '忘记'
      default: return '未学习'
    }
  }

  // 错误状态组件
  if (error && words.length === 0) {
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
              {searchKeyword && (
                <span className="text-blue-600 ml-2">
                  • 搜索到 {filteredWords.length} 个结果
                </span>
              )}
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

      {/* 错误提示 */}
      {error && words.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">{error}</p>
            </div>
          </div>
        </div>
      )}

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">排序方式</label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 搜索框 - 新增 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">搜索单词</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索单词或释义..."
                  className="border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchKeyword && (
                  <button
                    onClick={() => setSearchKeyword('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
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
              {searchKeyword && (
                <span className="text-blue-600 ml-1">
                  (搜索: &quot;{searchKeyword}&quot;)
                </span>
              )}
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
              <p className="text-gray-500">
                {searchKeyword ? `没有找到包含 "${searchKeyword}" 的单词` : '没有找到匹配的单词'}
              </p>
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
                >
                  清除搜索条件
                </button>
              )}
            </div>
          ) : (
            filteredWords.map((word) => (
              <WordListItem 
                key={word.id}
                word={word}
                isSelected={selectedWords.has(word.id)}
                onSelect={() => handleWordSelect(word.id)}
                showDefinition={filters.showDefinition}
                playPronunciation={playPronunciation}
                getFamiliarityColor={getFamiliarityColor}
                getFamiliarityText={getFamiliarityText}
                searchKeyword={searchKeyword} // 传递搜索关键词用于高亮
              />
            ))
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {selectedWords.size > 0 && (
        <ExportActions 
          selectedWordsCount={selectedWords.size}
          onExport={handleExport}
          onClearSelection={handleClearSelection}
        />
      )}
    </div>
  )
}

// 单词列表项组件（添加搜索高亮功能）
function WordListItem({ word, isSelected, onSelect, showDefinition, playPronunciation, getFamiliarityColor, getFamiliarityText, searchKeyword }) {
  
  // 高亮搜索关键词的函数
  const highlightText = (text, keyword) => {
    if (!keyword || !text) return text;
    
    const regex = new RegExp(`(${keyword})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-start space-x-4">
        {/* 选择框 */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </div>

        {/* 单词内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {searchKeyword ? highlightText(word.word, searchKeyword) : word.word}
                </h3>
                
                {/* 发音按钮 */}
                <div className="flex items-center space-x-2">
                  {word.bre && (
                    <button
                      onClick={() => playPronunciation(word.word, 'uk')}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                      title="英式发音"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
                      </svg>
                      <span>英 {word.bre}</span>
                    </button>
                  )}
                  {word.ame && (
                    <button
                      onClick={() => playPronunciation(word.word, 'us')}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                      title="美式发音"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m-2.828-9.9a9 9 0 012.728-2.728" />
                      </svg>
                      <span>美 {word.ame}</span>
                    </button>
                  )}
                </div>
              </div>

              {showDefinition && (
                <div className="text-gray-700 mb-2 whitespace-pre-wrap leading-relaxed">
                  {searchKeyword ? highlightText(word.definition, searchKeyword) : word.definition}
                </div>
              )}
            </div>

            {/* 学习状态 */}
            <div className="flex-shrink-0 text-right">
              {word.learned ? (
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFamiliarityColor(word.familiarity)}`}>
                    {getFamiliarityText(word.familiarity)}
                  </span>
                  <span className="text-xs text-gray-500">
                    复习 {word.review_count} 次
                  </span>
                  {word.next_review_at && (
                    <span className="text-xs text-blue-500">
                      下次: {new Date(word.next_review_at).toLocaleDateString()}
                    </span>
                  )}
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
  )
}

// 导出操作组件（保持不变）
function ExportActions({ selectedWordsCount, onExport, onClearSelection }) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg px-6 py-4 border border-gray-200">
      <div className="flex items-center space-x-4">
        <span className="text-sm font-medium text-gray-700">
          已选择 {selectedWordsCount} 个单词
        </span>
        <div className="flex space-x-2">
          <button
            onClick={() => onExport('pdf_pronunciation')}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF (音标版)
          </button>
          <button
            onClick={() => onExport('pdf')}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => onExport('csv')}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
          </button>
          <button
            onClick={() => onExport('txt')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            TXT
          </button>
          <button
            onClick={onClearSelection}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            取消选择
          </button>
        </div>
      </div>
    </div>
  )
}