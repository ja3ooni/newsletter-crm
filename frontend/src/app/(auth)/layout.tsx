import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication - DatatechtonCRM',
  description: 'Sign in or create an account to access DatatechtonCRM',
}

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}
