import { Providers } from '@/components/providers/Providers'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DatatechtonCRM - Professional Newsletter Platform',
  description: 'Enterprise-grade newsletter platform with advanced CRM and marketing automation',
  keywords: ['newsletter', 'email marketing', 'CRM', 'automation', 'mobile CRM', 'PWA'],
  authors: [{ name: 'DatatechtonCRM Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DatatechtonCRM CRM',
    startupImage: [
      {
        url: '/icons/crm-icon-512.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'DatatechtonCRM CRM',
    title: 'DatatechtonCRM - Professional CRM Platform',
    description: 'Manage contacts, deals, and tasks on the go with our mobile-first CRM platform',
    images: [
      {
        url: '/screenshots/crm-dashboard-mobile.png',
        width: 390,
        height: 844,
        alt: 'DatatechtonCRM CRM Mobile Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DatatechtonCRM - Professional CRM Platform',
    description: 'Manage contacts, deals, and tasks on the go with our mobile-first CRM platform',
    images: ['/screenshots/crm-dashboard-mobile.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#2563eb' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="DatatechtonCRM CRM" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DatatechtonCRM CRM" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/crm-icon-152.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/crm-icon-152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/crm-icon-192.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/crm-icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/crm-icon-16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* Splash Screens */}
        <link rel="apple-touch-startup-image" href="/icons/crm-icon-512.png" />

        {/* Preload critical resources */}
        <link rel="preload" href="/sw.js" as="script" />
      </head>
      <body className={`${inter.className} h-full bg-gray-50 antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
