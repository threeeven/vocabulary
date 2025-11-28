// utils/exportUtils.js
import { jsPDF } from 'jspdf'

// 字体配置变量 - 方便以后更换字体
const FONT_CONFIG = {
  chinese: {
    name: 'hei',
    fileName: 'hei.ttf',
    fallback: 'helvetica'
  },
  english: {
    name: 'Andika', 
    fileName: 'Andika-Regular.ttf',
    fallback: 'helvetica'
  }
}

// 加载字体
const loadFonts = async () => {
  try {
    // 加载中文字体
    const chineseFontResponse = await fetch(`/fonts/${FONT_CONFIG.chinese.fileName}`)
    const chineseFontArrayBuffer = await chineseFontResponse.arrayBuffer()
    const chineseFontBase64 = btoa(
      new Uint8Array(chineseFontArrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    )

    // 加载英文字体
    const englishFontResponse = await fetch(`/fonts/${FONT_CONFIG.english.fileName}`)
    const englishFontArrayBuffer = await englishFontResponse.arrayBuffer()
    const englishFontBase64 = btoa(
      new Uint8Array(englishFontArrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    )

    return {
      chineseFont: chineseFontBase64,
      englishFont: englishFontBase64
    }
  } catch (error) {
    console.error('字体加载失败:', error)
    return null
  }
}

// 缓存字体状态
let chineseFontLoaded = false
let englishFontLoaded = false

// 设置字体的辅助函数
const setFont = (pdf, fontType) => {
  const config = FONT_CONFIG[fontType]
  if (fontType === 'chinese' && chineseFontLoaded) {
    pdf.setFont(config.name, 'normal')
  } else if (fontType === 'english' && englishFontLoaded) {
    pdf.setFont(config.name, 'normal')
  } else {
    pdf.setFont(config.fallback, 'normal')
  }
}

// 简化的PDF导出函数 - 导出单词、音标和释义
export const exportToPDFAdvanced = async (wordData, wordListName) => {
  try {
    // 创建PDF文档
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    // 加载字体
    if (!chineseFontLoaded || !englishFontLoaded) {
      const fonts = await loadFonts()
      if (fonts) {
        try {
          // 注册中文字体
          pdf.addFileToVFS(FONT_CONFIG.chinese.fileName, fonts.chineseFont)
          pdf.addFont(FONT_CONFIG.chinese.fileName, FONT_CONFIG.chinese.name, 'normal')
          chineseFontLoaded = true
        } catch (chineseFontError) {
          console.warn('中文字体注册失败，使用默认字体:', chineseFontError)
        }

        try {
          // 注册英文字体
          pdf.addFileToVFS(FONT_CONFIG.english.fileName, fonts.englishFont)
          pdf.addFont(FONT_CONFIG.english.fileName, FONT_CONFIG.english.name, 'normal')
          englishFontLoaded = true
        } catch (englishFontError) {
          console.warn('英文字体注册失败，使用默认字体:', englishFontError)
        }
      }
    }

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin
    let currentPage = 1

    // 添加标题 - 使用中文字体
    pdf.setFontSize(18)
    setFont(pdf, 'chinese')
    const title = `${wordListName} - 单词列表`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // 添加统计信息 - 使用中文字体
    pdf.setFontSize(10)
    setFont(pdf, 'chinese')
    pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // 添加单词列表
    wordData.forEach((word, index) => {
      // 检查是否需要新页面
      if (yPosition > pageHeight - 30) {
        pdf.addPage()
        currentPage++
        yPosition = margin
      }

      // 序号 - 使用中文字体
      pdf.setFontSize(11)
      setFont(pdf, 'chinese')
      pdf.text(`${index + 1}.`, margin, yPosition)
      
      // 单词 - 使用英文字体
      pdf.setFontSize(12)
      setFont(pdf, 'english')
      pdf.text(word.word, margin + 10, yPosition)
      yPosition += 5
      
      // 音标 - 使用英文字体，在同一行显示
      pdf.setFontSize(10)
      setFont(pdf, 'english')
      
      let pronunciationText = ''
      if (word.BrE && word.AmE) {
        pronunciationText = `BrE: ${word.BrE}     AmE: ${word.AmE}`
      } else if (word.BrE) {
        pronunciationText = `BrE: ${word.BrE}`
      } else if (word.AmE) {
        pronunciationText = `AmE: ${word.AmE}`
      }
      
      if (pronunciationText) {
        pdf.text(pronunciationText, margin + 10, yPosition)
        yPosition += 5
      }
      
      // 释义 - 使用中文字体
      pdf.setFontSize(11)
      setFont(pdf, 'chinese')
      
      const definition = word.definition
      const definitionLines = pdf.splitTextToSize(definition, pageWidth - margin - 10)
      
      definitionLines.forEach(line => {
        pdf.text(line, margin + 10, yPosition)
        yPosition += 5
      })

      // 单词间的间隔
      yPosition += 8
    })

    // 添加页脚 - 使用中文字体
    const totalPages = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      setFont(pdf, 'chinese')
      pdf.text(`第 ${i} 页，共 ${totalPages} 页`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    }

    // 保存文件 - 使用中文文件名
    const fileName = `${wordListName || '单词列表'}_单词列表.pdf`
    pdf.save(fileName)

  } catch (error) {
    console.error('PDF导出失败:', error)
    throw new Error('PDF导出失败: ' + error.message)
  }
}

// 简化的CSV导出 - 包含单词、音标和释义
export const exportToCSVWords = (wordData, wordListName) => {
  const headers = ['单词', 'BrE', 'AmE', '释义']
  const csvContent = [
    headers.join(','),
    ...wordData.map(word => [
      `"${word.word}"`,
      `"${word.BrE || ''}"`,
      `"${word.AmE || ''}"`,
      `"${word.definition}"`
    ].join(','))
  ].join('\n')

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // 使用中文文件名
  a.download = `${wordListName || '单词列表'}_单词列表.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 简化的TXT导出 - 包含单词、音标和释义
export const exportToTXTWords = (wordData, wordListName) => {
  const content = wordData.map((word, index) => {
    let pronunciationText = []
    if (word.BrE) {
      pronunciationText.push(`BrE: ${word.BrE}`)
    }
    if (word.AmE) {
      pronunciationText.push(`AmE: ${word.AmE}`)
    }
    
    let result = `${index + 1}. ${word.word}`
    if (pronunciationText.length > 0) {
      result += '\n' + pronunciationText.join('  ') // 两个空格分隔
    }
    result += `\n${word.definition}`
    
    return result
  }).join('\n\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // 使用中文文件名
  a.download = `${wordListName || '单词列表'}_单词列表.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}