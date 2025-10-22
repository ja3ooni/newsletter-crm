import { useAuthStore } from '@/store/authStore'
import { render, screen } from '@testing-library/react'
import ProtectedRoute from '../ProtectedRoute'

// Mock the auth store
jest.mock('@/store/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state when checking auth', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      isLoading: true,
      checkAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'subscriber',
        profile: { firstName: 'Test', lastName: 'User' },
      },
      isLoading: false,
      checkAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('shows access denied when user lacks required role', () => {
    mockUseAuthStore.mockReturnValue({
      user: {
        id: '1',
        email: 'test@example.com',
        role: 'subscriber',
        profile: { firstName: 'Test', lastName: 'User' },
      },
      isLoading: false,
      checkAuth: jest.fn(),
    } as any)

    render(
      <ProtectedRoute requiredRoles={['admin']}>
        <div>Admin Content</div>
      </ProtectedRoute>
    )

    expect(screen.getByText('Access Denied')).toBeInTheDocument()
    expect(screen.getByText("You don't have permission to access this page.")).toBeInTheDocument()
  })
})
