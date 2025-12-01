// app/dashboard/stats/StatsClient.js - 优化版本
'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts'

export default function StatsClient({ 
  user, 
  studyStats, 
  dailyStats = [], 
  streakData = [] ,
  wordListProgress = []
}) {
  const [timeRange, setTimeRange] = useState('30days') // 30days, 7days, 90days

  // 使用 useMemo 优化计算，避免重复渲染时重复计算
  const { chartData, statistics } = useMemo(() => {
    const daysCount = getDaysCount(timeRange)
    const filteredData = dailyStats.slice(-daysCount)
    
    // 计算学习数据统计
    const totalWords = filteredData.reduce((sum, day) => sum + day.words_studied, 0)
    const studyDays = filteredData.filter(day => day.studied).length
    const averageWords = studyDays > 0 ? Math.round(totalWords / studyDays) : 0
    const bestDay = Math.max(...filteredData.map(d => d.words_studied))
    const studyFrequency = Math.round((studyDays / filteredData.length) * 100)

    return {
      chartData: filteredData,
      statistics: {
        totalWords,
        studyDays,
        averageWords,
        bestDay,
        studyFrequency
      }
    }
  }, [dailyStats, timeRange])

  // 今日学习数据 - 直接从 studyStats 获取
  const todayData = studyStats

  // 调试信息（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('StatsClient 接收到的数据:', {
      studyStats,
      dailyStatsCount: dailyStats.length,
      streakDataCount: streakData.length,
      chartDataCount: chartData.length
    })
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* 头部标题 */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">学习统计</h1>
            <p className="text-gray-600 mt-2">跟踪你的学习进度和成就</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            ← 返回首页
          </Link>
        </div>
      </div>

      {/* 关键数据概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="连续打卡"
          value={`${studyStats.currentStreak} 天`}
          subtitle={`最长 ${studyStats.longestStreak} 天`}
          color="red"
          icon="🔥"
        />
        <StatCard
          title="总学习天数"
          value={`${studyStats.totalStudyDays} 天`}
          color="blue"
          icon="📚"
        />
        <StatCard
          title="已学单词"
          value={studyStats.totalWordsStudied.toLocaleString()}
          color="green"
          icon="✅"
        />
        <StatCard
          title="词库数量"
          value={studyStats.wordListCount}
          color="purple"
          icon="📁"
        />
      </div>

      {/* 今日学习概览 */}
      <TodayStudyOverview studyStats={studyStats} />

      {/* 时间范围选择 */}
      <TimeRangeSelector timeRange={timeRange} setTimeRange={setTimeRange} />

      {/* 学习趋势图表 */}
      <StudyCharts chartData={chartData} />

      {/* 学习日历和详细统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 学习日历 */}
        <StudyCalendar data={dailyStats} />
        
        {/* 学习数据统计 */}
        <StudyStatistics statistics={statistics} />
      </div>

      {/* 词库进度展示 */}
      <WordListProgressSection wordListProgress={wordListProgress} />

      {/* 如果没有数据，显示提示信息 */}
      {studyStats.totalStudyDays === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center mt-8">
          <div className="text-yellow-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-yellow-800 mb-2">还没有学习记录</h3>
          <p className="text-yellow-700 mb-4">
            开始学习单词后，这里会显示详细的学习统计信息。
          </p>
          <Link
            href="/dashboard/word-lists"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
          >
            选择词库开始学习
          </Link>
        </div>
      )}
    </div>
  )
}

// 今日学习概览组件
function TodayStudyOverview({ studyStats }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">今日学习</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TodayStatCard
          title="学习单词"
          value={studyStats.todayStudied}
          color="blue"
        />
        <TodayStatCard
          title="新学单词"
          value={studyStats.todayNewWords}
          color="green"
        />
        <TodayStatCard
          title="复习单词"
          value={studyStats.todayReviewWords}
          color="orange"
        />
        <TodayStatCard
          title="学习时间"
          value={formatStudyTime(studyStats.todayStudyTime)}
          color="purple"
        />
      </div>
    </div>
  )
}

