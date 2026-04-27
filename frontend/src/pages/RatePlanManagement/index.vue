<template>
  <q-page class="rate-plan-page">
    <section class="rate-plan-hero">
      <div>
        <div class="eyebrow">Rate Plan Control</div>
        <h1>售卖套餐</h1>
        <p>维护房型下可售卖的本地套餐，并查看渠道同步状态。</p>
      </div>

      <div class="stats-grid" aria-label="售卖套餐概览">
        <div class="metric-card">
          <span>套餐总数</span>
          <strong>{{ stats.total }}</strong>
        </div>
        <div class="metric-card">
          <span>启用中</span>
          <strong>{{ stats.active }}</strong>
        </div>
        <div class="metric-card">
          <span>钟点房</span>
          <strong>{{ stats.hourly }}</strong>
        </div>
        <div class="metric-card">
          <span>已同步</span>
          <strong>{{ stats.synced }}</strong>
        </div>
      </div>
    </section>

    <section class="rate-plan-toolbar">
      <q-select
        v-model="filters.roomTypeCode"
        :options="roomTypeFilterOptions"
        label="房型"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field"
      />
      <q-input
        v-model.trim="filters.keyword"
        label="搜索套餐"
        outlined
        dense
        clearable
        class="toolbar-field keyword-field"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-select
        v-model="filters.status"
        :options="statusFilterOptions"
        label="状态"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field compact-field"
      />
      <q-select
        v-model="filters.salesType"
        :options="salesTypeFilterOptions"
        label="售卖类型"
        emit-value
        map-options
        outlined
        dense
        clearable
        class="toolbar-field compact-field"
      />

      <q-space />

      <q-btn
        flat
        round
        color="primary"
        icon="refresh"
        :loading="loading"
        aria-label="刷新售卖套餐"
        class="toolbar-icon-btn"
        @click="refreshAll"
      >
        <q-tooltip>刷新数据</q-tooltip>
      </q-btn>
      <q-btn
        color="primary"
        icon="add"
        label="新增套餐"
        unelevated
        class="primary-action"
        @click="openDialog()"
      />
    </section>

    <q-table
      :rows="filteredRatePlans"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="{ rowsPerPage: 10 }"
      flat
      bordered
      class="rate-plan-table"
    >
      <template #body-cell-name="props">
        <q-td :props="props">
          <div class="plan-title">{{ props.row.name }}</div>
          <div class="plan-id">ID {{ props.row.id }}</div>
        </q-td>
      </template>

      <template #body-cell-room_type="props">
        <q-td :props="props">
          <q-badge outline color="teal-8" class="q-px-sm q-py-xs">
            {{ props.row.room_type_name || props.row.room_type_code }}
          </q-badge>
          <div class="code-text">{{ props.row.room_type_code }}</div>
        </q-td>
      </template>

      <template #body-cell-base_price="props">
        <q-td :props="props" class="text-right">
          <span class="price-text">¥{{ formatPrice(props.row.base_price) }}</span>
          <div class="code-text">{{ props.row.currency }}</div>
        </q-td>
      </template>

      <template #body-cell-sales_type="props">
        <q-td :props="props">
          <q-chip
            square
            dense
            :icon="getSalesTypeMeta(props.row.sales_type).icon"
            :color="getSalesTypeMeta(props.row.sales_type).color"
            text-color="white"
            class="status-chip"
          >
            {{ getSalesTypeMeta(props.row.sales_type).label }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-chip
            square
            dense
            :icon="props.row.status === 1 ? 'check_circle' : 'pause_circle'"
            :color="props.row.status === 1 ? 'positive' : 'grey-7'"
            text-color="white"
            class="status-chip"
          >
            {{ props.row.status === 1 ? '启用' : '停用' }}
          </q-chip>
        </q-td>
      </template>

      <template #body-cell-channel="props">
        <q-td :props="props">
          <div v-if="props.row.is_synced" class="channel-state">
            <q-icon name="cloud_done" color="positive" size="18px" />
            <span>{{ props.row.douyin_rate_plan_id }}</span>
          </div>
          <div v-else class="channel-state muted">
            <q-icon name="cloud_off" color="grey-6" size="18px" />
            <span>未同步</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-rules="props">
        <q-td :props="props">
          <div class="rule-summary">
            <span v-if="props.row.sales_type === 2">
              {{ props.row.hourly_earliest_check_in || '--:--' }}
              -
              {{ props.row.hourly_latest_check_out || '--:--' }}
              · {{ props.row.hourly_usage_duration || '-' }}小时
            </span>
            <span v-else-if="props.row.sales_type === 3">
              {{ props.row.midnight_enabled ? '凌晨房已启用' : '凌晨房未启用' }}
              <template v-if="props.row.midnight_latest_booking_time">
                · {{ props.row.midnight_latest_booking_time }}点前
              </template>
            </span>
            <span v-else>全日售卖</span>
          </div>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props">
          <div class="row no-wrap justify-center q-gutter-xs">
            <q-btn
              flat
              round
              color="primary"
              icon="edit"
              aria-label="编辑售卖套餐"
              class="table-action-btn"
              @click="openDialog(props.row)"
            >
              <q-tooltip>编辑套餐</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              :color="props.row.is_synced ? 'positive' : 'teal-8'"
              icon="cloud_sync"
              aria-label="同步到抖音"
              class="table-action-btn"
              :loading="isSyncingPlan(props.row.id)"
              :disable="props.row.sales_type === 3 || isSyncingPlan(props.row.id)"
              @click="confirmSyncDouyin(props.row)"
            >
              <q-tooltip>
                {{ getSyncTooltip(props.row) }}
              </q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              color="deep-orange-7"
              icon="published_with_changes"
              aria-label="通知抖音拉取价量态"
              class="table-action-btn"
              :loading="isNotifyingPlan(props.row.id)"
              :disable="!props.row.is_synced || isNotifyingPlan(props.row.id)"
              @click="openAriNotifyDialog(props.row)"
            >
              <q-tooltip>
                {{ props.row.is_synced ? '通知抖音拉取价量态' : '套餐同步到抖音后才能通知拉取' }}
              </q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              color="negative"
              icon="delete_outline"
              aria-label="删除售卖套餐"
              class="table-action-btn"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>{{ props.row.is_synced ? '已同步套餐由后端限制删除' : '删除套餐' }}</q-tooltip>
            </q-btn>
          </div>
        </q-td>
      </template>

      <template #no-data>
        <div class="empty-state">
          <q-icon name="inventory_2" size="42px" color="grey-5" />
          <div>暂无售卖套餐</div>
          <q-btn flat color="primary" icon="add" label="新增套餐" @click="openDialog()" />
        </div>
      </template>
    </q-table>

    <q-dialog v-model="dialogOpen" persistent>
      <q-card class="rate-plan-dialog">
        <q-card-section class="dialog-heading">
          <div>
            <div class="text-h6">{{ editingPlan ? '编辑售卖套餐' : '新增售卖套餐' }}</div>
            <div class="text-caption text-grey-7">本地套餐信息将保存到后端 API。</div>
          </div>
          <q-btn
            flat
            round
            icon="close"
            aria-label="关闭弹窗"
            @click="dialogOpen = false"
          />
        </q-card-section>

        <q-separator />

        <q-form ref="formRef" @submit="submitForm">
          <q-card-section class="dialog-body">
            <div class="form-section-title">基础信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-select
                  v-model="form.room_type_code"
                  :options="roomTypeFormOptions"
                  label="房型"
                  emit-value
                  map-options
                  outlined
                  :rules="[requiredRule('请选择房型')]"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model.trim="form.name"
                  label="套餐名称"
                  outlined
                  :rules="[requiredRule('请输入套餐名称')]"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.number="form.base_price"
                  label="基础价"
                  type="number"
                  prefix="¥"
                  outlined
                  :rules="[requiredRule('请输入基础价'), nonNegativeRule]"
                />
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="form.sales_type"
                  :options="salesTypeOptions"
                  label="售卖类型"
                  emit-value
                  map-options
                  outlined
                />
              </div>
              <div class="col-12 col-md-4">
                <q-select
                  v-model="form.status"
                  :options="statusOptions"
                  label="状态"
                  emit-value
                  map-options
                  outlined
                />
              </div>
              <div class="col-12 col-md-4">
                <q-input
                  v-model.trim="form.currency"
                  label="币种"
                  outlined
                  maxlength="3"
                  :rules="[currencyRule]"
                />
              </div>
            </div>

            <div v-if="form.sales_type === 2" class="conditional-panel">
              <div class="form-section-title">钟点房字段</div>
              <div class="row q-col-gutter-md">
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.trim="form.hourly_earliest_check_in"
                    label="最早入住"
                    outlined
                    mask="time"
                    placeholder="10:00"
                    :rules="[optionalTimeRule]"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.trim="form.hourly_latest_check_out"
                    label="最晚离店"
                    outlined
                    mask="time"
                    placeholder="18:00"
                    :rules="[optionalTimeRule]"
                  />
                </div>
                <div class="col-12 col-md-4">
                  <q-input
                    v-model.number="form.hourly_usage_duration"
                    label="使用时长"
                    type="number"
                    suffix="小时"
                    outlined
                    :rules="[optionalRangeRule(1, 23, '使用时长为 1-23 小时')]"
                  />
                </div>
              </div>
            </div>

            <div v-if="form.sales_type === 3" class="conditional-panel">
              <div class="form-section-title">凌晨房字段</div>
              <div class="row q-col-gutter-md items-center">
                <div class="col-12 col-md-5">
                  <q-toggle
                    v-model="form.midnight_enabled"
                    color="primary"
                    label="启用凌晨房规则"
                  />
                </div>
                <div class="col-12 col-md-7">
                  <q-input
                    v-model.number="form.midnight_latest_booking_time"
                    label="最晚预定时间"
                    type="number"
                    suffix="点"
                    outlined
                    :rules="[optionalRangeRule(1, 6, '最晚预定时间为 1-6 点')]"
                  />
                </div>
              </div>
            </div>

            <div class="form-section-title">渠道扩展</div>
            <q-input
              v-model="form.douyin_config_text"
              label="抖音扩展配置 JSON"
              type="textarea"
              outlined
              autogrow
              :rules="[jsonObjectRule]"
            />
          </q-card-section>

          <q-card-actions align="right" class="dialog-actions">
            <q-btn flat label="取消" color="grey-8" @click="dialogOpen = false" />
            <q-btn
              type="submit"
              color="primary"
              label="保存"
              icon="save"
              unelevated
              :loading="saving"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>

    <q-dialog v-model="ariNotifyDialogOpen" persistent>
      <q-card class="ari-notify-dialog">
        <q-card-section class="dialog-heading">
          <div>
            <div class="text-h6">通知抖音拉取价量态</div>
            <div class="text-caption text-grey-7">
              当前套餐：{{ ariNotifyPlan?.name || '--' }}
            </div>
          </div>
          <q-btn
            flat
            round
            icon="close"
            aria-label="关闭价量态通知弹窗"
            @click="ariNotifyDialogOpen = false"
          />
        </q-card-section>

        <q-separator />

        <q-form ref="ariNotifyFormRef" @submit="submitAriNotify">
          <q-card-section class="dialog-body">
            <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-input
                  v-model="ariNotifyForm.startDate"
                  label="开始日期"
                  type="date"
                  outlined
                  :rules="[requiredRule('请选择开始日期')]"
                />
              </div>
              <div class="col-12 col-md-6">
                <q-input
                  v-model="ariNotifyForm.endDate"
                  label="结束日期"
                  type="date"
                  outlined
                  :rules="[requiredRule('请选择结束日期'), endDateRule]"
                />
              </div>
              <div class="col-12">
                <q-input
                  v-model.trim="ariNotifyForm.accountId"
                  label="抖音 account_id（可选）"
                  outlined
                  hint="不填时使用后端配置的 DOUYIN_ACCOUNT_ID"
                />
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right" class="dialog-actions">
            <q-btn flat label="取消" color="grey-8" @click="ariNotifyDialogOpen = false" />
            <q-btn
              type="submit"
              color="primary"
              label="立即通知"
              icon="send"
              unelevated
              :loading="ariNotifySubmitting"
            />
          </q-card-actions>
        </q-form>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onActivated, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'
import { ratePlanApi, roomApi } from 'src/api'

const $q = useQuasar()

const salesTypeOptions = [
  { label: '全日房', value: 1, icon: 'hotel', color: 'teal-8' },
  { label: '钟点房', value: 2, icon: 'schedule', color: 'deep-orange-7' },
  { label: '凌晨房', value: 3, icon: 'nightlight', color: 'indigo-7' }
]

const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 0 }
]

