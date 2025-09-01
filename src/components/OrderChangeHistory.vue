<template>
  <q-dialog
    v-model="localDialog"
    persistent
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card>
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">订单变更历史</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
          @click="$emit('update:modelValue', false)"
        />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-banner v-if="!orderId" class="bg-warning text-white">
          请提供订单ID以查看变更历史
        </q-banner>
        <div v-else>
          <div class="text-subtitle1 q-mb-sm">
            订单号: {{ orderId }}
            <q-badge
              v-if="orderInfo"
              color="primary"
              class="q-ml-sm"
            >
              {{ orderInfo.guestName }} - {{ orderInfo.roomNumber }}
            </q-badge>
          </div>

          <div class="q-mt-md" v-if="loading">
            <q-skeleton type="text" class="text-subtitle1 q-mb-sm" />
            <!-- Quasar 不支持 type="card"，改为 rect 并设置高度模拟卡片占位 -->
            <q-skeleton v-for="i in 5" :key="i" type="rect" class="q-mb-sm" style="height: 90px; border-radius: 6px;" />
          </div>

          <div class="q-mt-md" v-else-if="history.length === 0">
            <q-banner class="bg-grey-2">
              <template v-slot:avatar>
                <q-icon name="info" color="primary" />
              </template>
              此订单暂无变更历史记录
            </q-banner>
          </div>

          <div v-else>
            <q-timeline color="secondary">
              <q-timeline-entry
                v-for="(item, index) in history"
                :key="index"
                :title="item.change_type"
                :subtitle="`${formatDate(item.change_time)} - ${item.operator || '未知操作员'}`"
              >
                <div>
                  <q-badge
                    color="info"
                    class="q-mr-sm"
                    v-if="item.change_reason"
                  >
                    变更原因: {{ item.change_reason }}
                  </q-badge>
                </div>

                <q-card flat bordered class="q-mt-sm bg-grey-1">
                  <q-card-section>
                    <div class="row q-col-gutter-md">
                      <div
                        v-for="field in item.changed_fields"
                        :key="field"
                        class="col-md-6 col-xs-12"
                      >
                        <div class="text-subtitle2 text-weight-bold">{{ getFieldName(field) }}</div>
                        <div class="row q-col-gutter-sm">
                          <div class="col-6">
                            <q-card flat bordered class="bg-red-1">
                              <q-card-section class="q-py-xs">
                                <div class="text-caption text-grey">修改前</div>
                                <div>{{ formatValue(item.old_value[field]) }}</div>
                              </q-card-section>
                            </q-card>
                          </div>
                          <div class="col-6">
                            <q-card flat bordered class="bg-green-1">
                              <q-card-section class="q-py-xs">
                                <div class="text-caption text-grey">修改后</div>
                                <div>{{ formatValue(item.new_value[field]) }}</div>
                              </q-card-section>
                            </q-card>
                          </div>
                        </div>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </q-timeline-entry>
            </q-timeline>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right" class="bg-white text-primary">
        <q-btn
          flat
          label="关闭"
          v-close-popup
          @click="$emit('update:modelValue', false)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { date } from 'quasar'
import { orderApi } from 'src/api'

const props = defineProps({
  modelValue: Boolean,
  orderId: {
    type: String,
    default: ''
  },
  orderInfo: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const localDialog = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const history = ref([])
const loading = ref(false)
const error = ref(null)

// 监听对话框打开，加载历史记录
watch(() => props.modelValue, async (newVal) => {
  if (newVal && props.orderId) {
    await fetchHistory()
  }
})

// 监听订单ID变化，重新加载历史记录
watch(() => props.orderId, async (newVal) => {
  if (newVal && localDialog.value) {
    await fetchHistory()
  }
})

// 重试机制配置
const retryCount = ref(0)
const maxRetries = 3
const retryDelay = 1000 // 1秒后重试

// 获取订单变更历史
async function fetchHistory() {
  if (!props.orderId) return

  loading.value = true
  error.value = null

  try {
    const response = await orderApi.getOrderChangeHistory(props.orderId)
    history.value = response.data || []
    // 成功获取数据后重置重试计数
    retryCount.value = 0
  } catch (err) {
    console.error('获取订单变更历史失败:', err)

    // 实现重试机制
    if (retryCount.value < maxRetries) {
      retryCount.value++
      console.log(`将在${retryDelay}毫秒后重试获取历史(${retryCount.value}/${maxRetries})`)

      // 设置延迟重试
      setTimeout(() => {
        fetchHistory()
      }, retryDelay)

      return // 不显示错误，等待重试
    }

    error.value = err.message || '获取订单变更历史失败'
  } finally {
    // 仅在最后一次尝试或成功时更新loading状态
    if (retryCount.value === 0 || retryCount.value >= maxRetries) {
      loading.value = false
    }
  }
}

// 格式化日期时间
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return date.formatDate(new Date(dateStr), 'YYYY-MM-DD HH:mm:ss')
}

// 格式化字段值
function formatValue(value) {
  if (value === null || value === undefined) return '-'

  // 处理日期类型
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return formatDate(value)
  }

  // 处理对象或数组
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return value
}

// 获取字段中文名称
function getFieldName(field) {
  const fieldNameMap = {
    guest_name: '客人姓名',
    phone: '联系电话',
    id_number: '证件号码',
    room_type: '房间类型',
    room_number: '房间号',
    check_in_date: '入住日期',
    check_out_date: '退房日期',
    status: '订单状态',
    payment_method: '支付方式',
    room_price: '房间价格',
    deposit: '押金',
    remarks: '备注',
    order_source: '订单来源',
    id_source: '来源单号',
    should_pay: '应付金额',
    paid_amount: '已付金额',
    discount: '折扣',
    days: '天数',
    is_company: '公司标志',
    company_name: '公司名称',
    room_rate: '房间费率',
    arrival_time: '到达时间',
    stay_type: '住宿类型'
  }

  return fieldNameMap[field] || field
}
</script>

<style scoped>
.q-timeline__entry {
  padding-bottom: 20px;
}
</style>
