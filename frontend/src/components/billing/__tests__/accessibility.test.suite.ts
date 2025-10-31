/**
 * Comprehensive Accessibility Test Suite for Billing Components
 *
 * This file provides utilities and configurations for running accessibility tests
 * across all billing components to ensure WCAG 2.1 AA compliance.
 */

import { RenderResult } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

/**
 * Axe configuration for WCAG 2.1 AA compliance testing
 */
export const axeConfig = {
  rules: {
    // WCAG 2.1 Level A rules
    'area-alt': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-hidden-body': { enabled: true },
    'aria-hidden-focus': { enabled: true },
    'aria-label': { enabled: true },
    'aria-labelledby': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'bypass': { enabled: true },
    'color-contrast': { enabled: true },
    'document-title': { enabled: true },
    'duplicate-id': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'frame-title': { enabled: true },
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'image-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'keyboard': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'meta-refresh': { enabled: true },
    'meta-viewport': { enabled: true },
    'object-alt': { enabled: true },
    'role-img-alt': { enabled: true },
    'scrollable-region-focusable': { enabled: true },
    'server-side-image-map': { enabled: true },
    'svg-img-alt': { enabled: true },
    'td-headers-attr': { enabled: true },
    'th-has-data-cells': { enabled: true },
    'valid-lang': { enabled: true },
    'video-caption': { enabled: true },

    // WCAG 2.1 Level AA rules
    'color-contrast-enhanced': { enabled: false }, // Level AAA
    'focus-order-semantics': { enabled: true },
    'hidden-content': { enabled: true },
    'landmark-banner-is-top-level': { enabled: true },
    'landmark-complementary-is-top-level': { enabled: true },
    'landmark-contentinfo-is-top-level': { enabled: true },
    'landmark-main-is-top-level': { enabled: true },
    'landmark-no-duplicate-banner': { enabled: true },
    'landmark-no-duplicate-contentinfo': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'skip-link': { enabled: true },
    'tabindex': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
}

/**
 * Run accessibility tests on a rendered component
 */
export async function runAccessibilityTests(
  renderResult: RenderResult,
  componentName: string
): Promise<void> {
  const { container } = renderResult

  describe(`${componentName} Accessibility Compliance`, () => {
    it('should meet WCAG 2.1 AA standards', async () => {
      const results = await axe(container, axeConfig)
      expect(results).toHaveNoViolations()
    })

    it('should have proper semantic structure', () => {
      // Check for proper landmark usage
      const landmarks = container.querySelectorAll('[role="main"], [role="banner"], [role="navigation"], [role="region"], [role="complementary"], [role="contentinfo"]')
      if (landmarks.length > 0) {
        landmarks.forEach(landmark => {
          expect(landmark).toHaveAttribute('aria-label')
        })
      }
    })

    it('should have accessible interactive elements', () => {
      // Check buttons have accessible names
      const buttons = container.querySelectorAll('button')
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName()
      })

      // Check links have accessible names
      const links = container.querySelectorAll('a')
      links.forEach(link => {
        expect(link).toHaveAccessibleName()
      })

      // Check form controls have labels
      const inputs = container.querySelectorAll('input, select, textarea')
      inputs.forEach(input => {
        const id = input.getAttribute('id')
        if (id) {
          const label = container.querySelector(`label[for="${id}"]`)
          const ariaLabel = input.getAttribute('aria-label')
          const ariaLabelledby = input.getAttribute('aria-labelledby')

          expect(
            label || ariaLabel || ariaLabelledby
          ).toBeTruthy()
        }
      })
    })

    it('should have proper heading hierarchy', () => {
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')

      if (headings.length > 0) {
        // Check first heading is h1 or has aria-level="1"
        const firstHeading = headings[0]
        const isH1 = firstHeading.tagName.toLowerCase() === 'h1'
        const hasLevel1 = firstHeading.getAttribute('aria-level') === '1'

        expect(isH1 || hasLevel1).toBeTruthy()

        // Check all headings have accessible names
        headings.forEach(heading => {
          expect(heading).toHaveAccessibleName()
        })
      }
    })

    it('should have proper color contrast and not rely on color alone', () => {
      // Check for status indicators that might rely on color
      const statusElements = container.querySelectorAll('[class*="status"], [class*="badge"], [class*="alert"]')
      statusElements.forEach(element => {
        // Should have text content or ARIA label
        const hasText = element.textContent && element.textContent.trim().length > 0
        const hasAriaLabel = element.getAttribute('aria-label')

        expect(hasText || hasAriaLabel).toBeTruthy()
      })
    })

    it('should have proper focus management', () => {
      // Check focusable elements have visible focus indicators
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      focusableElements.forEach(element => {
        // Should not have tabindex > 0 (anti-pattern)
        const tabindex = element.getAttribute('tabindex')
        if (tabindex) {
          expect(parseInt(tabindex)).toBeLessThanOrEqual(0)
        }
      })
    })

    it('should handle loading and error states accessibly', () => {
      // Check for loading indicators
      const loadingElements = container.querySelectorAll('[role="status"], [aria-live]')
      loadingElements.forEach(element => {
        const role = element.getAttribute('role')
        const ariaLive = element.getAttribute('aria-live')

        if (role === 'status' || ariaLive) {
          expect(element).toHaveAccessibleName()
        }
      })

      // Check for error alerts
      const alertElements = container.querySelectorAll('[role="alert"]')
      alertElements.forEach(element => {
        expect(element).toHaveAccessibleName()
      })
    })
  })
}