const columns = [
  { name: 'name', label: '套餐', field: 'name', align: 'left', sortable: true },
  { name: 'room_type', label: '房型', field: 'room_type_code', align: 'left', sortable: true },
  { name: 'base_price', label: '基础价', field: 'base_price', align: 'right', sortable: true },
  { name: 'sales_type', label: '售卖类型', field: 'sales_type', align: 'center', sortable: true },
  { name: 'status', label: '状态', field: 'status', align: 'center', sortable: true },
  { name: 'rules', label: '规则摘要', field: 'sales_type', align: 'left' },
  { name: 'channel', label: '抖音同步', field: 'is_synced', align: 'left', sortable: true },
  { name: 'updated_at', label: '更新时间', field: 'updated_at', align: 'left', sortable: true },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

const formRef = ref(null)
const ariNotifyFormRef = ref(null)
const ratePlans = ref([])
const roomTypes = ref([])
const loading = ref(false)
const saving = ref(false)
const syncingPlanIds = ref([])
const notifyingPlanIds = ref([])
const dialogOpen = ref(false)
const editingPlan = ref(null)
const ariNotifyDialogOpen = ref(false)
const ariNotifySubmitting = ref(false)
const ariNotifyPlan = ref(null)

const filters = ref({
  roomTypeCode: '',
  keyword: '',
  status: null,
  salesType: null
})

const form = ref(createDefaultForm())
const ariNotifyForm = ref(createDefaultAriNotifyForm())

const roomTypeFilterOptions = computed(() => {
  return roomTypes.value.map(roomType => ({
    label: `${roomType.type_name} (${roomType.type_code})`,
    value: roomType.type_code
  }))
})

const roomTypeFormOptions = computed(() => roomTypeFilterOptions.value)

const statusFilterOptions = computed(() => statusOptions)
const salesTypeFilterOptions = computed(() => salesTypeOptions)

const filteredRatePlans = computed(() => {
  const keyword = filters.value.keyword.toLowerCase()

  return ratePlans.value.filter(plan => {
    const matchesRoomType = !filters.value.roomTypeCode || plan.room_type_code === filters.value.roomTypeCode
    const matchesStatus = filters.value.status === null || filters.value.status === undefined || plan.status === filters.value.status
    const matchesSalesType = filters.value.salesType === null || filters.value.salesType === undefined || plan.sales_type === filters.value.salesType
    const matchesKeyword = !keyword || [plan.name, plan.room_type_name, plan.room_type_code, plan.douyin_rate_plan_id]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(keyword))

    return matchesRoomType && matchesStatus && matchesSalesType && matchesKeyword
  })
})

