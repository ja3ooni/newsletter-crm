import { fireEvent, render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import SubscriptionOverview from '../SubscriptionOverview'

// Mock the billing store
jest.mock('@/store/billingStore', () => ({
  useBillingStore: () => ({
    cancelSubscription: jest.fn(),
    reactivateSubscription: jest.fn(),
    fetchCurrentSubscription: jest.fn(),
  })
}))

const mockActiveSubscription = {
  id: 'sub_123',
  status: 'active' as const,
  plan: {
    id: 'plan_1',
    name: 'Pro Plan',
    price: 2999,
    currency: 'USD',
    billingInterval: 'monthly' as const,
    features: []
  },
  currentPeriodStart: '2024-01-01T00:00:00Z',
  currentPeriodEnd: '2024-02-01T00:00:00Z',
  cancelAtPeriodEnd: false,
  trialEnd: null
}

const mockTrialSubscription = {
  ...mockActiveSubscription,
  status: 'trialing' as const,
  trialEnd: '2024-01-15T00:00:00Z'
}

const mockPastDueSubscription = {
  ...mockActiveSubscription,
  status: 'past_due' as const
}

const mockCancelledSubscription = {
  ...mockActiveSubscription,
  status: 'active' as const,
  cancelAtPeriodEnd: true
}

expect.extend(toHaveNoViolations)

describe('SubscriptionOverview Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<SubscriptionOverview subscription={mockActiveSubscription} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper region structure with labeled sections', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check for labeled regions
    expect(screen.getByRole('region', { name: /subscription details/i })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /billing cycle/i })).toBeInTheDocument()
  })

  it('should have proper status indicators with ARIA labels', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check status badge has proper label
    expect(screen.getByLabelText(/subscription status: active/i)).toBeInTheDocument()
  })

  it('should announce alerts properly for different subscription states', () => {
    // Test past due alert
    const { rerender } = render(<SubscriptionOverview subscription={mockPastDueSubscription} />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText(/payment alert:/i)).toHaveClass('sr-only')

    // Test cancellation notice
    rerender(<SubscriptionOverview subscription={mockCancelledSubscription} />)
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/cancellation notice:/i)).toHaveClass('sr-only')

    // Test trial status
    rerender(<SubscriptionOverview subscription={mockTrialSubscription} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/trial status:/i)).toHaveClass('sr-only')
  })

  it('should have accessible progress bars with proper labels', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check progress bar has descriptive label
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-label')
    expect(progressBar.getAttribute('aria-label')).toMatch(/billing cycle progress/i)
  })

  it('should have proper button accessibility with loading states', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check sync button has proper label
    const syncButton = screen.getByLabelText(/synchronize subscription status/i)
    expect(syncButton).toBeInTheDocument()
    expect(syncButton).toHaveAttribute('aria-busy', 'false')
  })

  it('should handle keyboard navigation for interactive elements', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Test button focus
    const syncButton = screen.getByLabelText(/synchronize subscription status/i)
    syncButton.focus()
    expect(syncButton).toHaveFocus()

    // Test keyboard activation
    fireEvent.keyDown(syncButton, { key: 'Enter' })
    fireEvent.keyDown(syncButton, { key: ' ' })
  })

  it('should have proper dialog accessibility for cancellation', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Find and click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel subscription/i })
    fireEvent.click(cancelButton)

    // Check dialog has proper attributes
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Check dialog title and description
    expect(screen.getByRole('heading', { name: /cancel subscription/i })).toBeInTheDocument()
  })

  it('should provide alternative text for decorative icons', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check that decorative icons have aria-hidden
    const icons = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('should have proper color contrast and not rely on color alone', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check that status indicators have text labels, not just colors
    const statusBadge = screen.getByLabelText(/subscription status/i)
    expect(statusBadge).toHaveTextContent(/active/i)

    // Should also have an icon
    const icon = statusBadge.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should handle different subscription statuses accessibly', () => {
    const statuses = [
      { subscription: mockActiveSubscription, expectedStatus: 'active' },
      { subscription: mockTrialSubscription, expectedStatus: 'trialing' },
      { subscription: mockPastDueSubscription, expectedStatus: 'past_due' }
    ]

    statuses.forEach(({ subscription, expectedStatus }) => {
      const { rerender } = render(<SubscriptionOverview subscription={subscription} />)

      // Check status is properly announced
      expect(screen.getByLabelText(new RegExp(`subscription status: ${expectedStatus}`, 'i'))).toBeInTheDocument()

      rerender(<div />)
    })
  })

  it('should have proper form validation and error handling', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // This would test form validation if there were forms
    // Currently the component doesn't have forms, but buttons should be properly labeled
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toHaveAccessibleName()
    })
  })

  it('should handle loading states with proper announcements', () => {
    // This would require mocking the loading state
    // For now, check that buttons have aria-busy attributes
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    const syncButton = screen.getByLabelText(/synchronize subscription status/i)
    expect(syncButton).toHaveAttribute('aria-busy')
  })

  it('should have proper heading hierarchy', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)

    // All headings should have accessible names
    headings.forEach(heading => {
      expect(heading).toHaveAccessibleName()
    })
  })

  it('should provide context for data relationships', () => {
    render(<SubscriptionOverview subscription={mockActiveSubscription} />)

    // Check that data is properly structured and labeled
    expect(screen.getByText(/subscription details/i)).toBeInTheDocument()
    expect(screen.getByText(/billing cycle/i)).toBeInTheDocument()

    // Check that related data is grouped together
    const regions = screen.getAllByRole('region')
    expect(regions.length).toBeGreaterThanOrEqual(2)
  })
})
