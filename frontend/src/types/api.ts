export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

export interface ApiError {
  message: string
  code?: string
  field?: string
  details?: Record<string, any>
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface FilterParams {
  search?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  [key: string]: any
}

export interface QueryParams extends PaginationParams, FilterParams {}

export interface UploadResponse {
  url: string
  filename: string
  size: number
  mimeType: string
}
