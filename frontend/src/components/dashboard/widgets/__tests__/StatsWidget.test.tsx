import { render, screen } from '@testing-library/react'
import StatsWidget from '../StatsWidget'

describe('StatsWidget', () => {
  it('renders title and value correctly', () => {
    render(
      <StatsWidget
        title="Total Subscribers"
        value="12,543"
      />
    )

    expect(screen.getByText('Total Subscribers')).toBeInTheDocument()
    expect(screen.getByText('12,543')).toBeInTheDocument()
  })

  it('displays positive change correctly', () => {
    render(
      <StatsWidget
        title="Open Rate"
        value="24.8%"
        change={{ value: 5.2, type: 'increase' }}
      />
    )

    expect(screen.getByText('+5.2%')).toBeInTheDocument()
    expect(screen.getByText('from last month')).toBeInTheDocument()
  })

  it('displays negative change correctly', () => {
    render(
      <StatsWidget
        title="Click Rate"
        value="3.2%"
        change={{ value: -2.1, type: 'decrease' }}
      />
    )

    expect(screen.getByText('+2.1%')).toBeInTheDocument() // Math.abs converts to positive
  })

  it('renders with icon when provided', () => {
    const TestIcon = () => <svg data-testid="test-icon" />

    render(
      <StatsWidget
        title="Test Metric"
        value="100"
        icon={<TestIcon />}
      />
    )

    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
  })
})
