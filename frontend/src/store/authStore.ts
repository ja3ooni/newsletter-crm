import { authApi } from '@/lib/api/auth'
import { LoginCredentials, RegisterData, User } from '@/types/auth'
import Cookies from 'js-cookie'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
  updateUser: (user: Partial<User>) => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        user: null,
        token: null,
        isLoading: false,
        error: null,

        // Actions
        login: async (credentials: LoginCredentials) => {
          set({ isLoading: true, error: null })
          try {
            const response = await authApi.login(credentials)
            const { user, token } = response.data

            // Store token in cookie for SSR
            Cookies.set('auth-token', token, {
              expires: 7, // 7 days
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            })

            set({ user, token, isLoading: false })
          } catch (error: any) {
            const message = error.response?.data?.message || 'Login failed'
            set({ error: message, isLoading: false })
            throw error
          }
        },

        register: async (data: RegisterData) => {
          set({ isLoading: true, error: null })
          try {
            const response = await authApi.register(data)
            const { user, token } = response.data

            Cookies.set('auth-token', token, {
              expires: 7,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            })

            set({ user, token, isLoading: false })
          } catch (error: any) {
            const message = error.response?.data?.message || 'Registration failed'
            set({ error: message, isLoading: false })
            throw error
          }
        },

        logout: () => {
          Cookies.remove('auth-token')
          set({ user: null, token: null, error: null })
        },

        checkAuth: async () => {
          const token = Cookies.get('auth-token')
          if (!token) {
            set({ user: null, token: null, isLoading: false })
            return
          }

          set({ isLoading: true })
          try {
            const response = await authApi.me()
            set({ user: response.data, token, isLoading: false })
          } catch (error) {
            // Token is invalid, clear it
            Cookies.remove('auth-token')
            set({ user: null, token: null, isLoading: false })
          }
        },

        clearError: () => {
          set({ error: null })
        },

        updateUser: (userData: Partial<User>) => {
          const { user } = get()
          if (user) {
            set({ user: { ...user, ...userData } })
          }
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          token: state.token
        }),
      }
    ),
    { name: 'auth-store' }
  )
)
