# @kanmon/kura-ui

Kura LLM Gateway & Token Broker 向けの組み込み型 Web Components UI ライブラリ。  
Vue 3、React、Next.js、Vanilla HTML などあらゆるフロントエンド環境に単一のカスタム要素として簡単に組み込み可能です。

## 特徴

- ⚡ **Web Components (Custom Elements)**: `<kura-console>` タグで即座にマウント可能
- 🛡️ **Shadow DOM スコープ保護**: ホストアプリケーションの CSS と干渉しない完全隔離スタイリング
- 📊 **トークン & コスト計測**: 全テナント横断のトークン消費量・Prompt/Completion 内訳・推計コスト集計
- 💳 **2段階クレジット上限管理**: サービス全体（親枠）およびテナント個別（子枠）の月次コスト上限統制

## インストール

```bash
npm install @kanmon/kura-ui
```

## 使い方 (Vue 3 / React)

### Vue 3
```vue
<script setup lang="ts">
import '@kanmon/kura-ui'

const tenants = [
  { id: 'tenant-corp-a', name: '企業 A' },
  { id: 'tenant-corp-b', name: '企業 B' }
]
</script>

<template>
  <kura-console
    api-base-url=""
    admin-key="your-admin-master-key"
    service-id="itcp-service"
    :tenants-json="tenants"
  />
</template>
```

### React
```tsx
import React, { useEffect } from 'react'

export function KuraAdminPage() {
  useEffect(() => {
    import('@kanmon/kura-ui')
  }, [])

  return (
    <kura-console
      api-base-url={process.env.NEXT_PUBLIC_KURA_API_URL}
      admin-key="secret"
      service-id="itcp-service"
    />
  )
}
```

## ライセンス

Apache-2.0
