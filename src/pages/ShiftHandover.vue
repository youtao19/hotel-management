# 交接班功能页面设计图

<template>
  <div class="shift-handover q-pa-sm q-mt-none q-pt-none">
    <div class="row q-col-gutter-md">
      <!-- 页面标题 -->
      <div class="col-12">
        <q-card class="bg-primary text-white q-mb-md q-mt-none">
          <q-card-section>
            <div class="text-h4">交接班</div>
            <div class="text-subtitle2">{{ currentDate }}</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 收款明细表区域 -->
      <div class="col-md-8 col-xs-12">
        <q-card>
          <q-card-section class="bg-secondary text-white">
            <div class="text-h6">
              <q-icon name="receipt_long" class="q-mr-xs" />
              收款明细表
            </div>
          </q-card-section>

          <!-- 切换按钮组 -->
          <q-card-section>
            <q-btn-toggle
              v-model="roomType"
              :options="[
                {label: '客房', value: 'hotel'},
                {label: '休息房', value: 'rest'}
              ]"
              class="q-mb-md"
              color="primary"
              @update:model-value="switchRoomType"
            />
          </q-card-section>

          <!-- 明细表格 -->
          <q-card-section>
            <q-table
              :rows="receiptDetails"
              :columns="receiptColumns"
              row-key="id"
              :loading="loading"
              :pagination.sync="pagination"
            >
              <!-- 自定义支付方式列 -->
              <template v-slot:body-cell-paymentMethod="props">
                <q-td :props="props">
                  <q-chip :color="getPaymentMethodColor(props.value)" text-color="white" dense>
                    {{ props.value }}
                  </q-chip>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>

      <!-- 统计区域 -->
      <div class="col-md-4 col-xs-12">
        <q-card>
          <q-card-section class="bg-secondary text-white">
            <div class="text-h6">
              <q-icon name="summarize" class="q-mr-xs" />
              交接班统计
            </div>
          </q-card-section>

          <q-card-section>
            <div class="row q-col-gutter-sm">
              <!-- 统计卡片 -->
              <div class="col-12">
                <q-list bordered separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label>备用金</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold">¥{{ statistics.reserveCash }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>客房收入</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold text-positive">¥{{ statistics.hotelIncome }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>休息房收入</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold text-positive">¥{{ statistics.restIncome }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>租车收入</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold text-positive">¥{{ statistics.carRentalIncome }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label class="text-weight-bold">合计</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-h6 text-positive">¥{{ statistics.totalIncome }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>客房退押</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold text-negative">¥{{ statistics.hotelDeposit }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>休息退押</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold text-negative">¥{{ statistics.restDeposit }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label>留存款</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-weight-bold">¥{{ statistics.retainedAmount }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label class="text-weight-bold">交接款</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-item-label class="text-h6">¥{{ statistics.handoverAmount }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>

              <!-- 特殊统计项 -->
              <div class="col-12 q-mt-md">
                <div class="row q-col-gutter-sm">
                  <div class="col-6">
                    <q-card class="bg-green-1">
                      <q-card-section class="text-center">
                        <div class="text-subtitle2">好评</div>
                        <div class="text-h6">{{ statistics.goodReviews }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-blue-1">
                      <q-card-section class="text-center">
                        <div class="text-subtitle2">大美卡</div>
                        <div class="text-h6">{{ statistics.vipCards }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <!-- 备注区域 -->
      <div class="col-12">
        <q-card>
          <q-card-section class="bg-secondary text-white">
            <div class="text-h6">
              <q-icon name="notes" class="q-mr-xs" />
              备注信息
            </div>
          </q-card-section>

          <q-card-section>
            <q-input
              v-model="remarks"
              type="textarea"
              filled
              autogrow
              label="交接班备注"
            />
          </q-card-section>

          <!-- 操作按钮 -->
          <q-card-actions align="right" class="q-pa-md">
            <q-btn color="primary" icon="save" label="保存交接班" @click="saveHandover" />
            <q-btn color="secondary" icon="print" label="打印交接单" class="q-ml-sm" @click="printHandover" />
            <q-btn color="accent" icon="file_download" label="导出Excel" class="q-ml-sm" @click="exportToExcel" />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'

const $q = useQuasar()

// 当前日期
const currentDate = computed(() => {
  return date.formatDate(new Date(), 'YYYY年MM月DD日 dddd')
})

// 房间类型切换
const roomType = ref('hotel')

// 加载状态
const loading = ref(false)

// 分页设置
const pagination = ref({
  rowsPerPage: 10
})

// 明细表格列定义
const receiptColumns = [
  { name: 'roomNumber', label: '房号', field: 'roomNumber', align: 'left' },
  { name: 'orderNumber', label: '单号', field: 'orderNumber', align: 'left' },
  { name: 'roomFee', label: '房费', field: 'roomFee', align: 'right' },
  { name: 'deposit', label: '押金', field: 'deposit', align: 'right' },
  { name: 'paymentMethod', label: '支付方式', field: 'paymentMethod', align: 'center' },
  { name: 'totalAmount', label: '收款总额', field: 'totalAmount', align: 'right' },
  { name: 'checkInTime', label: '开房时间', field: 'checkInTime', align: 'center' },
  { name: 'checkOutTime', label: '退房时间', field: 'checkOutTime', align: 'center' }
]

// 明细数据
const receiptDetails = ref([])

// 统计数据
const statistics = ref({
  reserveCash: 1000,
  hotelIncome: 0,
  restIncome: 0,
  carRentalIncome: 0,
  totalIncome: 0,
  hotelDeposit: 0,
  restDeposit: 0,
  retainedAmount: 0,
  handoverAmount: 0,
  goodReviews: 0,
  vipCards: 0
})

// 备注信息
const remarks = ref('')

// 获取支付方式对应的颜色
function getPaymentMethodColor(method) {
  const colors = {
    '现金': 'green',
    '微信': 'primary',
    '支付宝': 'blue',
    '银行卡': 'purple'
  }
  return colors[method] || 'grey'
}

// 切换房间类型
async function switchRoomType(type) {
  loading.value = true
  try {
    // 这里调用后端API获取对应类型的收款明细
    const response = await fetch(`/api/handover/receipts?type=${type}`)
    const data = await response.json()
    receiptDetails.value = data
    updateStatistics()
  } catch (error) {
    console.error('获取收款明细失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取收款明细失败'
    })
  } finally {
    loading.value = false
  }
}

// 更新统计数据
function updateStatistics() {
  // 根据明细数据计算统计数据
  const total = receiptDetails.value.reduce((sum, item) => sum + item.totalAmount, 0)
  statistics.value.totalIncome = total
  // ... 其他统计计算
}

// 保存交接班记录
async function saveHandover() {
  try {
    const handoverData = {
      type: roomType.value,
      details: receiptDetails.value,
      statistics: statistics.value,
      remarks: remarks.value,
      date: new Date()
    }

    const response = await fetch('/api/handover/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(handoverData)
    })

    if (response.ok) {
      $q.notify({
        type: 'positive',
        message: '交接班记录已保存'
      })
    } else {
      throw new Error('保存失败')
    }
  } catch (error) {
    console.error('保存交接班记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存交接班记录失败'
    })
  }
}

// 打印交接单
function printHandover() {
  window.print()
}

// 导出Excel
function exportToExcel() {
  // 实现导出Excel的逻辑
  $q.notify({
    type: 'info',
    message: '正在导出Excel...'
  })
}

// 组件挂载时获取初始数据
onMounted(async () => {
  await switchRoomType(roomType.value)
})
</script>

<style scoped>
.shift-handover {
  max-width: 1600px;
  margin: 0 auto;
}

@media print {
  .q-btn {
    display: none;
  }
}
</style>
