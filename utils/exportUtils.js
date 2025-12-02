
// utils/exportUtils.js
import { jsPDF } from 'jspdf'

// 字体配置变量
const FONT_CONFIG = {
  chinese: {
    name: 'msyh',
    fileName: 'msyh.subset.ttf',
    fallback: 'helvetica'
  },
  english: {
    name: 'Andika', 
    fileName: 'Andika-Regular.ttf',
    fallback: 'helvetica'
  }
}

// 导出选项枚举
export const PDFDirection = {
  LONGITUDINAL: '1',
  HORIZONTAL: '2',
  COMPACT: '3'
}

export const DictationOption = {
  DICTATION_OFF: '1',
  DICTATION_EN: '2',
  DICTATION_CH: '3'
}

export const OrderOption = {
  DEFAULT: '1',
  ALPHABETICAL: '2',
  RANDOM: '3'
}

// 选项描述映射
export const pdfDirectionDict = {
  [PDFDirection.LONGITUDINAL]: '纵向',
  [PDFDirection.HORIZONTAL]: '横向',
  [PDFDirection.COMPACT]: '紧凑模式'
}

export const dictationDict = {
  [DictationOption.DICTATION_OFF]: '默写关闭',
  [DictationOption.DICTATION_EN]: '默写英文',
  [DictationOption.DICTATION_CH]: '默写中文'
}

export const orderOptionsDict = {
  [OrderOption.DEFAULT]: '默认顺序',
  [OrderOption.ALPHABETICAL]: '字母顺序',
  [OrderOption.RANDOM]: '随机顺序'
}

