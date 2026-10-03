import type {
  TenantLlmUsage,
  ServiceMonthlyReport,
  UpdateCreditLimitInput,
  HealthData,
  TenantOption
} from '../types'

export class KuraApiClient {
  private baseUrl: string
  private adminKey?: string

  constructor(options?: { baseUrl?: string; adminKey?: string }) {
    this.baseUrl = (options?.baseUrl || '').replace(/\/$/, '')
    this.adminKey = options?.adminKey
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '')
  }

  public setAdminKey(key?: string) {
    this.adminKey = key
  }

  private async request<T>(path: string, options: RequestInit & { tenantId?: string; serviceId?: string } = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (this.adminKey) {
      headers['X-Admin-API-Key'] = this.adminKey
      headers['Authorization'] = `Bearer ${this.adminKey}`
    }

    if (options.tenantId) {
      headers['X-Tenant-ID'] = options.tenantId
    }

    if (options.serviceId) {
      headers['X-Service-ID'] = options.serviceId
    }

    const res = await fetch(url, {
      ...options,
      headers
    })

    if (!res.ok) {
      let errMsg = `HTTP Error: ${res.status} ${res.statusText}`
      try {
        const errorJson = await res.json()
        errMsg = errorJson.message || errorJson.error || errorJson.detail || errMsg
      } catch {
        // fallback
      }
      throw new Error(errMsg)
    }

    if (res.status === 204) {
      return {} as T
    }

    return (await res.json()) as T
  }

  async checkHealth(): Promise<HealthData> {
    try {
      const res = await fetch(`${this.baseUrl}/api/llm/health`)
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // fallback
    }
    return { status: 'ready', database: 'connected' }
  }

  async fetchTenantUsage(tenantId: string, serviceId?: string): Promise<TenantLlmUsage> {
    const data = await this.request<any>('/api/llm/v1/internal/usage', {
      tenantId,
      serviceId: serviceId || tenantId
    })

    const effectiveCostLimit =
      data.tenant_cost_limit_usd && data.tenant_cost_limit_usd > 0
        ? data.tenant_cost_limit_usd
        : data.service_cost_limit_usd || 0

    const effectiveRemaining =
      data.tenant_remaining_cost_usd !== undefined && data.tenant_remaining_cost_usd >= 0
        ? data.tenant_remaining_cost_usd
        : data.service_remaining_cost_usd ?? -1

    return {
      tenant_id: tenantId,
      tenant_name: tenantId,
      plan_id: 'payg',
      month: data.month || '',
      billing_type: data.billing_type || 'payg',
      service_cost_limit_usd: effectiveCostLimit,
      service_total_cost_usd: data.service_total_cost_usd || 0,
      service_remaining_cost_usd: effectiveRemaining,
      tenant_remaining_cost_usd: data.tenant_remaining_cost_usd ?? -1,
      total_tokens: data.total_tokens || 0,
      prompt_tokens: data.prompt_tokens || 0,
      completion_tokens: data.completion_tokens || 0,
      is_quota_exceeded: Boolean(data.is_quota_exceeded)
    }
  }

  async fetchAllTenantsUsage(tenants: TenantOption[], serviceId?: string): Promise<TenantLlmUsage[]> {
    if (!tenants || tenants.length === 0) return []

    const promises = tenants.map(async (t) => {
      try {
        const u = await this.fetchTenantUsage(t.id, serviceId)
        return {
          ...u,
          tenant_name: t.name || t.id,
          plan_id: t.plan_id || u.plan_id || 'payg'
        }
      } catch {
        return {
          tenant_id: t.id,
          tenant_name: t.name || t.id,
          plan_id: t.plan_id || 'payg',
          month: '',
          billing_type: 'payg',
          service_cost_limit_usd: 0,
          service_total_cost_usd: 0,
          service_remaining_cost_usd: -1,
          tenant_remaining_cost_usd: -1,
          total_tokens: 0,
          prompt_tokens: 0,
          completion_tokens: 0,
          is_quota_exceeded: false
        } as TenantLlmUsage
      }
    })

    return Promise.all(promises)
  }

  async fetchServiceReport(serviceId: string): Promise<ServiceMonthlyReport> {
    return this.request<ServiceMonthlyReport>(
      `/api/llm/v1/internal/admin/usage?service_id=${encodeURIComponent(serviceId)}`
    )
  }

  async updateLimits(input: UpdateCreditLimitInput): Promise<any> {
    return this.request('/api/llm/v1/internal/admin/limits', {
      method: 'POST',
      body: JSON.stringify(input)
    })
  }
}
