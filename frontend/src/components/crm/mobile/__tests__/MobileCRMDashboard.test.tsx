import { render, screen } from '@testing-library/react'
import { MobileCRMDashboard } from '../MobileCRMDashboard'

// Mock the hooks and stores
jest.mock('@/store/crmStore', () => ({
  useCRMStore: () => ({
    contacts: [],
    tasks: [],
    deals: [],
    opportunities: [],
    isLoading: false,
    fetchContacts: jest.fn(),
    fetchTasks: jest.fn(),
    fetchDeals: jest.fn()
  })
}))

jest.mock('@/store/uiStore', () => ({
  useUIStore: () => ({
    notifications: [],
    mobileMenuOpen: false,
    setMobileMenuOpen: jest.fn(),
    addNotification: jest.fn()
  })
}))

jest.mock('@/hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOnline: true,
    syncStatus: 'idle',
    pendingChanges: 0
  })
}))

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}))

describe('MobileCRMDashboard', () => {
  it('renders the mobile CRM dashboard', () => {
    render(<MobileCRMDashboard />)

    // Check for main elements
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Contacts')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Deals')).toBeInTheDocument()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('displays search input', () => {
    render(<MobileCRMDashboard />)

    const searchInput = screen.getByPlaceholderText('Search contacts, deals, tasks...')
    expect(searchInput).toBeInTheDocument()
  })

  it('shows tab navigation', () => {
    render(<MobileCRMDashboard />)

    // Check for tab buttons
    const contactsTab = screen.getByRole('button', { name: /contacts/i })
    const tasksTab = screen.getByRole('button', { name: /tasks/i })
    const dealsTab = screen.getByRole('button', { name: /deals/i })
    const alertsTab = screen.getByRole('button', { name: /alerts/i })

    expect(contactsTab).toBeInTheDocument()
    expect(tasksTab).toBeInTheDocument()
    expect(dealsTab).toBeInTheDocument()
    expect(alertsTab).toBeInTheDocument()
  })
})
