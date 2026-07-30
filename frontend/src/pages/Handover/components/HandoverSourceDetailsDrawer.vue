<template>
  <q-dialog v-model="visible" position="right" full-height>
    <q-card class="source-drawer">
      <q-card-section class="row items-center q-pb-sm">
        <div>
          <div class="text-h6">{{ itemLabel }} - {{ paymentMethod }} 来源明细</div>
          <div class="text-caption text-grey-7">{{ modeLabel }}</div>
        </div>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-none">
        <q-inner-loading :showing="loading">
          <q-spinner color="primary" size="36px" />
        </q-inner-loading>
        <q-markup-table v-if="details.length" flat separator="horizontal">
          <thead>
            <tr>
              <th>账单号</th>
              <th>房号</th>
              <th>客人姓名</th>
              <th>业务类型</th>
              <th>金额</th>
              <th>发生时间</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="detail in details" :key="detail.billId || `${detail.createTime}-${detail.changeType}`">
              <td>{{ detail.billId || '-' }}</td>
              <td>{{ detail.roomNumber || '-' }}</td>
              <td>{{ detail.guestName || '-' }}</td>
              <td>{{ detail.changeType || '-' }}</td>
              <td>{{ formatAmount(detail.amount) }}</td>
              <td>{{ formatTime(detail.createTime) }}</td>
              <td>{{ detail.remarks || '-' }}</td>
            </tr>
          </tbody>
        </q-markup-table>
        <div v-else-if="!loading" class="empty-state">暂无来源数据</div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { date as quasarDate, useQuasar } from 'quasar'
import { shiftHandoverApi } from 'src/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  date: { type: String, default: '' },
  item: { type: String, default: '' },
  paymentMethod: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])
const $q = useQuasar()
const loading = ref(false)
const details = ref([])
const sourceMode = ref('live')

const itemLabels = {
  hotelIncome: '客房收入',
  restIncome: '休息房收入',
  carRentIncome: '租车收入',
  hotelRefundDeposit: '客房退押',
  restRefundDeposit: '休息房退押'
}
const modeLabels = {
  live: '实时账单',
  snapshot: '交接快照',
  reference: '历史账单参考'
}
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const itemLabel = computed(() => itemLabels[props.item] || '来源')
const modeLabel = computed(() => modeLabels[sourceMode.value] || modeLabels.live)

/**
 * 抽屉打开时读取来源数据；历史快照与实时参考的选择只能由后端决定。
 */
async function loadDetails() {
  if (!props.date || !props.item || !props.paymentMethod) return
  loading.value = true
  details.value = []
  try {
    const response = await shiftHandoverApi.getSourceDetails({
      date: props.date,
      item: props.item,
      paymentMethod: props.paymentMethod
    })
    sourceMode.value = response.data?.sourceMode || 'live'
    details.value = response.data?.details || []
  } catch (error) {
    console.error('获取交接班来源明细失败:', error)
    $q.notify({ type: 'negative', message: error.message || '获取来源明细失败' })
  } finally {
    loading.value = false
  }
}

/**
 * 统一金额展示，避免来源抽屉和交接表出现不同的小数精度。
 */
function formatAmount(value) {
  return Number(value || 0).toFixed(2)
}

/**
 * 仅作展示格式化，timestamptz 由数据库和驱动负责时区转换。
 */
function formatTime(value) {
  return value ? quasarDate.formatDate(value, 'YYYY-MM-DD HH:mm:ss') : '-'
}

watch(visible, (isVisible) => {
  if (isVisible) loadDetails()
})
</script>

<style scoped>
.source-drawer {
  width: min(900px, 95vw);
  min-height: 100vh;
}

.empty-state {
  padding: 64px 20px;
  color: #757575;
  text-align: center;
}
</style>
