// types/auth.ts
export interface User {
  id: string
  email?: string
  user_metadata?: {
    // name?: string
    // avatar_url?: string
    // full_name?: string
    [key: string]: any
  }
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<any>
  signIn: (email: string, password: string) => Promise<any>
  signOut: () => Promise<any>
  signOutWithRetry: (retries?: number) => Promise<any>
  resetPassword: (email: string) => Promise<any>
  updatePassword: (password: string) => Promise<any>
}