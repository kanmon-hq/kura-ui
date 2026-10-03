<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import {
  Cpu,
  RefreshCw,
  Search,
  Sliders,
  DollarSign,
  Users,
  PieChart,
  CheckCircle2,
  AlertTriangle,
  Settings,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe,
  Database,
  Lock,
  Layers,
  Sparkles,
  Server
} from 'lucide-vue-next'
import { KuraApiClient } from '../api/client'
import type {
  TenantLlmUsage,
  ServiceMonthlyReport,
  HealthData,
  TenantOption
} from '../types'

const props = withDefaults(
  defineProps<{
    apiBaseUrl?: string
    adminKey?: string
    serviceId?: string
    tenantsJson?: string | TenantOption[]
    embedded?: boolean
    title?: string
  }>(),
  {
    apiBaseUrl: '',
    adminKey: '',
    serviceId: 'itcp-service',
    tenantsJson: () => [],
    embedded: false,
    title: 'LLM Gateway (Kura) 運用コンソール'
  }
)

const client = new KuraApiClient({
  baseUrl: props.apiBaseUrl,
  adminKey: props.adminKey
})

watch(() => props.apiBaseUrl, (url) => client.setBaseUrl(url || ''))
watch(() => props.adminKey, (key) => client.setAdminKey(key))

// テナントリストパース
const parsedTenants = computed<TenantOption[]>(() => {
  if (Array.isArray(props.tenantsJson)) {
    return props.tenantsJson
  }
  if (typeof props.tenantsJson === 'string' && props.tenantsJson.trim()) {
    try {
      return JSON.parse(props.tenantsJson)
    } catch {
      return []
    }
  }
  return []
})

// 状態管理
const tenantUsages = ref<TenantLlmUsage[]>([])
const selectedTenant = ref<TenantLlmUsage | null>(null)
const healthStatus = ref<HealthData>({ status: 'ready', database: 'connected' })
const isLoading = ref(false)
const alertMessage = ref('')
const alertType = ref<'success' | 'error'>('success')

const activeTab = ref<'usage' | 'system'>('usage')
const selectedServiceId = ref(props.serviceId)
const serviceReport = ref<ServiceMonthlyReport | null>(null)

// フィルタ
const searchQuery = ref('')
const quotaFilter = ref<'all' | 'normal' | 'exceeded'>('all')

// モーダル
const showServiceCreditModal = ref(false)
const serviceCreditForm = ref({
  cost_limit: 500,
  billing_type: 'capped'
})

const showCreditModal = ref(false)
const editingCreditTenant = ref<TenantLlmUsage | null>(null)
const creditForm = ref({
  cost_limit: 0,
  billing_type: 'capped'
})

// 算出メトリクス
const activeTenantsCount = computed(() => {
  const active = parsedTenants.value.filter((t) => t.status === 'active')
  return active.length > 0 ? active.length : tenantUsages.value.length
})

const aggregateTotalTokens = computed(() =>
  tenantUsages.value.reduce((sum, item) => sum + (item.total_tokens || 0), 0)
)

const aggregateTotalCostUSD = computed(() =>
  tenantUsages.value.reduce((sum, item) => sum + (item.service_total_cost_usd || 0), 0)
)

const exceededTenantsCount = computed(() =>
  tenantUsages.value.filter((t) => t.is_quota_exceeded).length
)

// サービス親枠の計算
const serviceCostLimit = computed(() => serviceReport.value?.cost_limit || 0)
const serviceTotalCost = computed(() =>
  Math.max(aggregateTotalCostUSD.value, serviceReport.value?.total_cost_usd || 0)
)
const serviceRemainingCost = computed(() => {
  if (serviceCostLimit.value <= 0) return -1
  return Math.max(0, serviceCostLimit.value - serviceTotalCost.value)
})
const serviceUsagePercent = computed(() => {
  if (serviceCostLimit.value <= 0) return 0
  return Math.min(100, Math.round((serviceTotalCost.value / serviceCostLimit.value) * 100))
})
const isServiceQuotaExceeded = computed(() =>
  serviceCostLimit.value > 0 && serviceTotalCost.value >= serviceCostLimit.value
)

