import LandingPage from '@/components/landing/LandingPage'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DatatechtonCRM - Professional Newsletter Platform',
  description: 'Transform your newsletter strategy with our enterprise-grade platform featuring advanced CRM, marketing automation, and AI-powered personalization.',
}

export default function HomePage(): JSX.Element {
  return <LandingPage />
}
