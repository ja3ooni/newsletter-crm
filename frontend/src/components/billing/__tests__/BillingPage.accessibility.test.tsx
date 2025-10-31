import { fireEvent, render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import BillingPage from '../../../app/(dashboard)/dashboard/billing/page'

// Mock the billing store
jest.mock('@/store/billingStore', () => ({
  useBillingStore: () => ({
    currentSubscription: {
      id: 'sub_123',
      status: 'active',
      plan: {
        name: 'Pro Plan',
        price: 2999,
        currency: 'USD',
        billingInterval: 'monthly'
      },
      currentPeriodStart: '2024-01-01',
      currentPeriodEnd: '2024-02-01',
      cancelAtPeriodEnd: false
    },
    subscriptionPlans: [],
    invoices: [],
    usageTracking: [],
    billingAnalytics: null,
    isLoadingSubscription: false,
    isLoadingPlans: false,
    isLoadingInvoices: false,
    isLoadingAnalytics: false,
    subscriptionError: null,
    invoiceError: null,
    error: null,
    fetchCurrentSubscription: jest.fn(),
    fetchSubscriptionPlans: jest.fn(),
    fetchInvoices: jest.fn(),
    fetchBillingAnalytics: jest.fn(),
    fetchUsageTracking: jest.fn(),
    clearError: jest.fn(),
  })
}))

// Mock the components to avoid complex dependencies
jest.mock('@/components/billing/BillingAnalytics', () => {
  return function MockBillingAnalytics() {
    return <div data-testid="billing-analytics">Billing Analytics</div>
  }
})

jest.mock('@/components/billing/BillingHistory', () => {
  return function MockBillingHistory() {
    return <div data-testid="billing-history">Billing History</div>
  }
})

jest.mock('@/components/billing/PlanUpgrade', () => {
  return function MockPlanUpgrade() {
    return <div data-testid="plan-upgrade">Plan Upgrade</div>
  }
})

jest.mock('@/components/billing/PromoCodeManager', () => {
  return function MockPromoCodeManager() {
    return <div data-testid="promo-code-manager">Promo Code Manager</div>
  }
})

jest.mock('@/components/billing/SubscriptionOverview', () => {
  return function MockSubscriptionOverview() {
    return <div data-testid="subscription-overview">Subscription Overview</div>
  }
})

jest.mock('@/components/billing/UsageTracking', () => {
  return function MockUsageTracking() {
    return <div data-testid="usage-tracking">Usage Tracking</div>
  }
})

expect.extend(toHaveNoViolations)

describe('BillingPage Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<BillingPage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper page structure with landmarks', () => {
    render(<BillingPage />)

    // Check for proper landmarks
    expect(screen.getByRole('banner')).toBeInTheDocument() // header
    expect(screen.getByRole('main')).toBeInTheDocument() // main content
    expect(screen.getByRole('region')).toBeInTheDocument() // subscription overview section
  })

  it('should have proper heading hierarchy', () => {
    render(<BillingPage />)

    // Check for h1 page title
    expect(screen.getByRole('heading', { level: 1, name: /billing & subscription/i })).toBeInTheDocument()

    // Check for h2 section headings
    expect(screen.getByRole('heading', { level: 2, name: /current subscription/i })).toBeInTheDocument()
  })

  it('should have proper ARIA labels for interactive elements', () => {
    render(<BillingPage />)

    // Check action buttons have proper labels
    expect(screen.getByLabelText(/export billing data to file/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/open billing settings/i)).toBeInTheDocument()
  })

  it('should have proper tab navigation', () => {
    render(<BillingPage />)

    // Check tablist exists with proper label
    expect(screen.getByRole('tablist', { name: /billing sections/i })).toBeInTheDocument()

    // Check tabs have proper attributes
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')

    if (tabs[1]) {
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
      expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    }
  })

  it('should handle keyboard navigation for tabs', () => {
    render(<BillingPage />)

    const tabs = screen.getAllByRole('tab')
    const firstTab = tabs[0]

    // Focus first tab
    firstTab.focus()
    expect(firstTab).toHaveFocus()

    // Test arrow key navigation
    if (tabs[1]) {
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' })
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    }
  })

  it('should announce loading states properly', () => {
    // Mock loading state
    jest.doMock('@/store/billingStore', () => ({
      useBillingStore: () => ({
        currentSubscription: null,
        subscriptionPlans: [],
        invoices: [],
        usageTracking: [],
        billingAnalytics: null,
        isLoadingSubscription: true,
        isLoadingPlans: false,
        isLoadingInvoices: false,
        isLoadingAnalytics: false,
        subscriptionError: null,
        invoiceError: null,
        error: null,
        fetchCurrentSubscription: jest.fn(),
        fetchSubscriptionPlans: jest.fn(),
        fetchInvoices: jest.fn(),
        fetchBillingAnalytics: jest.fn(),
        fetchUsageTracking: jest.fn(),
        clearError: jest.fn(),
      })
    }))

    render(<BillingPage />)

    // Check loading state has proper ARIA attributes
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByLabelText(/loading subscription information/i)).toBeInTheDocument()
  })

  it('should handle error states with proper announcements', () => {
    // Mock error state
    jest.doMock('@/store/billingStore', () => ({
      useBillingStore: () => ({
        currentSubscription: null,
        subscriptionPlans: [],
        invoices: [],
        usageTracking: [],
        billingAnalytics: null,
        isLoadingSubscription: false,
        isLoadingPlans: false,
        isLoadingInvoices: false,
        isLoadingAnalytics: false,
        subscriptionError: 'Failed to load subscription',
        invoiceError: null,
        error: null,
        fetchCurrentSubscription: jest.fn(),
        fetchSubscriptionPlans: jest.fn(),
        fetchInvoices: jest.fn(),
        fetchBillingAnalytics: jest.fn(),
        fetchUsageTracking: jest.fn(),
        clearError: jest.fn(),
      })
    }))

    render(<BillingPage />)

    // Check error alert has proper ARIA attributes
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText(/error:/i)).toHaveClass('sr-only')
  })

  it('should have proper focus management', () => {
    render(<BillingPage />)

    // Check that interactive elements are focusable
    const exportButton = screen.getByLabelText(/export billing data to file/i)
    const settingsButton = screen.getByLabelText(/open billing settings/i)

    exportButton.focus()
    expect(exportButton).toHaveFocus()

    settingsButton.focus()
    expect(settingsButton).toHaveFocus()
  })

  it('should have proper color contrast and not rely on color alone', () => {
    render(<BillingPage />)

    // This would typically be tested with automated tools
    // Here we check that status indicators have text labels, not just colors
    const statusElements = screen.queryAllByText(/active|inactive|trial/i)
    expect(statusElements.length).toBeGreaterThan(0)
  })
})