// ========== 字体缓存解决方案 - 单例模式 ==========
class FontManager {
  constructor() {
    // 字体缓存
    this.fontCache = null;
    // 加载状态
    this.loading = false;
    // 加载失败重试次数
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // 获取单例实例
  static getInstance() {
    if (!FontManager.instance) {
      FontManager.instance = new FontManager();
    }
    return FontManager.instance;
  }

  // 检查字体是否已加载
  isFontsLoaded() {
    return this.fontCache !== null && !this.loading;
  }

  // 加载字体（只加载一次）
  async loadFonts() {
    // 如果正在加载，等待
    if (this.loading) {
      console.log('字体正在加载中，请等待...');
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.loadFonts();
    }

    // 如果已经加载过，直接返回
    if (this.fontCache) {
      console.log('使用已缓存的字体');
      return this.fontCache;
    }

    // 开始加载
    this.loading = true;
    
    try {
      console.log('开始加载字体...');
      
      // 并行加载两种字体，提高速度
      const [chineseFontResponse, englishFontResponse] = await Promise.all([
        fetch(`/fonts/${FONT_CONFIG.chinese.fileName}`),
        fetch(`/fonts/${FONT_CONFIG.english.fileName}`)
      ]);

      // 检查响应
      if (!chineseFontResponse.ok || !englishFontResponse.ok) {
        throw new Error(`字体加载失败: 中文 ${chineseFontResponse.status}, 英文 ${englishFontResponse.status}`);
      }

      // 并行转换
      const [chineseFontArrayBuffer, englishFontArrayBuffer] = await Promise.all([
        chineseFontResponse.arrayBuffer(),
        englishFontResponse.arrayBuffer()
      ]);

      const [chineseFontBase64, englishFontBase64] = await Promise.all([
        this.arrayBufferToBase64(chineseFontArrayBuffer),
        this.arrayBufferToBase64(englishFontArrayBuffer)
      ]);

      console.log('字体加载完成并缓存');
      
      this.fontCache = {
        chineseFont: chineseFontBase64,
        englishFont: englishFontBase64,
        loadedAt: Date.now()
      };
      
      this.loading = false;
      this.retryCount = 0;
      
      return this.fontCache;
    } catch (error) {
      this.loading = false;
      
      // 重试逻辑
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.warn(`字体加载失败，第 ${this.retryCount} 次重试...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));
        return this.loadFonts();
      } else {
        console.error('字体加载最终失败:', error);
        this.fontCache = { error: true };
        return null;
      }
    }
  }

  // 辅助函数：ArrayBuffer 转 Base64
  arrayBufferToBase64(buffer) {
    return btoa(
      new Uint8Array(buffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
  }

  // 清理缓存（如果需要重新加载）
  clearCache() {
    this.fontCache = null;
    this.retryCount = 0;
    console.log('字体缓存已清除');
  }

  // 获取缓存信息
  getCacheInfo() {
    return {
      loaded: !!this.fontCache,
      loading: this.loading,
      cacheTime: this.fontCache?.loadedAt,
      error: this.fontCache?.error
    };
  }
}

// 创建全局字体管理器实例
const fontManager = FontManager.getInstance();

// ========== 优化后的PDF导出函数 ==========

// 注册字体到PDF实例（使用缓存）
const registerFontsToPDF = async (pdf) => {
  // 检查是否已加载字体
  if (!fontManager.isFontsLoaded()) {
    console.log('字体未加载，开始加载...');
    const fonts = await fontManager.loadFonts();
    if (!fonts || fonts.error) {
      console.warn('字体加载失败，使用默认字体');
      return false;
    }
  }

  try {
    // 获取缓存的字体
    const fonts = fontManager.fontCache;
    
    // 注册中文字体
    try {
      pdf.addFileToVFS(FONT_CONFIG.chinese.fileName, fonts.chineseFont);
      pdf.addFont(FONT_CONFIG.chinese.fileName, FONT_CONFIG.chinese.name, 'normal');
      console.log('中文字体注册到PDF实例');
    } catch (chineseError) {
      console.warn('中文字体注册失败，使用默认字体:', chineseError);
    }

    // 注册英文字体
    try {
      pdf.addFileToVFS(FONT_CONFIG.english.fileName, fonts.englishFont);
      pdf.addFont(FONT_CONFIG.english.fileName, FONT_CONFIG.english.name, 'normal');
      console.log('英文字体注册到PDF实例');
    } catch (englishError) {
      console.warn('英文字体注册失败，使用默认字体:', englishError);
    }

    return true;
  } catch (error) {
    console.error('字体注册过程中出错:', error);
    return false;
  }
};

// 设置字体的辅助函数
const setFont = (pdf, fontType) => {
  const config = FONT_CONFIG[fontType];
  try {
    // 尝试设置自定义字体
    pdf.setFont(config.name, 'normal');
  } catch (error) {
    // 字体未注册，使用回退字体
    pdf.setFont(config.fallback, 'normal');
  }
};

// 文本换行处理
const wrapText = (pdf, text, maxWidth) => {
  const lines = []
  let currentLine = ''
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const testLine = currentLine + char
    const testWidth = pdf.getTextWidth(testLine)
    
    if (testWidth <= maxWidth) {
      currentLine = testLine
    } else {
      lines.push(currentLine)
      currentLine = char
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }
  
  return {
    lines,
    lineCount: lines.length
  }
}

// 主PDF导出函数
export const exportToPDFWithOptions = async (wordData, wordListName, direction, dictationMode, orderChoice) => {
  console.log('开始导出PDF...', fontManager.getCacheInfo());
  
  try {
    let pdf;
    
    // 创建PDF实例
    if (direction === PDFDirection.HORIZONTAL) {
      pdf = new jsPDF('l', 'mm', 'a4'); // 横向
    } else {
      pdf = new jsPDF('p', 'mm', 'a4'); // 纵向
    }
    
    // 注册字体（会使用缓存的字体数据）
    await registerFontsToPDF(pdf);
    
    if (direction === PDFDirection.COMPACT) {
      pdf = await exportToPDFCompact(pdf, wordData, wordListName, orderChoice)
    } else {
      pdf = await exportToPDFRegular(pdf, wordData, wordListName, direction, dictationMode)
    }

    // 添加页脚
    addFooter(pdf)
    
    // 生成文件名并保存
    const directionText = pdfDirectionDict[direction] || '未知方向'
    const dictationText = dictationDict[dictationMode] || '默写关闭'
    
    let fileName
    if (direction === PDFDirection.COMPACT) {
      fileName = `${wordListName || '单词列表'}-${directionText}.pdf`
    } else {
      fileName = `${wordListName || '单词列表'}-${directionText}-${dictationText}.pdf`
    }
    
    pdf.save(fileName)
    return fileName
  } catch (error) {
    console.error('PDF导出失败:', error);
    throw new Error('PDF导出失败: ' + error.message);
  }
};

// 显示音标的PDF导出函数
export const exportToPDFWithPronunciation = async (wordData, wordListName) => {
  console.log('开始导出带音标的PDF...', fontManager.getCacheInfo());
  
  try {
    const pdf = new jsPDF('p', 'mm', 'a4')
    await registerFontsToPDF(pdf)
    
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 20
    let yPosition = margin

    // 添加标题
    pdf.setFontSize(18)
    setFont(pdf, 'chinese')
    const title = `${wordListName} - 单词列表`
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10

    // 添加统计信息
    pdf.setFontSize(10)
    setFont(pdf, 'chinese')
    pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // 添加单词列表
    wordData.forEach((wordObj, index) => {
      // 检查是否需要新页面
      if (yPosition > pageHeight - 40) {
        pdf.addPage()
        yPosition = margin
      }

      const word = wordObj.word
      const definition = wordObj.definition

      // 序号
      pdf.setFontSize(11)
      setFont(pdf, 'chinese')
      pdf.text(`${index + 1}.`, margin, yPosition)
      
      // 单词
      pdf.setFontSize(12)
      setFont(pdf, 'english')
      pdf.text(word, margin + 10, yPosition)
      yPosition += 5
      
      // 音标 - 在同一行显示
      pdf.setFontSize(10)
      setFont(pdf, 'english')
      
      let pronunciationText = ''
      if (wordObj.BrE && wordObj.AmE) {
        pronunciationText = `BrE: ${wordObj.BrE}   AmE: ${wordObj.AmE}`
      } else if (wordObj.BrE) {
        pronunciationText = `BrE: ${wordObj.BrE}`
      } else if (wordObj.AmE) {
        pronunciationText = `AmE: ${wordObj.AmE}`
      }
      
      if (pronunciationText) {
        pdf.text(pronunciationText, margin + 10, yPosition)
        yPosition += 5
      }
      
      // 释义
      pdf.setFontSize(11)
      setFont(pdf, 'chinese')
      
      const definitionLines = pdf.splitTextToSize(definition, pageWidth - margin - 10)
      
      definitionLines.forEach(line => {
        pdf.text(line, margin + 10, yPosition)
        yPosition += 5
      })

      // 单词间的间隔
      yPosition += 8
    })

    // 添加页脚
    const totalPages = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i)
      pdf.setFontSize(8)
      setFont(pdf, 'chinese')
      pdf.text(`第 ${i} 页，共 ${totalPages} 页`, pageWidth / 2, pageHeight - 10, { align: 'center' })
    }

    // 保存文件
    const fileName = `${wordListName || '单词列表'}_单词列表_音标版.pdf`
    pdf.save(fileName)
    return fileName
    
  } catch (error) {
    console.error('PDF导出失败:', error);
    throw new Error('PDF导出失败: ' + error.message);
  }
};

// 紧凑模式PDF导出 - 修复版
const exportToPDFCompact = async (pdf, wordData, wordListName, orderChoice) => {
  // await registerFontsToPDF(pdf)
  
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const gap = 5
  const colWidth = (pageWidth - margin * 2 - gap) / 2
  const lineHeight = 4
  const maxY = pageHeight - 15
  
  let currentColumn = 0
  let yPosition = margin
  const xPositions = [margin, margin + colWidth + gap]
  
  pdf.setFontSize(7)
  
  // 添加标题 - 确保有足够空间
  setFont(pdf, 'chinese')
  pdf.text(`${wordListName} - 单词列表`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8
  
  // 添加统计信息
  pdf.setFontSize(6)
  setFont(pdf, 'chinese')
  pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10
  
  // 处理每个单词
  wordData.forEach((wordObj, index) => {
    const word = wordObj.word
    const definition = wordObj.definition
    
    // 使用空格而不是"-"号
    const text = `${word} ${definition}`
    
    // 计算文本换行
    const indentWidth = pdf.getTextWidth(`${word} `) // 改为空格
    const firstLineMaxWidth = colWidth
    const wrappedLineMaxWidth = colWidth - indentWidth
    
    // 分割第一行
    let firstLine = ''
    let remainingText = text
    for (let i = 0; i < text.length; i++) {
      const testLine = firstLine + text[i]
      if (pdf.getTextWidth(testLine) <= firstLineMaxWidth) {
        firstLine = testLine
        remainingText = remainingText.substring(1)
      } else {
        break
      }
    }
    
    // 分割剩余文本
    const wrappedResult = wrapText(pdf, remainingText, wrappedLineMaxWidth)
    const totalHeight = lineHeight + (wrappedResult.lineCount * lineHeight)
    
    // 检查是否需要换列或换页
    if (yPosition + totalHeight > maxY) {
      if (currentColumn === 0) {
        currentColumn = 1
        yPosition = margin + 18 // 保留标题空间
      } else {
        pdf.addPage()
        currentColumn = 0
        yPosition = margin + 18 // 保留标题空间
        
        // 在新页面重新添加标题
        pdf.setFontSize(7)
        setFont(pdf, 'chinese')
        pdf.text(`${wordListName} - 单词列表`, pageWidth / 2, margin, { align: 'center' })
        pdf.setFontSize(6)
        pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, margin + 8, { align: 'center' })
      }
    }
    
    // 绘制第一行
    pdf.text(firstLine, xPositions[currentColumn], yPosition)
    yPosition += lineHeight
    
    // 绘制剩余行
    wrappedResult.lines.forEach(line => {
      pdf.text(line, xPositions[currentColumn] + indentWidth, yPosition)
      yPosition += lineHeight
    })
    
    yPosition += 2 // 单词间间距
  })
  
  return pdf
}

// 常规模式PDF导出（纵向/横向）- 完全重写的表格实现
const exportToPDFRegular = async (pdf, wordData, wordListName, direction, dictationMode) => {
  // await registerFontsToPDF(pdf)
  
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  
  // 根据方向设置列宽
  let colWidths
  if (direction === PDFDirection.HORIZONTAL) {
    colWidths = [15, 35, pageWidth - 65] // 横向：序号15mm，单词35mm，释义填满剩余空间
  } else { // LONGITUDINAL
    colWidths = [15, 35, pageWidth - 65] // 纵向：同样比例
  }
  
  const baseLineHeight = 6 // 减小基础行高
  const padding = 3
  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0)
  const startX = (pageWidth - tableWidth) / 2
  let yPosition = 35
  
  // 添加标题
  pdf.setFontSize(16)
  setFont(pdf, 'chinese')
  pdf.text(`${wordListName} - 单词列表`, pageWidth / 2, 20, { align: 'center' })
  
  // 添加统计信息
  pdf.setFontSize(10)
  setFont(pdf, 'chinese')
  pdf.text(`共 ${wordData.length} 个单词`, pageWidth / 2, 30, { align: 'center' })
  
  // 添加表头
  pdf.setFillColor(66, 133, 244)
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(11)
  setFont(pdf, 'chinese')
  
  // 绘制表头背景
  pdf.rect(startX, yPosition, tableWidth, baseLineHeight, 'F')
  
  // 绘制表头文本
  const headers = ['序号', '单词', '释义']
  let headerX = startX
  headers.forEach((header, index) => {
    // 绘制表头边框
    pdf.setDrawColor(200, 200, 200)
    pdf.rect(headerX, yPosition, colWidths[index], baseLineHeight)
    
    // 绘制表头文本（居中对齐）
    pdf.text(
      header, 
      headerX + colWidths[index] / 2, 
      yPosition + baseLineHeight / 2 + 1, 
      { align: 'center' }
    )
    headerX += colWidths[index]
  })
  
  yPosition += baseLineHeight
  
  // 处理每个单词
  for (let i = 0; i < wordData.length; i++) {
    const wordObj = wordData[i]
    const word = wordObj.word
    const definition = wordObj.definition
    
    // 根据默写模式处理显示内容
    const displayWord = dictationMode === DictationOption.DICTATION_EN ? '' : word
    const displayDefinition = dictationMode === DictationOption.DICTATION_CH ? '' : definition
    
    // 计算释义需要的行数和高度
    pdf.setFontSize(9)
    setFont(pdf, 'chinese')
    const definitionLines = pdf.splitTextToSize(
      displayDefinition, 
      colWidths[2] - padding * 2
    )
    const definitionLineCount = definitionLines.length
    
    // 计算行高 - 确保每行有足够空间
    const rowHeight = Math.max(
      baseLineHeight + 2, // 最小行高
      definitionLineCount * (baseLineHeight + 1) + 2 // 基于行数的行高
    )
    
    // 检查是否需要换页
    if (yPosition + rowHeight > pageHeight - 20) {
      pdf.addPage()
      yPosition = 20
      
      // 新页面重新添加表头
      pdf.setFillColor(66, 133, 244)
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(11)
      setFont(pdf, 'chinese')
      
      // 绘制表头背景
      pdf.rect(startX, yPosition, tableWidth, baseLineHeight, 'F')
      
      // 绘制表头文本
      let newHeaderX = startX
      headers.forEach((header, index) => {
        pdf.rect(newHeaderX, yPosition, colWidths[index], baseLineHeight)
        pdf.text(
          header, 
          newHeaderX + colWidths[index] / 2, 
          yPosition + baseLineHeight / 2 + 1, 
          { align: 'center' }
        )
        newHeaderX += colWidths[index]
      })
      
      yPosition += baseLineHeight
    }
    
    // 设置行背景色（交替颜色）
    const fill = i % 2 === 0
    if (fill) {
      pdf.setFillColor(245, 245, 245) // 浅灰色
    } else {
      pdf.setFillColor(255, 255, 255) // 白色
    }
    
    // 绘制行背景
    pdf.rect(startX, yPosition, tableWidth, rowHeight, 'F')
    
    // 绘制边框
    pdf.setDrawColor(200, 200, 200)
    let borderX = startX
    colWidths.forEach((width) => {
      pdf.rect(borderX, yPosition, width, rowHeight)
      borderX += width
    })
    
    // 设置文本颜色
    pdf.setTextColor(0, 0, 0)
    
    // 序号列 - 居中对齐
    pdf.setFontSize(9)
    setFont(pdf, 'chinese')
    pdf.text(
      (i + 1).toString(), 
      startX + colWidths[0] / 2, 
      yPosition + rowHeight / 2, 
      { align: 'center' }
    )
    
    // 单词列 - 居中对齐
    if (displayWord) {
      pdf.setFontSize(10)
      setFont(pdf, 'english')
      pdf.text(
        displayWord, 
        startX + colWidths[0] + colWidths[1] / 2, 
        yPosition + rowHeight / 2, 
        { align: 'center' }
      )
    }
    
    // 释义列 - 左对齐，多行文本
    if (displayDefinition) {
      pdf.setFontSize(9)
      setFont(pdf, 'chinese')
      
      // 计算文本起始Y位置（垂直居中）
      const textStartY = yPosition + (rowHeight - (definitionLineCount * (baseLineHeight + 1))) / 2 + baseLineHeight / 2
      
      definitionLines.forEach((line, lineIndex) => {
        pdf.text(
          line, 
          startX + colWidths[0] + colWidths[1] + padding, 
          textStartY + lineIndex * (baseLineHeight + 1)
        )
      })
    }
    
    yPosition += rowHeight
  }
  
  return pdf
}

// 添加页脚
const addFooter = (pdf) => {
  const totalPages = pdf.internal.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    setFont(pdf, 'chinese')
    pdf.text(`第 ${i} 页，共 ${totalPages} 页`, pageWidth / 2, pageHeight - 10, { align: 'center' })
  }
}

// 原有的CSV和TXT导出函数保持不变
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
  a.download = `${wordListName || '单词列表'}_单词列表.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
      result += '\n' + pronunciationText.join('  ')
    }
    result += `\n${word.definition}`
    
    return result
  }).join('\n\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${wordListName || '单词列表'}_单词列表.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}