// テナント一覧フィルタ
const filteredTenantUsages = computed(() => {
  let list = tenantUsages.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (t) =>
        t.tenant_name.toLowerCase().includes(q) ||
        t.tenant_id.toLowerCase().includes(q)
    )
  }
  if (quotaFilter.value === 'normal') {
    list = list.filter((t) => !t.is_quota_exceeded)
  } else if (quotaFilter.value === 'exceeded') {
    list = list.filter((t) => t.is_quota_exceeded)
  }
  return list
})

// ドリルダウン比率
const selectedPromptRatio = computed(() => {
  if (!selectedTenant.value || selectedTenant.value.total_tokens === 0) return 0
  return Math.round(
    (selectedTenant.value.prompt_tokens / selectedTenant.value.total_tokens) * 100
  )
})
const selectedCompletionRatio = computed(() => {
  if (!selectedTenant.value || selectedTenant.value.total_tokens === 0) return 0
  return 100 - selectedPromptRatio.value
})

function showAlert(msg: string, type: 'success' | 'error' = 'success') {
  alertMessage.value = msg
  alertType.value = type
  if (type === 'success') {
    setTimeout(() => {
      if (alertMessage.value === msg) alertMessage.value = ''
    }, 5000)
  }
}

// データ読み込み
async function fetchServiceReport() {
  if (!selectedServiceId.value) return
  try {
    serviceReport.value = await client.fetchServiceReport(selectedServiceId.value)
  } catch (err: any) {
    console.error('Fetch service report failed:', err)
  }
}

