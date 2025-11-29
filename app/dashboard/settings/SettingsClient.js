// app/dashboard/settings/SettingsClient.js
'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsClient({ 
  user,
  initialSettings = { daily_goal: 10 }
}) {
  const { user: authUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState(initialSettings)
  const supabase = createClient()

  const handleSave = async () => {
    const currentUser = user || authUser
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          daily_goal: settings.daily_goal
        })
        .eq('id', currentUser.id)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('保存设置失败:', error)
      alert('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">学习设置</h1>
        <p className="text-gray-600 mt-2">个性化你的学习体验</p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            每日学习目标
          </label>
          <p className="text-sm text-gray-500 mb-4">
            设置每天学习的新单词数量
          </p>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              min="0"
              max="1000"
              value={settings.daily_goal}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                daily_goal: parseInt(e.target.value) || 1
              }))}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-600">个新单词/天</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            返回仪表板
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '保存中...' : '保存设置'}
          </button>
        </div>

        {saved && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700 text-sm">设置已保存！</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}