// utils/exportUtils.js
import { jsPDF } from 'jspdf'

// 加载中文字体
const loadChineseFont = async () => {
  try {
    // 从public目录加载字体文件
    const fontResponse = await fetch('/fonts/hei.ttf')
    const fontArrayBuffer = await fontResponse.arrayBuffer()
    
    // 将 ArrayBuffer 转换为 base64
    const base64 = btoa(
      new Uint8Array(fontArrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    )
    
    return base64
  } catch (error) {
    console.error('字体加载失败:', error)
    return null
  }
}

// 缓存字体
let chineseFontLoaded = false

// 简化的PDF导出函数 - 只导出单词和释义
export const exportToPDFAdvanced = async (wordData, wordListName) => {
  try {
    // 创建PDF文档
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    // 加载中文字体
    if (!chineseFontLoaded) {
      const fontBase64 = await loadChineseFont()
      if (fontBase64) {
        try {
          pdf.addFileToVFS('hei.ttf', fontBase64)
          pdf.addFont('hei.ttf', 'hei', 'normal')
          chineseFontLoaded = true
        } catch (fontError) {
          console.warn('字体注册失败，使用默认字体:', fontError)
        }
      }
    }

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin
    let currentPage = 1

    // 使用中文字体（如果可用）
    const currentFont = chineseFontLoaded ? 'hei' : 'helvetica'

    // 添加标题 - 使用中文字体
    pdf.setFontSize(18)
    pdf.setFont(currentFont, 'normal')
    const title = `${wordListName} - 单词列表`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // 添加统计信息 - 使用中文字体
    pdf.setFontSize(10)
    if (chineseFontLoaded) {
      pdf.setFont('hei', 'normal')
    } else {
      pdf.setFont('helvetica', 'normal')
    }
    pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // 添加单词列表
    wordData.forEach((word, index) => {
      // 检查是否需要新页面
      if (yPosition > pageHeight - 20) {
        pdf.addPage()
        currentPage++
        yPosition = margin
        
        // 新页面重置字体
        if (chineseFontLoaded) {
          pdf.setFont('hei', 'normal')
        } else {
          pdf.setFont('helvetica', 'normal')
        }
      }

      // 序号 - 使用中文字体
      pdf.setFontSize(11)
      if (chineseFontLoaded) {
        pdf.setFont('hei', 'bold')
      } else {
        pdf.setFont('helvetica', 'bold')
      }
      pdf.text(`${index + 1}.`, margin, yPosition)
      
      // 单词 - 使用默认字体
      pdf.setFontSize(12)
      pdf.setFont('helvetica', 'bold')
      pdf.text(word.word, margin + 10, yPosition)
      
      // 释义 - 使用中文字体
      if (chineseFontLoaded) {
        pdf.setFont('hei', 'normal')
      } else {
        pdf.setFont('helvetica', 'normal')
      }
      
      const definition = word.definition
      const definitionLines = pdf.splitTextToSize(definition, pageWidth - margin - 50)
      
      if (definitionLines.length === 1) {
        pdf.text(definitionLines[0], margin + 50, yPosition)
        yPosition += 8
      } else {
        // 第一行与单词对齐
        pdf.text(definitionLines[0], margin + 50, yPosition)
        yPosition += 5
        
        // 后续行缩进
        for (let i = 1; i < definitionLines.length; i++) {
          pdf.text(definitionLines[i], margin + 10, yPosition)
          yPosition += 5
        }
        yPosition += 3
      }
    })

    // 添加页脚 - 使用中文字体
    const totalPages = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      if (chineseFontLoaded) {
        pdf.setFont('hei', 'normal')
      } else {
        pdf.setFont('helvetica', 'normal')
      }
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

// 简化的CSV导出 - 只包含单词和释义
export const exportToCSVWords = (wordData, wordListName) => {
  const headers = ['单词', '释义']
  const csvContent = [
    headers.join(','),
    ...wordData.map(word => [
      `"${word.word}"`,
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

// 简化的TXT导出 - 只包含单词和释义
export const exportToTXTWords = (wordData, wordListName) => {
  const content = wordData.map((word, index) => 
    `${index + 1}. ${word.word} - ${word.definition}`
  ).join('\n\n')

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