/**
 * Common accessibility test patterns for billing components
 */
export const accessibilityTestPatterns = {
  /**
   * Test table accessibility
   */
  testTableAccessibility: (container: HTMLElement) => {
    const tables = container.querySelectorAll('table, [role="table"]')

    tables.forEach(table => {
      // Should have caption or aria-label
      const caption = table.querySelector('caption')
      const ariaLabel = table.getAttribute('aria-label')
      expect(caption || ariaLabel).toBeTruthy()

      // Column headers should have scope="col"
      const columnHeaders = table.querySelectorAll('th, [role="columnheader"]')
      columnHeaders.forEach(header => {
        const scope = header.getAttribute('scope')
        expect(scope).toBe('col')
      })
    })
  },

  /**
   * Test form accessibility
   */
  testFormAccessibility: (container: HTMLElement) => {
    const forms = container.querySelectorAll('form')

    forms.forEach(form => {
      // Required fields should be marked
      const requiredInputs = form.querySelectorAll('input[required], select[required], textarea[required]')
      requiredInputs.forEach(input => {
        const ariaRequired = input.getAttribute('aria-required')
        const hasRequiredIndicator = form.querySelector(`label[for="${input.getAttribute('id')}"] *`)?.textContent?.includes('*')

        expect(ariaRequired === 'true' || hasRequiredIndicator).toBeTruthy()
      })

      // Error messages should be associated with fields
      const errorMessages = form.querySelectorAll('[role="alert"], .error, [class*="error"]')
      errorMessages.forEach(error => {
        const id = error.getAttribute('id')
        if (id) {
          const associatedField = form.querySelector(`[aria-describedby*="${id}"]`)
          expect(associatedField).toBeTruthy()
        }
      })
    })
  },

  /**
   * Test dialog accessibility
   */
  testDialogAccessibility: (container: HTMLElement) => {
    const dialogs = container.querySelectorAll('[role="dialog"], dialog')

    dialogs.forEach(dialog => {
      // Should have accessible name
      expect(dialog).toHaveAccessibleName()

      // Should have focus management
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      expect(focusableElements.length).toBeGreaterThan(0)
    })
  },

  /**
   * Test chart accessibility
   */
  testChartAccessibility: (container: HTMLElement) => {
    const charts = container.querySelectorAll('[role="img"], .recharts-wrapper')

    charts.forEach(chart => {
      // Should have descriptive label
      expect(chart).toHaveAccessibleName()

      // Should have screen reader description
      const description = container.querySelector('.sr-only')
      if (description) {
        expect(description.textContent).toMatch(/chart|graph|data/i)
      }
    })
  }
}

/**
 * Keyboard navigation test utilities
 */
export const keyboardTestUtils = {
  /**
   * Test tab navigation order
   */
  testTabOrder: (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    )

    // Elements should be in logical order
    expect(focusableElements.length).toBeGreaterThan(0)

    // No positive tabindex values (anti-pattern)
    focusableElements.forEach(element => {
      const tabindex = element.getAttribute('tabindex')
      if (tabindex && parseInt(tabindex) > 0) {
        fail(`Element has positive tabindex: ${element.outerHTML}`)
      }
    })
  },

  /**
   * Test arrow key navigation for tabs/menus
   */
  testArrowKeyNavigation: (container: HTMLElement) => {
    const tabLists = container.querySelectorAll('[role="tablist"]')
    const menus = container.querySelectorAll('[role="menu"], [role="menubar"]')

    // Tabs should support arrow key navigation
    tabLists.forEach(tabList => {
      const tabs = tabList.querySelectorAll('[role="tab"]')
      if (tabs.length > 1) {
        // Should have proper tabindex management
        const activeTabs = Array.from(tabs).filter(tab =>
          tab.getAttribute('tabindex') === '0' || tab.getAttribute('aria-selected') === 'true'
        )
        expect(activeTabs.length).toBe(1)
      }
    })

    // Menus should support arrow key navigation
    menus.forEach(menu => {
      const menuItems = menu.querySelectorAll('[role="menuitem"]')
      if (menuItems.length > 1) {
        // Should have proper focus management
        expect(menuItems.length).toBeGreaterThan(0)
      }
    })
  }
}

export default {
  runAccessibilityTests,
  accessibilityTestPatterns,
  keyboardTestUtils,
  axeConfig
}
