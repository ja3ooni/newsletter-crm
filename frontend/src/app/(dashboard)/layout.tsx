import ProtectedRoute from '@/components/auth/ProtectedRoute'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard - DatatechtonCRM',
  description: 'Manage your newsletters, contacts, and automation workflows',
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: DashboardLayoutProps): JSX.Element {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