const stats = computed(() => {
  return {
    total: ratePlans.value.length,
    active: ratePlans.value.filter(plan => plan.status === 1).length,
    hourly: ratePlans.value.filter(plan => plan.sales_type === 2).length,
    synced: ratePlans.value.filter(plan => plan.is_synced).length
  }
})

function createDefaultForm() {
  return {
    room_type_code: '',
    name: '',
    base_price: 0,
    status: 1,
    sales_type: 1,
    currency: 'CNY',
    hourly_earliest_check_in: '',
    hourly_latest_check_out: '',
    hourly_usage_duration: null,
    midnight_latest_booking_time: null,
    midnight_enabled: false,
    douyin_config_text: '{}'
  }
}

function createDefaultAriNotifyForm() {
  return {
    startDate: '',
    endDate: '',
    accountId: ''
  }
}

function getSalesTypeMeta(value) {
  return salesTypeOptions.find(option => option.value === value) || salesTypeOptions[0]
}

function formatPrice(value) {
  const amount = Number(value || 0)
  return amount.toFixed(2)
}

function requiredRule(message) {
  return value => (value !== null && value !== undefined && value !== '') || message
}

function nonNegativeRule(value) {
  return Number(value) >= 0 || '基础价不能小于 0'
}

function currencyRule(value) {
  return /^[A-Z]{3}$/.test(String(value || '')) || '请输入三位大写币种'
}

