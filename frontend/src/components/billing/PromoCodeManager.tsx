'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/Select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useBillingStore } from '@/store/billingStore'
import { CreatePromoCodeRequest, PromoCode } from '@/types/billing'
import {
  Copy,
  Edit,
  Eye,
  EyeOff,
  MoreHorizontal,
  Percent,
  Plus,
  Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function PromoCodeManager(): JSX.Element {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreatePromoCodeRequest>({
    code: '',
    name: '',
    description: '',
    type: 'percentage',
    value: 0,
    currency: 'USD',
    maxRedemptions: undefined,
    validFrom: new Date(),
    validUntil: undefined,
    applicablePlans: [],
    metadata: {},
  })

  const {
    promoCodes,
    subscriptionPlans,
    fetchPromoCodes,
    fetchSubscriptionPlans,
    createPromoCode,
    isLoading: storeLoading,
  } = useBillingStore()

  useEffect(() => {
    fetchPromoCodes()
    fetchSubscriptionPlans()
  }, [])

  const handleCreatePromoCode = async () => {
    setIsLoading(true)
    try {
      await createPromoCode(formData)
      setIsCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Failed to create promo code:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      currency: 'USD',
      maxRedemptions: undefined,
      validFrom: new Date(),
      validUntil: undefined,
      applicablePlans: [],
      metadata: {},
    })
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    // You could add a toast notification here
  }

  const getStatusColor = (promoCode: PromoCode) => {
    const now = new Date()
    const validFrom = new Date(promoCode.validFrom)
    const validUntil = promoCode.validUntil ? new Date(promoCode.validUntil) : null

    if (!promoCode.isActive) {
      return 'bg-gray-100 text-gray-800 border-gray-200'
    }

    if (now < validFrom) {
      return 'bg-blue-100 text-blue-800 border-blue-200'
    }

    if (validUntil && now > validUntil) {
      return 'bg-red-100 text-red-800 border-red-200'
    }

    if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }

    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getStatusText = (promoCode: PromoCode) => {
    const now = new Date()
    const validFrom = new Date(promoCode.validFrom)
    const validUntil = promoCode.validUntil ? new Date(promoCode.validUntil) : null

    if (!promoCode.isActive) return 'Inactive'
    if (now < validFrom) return 'Scheduled'
    if (validUntil && now > validUntil) return 'Expired'
    if (promoCode.maxRedemptions && promoCode.currentRedemptions >= promoCode.maxRedemptions) return 'Exhausted'
    return 'Active'
  }

  const formatDiscount = (promoCode: PromoCode) => {
    if (promoCode.type === 'percentage') {
      return `${promoCode.value}%`
    } else {
      return formatCurrency(promoCode.value / 100, promoCode.currency || 'USD')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Promotional Campaigns
            </CardTitle>
            <CardDescription>
              Create and manage discount codes and promotional campaigns
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Promo Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Promotional Code</DialogTitle>
                <DialogDescription>
                  Create a new discount code for your customers
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Promo Code *</Label>
                    <Input
                      id="code"
                      placeholder="SAVE20"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name *</Label>
                    <Input
                      id="name"
                      placeholder="20% Off Summer Sale"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Special discount for summer promotion"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Discount Type *</Label>
                    <Select
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed_amount' })}
                      options={[
                        { value: 'percentage', label: 'Percentage' },
                        { value: 'fixed_amount', label: 'Fixed Amount' }
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">
                      {formData.type === 'percentage' ? 'Percentage (%)' : 'Amount'} *
                    </Label>
                    <Input
                      id="value"
                      type="number"
                      placeholder={formData.type === 'percentage' ? '20' : '10.00'}
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  {formData.type === 'fixed_amount' && (
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        options={[
                          { value: 'USD', label: 'USD' },
                          { value: 'EUR', label: 'EUR' },
                          { value: 'GBP', label: 'GBP' }
                        ]}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="validFrom">Valid From *</Label>
                    <Input
                      id="validFrom"
                      type="datetime-local"
                      value={formData.validFrom.toISOString().slice(0, 16)}
                      onChange={(e) => setFormData({ ...formData, validFrom: new Date(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validUntil">Valid Until</Label>
                    <Input
                      id="validUntil"
                      type="datetime-local"
                      value={formData.validUntil?.toISOString().slice(0, 16) || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validUntil: e.target.value ? new Date(e.target.value) : undefined
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRedemptions">Max Redemptions</Label>
                  <Input
                    id="maxRedemptions"
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={formData.maxRedemptions || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      maxRedemptions: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Applicable Plans</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {subscriptionPlans.map((plan) => (
                      <label key={plan.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.applicablePlans.includes(plan.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                applicablePlans: [...formData.applicablePlans, plan.id]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                applicablePlans: formData.applicablePlans.filter(id => id !== plan.id)
                              })
                            }
                          }}
                        />
                        <span className="text-sm">{plan.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePromoCode}
                  disabled={isLoading || !formData.code || !formData.name}
                >
                  {isLoading ? 'Creating...' : 'Create Promo Code'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {storeLoading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading promotional codes...</p>
          </div>
        ) : promoCodes.length === 0 ? (
          <div className="text-center py-8">
            <Percent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No promotional codes created yet</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Promo Code
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((promoCode) => (
                  <TableRow key={promoCode.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium font-mono">{promoCode.code}</div>
                        <div className="text-sm text-muted-foreground">{promoCode.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatDiscount(promoCode)}</div>
                      <div className="text-sm text-muted-foreground capitalize">
                        {promoCode.type.replace('_', ' ')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {promoCode.currentRedemptions}
                          {promoCode.maxRedemptions && ` / ${promoCode.maxRedemptions}`}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {promoCode.maxRedemptions ? 'redemptions' : 'unlimited'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(promoCode.validFrom)}</div>
                        <div className="text-muted-foreground">
                          {promoCode.validUntil ? `to ${formatDate(promoCode.validUntil)}` : 'No expiry'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(promoCode)}>
                        {getStatusText(promoCode)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleCopyCode(promoCode.code)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Code
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            {promoCode.isActive ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
