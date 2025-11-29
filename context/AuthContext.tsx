// context/AuthContext.tsx
'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthContextType } from '@/types/auth'
import { useRouter } from 'next/navigation'

// 创建上下文时提供默认值
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => ({ data: { user: null, session: null }, error: null }),
  signIn: async () => ({ data: { user: null, session: null }, error: null }),
  signOut: async () => ({ error: null }),
  signOutWithRetry: async () => ({ error: null }), // 新增
  resetPassword: async () => ({ data: {}, error: null }),
  updatePassword: async () => ({ data: { user: null }, error: null })
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  // 确保用户记录存在
  const ensureUserRecord = useCallback(async (user: User) => {
    try {
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
        console.error('查询用户记录失败:', error)
        return
      }

      if (!existingUser) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: user.id,
              email: user.email,
              username: user.email?.split('@')[0],
              daily_goal: 10,
              created_at: new Date().toISOString()
            }
          ])

        if (insertError) {
          console.error('创建用户记录失败:', insertError)
        } else {
          console.log('用户记录创建成功')
        }
      }
    } catch (error) {
      console.error('确保用户记录时出错:', error)
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('获取会话失败:', error)
          setLoading(false)
          return
        }

        setUser(session?.user ?? null)
        
        // 如果用户已登录，确保用户记录存在
        if (session?.user) {
          await ensureUserRecord(session.user)
        }
      } catch (error) {
        console.error('获取会话时发生错误:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getSession()
    
    // 在 AuthContext 的 onAuthStateChange 中增强退出处理
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('认证状态变化:', event, session?.user?.email)
        
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserRecord(session.user)
        }

        // 特别加强退出事件的处理
        if (event === 'SIGNED_OUT') {
          console.log('检测到用户退出，执行清理操作')
          
          // 确保状态被清除
          setUser(null)
          setLoading(false)
          
          // 清除本地存储
          if (typeof window !== 'undefined') {
            // 清除学习进度
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith('study_progress_')) {
                keysToRemove.push(key)
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key))
            
            // 如果当前在受保护的路由，重定向到首页
            const currentPath = window.location.pathname
            if (currentPath.startsWith('/dashboard')) {
              console.log('在受保护页面检测到退出，重定向到首页')
              window.location.replace('/')
            }
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, ensureUserRecord])

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const result = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      return result
    } catch (error) {
      console.error('注册失败:', error)
      return { data: { user: null, session: null }, error }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const result = await supabase.auth.signInWithPassword({ email, password })
      return result
    } catch (error) {
      console.error('登录失败:', error)
      return { data: { user: null, session: null }, error }
    } finally {
      setLoading(false)
    }
  }, [supabase])
  
  const signOut = useCallback(async () => {
    try {
      console.log('开始退出登录...')
      
      // 1. 先清除本地状态，提供即时反馈
      setUser(null)
      setLoading(false)
      
      // 2. 调用 Supabase 退出
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase 退出登录失败:', error)
        throw error
      }
      
      console.log('退出登录成功')
      
      // 3. 清除所有相关的本地存储
      if (typeof window !== 'undefined') {
        // 清除所有可能的学习进度缓存
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('study_progress_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        console.log('已清除本地存储的学习进度')
      }
      
      // 4. 强制重定向到首页（确保在任何页面都能正确跳转）
      if (typeof window !== 'undefined') {
        // 使用 replace 而不是 push，避免用户点击返回按钮
        window.location.replace('/')
      }
      
      return { error: null }
    } catch (error) {
      console.error('退出登录错误:', error)
      // 即使出错也强制重定向到首页
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      }
      return { error }
    }
  }, [supabase])

// 新增：带重试机制的退出函数
  const signOutWithRetry = useCallback(async (retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`退出登录尝试 ${attempt}/${retries}`)
        
        // 先清除本地状态
        setUser(null)
        setLoading(false)
        
        const { error } = await supabase.auth.signOut()
        
        if (!error) {
          console.log('退出登录成功')
          
          // 清除本地存储
          if (typeof window !== 'undefined') {
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith('study_progress_')) {
                keysToRemove.push(key)
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key))
          }
          
          // 重定向到首页
          if (typeof window !== 'undefined') {
            window.location.replace('/')
          }
          
          return { error: null }
        }
        
        // 如果有错误，且不是最后一次尝试，则等待后重试
        if (attempt < retries) {
          console.log(`退出失败，${1000 * attempt}ms后重试`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        } else {
          throw error
        }
      } catch (error) {
        console.error(`退出登录尝试 ${attempt} 失败:`, error)
        if (attempt === retries) {
          // 所有重试都失败，强制重定向
          if (typeof window !== 'undefined') {
            window.location.replace('/')
          }
          return { error }
        }
      }
    }
    
    return { error: new Error('退出登录失败') }
  }, [supabase])

  const resetPassword = useCallback(async (email: string) => {
    try {
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })
      return result
    } catch (error) {
      console.error('重置密码失败:', error)
      return { data: {}, error }
    }
  }, [supabase])

  const updatePassword = useCallback(async (password: string) => {
    try {
      const result = await supabase.auth.updateUser({ password })
      return result
    } catch (error) {
      console.error('更新密码失败:', error)
      return { data: { user: null }, error }
    }
  }, [supabase])

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    signOutWithRetry, // 新增
    resetPassword,
    updatePassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