// 时间范围选择器组件
function TimeRangeSelector({ timeRange, setTimeRange }) {
  const ranges = [
    { key: '7days', label: '最近7天' },
    { key: '30days', label: '最近30天' },
    { key: '90days', label: '最近90天' }
  ]

  return (
    <div className="flex justify-end mb-4">
      <div className="inline-flex rounded-md shadow-sm">
        {ranges.map((range, index) => (
          <button
            key={range.key}
            onClick={() => setTimeRange(range.key)}
            className={`px-4 py-2 text-sm font-medium border ${
              timeRange === range.key
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } ${index === 0 ? 'rounded-l-md' : ''} ${
              index === ranges.length - 1 ? 'rounded-r-md' : 'border-r-0'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// 学习图表组件
function StudyCharts({ chartData }) {
  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center mb-8">
        <p className="text-gray-500">暂无图表数据</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* 每日学习单词数趋势图 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">学习趋势</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
              formatter={(value) => [value, '单词数']}
            />
            <Line 
              type="monotone" 
              dataKey="words_studied" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="学习单词"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#1d4ed8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 新学 vs 复习单词 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">新学 vs 复习</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
            />
            <Legend />
            <Bar dataKey="new_words" name="新学单词" fill="#10b981" />
            <Bar dataKey="review_words" name="复习单词" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// 学习日历组件
function StudyCalendar({ data }) {
  // 显示最近30天的数据
  const calendarData = data.slice(-30)
  
  // 获取星期几的标签
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  
  // 计算日历开始日期（确保从周日开始）
  const startDate = new Date(calendarData[0]?.date || new Date())
  const startDay = startDate.getDay()
  const adjustedStartDate = new Date(startDate)
  adjustedStartDate.setDate(startDate.getDate() - startDay)

  return (
    <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">学习日历</h3>
      
      {/* 星期标签 */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
      </div>
      
      {/* 日历格子 */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 42 }).map((_, index) => {
          const currentDate = new Date(adjustedStartDate)
          currentDate.setDate(adjustedStartDate.getDate() + index)
          const dateStr = currentDate.toLocaleDateString('en-CA')
          const dayData = calendarData.find(d => d.date === dateStr)
          const wordsStudied = dayData?.words_studied || 0
          const studied = wordsStudied > 0
          const intensity = Math.min(wordsStudied / 30, 1) // 假设30个单词为最高强度
          
          // 检查是否在日历数据范围内
          const isInRange = currentDate >= new Date(calendarData[0]?.date) && 
                           currentDate <= new Date(calendarData[calendarData.length - 1]?.date)
          
          return (
            <div key={dateStr} className="text-center">
              <div className={`text-xs mb-1 ${
                isInRange ? 'text-gray-700' : 'text-gray-400'
              }`}>
                {currentDate.getDate()}
              </div>
              <div 
                className={`w-6 h-6 mx-auto rounded border ${
                  studied 
                    ? `bg-green-500 border-green-600` 
                    : 'bg-gray-100 border-gray-200'
                } ${!isInRange ? 'opacity-30' : ''}`}
                style={{
                  opacity: studied ? 0.3 + intensity * 0.7 : (isInRange ? 1 : 0.3)
                }}
                title={isInRange ? 
                  `${currentDate.toLocaleDateString('zh-CN')}: ${wordsStudied} 个单词` : 
                  '不在统计范围内'
                }
              />
            </div>
          )
        })}
      </div>
      
      {/* 图例 */}
      <div className="flex justify-center items-center mt-4 text-xs text-gray-500">
        <div className="flex items-center mr-4">
          <div className="w-3 h-3 bg-gray-100 border border-gray-300 mr-1"></div>
          <span>未学习</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 border border-green-600 mr-1"></div>
          <span>已学习</span>
        </div>
      </div>
    </div>
  )
}

// 学习数据统计组件
function StudyStatistics({ statistics }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">学习数据</h3>
      <div className="space-y-4">
        <DataItem 
          label="总学习单词" 
          value={statistics.totalWords.toLocaleString()} 
        />
        <DataItem 
          label="学习天数" 
          value={statistics.studyDays} 
        />
        <DataItem 
          label="平均每日" 
          value={`${statistics.averageWords} 单词`} 
        />
        <DataItem 
          label="学习频率" 
          value={`${statistics.studyFrequency}%`} 
        />
        <DataItem 
          label="最佳单日" 
          value={statistics.bestDay} 
        />
      </div>
    </div>
  )
}

// 辅助函数：根据时间范围获取天数
function getDaysCount(range) {
  switch (range) {
    case '7days': return 7
    case '90days': return 90
    default: return 30
  }
}

// 辅助函数：格式化学习时间
function formatStudyTime(seconds) {
  if (seconds === 0) return '0 分钟'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} 分钟`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? 
      `${hours} 小时 ${remainingMinutes} 分钟` : 
      `${hours} 小时`
  }
}

// 统计卡片组件
function StatCard({ title, value, subtitle, color, icon }) {
  const colorClasses = {
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600'
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
    </div>
  )
}

// 今日统计卡片
function TodayStatCard({ title, value, color }) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    orange: 'border-orange-200 bg-orange-50',
    purple: 'border-purple-200 bg-purple-50'
  }

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

// 数据项组件
function DataItem({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// 词库进度展示组件
function WordListProgressSection({ wordListProgress }) {
  if (wordListProgress.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <div className="text-yellow-500 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-yellow-800 mb-2">还没有选择词库</h3>
        <p className="text-yellow-700 mb-4">
          选择你想要学习的词库，开始高效学习单词吧！
        </p>
        <Link
          href="/dashboard/word-lists"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          立即选择词库
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">词库学习进度</h2>
        <Link 
          href="/dashboard/word-lists" 
          className="text-blue-500 hover:text-blue-600 text-sm font-medium"
        >
          管理词库
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wordListProgress.map((list) => (
          <div 
            key={list.word_list_id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <h3 className="font-semibold text-gray-900 truncate">{list.word_list_name}</h3>
            {list.description && (
              <p className="text-gray-600 text-sm mt-1 line-clamp-2">{list.description}</p>
            )}
            <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
              <span>{list.word_count} 个单词</span>
              <div className="flex space-x-2">
                <span className="text-green-600">
                  {list.learned_count || 0} 已学
                </span>
                <Link 
                  href={`/dashboard/study/${list.word_list_id}`}
                  className="text-blue-500 hover:text-blue-600 font-medium"
                >
                  学习
                </Link>
              </div>
            </div>
            {/* 进度条 */}
            <div className="mt-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>学习进度</span>
                <span>{Math.round(list.progress_percent || 0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(list.progress_percent || 0, 100)}%` 
                  }}
                ></div>
              </div>
            </div>
            
            {/* 今日复习提醒 */}
            {list.today_review_count > 0 && (
              <div className="mt-3 flex items-center text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                今日需复习: {list.today_review_count} 个单词
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 总体进度统计 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {wordListProgress.length}
            </div>
            <div className="text-sm text-gray-600">总词库数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {wordListProgress.reduce((sum, list) => sum + (list.learned_count || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">已学单词</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {wordListProgress.reduce((sum, list) => sum + (list.word_count || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">总单词数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {Math.round(wordListProgress.reduce((sum, list) => sum + (list.progress_percent || 0), 0) / wordListProgress.length)}%
            </div>
            <div className="text-sm text-gray-600">平均进度</div>
          </div>
        </div>
      </div>
    </div>
  )
}
