export interface TenantOption {
  id: string
  name: string
  status?: string
  plan_id?: string
}

export interface TenantLlmUsage {
  tenant_id: string
  tenant_name: string
  plan_id: string
  month: string
  billing_type: string
  service_cost_limit_usd: number
  service_total_cost_usd: number
  service_remaining_cost_usd: number
  tenant_remaining_cost_usd: number
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  is_quota_exceeded: boolean
}

export interface ServiceMonthlyReport {
  service_id: string
  month: string
  total_tokens: number
  total_cost_usd: number
  cost_limit: number
  billing_type: string
  models?: Record<string, any>
}

export interface HealthData {
  status?: string
  database?: string
}

export interface UpdateCreditLimitInput {
  service_id: string
  tenant_id?: string
  cost_limit: number
  billing_type: string
}
