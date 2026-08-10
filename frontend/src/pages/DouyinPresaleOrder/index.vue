<template>
  <q-page class="q-pa-lg presale-order-page">
    <section class="page-hero q-mb-lg">
      <div class="row items-center justify-between q-col-gutter-md">
        <div class="col-12 col-md">
          <div class="row items-center q-gutter-x-sm">
            <q-avatar color="indigo-1" text-color="indigo-8" icon="receipt_long" size="44px" />
            <div>
              <div class="text-h5 text-weight-bold text-grey-10">抖音预售订单</div>
              <div class="text-grey-7 q-mt-xs">查看已购买的预售券主订单；未预约前不会占用酒店房间。</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-auto">
          <q-btn outline color="primary" icon="refresh" label="刷新列表" :loading="loading || auditLoading" @click="loadData" />
        </div>
      </div>
    </section>

    <section class="row q-col-gutter-md q-mb-lg">
      <div v-for="item in summaryCards" :key="item.label" class="col-12 col-sm-4">
        <q-card flat bordered class="summary-card">
          <q-card-section class="row items-center no-wrap">
            <q-avatar :color="item.color" text-color="white" :icon="item.icon" size="38px" />
            <div class="q-ml-md">
              <div class="text-caption text-grey-7">{{ item.label }}</div>
              <div class="text-h5 text-weight-bold">{{ item.value }}</div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </section>

    <q-card flat bordered class="table-card">
      <q-table
        :rows="orders"
        :columns="columns"
        row-key="order_id"
        :loading="loading"
        :pagination="{ rowsPerPage: 10 }"
        flat
      >
        <template #body-cell-order="props">
          <q-td :props="props">
            <div class="text-weight-bold text-grey-9">{{ props.row.ota_order_id }}</div>
            <div class="text-caption text-grey-6">本地：{{ props.row.order_id }}</div>
          </q-td>
        </template>

        <template #body-cell-voucher="props">
          <q-td :props="props">
            <div class="text-weight-medium text-grey-9">{{ props.row.voucher_name || '已购预售券' }}</div>
            <div class="text-caption text-grey-6">券 ID：{{ props.row.pre_sale_coupon_id || '-' }}</div>
            <div v-if="props.row.rate_plan_name" class="text-caption text-primary q-mt-xs">关联套餐：{{ props.row.rate_plan_name }}</div>
          </q-td>
        </template>

        <template #body-cell-amount="props">
          <q-td :props="props" class="text-right">
            <div class="text-weight-bold text-primary">{{ formatAmount(props.row.total_amount, props.row.currency) }}</div>
            <div class="text-caption text-grey-6">{{ props.row.voucher_count || 0 }} 张券</div>
          </q-td>
        </template>

        <template #body-cell-stage="props">
          <q-td :props="props">
            <q-chip dense :color="stageMeta(props.row.order_stage).color" text-color="white" :icon="stageMeta(props.row.order_stage).icon">
              {{ stageMeta(props.row.order_stage).label }}
            </q-chip>
          </q-td>
        </template>

        <template #body-cell-created_at="props">
          <q-td :props="props">{{ props.row.created_at || '-' }}</q-td>
        </template>

        <template #no-data>
          <div class="full-width row flex-center q-gutter-sm q-pa-xl text-grey-7">
            <q-icon size="30px" name="receipt_long" />
            <span>暂无抖音预售订单，客人购买预售券后会自动出现。</span>
          </div>
        </template>
      </q-table>
    </q-card>

    <q-card flat bordered class="table-card q-mt-lg">
      <q-card-section class="row items-center justify-between">
        <div>
          <div class="text-subtitle1 text-weight-bold">待人工审核的取消申请</div>
          <div class="text-caption text-grey-7 q-mt-xs">仅显示抖音要求人工审核的订单；同意或拒绝后会立即回传抖音。</div>
        </div>
        <q-chip dense color="orange-1" text-color="orange-9" icon="pending_actions">{{ audits.length }} 条待处理</q-chip>
      </q-card-section>
      <q-separator />
      <q-table
        :rows="audits"
        :columns="auditColumns"
        row-key="cancel_id"
        :loading="auditLoading"
        :pagination="{ rowsPerPage: 10 }"
        flat
      >
        <template #body-cell-order="props">
          <q-td :props="props">
            <div class="text-weight-medium">{{ props.row.ota_order_id }}</div>
            <div class="text-caption text-grey-6">本地：{{ props.row.order_out_id || '-' }}</div>
          </q-td>
        </template>

        <template #body-cell-sale="props">
          <q-td :props="props">{{ afterSaleLabel(props.row.after_sale_type) }}</q-td>
        </template>

        <template #body-cell-action="props">
          <q-td :props="props">
            <q-btn dense unelevated color="primary" icon="fact_check" label="审核" @click="openAuditDialog(props.row)" />
          </q-td>
        </template>

        <template #no-data>
          <div class="full-width row flex-center q-gutter-sm q-pa-xl text-grey-7">
            <q-icon size="30px" name="task_alt" />
            <span>暂无待人工审核的取消申请。</span>
          </div>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="auditDialogOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section>
          <div class="text-h6">审核取消申请</div>
          <div class="text-caption text-grey-7 q-mt-sm">取消编号：{{ selectedAudit?.cancel_id }}</div>
          <div class="text-caption text-grey-7">订单号：{{ selectedAudit?.ota_order_id }}</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model.trim="auditReason" type="textarea" autogrow outlined label="审核说明" hint="拒绝取消时必须填写原因" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="关闭" :disable="auditSubmitting" v-close-popup />
          <q-btn flat color="negative" label="拒绝取消" :loading="auditSubmitting" @click="submitAudit(2)" />
          <q-btn unelevated color="primary" label="同意取消" :loading="auditSubmitting" @click="submitAudit(1)" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { douyinPresaleOrderApi } from 'src/api'

