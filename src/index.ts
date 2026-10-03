import { defineCustomElement } from 'vue'
import KuraConsoleSFC from './components/KuraConsole.ce.vue'
import { KuraApiClient } from './api/client'
import type {
  TenantLlmUsage,
  ServiceMonthlyReport,
  HealthData,
  TenantOption,
  UpdateCreditLimitInput
} from './types'

// Custom Element の定義
export const KuraConsoleElement = defineCustomElement(KuraConsoleSFC)

/**
 * Web Components を登録する関数
 * @param tagName カスタムタグ名 (デフォルト: 'kura-console')
 */
export function registerKuraUI(tagName = 'kura-console') {
  if (typeof window !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, KuraConsoleElement)
  }
}

// 自動登録
if (typeof window !== 'undefined') {
  registerKuraUI()
}

export {
  KuraConsoleSFC,
  KuraApiClient
}

export type {
  TenantLlmUsage,
  ServiceMonthlyReport,
  HealthData,
  TenantOption,
  UpdateCreditLimitInput
}

export default registerKuraUI
