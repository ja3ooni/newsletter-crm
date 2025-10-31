import { fireEvent, render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import UsageTracking from '../UsageTracking'

// Mock the billing store
jest.mock('@/store/billingStore', () => ({
  useBillingStore: () => ({
    fetchUsageTracking: jest.fn(),
  })
}))

// Mock recharts to avoid canvas rendering issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  CartesianGrid: () => <div data-testid="grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const mockUsageData = [
  {
    metricName: 'newsletters',
    currentUsage: 15,
    limit: 50,
    percentage: 30,
    resetDate: '2024-02-01T00:00:00Z'
  },
  {
    metricName: 'emails',
    currentUsage: 4500,
    limit: 10000,
    percentage: 45,
    resetDate: '2024-02-01T00:00:00Z'
  },
  {
    metricName: 'subscribers',
    currentUsage: 950,
    limit: 1000,
    percentage: 95,
    resetDate: '2024-02-01T00:00:00Z'
  }
]

const defaultProps = {
  subscriptionId: 'sub_123',
  usageData: mockUsageData,
  isLoading: false,
  detailed: false
}

expect.extend(toHaveNoViolations)

describe('UsageTracking Accessibility', () => {
  it('should not have any accessibility violations', async () => {
    const { container } = render(<UsageTracking {...defaultProps} />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have proper region structure with labeled sections', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check for labeled regions
    expect(screen.getByRole('region', { name: /usage metrics/i })).toBeInTheDocument()
  })

  it('should have comprehensive ARIA labeling for usage metrics', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check that each metric group has proper labeling
    const metricGroups = screen.getAllByRole('group')
    expect(metricGroups.length).toBeGreaterThan(0)

    // Check specific metric labels
    expect(screen.getByLabelText(/newsletters: 15 used of 50 limit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/emails: 4,500 used of 10,000 limit/i)).toBeInTheDocument()
  })

  it('should have proper progress bar accessibility', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check progress bars have descriptive labels
    const progressBars = screen.getAllByRole('progressbar')
    expect(progressBars.length).toBeGreaterThan(0)

    progressBars.forEach(progressBar => {
      expect(progressBar).toHaveAttribute('aria-label')
      expect(progressBar.getAttribute('aria-label')).toMatch(/usage:/i)
    })
  })

  it('should announce high usage warnings properly', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check high usage alert for subscribers (95%)
    const highUsageAlert = screen.getByRole('alert')
    expect(highUsageAlert).toHaveAttribute('aria-label')
    expect(highUsageAlert.getAttribute('aria-label')).toMatch(/warning.*subscribers.*high.*95/i)
  })

  it('should have accessible form controls for chart filters', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Check select controls have proper labels
    expect(screen.getByLabelText(/select metric to display in chart/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/select time range for chart data/i)).toBeInTheDocument()
  })

  it('should provide screen reader accessible chart descriptions', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Check chart has proper role and label
    expect(screen.getByRole('img')).toHaveAttribute('aria-label')
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/usage history chart/i)

    // Check for screen reader description
    expect(screen.getByText(/chart showing usage data/i)).toHaveClass('sr-only')
  })

  it('should handle loading states with proper announcements', () => {
    render(<UsageTracking {...defaultProps} isLoading={true} />)

    // Check loading state has proper ARIA attributes
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByLabelText(/loading usage metrics/i)).toBeInTheDocument()
  })

  it('should handle empty state accessibility', () => {
    render(<UsageTracking {...defaultProps} usageData={[]} />)

    // Check empty state has proper status announcement
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText(/no usage data available/i)).toBeInTheDocument()
  })

  it('should have proper keyboard navigation for interactive elements', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Test refresh button focus
    const refreshButton = screen.getByLabelText(/refresh usage data/i)
    refreshButton.focus()
    expect(refreshButton).toHaveFocus()

    // Test select controls focus
    const metricSelect = screen.getByLabelText(/select metric to display/i)
    metricSelect.focus()
    expect(metricSelect).toHaveFocus()
  })

  it('should provide alternative text for decorative icons', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check that decorative icons have aria-hidden
    const icons = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })

  it('should have proper color contrast and not rely on color alone', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check that usage status includes text labels, not just colors
    expect(screen.getByText(/30.0%/)).toBeInTheDocument() // Percentage text
    expect(screen.getByText(/45.0%/)).toBeInTheDocument()
    expect(screen.getByText(/95.0%/)).toBeInTheDocument()

    // High usage should have warning badge with text
    expect(screen.getByText(/high/i)).toBeInTheDocument()
  })

  it('should handle chart accessibility for different metric selections', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Test metric selection change
    const metricSelect = screen.getByLabelText(/select metric to display/i)
    fireEvent.change(metricSelect, { target: { value: 'newsletters' } })

    // Chart label should update
    const chart = screen.getByRole('img')
    expect(chart.getAttribute('aria-label')).toMatch(/newsletters/i)
  })

  it('should provide context for usage reset dates', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check that reset dates are properly labeled
    const resetInfo = screen.getAllByLabelText(/usage resets on/i)
    expect(resetInfo.length).toBeGreaterThan(0)
  })

  it('should have proper heading hierarchy', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)

    // All headings should have accessible names
    headings.forEach(heading => {
      expect(heading).toHaveAccessibleName()
    })
  })

  it('should handle detailed view accessibility', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Check additional accessibility features in detailed view
    expect(screen.getByRole('group', { name: /chart filters/i })).toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument() // Chart

    // Check loading state for history
    expect(screen.getByText(/loading usage history/i)).toBeInTheDocument()
  })

  it('should provide proper status announcements for usage levels', () => {
    render(<UsageTracking {...defaultProps} />)

    // Check that usage levels are properly announced
    expect(screen.getByLabelText(/30.0 percent used, normal usage/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/45.0 percent used, normal usage/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/95.0 percent used, high usage/i)).toBeInTheDocument()
  })

  it('should handle chart axis accessibility', () => {
    render(<UsageTracking {...defaultProps} detailed={true} />)

    // Check that chart axes have proper labels (mocked)
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
  })
})
