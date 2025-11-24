// components/UploadWordList.js - 完整优化版
'use client'
import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'

export default function UploadWordList({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    file: null
  })
  const supabase = createClient()

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('文件大小不能超过 5MB')
        return
      }

      const fileName = file.name.replace(/\.[^/.]+$/, "")
      setFormData(prev => ({
        ...prev,
        file,
        name: prev.name || fileName
      }))
      setError('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.file) {
      setError('请填写词库名称并选择文件')
      return
    }

    setLoading(true)
    setError('')
    setProgress(0)

    try {
      setProgress(10)
      const words = await parseFile(formData.file)
      setProgress(30)
      
      if (words.length === 0) {
        throw new Error('文件中没有找到有效的单词数据')
      }

      // 验证数据格式
      const invalidWords = words.filter(word => !word.word || !word.definition)
      if (invalidWords.length > 0) {
        throw new Error(`发现 ${invalidWords.length} 个单词缺少必要的单词或释义字段`)
      }

      if (words.length > 10000) {
        throw new Error('单词数量过多，请确保文件不超过 10000 个单词')
      }

      setProgress(50)
      // 创建词库记录
      const { data: wordList, error: listError } = await supabase
        .from('word_lists')
        .insert([
          {
            name: formData.name.trim(),
            description: formData.description.trim(),
            word_count: words.length,
            created_by: user.id
          }
        ])
        .select()
        .single()

      if (listError) throw listError
      setProgress(70)

      // 分批插入单词
      const batchSize = 100
      const batches = []
      for (let i = 0; i < words.length; i += batchSize) {
        batches.push(words.slice(i, i + batchSize))
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const studyRecords = batch.map(word => ({
          user_id: user.id,
          word_list_id: wordList.id,
          word: word.word.substring(0, 100),
          definition: word.definition.substring(0, 500),
          pronunciation: word.pronunciation ? word.pronunciation.substring(0, 100) : '',
          created_at: new Date().toISOString()
        }))

        const { error: recordsError } = await supabase
          .from('study_records')
          .insert(studyRecords)

        if (recordsError) throw recordsError
        
        setProgress(70 + (i / batches.length) * 25)
      }

      setProgress(100)
      setTimeout(() => {
        onSuccess()
      }, 500)

    } catch (err) {
      console.error('导入失败:', err)
      setError(err.message || '导入失败，请检查文件格式和内容')
    } finally {
      setLoading(false)
    }
  }

  const parseFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target.result
          let words = []

          if (file.name.endsWith('.csv')) {
            words = parseCSV(content)
          } else if (file.name.endsWith('.json')) {
            words = parseJSON(content)
          } else if (file.name.endsWith('.txt')) {
            words = parseTXT(content)
          } else {
            reject(new Error('不支持的文件格式，请上传 CSV、JSON 或 TXT 文件'))
            return
          }

          resolve(words)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'UTF-8')
    })
  }

  // 更新后的解析函数
  const parseCSV = (content) => {
    const lines = content.split('\n').filter(line => line.trim())
    const words = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 处理CSV格式：支持逗号分隔，处理带引号的情况
      const parts = line.split(',').map(part => 
        part.trim().replace(/^"(.*)"$/, '$1')
      )
      
      // 至少需要单词和释义两部分
      if (parts.length >= 2 && parts[0] && parts[1]) {
        words.push({
          word: parts[0],
          definition: parts[1],
          pronunciation: parts[2] || '' // 第三部分是音标，可选
        })
      }
    }
    return words
  }

  const parseJSON = (content) => {
    try {
      const data = JSON.parse(content)
      const words = []
      
      if (Array.isArray(data)) {
        data.forEach(item => {
          // 必须有word和definition，pronunciation可选
          if (item.word && item.definition) {
            words.push({
              word: item.word,
              definition: item.definition,
              pronunciation: item.pronunciation || ''
            })
          }
        })
      } else if (data.words && Array.isArray(data.words)) {
        data.words.forEach(item => {
          if (item.word && item.definition) {
            words.push({
              word: item.word,
              definition: item.definition,
              pronunciation: item.pronunciation || ''
            })
          }
        })
      } else {
        throw new Error('JSON 格式不正确，期望包含单词和释义的数组')
      }
      
      return words
    } catch (err) {
      throw new Error('JSON 解析失败: ' + err.message)
    }
  }

  const parseTXT = (content) => {
    const lines = content.split('\n').filter(line => line.trim())
    const words = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 支持多种分隔符：制表符、逗号、竖线等
      let parts = []
      
      // 优先尝试制表符分隔
      if (line.includes('\t')) {
        parts = line.split('\t').map(part => part.trim())
      } 
      // 然后尝试逗号分隔
      else if (line.includes(',')) {
        parts = line.split(',').map(part => part.trim())
      }
      // 最后尝试竖线分隔
      else if (line.includes('|')) {
        parts = line.split('|').map(part => part.trim())
      }
      // 如果没有明确的分隔符，尝试用空格分割（但单词中可能有空格，所以这是最后的选择）
      else {
        // 查找第一个连续的空格作为分隔点
        const firstSpaceGroup = line.search(/\s{2,}/)
        if (firstSpaceGroup !== -1) {
          parts = [
            line.substring(0, firstSpaceGroup).trim(),
            line.substring(firstSpaceGroup).trim()
          ]
        } else {
          // 如果连连续空格都没有，跳过这行
          continue
        }
      }
      
      // 至少需要单词和释义两部分
      if (parts.length >= 2 && parts[0] && parts[1]) {
        words.push({
          word: parts[0],
          definition: parts[1],
          pronunciation: parts[2] || '' // 第三部分是音标，可选
        })
      }
    }
    return words
  }

  // 模态框UI部分保持不变
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">导入词库</h3>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>导入进度</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                词库名称 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：四级核心词汇"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                词库描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="可选：描述这个词库的特点"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                选择文件 *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.txt"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
              {formData.file && (
                <p className="text-sm text-green-600 mt-1">
                  已选择: {formData.file.name}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                支持格式: CSV, JSON, TXT
                <br />
                CSV格式: 单词,释义,音标(可选)
                <br />
                JSON格式示例：
                <br />
                数组形式: <code>{`[{"word":"apple","definition":"苹果","pronunciation":"/ˈæpl/"}]`}</code>
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                disabled={loading}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-500 border border-transparent rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    导入中...
                  </>
                ) : (
                  '导入词库'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}