async function fetchAllData() {
  isLoading.value = true
  try {
    healthStatus.value = await client.checkHealth()
    let tenants = parsedTenants.value
    if (tenants.length === 0) {
      tenants = [
        { id: 'tenant-corp-a', name: '企業 A' },
        { id: 'tenant-corp-b', name: '企業 B' }
      ]
    }
    const results = await client.fetchAllTenantsUsage(tenants, selectedServiceId.value)
    tenantUsages.value = results
    if (results.length > 0) {
      if (!selectedTenant.value || !results.some((r) => r.tenant_id === selectedTenant.value?.tenant_id)) {
        selectedTenant.value = results[0]
      } else {
        selectedTenant.value = results.find((r) => r.tenant_id === selectedTenant.value?.tenant_id) || results[0]
      }
    }
  } catch (err: any) {
    showAlert(`データ取得に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// 親枠モーダル操作
function openServiceCreditModal() {
  serviceCreditForm.value = {
    cost_limit: serviceReport.value?.cost_limit || 500,
    billing_type: serviceReport.value?.billing_type || (serviceCostLimit.value > 0 ? 'capped' : 'pay_as_you_go')
  }
  showServiceCreditModal.value = true
}

async function submitUpdateServiceCredit() {
  if (!selectedServiceId.value) return
  isLoading.value = true
  try {
    await client.updateLimits({
      service_id: selectedServiceId.value,
      cost_limit: Number(serviceCreditForm.value.cost_limit),
      billing_type: serviceCreditForm.value.billing_type
    })
    showAlert(`連携サービス「${selectedServiceId.value}」の月次総クレジット上限を設定しました。`, 'success')
    showServiceCreditModal.value = false
    await fetchServiceReport()
    await fetchAllData()
  } catch (err: any) {
    showAlert(`上限更新に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

// テナント個別モーダル操作
function openCreditModal(item: TenantLlmUsage) {
  editingCreditTenant.value = item
  creditForm.value = {
    cost_limit: item.service_cost_limit_usd || 0,
    billing_type: item.billing_type || (item.service_cost_limit_usd > 0 ? 'capped' : 'payg')
  }
  showCreditModal.value = true
}

async function submitUpdateCredit() {
  if (!editingCreditTenant.value) return
  isLoading.value = true
  try {
    await client.updateLimits({
      service_id: selectedServiceId.value,
      tenant_id: editingCreditTenant.value.tenant_id,
      cost_limit: Number(creditForm.value.cost_limit),
      billing_type: creditForm.value.billing_type
    })
    showAlert(`テナント「${editingCreditTenant.value.tenant_name}」の個別上限を設定しました。`, 'success')
    showCreditModal.value = false
    editingCreditTenant.value = null
    await fetchAllData()
  } catch (err: any) {
    showAlert(`個別上限更新に失敗しました: ${err.message}`, 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchAllData()
  fetchServiceReport()
})
</script>

<template>
  <div class="kura-root min-h-[600px] w-full bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans antialiased space-y-8 rounded-2xl border border-slate-800/80 shadow-2xl">
    
    <!-- ページヘッダー -->
    <div v-if="!embedded" class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
          <Cpu class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white">{{ title }}</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Kura Connected</span>
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-400 mt-1">
            全テナント横断のトークン消費計測 (KuraUsage)・推計コスト・月次クォータ監視
          </p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="fetchAllData(); fetchServiceReport()"
          :disabled="isLoading"
          class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading }" />
          <span>再読み込み</span>
        </button>
      </div>
    </div>

    <!-- アラートメッセージ通知 -->
    <div
      v-if="alertMessage"
      class="p-4 rounded-2xl flex items-center gap-3 text-xs sm:text-sm border"
      :class="alertType === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300' : 'bg-rose-950/40 border-rose-800 text-rose-300'"
    >
      <CheckCircle2 v-if="alertType === 'success'" class="w-5 h-5 text-emerald-400 shrink-0" />
      <AlertTriangle v-else class="w-5 h-5 text-rose-400 shrink-0" />
      <span class="flex-1">{{ alertMessage }}</span>
      <button @click="alertMessage = ''" class="text-slate-400 hover:text-white">&times;</button>
    </div>

    <!-- 4大メトリクスカード -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">監視テナント数</span>
          <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-white">{{ tenantUsages.length }}</span>
          <span class="text-xs text-slate-500 font-medium">社</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">稼働中: {{ activeTenantsCount }} 社</p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">全社総消費トークン</span>
          <div class="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Zap class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-cyan-400">{{ aggregateTotalTokens.toLocaleString() }}</span>
          <span class="text-xs text-slate-500 font-medium">tokens</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">Prompt &amp; Completion 累計</p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">当月総推計コスト</span>
          <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-emerald-400">${{ serviceTotalCost.toFixed(4) }}</span>
          <span class="text-xs text-slate-500 font-medium">USD</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">
          上限: {{ serviceCostLimit > 0 ? `$${serviceCostLimit.toFixed(2)}` : '無制限' }}
        </p>
      </div>

      <div class="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400">クォータ超過社数</span>
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl sm:text-3xl font-black text-amber-400">{{ exceededTenantsCount }}</span>
          <span class="text-xs text-slate-500 font-medium">社</span>
        </div>
        <p class="mt-1 text-[11px] text-slate-400">429 Rate Limit 発動中</p>
      </div>
    </div>

    <!-- サービス親枠月次クレジット設定バナー -->
    <div class="bg-slate-900/90 rounded-2xl border border-indigo-900/60 p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-indigo-400" />
          <span class="text-sm font-bold text-white">連携サービス親枠 (Service ID: {{ selectedServiceId }}) 月次総クレジット</span>
        </div>
        <p class="text-xs text-slate-400">
          全テナント合計消費: <span class="font-mono text-indigo-300 font-bold">${{ serviceTotalCost.toFixed(4) }}</span> / 
          上限: <span class="font-mono text-white font-bold">{{ serviceCostLimit > 0 ? `$${serviceCostLimit.toFixed(2)}` : '無制限 (従量課金)' }}</span>
        </p>
        <div v-if="serviceCostLimit > 0" class="w-64 sm:w-96 bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="serviceUsagePercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'"
            :style="{ width: `${serviceUsagePercent}%` }"
          ></div>
        </div>
      </div>

      <button
        @click="openServiceCreditModal"
        class="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/80 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
      >
        <Sliders class="w-3.5 h-3.5" />
        <span>サービス総上限を変更</span>
      </button>
    </div>

    <!-- タブ切り替え -->
    <div class="flex items-center gap-2 border-b border-slate-800">
      <button
        @click="activeTab = 'usage'"
        class="pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer"
        :class="activeTab === 'usage' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Users class="w-4 h-4" />
        <span>テナント別消費一覧</span>
      </button>

      <button
        @click="activeTab = 'system'"
        class="pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer"
        :class="activeTab === 'system' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'"
      >
        <Sliders class="w-4 h-4" />
        <span>システム仕様 &amp; ルーティング</span>
      </button>
    </div>

    <!-- ─── タブ 1: テナント別消費一覧 ──────────────────────────────────── -->
    <div v-if="activeTab === 'usage'" class="space-y-6">
      
      <!-- フィルタバー -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="relative flex-1 max-w-md w-full">
          <Search class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="テナント名, テナントIDで検索..."
            class="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button
            v-for="f in ['all', 'normal', 'exceeded']"
            :key="f"
            @click="quotaFilter = f as any"
            class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize cursor-pointer"
            :class="quotaFilter === f
              ? 'bg-indigo-950 text-indigo-300 border-indigo-700 font-bold'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'"
          >
            {{ f === 'all' ? 'すべての状態' : f === 'normal' ? '正常' : '上限超過' }}
          </button>
        </div>
      </div>

      <!-- テーブル & ドリルダウン分割 -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- 左側: テナント一覧テーブル (2カラム) -->
        <div class="lg:col-span-2 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Users class="w-4 h-4 text-indigo-400" />
              <h2 class="text-sm font-bold text-white">テナント別利用量 &amp; クォータ</h2>
            </div>
            <span class="text-xs text-slate-500 font-medium">該当: {{ filteredTenantUsages.length }} 社</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th class="py-3 px-4">テナント</th>
                  <th class="py-3 px-4">総トークン数</th>
                  <th class="py-3 px-4">当月推計コスト</th>
                  <th class="py-3 px-4">状態</th>
                  <th class="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60 text-slate-200">
                <tr
                  v-for="t in filteredTenantUsages"
                  :key="t.tenant_id"
                  @click="selectedTenant = t"
                  class="hover:bg-slate-800/30 transition-colors cursor-pointer"
                  :class="selectedTenant?.tenant_id === t.tenant_id ? 'bg-indigo-950/30 border-l-2 border-indigo-500' : ''"
                >
                  <td class="py-3 px-4">
                    <div class="font-bold text-white">{{ t.tenant_name }}</div>
                    <div class="text-[11px] font-mono text-slate-500">{{ t.tenant_id }}</div>
                  </td>
                  <td class="py-3 px-4 font-mono text-slate-300">
                    {{ t.total_tokens.toLocaleString() }}
                  </td>
                  <td class="py-3 px-4 font-mono text-emerald-400 font-bold">
                    ${{ t.service_total_cost_usd.toFixed(4) }}
                  </td>
                  <td class="py-3 px-4">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold border"
                      :class="t.is_quota_exceeded
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'"
                    >
                      {{ t.is_quota_exceeded ? '上限超過' : '正常' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <button
                      @click.stop="openCreditModal(t)"
                      class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      上限設定
                    </button>
                  </td>
                </tr>
                <tr v-if="filteredTenantUsages.length === 0">
                  <td colspan="5" class="py-8 text-center text-slate-500">
                    該当するテナントは見つかりませんでした。
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 右側: 選択テナント詳細ドリルダウン (1カラム) -->
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div class="flex items-center gap-2 pb-3 border-b border-slate-800">
            <PieChart class="w-4 h-4 text-indigo-400" />
            <h3 class="text-sm font-bold text-white">テナント詳細内訳</h3>
          </div>

          <div v-if="selectedTenant" class="space-y-4 text-xs">
            <div>
              <span class="text-slate-400">対象テナント:</span>
              <div class="text-base font-bold text-white mt-0.5">{{ selectedTenant.tenant_name }}</div>
              <div class="font-mono text-slate-500 text-[11px]">{{ selectedTenant.tenant_id }}</div>
            </div>

            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div class="flex justify-between">
                <span class="text-slate-400">Prompt トークン:</span>
                <span class="font-mono text-indigo-300 font-bold">{{ selectedTenant.prompt_tokens.toLocaleString() }} ({{ selectedPromptRatio }}%)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Completion トークン:</span>
                <span class="font-mono text-cyan-300 font-bold">{{ selectedTenant.completion_tokens.toLocaleString() }} ({{ selectedCompletionRatio }}%)</span>
              </div>
              <!-- プログレスバー -->
              <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                <div class="bg-indigo-500 h-full" :style="{ width: `${selectedPromptRatio}%` }"></div>
                <div class="bg-cyan-500 h-full" :style="{ width: `${selectedCompletionRatio}%` }"></div>
              </div>
            </div>

            <div class="space-y-1.5 pt-2 border-t border-slate-800">
              <div class="flex justify-between">
                <span class="text-slate-400">課金体系:</span>
                <span class="font-mono text-slate-200 capitalize">{{ selectedTenant.billing_type }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">個別上限設定:</span>
                <span class="font-mono text-slate-200">{{ selectedTenant.service_cost_limit_usd > 0 ? `$${selectedTenant.service_cost_limit_usd.toFixed(2)}` : '無制限' }}</span>
              </div>
            </div>
          </div>

          <div v-else class="py-8 text-center text-slate-500 text-xs">
            左の一覧からテナントを選択してください。
          </div>
        </div>

      </div>
    </div>

    <!-- ─── タブ 2: システム仕様 & ルーティング ────────────────────────── -->
    <div v-if="activeTab === 'system'" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-indigo-400">
            <Layers class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">Kura LLM プロキシ</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            OpenAI, Anthropic, Bedrock などの LLM プロバイダー宛のリクエストを仲介し、テナント別のリアルタイムトークン計測と自動コスト換算を実施します。
          </p>
        </div>

        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-cyan-400">
            <Zap class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">2階層クレジット制御</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            サービス全体の総クレジット上限（親枠）と、テナントごとの個別上限（子枠）の2段階でクォータを厳密に制限し、予算超過を完全に防止します。
          </p>
        </div>

        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-3">
          <div class="flex items-center gap-2 text-emerald-400">
            <Server class="w-5 h-5" />
            <h3 class="font-bold text-white text-sm">ストリーミング完全対応</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            SSE / Server-Sent Events ストリーミングレスポンスでもチャンクをパースして正確にトークン数を取得・記録します。
          </p>
        </div>
      </div>
    </div>

    <!-- ─── モーダル: サービス総上限設定 ──────────────────────────────── -->
    <div v-if="showServiceCreditModal" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-white">サービス総クレジット上限設定</h3>
          <button @click="showServiceCreditModal = false" class="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">月次総上限 (USD)</label>
            <input
              v-model.number="serviceCreditForm.cost_limit"
              type="number"
              step="0.01"
              min="0"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">課金モード</label>
            <select
              v-model="serviceCreditForm.billing_type"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="capped">Capped (上限到達時に 429 遮断)</option>
              <option value="pay_as_you_go">Pay As You Go (従量課金 / 上限なし)</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            @click="showServiceCreditModal = false"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            キャンセル
          </button>
          <button
            @click="submitUpdateServiceCredit"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
          >
            保存する
          </button>
        </div>
      </div>
    </div>

    <!-- ─── モーダル: テナント個別上限設定 ────────────────────────────── -->
    <div v-if="showCreditModal && editingCreditTenant" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 class="text-base font-bold text-white">個別クレジット上限設定</h3>
            <p class="text-xs text-slate-400 mt-0.5">{{ editingCreditTenant.tenant_name }}</p>
          </div>
          <button @click="showCreditModal = false" class="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">月次個別上限 (USD, 0 = 無制限)</label>
            <input
              v-model.number="creditForm.cost_limit"
              type="number"
              step="0.01"
              min="0"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">課金モード</label>
            <select
              v-model="creditForm.billing_type"
              class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="capped">Capped (個別上限で遮断)</option>
              <option value="payg">PAYG (従量課金)</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            @click="showCreditModal = false"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            キャンセル
          </button>
          <button
            @click="submitUpdateCredit"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
          >
            保存する
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style>
@import '../styles/main.css';
</style>
