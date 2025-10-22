'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { newsletterApi } from '@/lib/api/newsletter'
import { useNewsletterStore } from '@/store/newsletterStore'
import { useEffect, useState } from 'react'

export function BuilderPreview(): JSX.Element {
  const { builderState } = useNewsletterStore()
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testEmails, setTestEmails] = useState<string>('')
  const [sendingTest, setSendingTest] = useState(false)
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop')

  useEffect(() => {
    if (builderState?.newsletter) {
      loadPreview()
    }
  }, [builderState?.newsletter])

  const loadPreview = async () => {
    if (!builderState?.newsletter) return

    setLoading(true)
    setError(null)

    try {
      const preview = await newsletterApi.previewNewsletter(builderState.newsletter.id)
      setPreviewHtml(preview.html)
    } catch (err) {
      setError('Failed to load preview')
      console.error('Preview error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    if (!builderState?.newsletter || !testEmails.trim()) return

    const emails = testEmails.split(',').map(email => email.trim()).filter(Boolean)
    if (emails.length === 0) return

    setSendingTest(true)
    try {
      await newsletterApi.sendTestEmail(builderState.newsletter.id, emails)
      alert('Test email sent successfully!')
      setTestEmails('')
    } catch (err) {
      alert('Failed to send test email')
      console.error('Test email error:', err)
    } finally {
      setSendingTest(false)
    }
  }

  if (!builderState) {
    return <div>Loading...</div>
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Preview Controls */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">Preview</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setDeviceView('desktop')}
                className={`px-3 py-1 text-sm rounded ${
                  deviceView === 'desktop'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Desktop
              </button>
              <button
                onClick={() => setDeviceView('mobile')}
                className={`px-3 py-1 text-sm rounded ${
                  deviceView === 'mobile'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mobile
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={loadPreview}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Test Email Section */}
        <div className="mt-4 flex items-center space-x-3">
          <Input
            value={testEmails}
            onChange={(e) => setTestEmails(e.target.value)}
            placeholder="Enter test email addresses (comma separated)"
            className="flex-1"
          />
          <Button
            onClick={handleSendTest}
            disabled={sendingTest || !testEmails.trim()}
          >
            {sendingTest ? 'Sending...' : 'Send Test'}
          </Button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading preview...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-red-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Preview Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={loadPreview}>Try Again</Button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto bg-gray-100 p-6">
            <div className={`mx-auto bg-white shadow-lg ${
              deviceView === 'mobile' ? 'max-w-sm' : 'max-w-2xl'
            }`}>
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full min-h-[600px] border-0"
                  title="Newsletter Preview"
                />
              ) : (
                <div className="p-8">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      {builderState.newsletter.title}
                    </h2>

                    {builderState.newsletter.content.sections.length === 0 ? (
                      <div className="text-gray-500">
                        <p>No content sections yet.</p>
                        <p className="text-sm mt-2">Add sections in the Design tab to see the preview.</p>
                      </div>
                    ) : (
                      <div className="space-y-6 text-left">
                        {builderState.newsletter.content.sections
                          .sort((a, b) => a.order - b.order)
                          .map((section) => (
                            <div key={section.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                              {section.type === 'text' && (
                                <div
                                  className="prose max-w-none"
                                  style={{
                                    textAlign: section.styles?.textAlign || 'left',
                                    fontSize: section.styles?.fontSize || '16px',
                                    color: section.styles?.textColor || '#000000'
                                  }}
                                  dangerouslySetInnerHTML={{ __html: section.content || 'Text content...' }}
                                />
                              )}

                              {section.type === 'image' && (
                                <div style={{ textAlign: section.styles?.textAlign || 'center' }}>
                                  <img
                                    src={section.imageUrl || 'https://via.placeholder.com/600x300'}
                                    alt={section.title}
                                    className="max-w-full h-auto rounded-lg"
                                  />
                                  {section.content && (
                                    <p className="mt-2 text-sm text-gray-600">{section.content}</p>
                                  )}
                                </div>
                              )}

                              {section.type === 'button' && (
                                <div style={{ textAlign: section.styles?.textAlign || 'center' }}>
                                  <a
                                    href={section.buttonUrl || '#'}
                                    className="inline-block px-6 py-3 rounded-lg text-white font-medium"
                                    style={{
                                      backgroundColor: section.styles?.backgroundColor || '#3B82F6'
                                    }}
                                  >
                                    {section.buttonText || 'Click Here'}
                                  </a>
                                </div>
                              )}

                              {section.type === 'divider' && (
                                <hr className="border-gray-300" />
                              )}

                              {section.type === 'news' && (
                                <div>
                                  <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
                                  {section.items.length === 0 ? (
                                    <div className="text-gray-500 text-sm">
                                      News content will be populated automatically
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {section.items.slice(0, 3).map((item) => (
                                        <div key={item.id} className="border-l-4 border-blue-500 pl-4">
                                          <h4 className="font-medium text-gray-900">{item.title}</h4>
                                          <p className="text-sm text-gray-600 mt-1">{item.summary}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {section.type === 'custom' && (
                                <div>
                                  <h3 className="text-lg font-semibold mb-4">{section.title}</h3>
                                  <div dangerouslySetInnerHTML={{ __html: section.content || 'Custom content...' }} />
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
                      <p>Newsletter powered by AiLert</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