function optionalTimeRule(value) {
  if (!value) return true
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(value)) || '时间格式为 HH:mm'
}

function optionalRangeRule(min, max, message) {
  return value => {
    if (value === null || value === undefined || value === '') return true
    const numberValue = Number(value)
    return Number.isInteger(numberValue) && numberValue >= min && numberValue <= max || message
  }
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDefaultAriDateRange() {
  const startDate = new Date()
  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 1)

  return {
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate)
  }
}

function endDateRule(value) {
  if (!value || !ariNotifyForm.value.startDate) return true
  return value >= ariNotifyForm.value.startDate || '结束日期不能早于开始日期'
}

function parseJsonObject(text) {
  if (!String(text || '').trim()) return {}
  const parsed = JSON.parse(text)
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('JSON 必须是对象')
  }
  return parsed
}

function jsonObjectRule(value) {
  try {
    parseJsonObject(value)
    return true
  } catch (error) {
    return error.message || 'JSON 格式错误'
  }
}

function appendIfPresent(payload, key, value) {
  if (value !== null && value !== undefined && value !== '') {
    payload[key] = value
  }
}

function appendNumberIfPresent(payload, key, value) {
  if (value !== null && value !== undefined && value !== '') {
    payload[key] = Number(value)
  }
}

function buildPayload() {
  const payload = {
    room_type_code: form.value.room_type_code,
    name: form.value.name,
    base_price: Number(form.value.base_price),
    status: Number(form.value.status),
    sales_type: Number(form.value.sales_type),
    currency: String(form.value.currency || 'CNY').trim().toUpperCase(),
    midnight_enabled: Boolean(form.value.midnight_enabled),
    douyin_config: parseJsonObject(form.value.douyin_config_text)
  }

  if (payload.sales_type === 2) {
    appendIfPresent(payload, 'hourly_earliest_check_in', form.value.hourly_earliest_check_in)
    appendIfPresent(payload, 'hourly_latest_check_out', form.value.hourly_latest_check_out)
    appendNumberIfPresent(payload, 'hourly_usage_duration', form.value.hourly_usage_duration)
  }

  if (payload.sales_type === 3) {
    appendNumberIfPresent(payload, 'midnight_latest_booking_time', form.value.midnight_latest_booking_time)
  }

  return payload
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function isSyncingPlan(id) {
  return syncingPlanIds.value.includes(Number(id))
}

function isNotifyingPlan(id) {
  return notifyingPlanIds.value.includes(Number(id))
}

function setSyncingPlan(id, syncing) {
  const normalizedId = Number(id)
  syncingPlanIds.value = syncing
    ? Array.from(new Set([...syncingPlanIds.value, normalizedId]))
    : syncingPlanIds.value.filter(planId => planId !== normalizedId)
}

function setNotifyingPlan(id, notifying) {
  const normalizedId = Number(id)
  notifyingPlanIds.value = notifying
    ? Array.from(new Set([...notifyingPlanIds.value, normalizedId]))
    : notifyingPlanIds.value.filter(planId => planId !== normalizedId)
}

function getSyncTooltip(plan) {
  if (plan.sales_type === 3) return '凌晨房暂不支持同步抖音'
  return plan.is_synced ? '更新抖音预定商品' : '同步到抖音'
}

async function fetchRatePlans() {
  const response = await ratePlanApi.getRatePlans()
  ratePlans.value = response.data || []
}

async function fetchRoomTypes() {
  const response = await roomApi.getRoomTypes()
  roomTypes.value = response.data || []
}

async function refreshAll() {
  loading.value = true
  try {
    await Promise.all([fetchRatePlans(), fetchRoomTypes()])
  } catch (error) {
    console.error('获取售卖套餐数据失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '获取售卖套餐数据失败') })
  } finally {
    loading.value = false
  }
}

function openDialog(plan = null) {
  editingPlan.value = plan
  form.value = plan
    ? {
        room_type_code: plan.room_type_code || '',
        name: plan.name || '',
        base_price: Number(plan.base_price || 0),
        status: Number(plan.status ?? 1),
        sales_type: Number(plan.sales_type ?? 1),
        currency: plan.currency || 'CNY',
        hourly_earliest_check_in: plan.hourly_earliest_check_in || '',
        hourly_latest_check_out: plan.hourly_latest_check_out || '',
        hourly_usage_duration: plan.hourly_usage_duration ?? null,
        midnight_latest_booking_time: plan.midnight_latest_booking_time ?? null,
        midnight_enabled: Boolean(plan.midnight_enabled),
        douyin_config_text: JSON.stringify(plan.douyin_config || {}, null, 2)
      }
    : createDefaultForm()

  dialogOpen.value = true
}

function openAriNotifyDialog(plan) {
  if (!plan?.is_synced || isNotifyingPlan(plan.id)) return

  ariNotifyPlan.value = plan
  ariNotifyForm.value = {
    ...createDefaultAriNotifyForm(),
    ...getDefaultAriDateRange()
  }
  ariNotifyDialogOpen.value = true
}

async function submitForm() {
  saving.value = true
  try {
    const valid = await formRef.value.validate()
    if (!valid) return

    const payload = buildPayload()
    if (editingPlan.value) {
      await ratePlanApi.updateRatePlan(editingPlan.value.id, payload)
      $q.notify({ type: 'positive', message: '售卖套餐已更新', icon: 'check_circle' })
    } else {
      await ratePlanApi.createRatePlan(payload)
      $q.notify({ type: 'positive', message: '售卖套餐已创建', icon: 'check_circle' })
    }

    dialogOpen.value = false
    await refreshAll()
  } catch (error) {
    console.error('保存售卖套餐失败:', error)
    $q.notify({ type: 'negative', message: getErrorMessage(error, '保存售卖套餐失败') })
  } finally {
    saving.value = false
  }
}

function confirmDelete(plan) {
  $q.dialog({
    title: '删除售卖套餐',
    message: `确认删除「${plan.name}」？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: '删除', color: 'negative', icon: 'delete_outline' },
    persistent: true
  }).onOk(async () => {
    try {
      await ratePlanApi.deleteRatePlan(plan.id)
      $q.notify({ type: 'positive', message: '售卖套餐已删除', icon: 'check_circle' })
      await refreshAll()
    } catch (error) {
      console.error('删除售卖套餐失败:', error)
      $q.notify({ type: 'negative', message: getErrorMessage(error, '删除售卖套餐失败') })
    }
  })
}

function confirmSyncDouyin(plan) {
  if (plan.sales_type === 3 || isSyncingPlan(plan.id)) return

  $q.dialog({
    title: plan.is_synced ? '更新抖音商品' : '同步抖音商品',
    message: `确认将「${plan.name}」同步到抖音预定商品？`,
    cancel: { label: '取消', flat: true, color: 'grey-7' },
    ok: { label: plan.is_synced ? '更新' : '同步', color: 'primary', icon: 'cloud_sync' },
    persistent: true
  }).onOk(async () => {
    setSyncingPlan(plan.id, true)
    try {
      const response = await ratePlanApi.syncDouyinRatePlan(plan.id)
      const douyinId = response?.data?.douyin?.douyinId || response?.data?.rate_plan?.douyin_rate_plan_id
      $q.notify({
        type: 'positive',
        message: getSyncSuccessMessage(douyinId),
        icon: 'cloud_done'
      })
      await refreshAll()
    } catch (error) {
      console.error('同步抖音商品失败:', error)
      $q.notify({ type: 'negative', message: getSyncErrorMessage(error) })
    } finally {
      setSyncingPlan(plan.id, false)
    }
  })
}

function getSyncSuccessMessage(douyinId) {
  return douyinId ? `抖音同步成功：${douyinId}` : '抖音同步成功'
}

function getSyncErrorMessage(error) {
  return getErrorMessage(error, '同步抖音商品失败')
}

async function submitAriNotify() {
  if (!ariNotifyPlan.value) return

  ariNotifySubmitting.value = true
  setNotifyingPlan(ariNotifyPlan.value.id, true)

  try {
    const valid = await ariNotifyFormRef.value.validate()
    if (!valid) return

    const payload = {
      localRatePlanIds: [ariNotifyPlan.value.id],
      startDate: ariNotifyForm.value.startDate,
      endDate: ariNotifyForm.value.endDate
    }

    if (ariNotifyForm.value.accountId) {
      payload.accountId = ariNotifyForm.value.accountId
    }

    const response = await ratePlanApi.notifyDouyinAri(payload)
    const douyinLogId = response?.data?.data?.douyinLogId

    $q.notify({
      type: 'positive',
      icon: 'task_alt',
      message: douyinLogId ? `已通知抖音拉取价量态，logid：${douyinLogId}` : '已通知抖音拉取价量态'
    })
    ariNotifyDialogOpen.value = false
  } catch (error) {
    console.error('通知抖音拉取价量态失败:', error)
    const douyinLogId = error?.response?.data?.douyin_log_id
    $q.notify({
      type: 'negative',
      message: douyinLogId
        ? `${getErrorMessage(error, '通知抖音拉取价量态失败')}，logid：${douyinLogId}`
        : getErrorMessage(error, '通知抖音拉取价量态失败')
    })
  } finally {
    ariNotifySubmitting.value = false
    if (ariNotifyPlan.value) {
      setNotifyingPlan(ariNotifyPlan.value.id, false)
    }
  }
}

onMounted(refreshAll)
onActivated(refreshAll)
</script>

<style scoped>
.rate-plan-page {
  --surface: #ffffff;
  --surface-muted: #f4f7f6;
  --ink: #17221f;
  --ink-soft: #5e6b67;
  --line: rgba(23, 34, 31, 0.11);
  --accent: #0f766e;
  --accent-dark: #115e59;
  --amber: #b7791f;

  min-height: 100vh;
  padding: 24px;
  background:
    linear-gradient(180deg, rgba(244, 247, 246, 0.96), rgba(249, 250, 248, 1)),
    repeating-linear-gradient(90deg, rgba(15, 118, 110, 0.04) 0 1px, transparent 1px 84px);
  color: var(--ink);
}

.rate-plan-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
  gap: 24px;
  align-items: end;
  max-width: 1600px;
  margin: 0 auto 18px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 36px rgba(23, 34, 31, 0.08);
}

.eyebrow {
  color: var(--accent-dark);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.rate-plan-hero h1 {
  margin: 8px 0 6px;
  font-size: 36px;
  font-weight: 760;
  line-height: 1.12;
}

.rate-plan-hero p {
  max-width: 680px;
  margin: 0;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  min-height: 88px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.metric-card span {
  display: block;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.4;
}

.metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.rate-plan-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  max-width: 1600px;
  margin: 0 auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: var(--surface);
}

.toolbar-field {
  width: 220px;
}

.keyword-field {
  width: 300px;
}

.compact-field {
  width: 160px;
}

.toolbar-icon-btn,
.table-action-btn {
  min-width: 44px;
  min-height: 44px;
}

.primary-action {
  min-height: 44px;
  border-radius: 8px;
  background: var(--accent);
}

.rate-plan-table {
  max-width: 1600px;
  margin: 0 auto;
  border-color: var(--line);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  box-shadow: 0 18px 42px rgba(23, 34, 31, 0.08);
}

.rate-plan-table :deep(.q-table__top),
.rate-plan-table :deep(thead tr) {
  background: #f7faf8;
}

.rate-plan-table :deep(.q-table th) {
  color: #44524e;
  font-size: 12px;
  font-weight: 700;
}

.rate-plan-table :deep(.q-table tbody td) {
  height: 68px;
}

.rate-plan-table :deep(.q-table tbody tr:hover) {
  background: #f1f8f6;
}

.plan-title {
  color: var(--ink);
  font-weight: 700;
}

.plan-id,
.code-text,
.rule-summary,
.channel-state {
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.price-text {
  color: var(--amber);
  font-size: 15px;
  font-weight: 760;
  font-variant-numeric: tabular-nums;
}

.status-chip {
  min-width: 76px;
  justify-content: center;
}

.channel-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.channel-state.muted {
  color: var(--ink-soft);
}

.empty-state {
  display: flex;
  width: 100%;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-soft);
}

.rate-plan-dialog {
  width: min(920px, calc(100vw - 32px));
  max-width: 920px;
  border-radius: 8px;
}

.ari-notify-dialog {
  width: min(560px, calc(100vw - 32px));
  border-radius: 8px;
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #f7faf8;
}

.dialog-body {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.form-section-title {
  color: var(--accent-dark);
  font-size: 13px;
  font-weight: 700;
}

.conditional-panel {
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-muted);
}

.dialog-actions {
  padding: 16px 22px 22px;
  background: #fbfcfb;
}

@media (max-width: 1024px) {
  .rate-plan-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .rate-plan-page {
    padding: 12px;
  }

  .rate-plan-hero {
    padding: 18px;
  }

  .rate-plan-hero h1 {
    font-size: 28px;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-field,
  .keyword-field,
  .compact-field {
    width: 100%;
  }

  .rate-plan-toolbar .q-space {
    display: none;
  }

  .primary-action {
    width: 100%;
  }
}
</style>