const $q = useQuasar()
const orders = ref([])
const loading = ref(false)
const audits = ref([])
const auditLoading = ref(false)
const auditDialogOpen = ref(false)
const auditSubmitting = ref(false)
const selectedAudit = ref(null)
const auditReason = ref('')

const columns = [
  { name: 'order', label: '订单号', field: 'ota_order_id', align: 'left', sortable: true },
  { name: 'voucher', label: '预售券', field: 'voucher_name', align: 'left' },
  { name: 'amount', label: '订单金额', field: 'total_amount', align: 'right', sortable: true },
  { name: 'stage', label: '订单状态', field: 'order_stage', align: 'center' },
  { name: 'created_at', label: '创建时间', field: 'created_at', align: 'left', sortable: true }
]

const auditColumns = [
  { name: 'cancel_id', label: '取消编号', field: 'cancel_id', align: 'left' },
  { name: 'order', label: '订单号', field: 'ota_order_id', align: 'left' },
  { name: 'biz_type', label: '业务类型', field: 'biz_type', align: 'center', format: value => Number(value) === 2012 ? '预约单' : '预售券' },
  { name: 'sale', label: '售后方式', field: 'after_sale_type', align: 'left' },
  { name: 'created_at', label: '申请时间', field: 'created_at', align: 'left' },
  { name: 'action', label: '操作', field: 'cancel_id', align: 'right' }
]

/** 汇总页面顶部的订单数量，帮助运营快速判断待处理量。 */
const summaryCards = computed(() => [
  { label: '订单总数', value: orders.value.length, icon: 'receipt_long', color: 'primary' },
  { label: '已创单', value: orders.value.filter(order => order.order_stage === 'CREATED').length, icon: 'add_task', color: 'orange-7' },
  { label: '已收到支付通知', value: orders.value.filter(order => order.order_stage === 'PAID').length, icon: 'verified', color: 'positive' }
])

/** 将抖音分单位金额转换为运营可读的货币文本。 */
function formatAmount(amount, currency = 'CNY') {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '-'
  const text = (value / 100).toFixed(2)
  return currency === 'CNY' ? `¥${text}` : `${currency} ${text}`
}

/** 返回预售券主订单的后台展示状态。 */
function stageMeta(stage) {
  if (stage === 'PAID') return { label: '已支付', color: 'positive', icon: 'verified' }
  return { label: '已创单', color: 'orange-7', icon: 'add_task' }
}

/** 将抖音售后方式转换为员工可读文本。 */
function afterSaleLabel(type) {
  const labels = { 1: '取消预约并退款', 2: '仅取消预约', 3: '仅退款不取消订单' }
  return labels[type] || '-'
}

/** 加载抖音创单 SPI 已落库的预售券主订单。 */
async function loadOrders() {
  loading.value = true
  try {
    const response = await douyinPresaleOrderApi.getOrders()
    orders.value = response.data || []
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '获取抖音预售订单失败' })
  } finally {
    loading.value = false
  }
}

/** 加载人工审核队列，避免主订单列表混入待审核申请。 */
async function loadAudits() {
  auditLoading.value = true
  try {
    const response = await douyinPresaleOrderApi.getCancelAudits()
    audits.value = response.data || []
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '获取取消审核列表失败' })
  } finally {
    auditLoading.value = false
  }
}

/** 同步刷新预售订单和待人工审核取消申请。 */
async function loadData() {
  await Promise.all([loadOrders(), loadAudits()])
}

/** 打开选中取消申请的人工审核窗口。 */
function openAuditDialog(audit) {
  selectedAudit.value = audit
  auditReason.value = ''
  auditDialogOpen.value = true
}

/** 将员工审核结论交由后端验证并回传抖音。 */
async function submitAudit(cancelResult) {
  if (!selectedAudit.value) return
  if (cancelResult === 2 && !auditReason.value) {
    $q.notify({ type: 'warning', message: '拒绝取消时请填写原因' })
    return
  }
  auditSubmitting.value = true
  try {
    await douyinPresaleOrderApi.decideCancelAudit(selectedAudit.value.cancel_id, {
      cancelResult,
      reason: auditReason.value
    })
    $q.notify({ type: 'positive', message: '审核结果已回传抖音' })
    auditDialogOpen.value = false
    await loadData()
  } catch (error) {
    $q.notify({ type: 'negative', message: error?.response?.data?.message || '审核结果回传失败，请稍后重试' })
  } finally {
    auditSubmitting.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.presale-order-page { max-width: 1600px; margin: 0 auto; }
.page-hero { padding: 24px; border: 1px solid #e4e9f2; border-radius: 16px; background: linear-gradient(120deg, #f7faff 0%, #f3f7ff 100%); }
.summary-card, .table-card { border-color: #e4e9f2; border-radius: 14px; }
</style>
