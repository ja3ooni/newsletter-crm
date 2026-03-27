export interface TemplateMarketplaceFilters {
  category?: 'business' | 'tech' | 'creative' | 'minimal';
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number;
  tags?: string[];
  sortBy?: 'popularity' | 'rating' | 'newest' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateCustomization {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  layout: {
    width: number;
    padding: number;
    borderRadius: number;
  };
  branding: {
    logo?: string;
    companyName?: string;
    socialLinks?: Record<string, string>;
  };
}

export interface TemplatePreview {
  id: string;
  templateId: string;
  html: string;
  previewUrl: string;
  customization: TemplateCustomization;
  generatedAt: Date;
  expiresAt: Date;
}

export interface TemplateUsageStats {
  templateId: string;
  totalUsage: number;
  uniqueUsers: number;
  averageRating: number;
  lastUsed: Date;
  popularVariables: Array<{
    name: string;
    usage: number;
  }>;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
  suggestions: string[];
}

export interface TemplateValidationError {
  type: 'html' | 'css' | 'variable' | 'accessibility';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface TemplateValidationWarning {
  type: 'performance' | 'compatibility' | 'best-practice' | 'accessibility';
  message: string;
  suggestion: string;
}

export interface ResponsiveBreakpoint {
  name: string;
  width: number;
  css: string;
}

export interface TemplateResponsiveSettings {
  breakpoints: ResponsiveBreakpoint[];
  mobileFirst: boolean;
  fluidLayout: boolean;
  adaptiveImages: boolean;
}

export interface TemplateAccessibilitySettings {
  altTextRequired: boolean;
  colorContrastRatio: number;
  focusIndicators: boolean;
  semanticMarkup: boolean;
  screenReaderOptimized: boolean;
}
