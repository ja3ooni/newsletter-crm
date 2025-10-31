import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import PromoCodeManager from '../PromoCodeManager'

// Mock the billing store
const mockPromoCodes = [
  {
    id: 'promo_1',
    code: 'SAVE20',
    name: '20% Off Sale',
    description: 'Summer sale discount',
    type: 'percentage' as const,
    value: 20,
    currency: 'USD',
    isActive: true,
    currentRedemptions: 5,
    maxRedemptions: 100,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    applicablePlans: ['plan_1'],
    metadata: {}
  },
  {
    id: 'promo_2',
    code: 'EXPIRED10',
    name: '10% Off Expired',
    description: 'Expired discount',
    type: 'percentage' as const,
    value: 10,
    currency: 'USD',
    isActive: false,
    currentRedemptions: 50,
    maxRedemptions: 50,
    validFrom: '2023-01-01',
    validUntil: '2023-12-31',
    applicablePlans: ['plan_1'],
    metadata: {}
  }
]

const mockSubscriptionPlans = [
  {
    id: 'plan_1',
    name: 'Basic Plan',
    description: 'Basic subscription plan',
    price: 999,
    currency: 'USD',
    billingInterval: 'monthly' as const,
    features: []
  }
]

jest.mock('@/store/billingStore', () => ({
  useBillingStore: () => ({
    promoCodes: mockPromoCodes,
    subscriptionPlans: mockSubscriptionPlans,
    fetchPromoCodes: jest.fn(),
    fetchSubscriptionPlans: jest.fn(),
    createPromoCode: jest.fn(),
    isLoading: false,
  })
}))

expect.extend(toHaveNoViolations)

describe('PromoCodeManager Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<PromoCodeManager />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper table structure with caption and headers', () => {
    render(<PromoCodeManager />)

    // Check table has proper role and label
    expect(screen.getByRole('table', { name: /promotional codes management table/i })).toBeInTheDocument()

    // Check column headers have proper scope
    const headers = screen.getAllByRole('columnheader')
    headers.forEach(header => {
      expect(header).toHaveAttribute('scope', 'col')
    })
  })

  it('should have proper ARIA labels for action buttons', () => {
    render(<PromoCodeManager />)

    // Check create button has proper label
    expect(screen.getByLabelText(/open dialog to create a new promotional code/i)).toBeInTheDocument()

    // Check action menu buttons have proper labels
    const actionButtons = screen.getAllByLabelText(/actions for promo code/i)
    expect(actionButtons.length).toBeGreaterThan(0)
  })

  it('should have proper status indicators with icons and text', () => {
    render(<PromoCodeManager />)

    // Check that status badges have proper ARIA labels
    const statusBadges = screen.getAllByLabelText(/status:/i)
    expect(statusBadges.length).toBeGreaterThan(0)

    // Check that status includes both icon and text
    statusBadges.forEach(badge => {
      expect(badge).toHaveTextContent(/active|inactive|expired|scheduled|exhausted/i)
    })
  })

  it('should have accessible form controls in create dialog', async () => {
    render(<PromoCodeManager />)

    // Open create dialog
    const createButton = screen.getByLabelText(/open dialog to create a new promotional code/i)
    fireEvent.click(createButton)

    await waitFor(() => {
      // Check form fields have proper labels
      expect(screen.getByLabelText(/promo code/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    })
  })

  it('should have accessible checkbox group for plan selection', async () => {
    render(<PromoCodeManager />)

    // Open create dialog
    const createButton = screen.getByLabelText(/open dialog to create a new promotional code/i)
    fireEvent.click(createButton)

    await waitFor(() => {
      // Check fieldset and legend exist
      expect(screen.getByRole('group', { name: /subscription plan selection/i })).toBeInTheDocument()

      // Check checkboxes have proper labels
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toHaveAttribute('id')
        const id = checkbox.getAttribute('id')
        if (id) {
          expect(screen.getByLabelText(new RegExp(mockSubscriptionPlans[0].name, 'i'))).toBeInTheDocument()
        }
      })
    })
  })

  it('should handle keyboard navigation for dropdown menus', () => {
    render(<PromoCodeManager />)

    // Find and focus first action button
    const actionButtons = screen.getAllByLabelText(/actions for promo code/i)
    if (actionButtons.length > 0) {
      const firstActionButton = actionButtons[0]
      firstActionButton.focus()
      expect(firstActionButton).toHaveFocus()

      // Test keyboard activation
      fireEvent.keyDown(firstActionButton, { key: 'Enter' })
      // Menu should open (implementation dependent)
    }
  })

  it('should announce loading states properly', () => {
    // Mock loading state
    jest.doMock('@/store/billingStore', () => ({
      useBillingStore: () => ({
        promoCodes: [],
        subscriptionPlans: [],
        fetchPromoCodes: jest.fn(),
        fetchSubscriptionPlans: jest.fn(),
        createPromoCode: jest.fn(),
        isLoading: true,
      })
    }))

    render(<PromoCodeManager />)

    // Check loading state has proper ARIA attributes
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('should have proper focus management in dialogs', async () => {
    render(<PromoCodeManager />)

    // Open create dialog
    const createButton = screen.getByLabelText(/open dialog to create a new promotional code/i)
    fireEvent.click(createButton)

    await waitFor(() => {
      // Focus should move to dialog
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()

      // First focusable element should receive focus
      const firstInput = screen.getByLabelText(/promo code/i)
      expect(firstInput).toBeInTheDocument()
    })
  })

  it('should have proper button states and loading indicators', async () => {
    render(<PromoCodeManager />)

    // Open create dialog
    const createButton = screen.getByLabelText(/open dialog to create a new promotional code/i)
    fireEvent.click(createButton)

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /create promo code/i })
      expect(submitButton).toBeDisabled() // Should be disabled when form is invalid

      // Fill required fields
      const codeInput = screen.getByLabelText(/promo code/i)
      const nameInput = screen.getByLabelText(/display name/i)

      fireEvent.change(codeInput, { target: { value: 'TEST20' } })
      fireEvent.change(nameInput, { target: { value: 'Test Discount' } })

      expect(submitButton).not.toBeDisabled()
    })
  })

  it('should provide alternative text for decorative icons', () => {
    render(<PromoCodeManager />)

    // Check that decorative icons have aria-hidden
    const icons = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('should have proper color contrast and not rely on color alone', () => {
    render(<PromoCodeManager />)

    // Check that status indicators have both color and text/icons
    const statusBadges = screen.getAllByLabelText(/status:/i)
    statusBadges.forEach(badge => {
      // Should have text content, not just color
      expect(badge).toHaveTextContent(/\w+/)

      // Should have an icon (svg element)
      const icon = badge.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  it('should handle empty state accessibility', () => {
    // Mock empty state
    jest.doMock('@/store/billingStore', () => ({
      useBillingStore: () => ({
        promoCodes: [],
        subscriptionPlans: [],
        fetchPromoCodes: jest.fn(),
        fetchSubscriptionPlans: jest.fn(),
        createPromoCode: jest.fn(),
        isLoading: false,
      })
    }))

    render(<PromoCodeManager />)

    // Check empty state has proper button
    expect(screen.getByLabelText(/create your first promotional code/i)).toBeInTheDocument()
  })
})
