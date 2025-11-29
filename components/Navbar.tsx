// components/Navbar.tsx - 增强退出处理
'use client'
import { useAuth } from '@/context/AuthContext'
import Link from 'next/link'
import { useState } from 'react'

export default function Navbar() {
  const { user, signOut , signOutWithRetry} = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    try {
      console.log('Navbar: 开始退出登录（使用重试机制）')
      
      // 使用带重试机制的退出函数
      const result = await signOutWithRetry(3) // 重试3次
      
      if (result.error) {
        console.error('Navbar: 退出登录失败:', result.error)
        // 即使失败也强制重定向
        if (typeof window !== 'undefined') {
          window.location.replace('/')
        }
      } else {
        console.log('Navbar: 退出登录成功')
      }
    } catch (error) {
      console.error('Navbar: 退出登录异常:', error)
      // 发生异常时强制重定向
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              单词学习
            </Link>
            {user && (
              <div className="hidden md:flex space-x-4">
                <Link 
                  href="/dashboard" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  仪表板
                </Link>
                <Link 
                  href="/dashboard/word-lists" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  词库管理
                </Link>
                <Link 
                  href="/dashboard/study" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  学习
                </Link>
                <Link 
                  href="/dashboard/settings" 
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  设置
                </Link>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-gray-700 hidden sm:inline text-sm">
                  {user.email?.split('@')[0] || user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSigningOut ? '退出中...' : '退出登录'}
                </button>
              </>
            ) : (
              <div className="space-x-2">
                <Link
                  href="/auth/login"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  登录
                </Link>
                <Link
                  href="/auth/signup"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}