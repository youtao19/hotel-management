<template>
  <q-page class="q-pa-lg douyin-settings-page">
    <section class="page-hero q-mb-lg">
      <div class="row items-center q-gutter-md">
        <q-avatar color="indigo-1" text-color="indigo-8" icon="settings" size="44px" />
        <div>
          <div class="text-h5 text-weight-bold text-grey-10">抖音支持设置</div>
          <div class="text-grey-7 q-mt-xs">管理系统与抖音的协作方式；订单处理规则由后端统一执行。</div>
        </div>
      </div>
    </section>

    <q-card flat bordered class="settings-card">
      <q-card-section>
        <div class="text-subtitle1 text-weight-bold">预约订单接单方式</div>
        <div class="text-caption text-grey-7 q-mt-xs">仅影响新进入系统的抖音预售券预约订单（biz_type=2012）。</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="row items-center justify-between q-col-gutter-md">
        <div class="col-12 col-sm">
          <div class="text-weight-medium">自动接单</div>
          <div class="text-caption text-grey-7 q-mt-xs">开启后系统自动回传接单；关闭后需在预售订单页逐笔接单或拒单。</div>
        </div>
        <div class="col-12 col-sm-auto row items-center q-gutter-sm">
          <q-toggle v-model="autoConfirmEnabled" color="primary" :disable="loading || saving" :label="autoConfirmEnabled ? '已开启' : '已关闭'" />
          <q-btn color="primary" unelevated label="保存设置" :loading="saving" :disable="loading" @click="save" />
        </div>
      </q-card-section>
      <q-card-section v-if="updatedAt" class="q-pt-none text-caption text-grey-6">
        上次修改：{{ updatedAt }}
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { douyinSettingsApi } from 'src/api'

const $q = useQuasar()
const autoConfirmEnabled = ref(true)
const updatedAt = ref(null)
const loading = ref(false)
const saving = ref(false)

/** 加载已保存的抖音接单方式。 */
async function load() {
  loading.value = true
  try {
    const response = await douyinSettingsApi.getSettings()
    autoConfirmEnabled.value = response.data?.auto_confirm_enabled === true
    updatedAt.value = response.data?.updated_at || null
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '获取抖音设置失败' })
  } finally {
    loading.value = false
  }
}

/** 保存自动接单开关，使后端立即按新模式处理后续预约单。 */
async function save() {
  saving.value = true
  try {
    const response = await douyinSettingsApi.updateSettings({ autoConfirmEnabled: autoConfirmEnabled.value })
    autoConfirmEnabled.value = response.data?.auto_confirm_enabled === true
    updatedAt.value = response.data?.updated_at || null
    $q.notify({ type: 'positive', message: response.message || '抖音设置已保存' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '保存抖音设置失败' })
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.douyin-settings-page { max-width: 1000px; margin: 0 auto; }
.page-hero { padding: 24px; border: 1px solid #e4e9f2; border-radius: 16px; background: linear-gradient(120deg, #f7faff 0%, #f3f7ff 100%); }
.settings-card { border-color: #e4e9f2; border-radius: 14px; }
</style>
