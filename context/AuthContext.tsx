// context/AuthContext.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, AuthContextType } from '@/types/auth'
import { useRouter } from 'next/navigation'

// 创建上下文时提供默认值
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {}
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        // 当用户登录时，确保用户记录存在
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserRecord(session.user)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  // 确保users表中存在对应的用户记录
  const ensureUserRecord = async (user: User) => {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingUser) {
      await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
            username: user.email?.split('@')[0], // 默认用户名
            daily_goal: 10, // 默认每日目标
            created_at: new Date().toISOString()
          }
        ])
    }
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    try {
      console.log('开始退出登录...')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('退出登录失败:', error)
        throw error
      }
      
      // 手动清除用户状态 
      setUser(null)
      setLoading(false)
      
      console.log('退出登录成功')
      
      // 强制刷新页面以确保状态完全清除
      router.push('/')
      router.refresh() // 强制刷新页面
      
    } catch (error) {
      console.error('退出登录错误:', error)
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email)
  }

  const updatePassword = async (password: string) => {
    return await supabase.auth.updateUser({ password })
  }

  const value: AuthContextType = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
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