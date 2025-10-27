# Accessibility Audit: PromoCodeManager Component

## Overview

This audit evaluates the PromoCodeManager component
(`frontend/src/components/billing/PromoCodeManager.tsx`) for compliance with
WCAG 2.1 AA standards and React accessibility best practices.

## Critical Issues Found

### 1. Missing ARIA Labels and Descriptions

**Severity: High**

- **Issue**: Action buttons in dropdown menu lack proper ARIA labels
- **Location**: DropdownMenu items (Copy, Edit, Activate/Deactivate, Delete)
- **Impact**: Screen readers cannot properly announce button purposes
- **Fix**: Add `aria-label` attributes to describe each action

### 2. Keyboard Navigation Issues

**Severity: High**

- **Issue**: Custom checkbox inputs for plan selection lack proper keyboard
  handling
- **Location**: Applicable Plans section in create dialog
- **Impact**: Users cannot navigate or select plans using keyboard only
- **Fix**: Replace with proper checkbox components or add keyboard event
  handlers

### 3. Form Validation and Error Handling

**Severity: High**

- **Issue**: No ARIA live regions for form validation errors
- **Location**: Create promo code form
- **Impact**: Screen readers don't announce validation errors
- **Fix**: Add `aria-live="polite"` regions for error messages

### 4. Missing Form Field Associations

**Severity: Medium**

- **Issue**: Some form fields lack proper label associations
- **Location**: Plan selection checkboxes
- **Impact**: Screen readers cannot associate labels with controls
- **Fix**: Use proper `htmlFor` attributes or wrap inputs in labels

### 5. Color-Only Status Indication

**Severity: Medium**

- **Issue**: Promo code status relies solely on color coding
- **Location**: Status badges in table
- **Impact**: Users with color blindness cannot distinguish status
- **Fix**: Add icons or text patterns alongside colors

### 6. Missing Loading States

**Severity: Medium**

- **Issue**: No ARIA attributes for loading states
- **Location**: Create button and table loading
- **Impact**: Screen readers don't announce loading status
- **Fix**: Add `aria-busy` and `aria-live` attributes

### 7. Table Accessibility

**Severity: Medium**

- **Issue**: Table lacks proper caption and summary
- **Location**: Promo codes table
- **Impact**: Screen readers cannot provide table context
- **Fix**: Add table caption and column headers with scope attributes

## Recommendations

### Immediate Fixes (High Priority)

1. **Add ARIA Labels to Action Buttons**

```tsx
<DropdownMenuItem
  onClick={() => handleCopyCode(promoCode.code)}
  aria-label={`Copy promo code ${promoCode.code}`}
>
  <Copy className='h-4 w-4 mr-2' />
  Copy Code
</DropdownMenuItem>
```

2. **Improve Checkbox Accessibility**

```tsx
<div className='space-y-2'>
  <Label>Applicable Plans</Label>
  <fieldset>
    <legend className='sr-only'>Select applicable subscription plans</legend>
    <div className='grid grid-cols-2 gap-2'>
      {subscriptionPlans.map(plan => (
        <div key={plan.id} className='flex items-center space-x-2'>
          <input
            type='checkbox'
            id={`plan-${plan.id}`}
            checked={formData.applicablePlans.includes(plan.id)}
            onChange={e => {
              /* existing logic */
            }}
            aria-describedby={`plan-${plan.id}-desc`}
          />
          <label htmlFor={`plan-${plan.id}`} className='text-sm'>
            {plan.name}
          </label>
        </div>
      ))}
    </div>
  </fieldset>
</div>
```

3. **Add Form Validation with ARIA**

```tsx
const [errors, setErrors] = useState<Record<string, string>>({})

// In form field:
<div className="space-y-2">
  <Label htmlFor="code">Promo Code *</Label>
  <Input
    id="code"
    placeholder="SAVE20"
    value={formData.code}
    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
    aria-invalid={!!errors.code}
    aria-describedby={errors.code ? "code-error" : undefined}
  />
  {errors.code && (
    <div id="code-error" role="alert" className="text-red-600 text-sm">
      {errors.code}
    </div>
  )}
</div>
```

4. **Enhance Status Badges**

```tsx
const getStatusIcon = (promoCode: PromoCode) => {
  const status = getStatusText(promoCode);
  switch (status) {
    case 'Active':
      return <CheckCircle className='h-3 w-3' />;
    case 'Expired':
      return <XCircle className='h-3 w-3' />;
    case 'Scheduled':
      return <Clock className='h-3 w-3' />;
    case 'Exhausted':
      return <AlertCircle className='h-3 w-3' />;
    default:
      return <Circle className='h-3 w-3' />;
  }
};

<Badge
  className={getStatusColor(promoCode)}
  aria-label={`Status: ${getStatusText(promoCode)}`}
>
  {getStatusIcon(promoCode)}
  <span className='ml-1'>{getStatusText(promoCode)}</span>
</Badge>;
```

### Medium Priority Improvements

5. **Add Table Caption and Headers**

```tsx
<Table role="table" aria-label="Promotional codes management table">
  <caption className="sr-only">
    List of promotional codes with their details, usage statistics, and management actions
  </caption>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">Code</TableHead>
      <TableHead scope="col">Discount</TableHead>
      <TableHead scope="col">Usage</TableHead>
      <TableHead scope="col">Valid Period</TableHead>
      <TableHead scope="col">Status</TableHead>
      <TableHead scope="col" className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
```

6. **Improve Loading States**

```tsx
{storeLoading ? (
  <div className="text-center py-8" role="status" aria-live="polite">
    <p className="text-muted-foreground">Loading promotional codes...</p>
  </div>
) : (
  // existing content
)}

<Button
  onClick={handleCreatePromoCode}
  disabled={isLoading || !formData.code || !formData.name}
  aria-busy={isLoading}
>
  {isLoading ? 'Creating...' : 'Create Promo Code'}
</Button>
```

7. **Add Focus Management**

```tsx
import { useRef } from 'react';

const createButtonRef = useRef<HTMLButtonElement>(null);

const handleCreatePromoCode = async () => {
  setIsLoading(true);
  try {
    await createPromoCode(formData);
    setIsCreateDialogOpen(false);
    resetForm();
    // Return focus to trigger button
    createButtonRef.current?.focus();
  } catch (error) {
    console.error('Failed to create promo code:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Low Priority Enhancements

8. **Add Skip Links for Large Tables**
9. **Implement Reduced Motion Preferences**
10. **Add Tooltips for Complex Actions**

## Testing Recommendations

1. **Automated Testing**
   - Use `@testing-library/jest-dom` for accessibility assertions
   - Test with `axe-core` for automated accessibility scanning
   - Verify keyboard navigation paths

2. **Manual Testing**
   - Test with screen readers (NVDA, JAWS, VoiceOver)
   - Navigate using only keyboard
   - Test with high contrast mode
   - Verify with zoom levels up to 200%

3. **User Testing**
   - Include users with disabilities in testing process
   - Test with assistive technologies
   - Gather feedback on usability

## Compliance Status

- **WCAG 2.1 A**: ❌ Fails (keyboard navigation issues)
- **WCAG 2.1 AA**: ❌ Fails (color contrast, form labels)
- **Section 508**: ❌ Fails (missing ARIA labels)

## Next Steps

1. Implement high-priority fixes immediately
2. Add comprehensive accessibility testing
3. Create accessibility testing checklist for future components
4. Consider implementing a design system with built-in accessibility features

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [React Accessibility Documentation](https://reactjs.org/docs/accessibility.html)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
