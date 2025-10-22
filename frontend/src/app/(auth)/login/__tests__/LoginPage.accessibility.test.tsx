import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import LoginPage from '../page'

// Mock the auth store
jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    login: jest.fn(),
    isLoading: false,
    error: null,
    clearError: jest.fn(),
    user: null
  })
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn()
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null)
  })
}))

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn()
  }
}))

expect.extend(toHaveNoViolations)

describe('LoginPage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<LoginPage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper heading hierarchy', () => {
    render(<LoginPage />)

    // Should have h1 as main heading
    const mainHeading = screen.getByRole('heading', { level: 1 })
    expect(mainHeading).toBeInTheDocument()
    expect(mainHeading).toHaveTextContent('Sign in to your account')
  })

  it('should have properly labeled form elements', () => {
    render(<LoginPage />)

    // Email input should be properly labeled
    const emailInput = screen.getByLabelText('Email address')
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('required')

    // Password input should be properly labeled
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('required')

    // Remember me checkbox should be properly labeled
    const rememberMeCheckbox = screen.getByLabelText('Remember me')
    expect(rememberMeCheckbox).toBeInTheDocument()
    expect(rememberMeCheckbox).toHaveAttribute('type', 'checkbox')
  })

  it('should have accessible buttons with proper labels', () => {
    render(<LoginPage />)

    // Main submit button
    const submitButton = screen.getByRole('button', { name: /sign in to your account/i })
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toHaveAttribute('type', 'submit')

    // OAuth buttons with descriptive labels
    const googleButton = screen.getByRole('button', { name: /sign in with google/i })
    expect(googleButton).toBeInTheDocument()

    const githubButton = screen.getByRole('button', { name: /sign in with github/i })
    expect(githubButton).toBeInTheDocument()
  })

  it('should have accessible SVG icons', () => {
    render(<LoginPage />)

    // User account icon should have proper accessibility attributes
    const userIcon = screen.getByLabelText('User account icon')
    expect(userIcon).toBeInTheDocument()
    expect(userIcon).toHaveAttribute('role', 'img')

    // OAuth icons should be hidden from screen readers since buttons have text labels
    const svgElements = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgElements.length).toBeGreaterThan(0)
  })

  it('should have accessible links', () => {
    render(<LoginPage />)

    // Navigation links should be accessible
    const signupLink = screen.getByRole('link', { name: /create a new account/i })
    expect(signupLink).toBeInTheDocument()
    expect(signupLink).toHaveAttribute('href', '/signup')

    const forgotPasswordLink = screen.getByRole('link', { name: /forgot your password/i })
    expect(forgotPasswordLink).toBeInTheDocument()
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password')
  })

  it('should handle error states accessibly', () => {
    // Mock error state
    jest.mocked(require('@/store/authStore').useAuthStore).mockReturnValue({
      login: jest.fn(),
      isLoading: false,
      error: 'Invalid credentials',
      clearError: jest.fn(),
      user: null
    })

    render(<LoginPage />)

    // Error message should be announced to screen readers
    const errorAlert = screen.getByRole('alert')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveAttribute('aria-live', 'polite')
    expect(errorAlert).toHaveTextContent('Invalid credentials')

    // Form inputs should be associated with error
    const emailInput = screen.getByLabelText('Email address')
    const passwordInput = screen.getByLabelText('Password')
    expect(emailInput).toHaveAttribute('aria-describedby', 'login-error')
    expect(passwordInput).toHaveAttribute('aria-describedby', 'login-error')
  })

  it('should handle loading states accessibly', () => {
    // Mock loading state
    jest.mocked(require('@/store/authStore').useAuthStore).mockReturnValue({
      login: jest.fn(),
      isLoading: true,
      error: null,
      clearError: jest.fn(),
      user: null
    })

    render(<LoginPage />)

    // Loading button should have proper accessibility
    const submitButton = screen.getByRole('button', { name: /signing in, please wait/i })
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    // Screen reader text should be present
    const srText = screen.getByText('Signing in, please wait')
    expect(srText).toHaveClass('sr-only')
  })

  it('should have proper keyboard navigation', () => {
    render(<LoginPage />)

    // All interactive elements should be focusable
    const interactiveElements = [
      screen.getByLabelText('Email address'),
      screen.getByLabelText('Password'),
      screen.getByLabelText('Remember me'),
      screen.getByRole('button', { name: /sign in to your account/i }),
      screen.getByRole('link', { name: /create a new account/i }),
      screen.getByRole('link', { name: /forgot your password/i }),
      screen.getByRole('button', { name: /sign in with google/i }),
      screen.getByRole('button', { name: /sign in with github/i })
    ]

    interactiveElements.forEach(element => {
      expect(element).not.toHaveAttribute('tabindex', '-1')
    })
  })

  it('should have semantic HTML structure', () => {
    render(<LoginPage />)

    // Should have proper form structure
    const form = screen.getByRole('form')
    expect(form).toBeInTheDocument()
    expect(form).toHaveAttribute('noValidate') // Custom validation

    // Should have proper landmark structure
    const main = document.querySelector('main')
    if (main) {
      expect(main).toBeInTheDocument()
    }
  })
})
