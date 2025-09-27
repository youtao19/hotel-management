<template>
  <div class="check-data-container">
    <!-- 核对数据卡片 -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="fact_check" color="primary" class="q-mr-sm" />
          请核对交接数据
        </div>

        <!-- 客房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="text-subtitle1 q-mb-sm text-weight-medium">客房数据</div>
          <q-table
            :rows="hotelRoomData"
            :columns="roomColumns"
            row-key="orderNo"
            flat
            bordered
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
            class="data-check-table"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="text-center">
                <div class="action-buttons">
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="positive"
                    icon="check"
                    @click="confirmRow(props.row, 'hotel')"
                    :disable="props.row.confirmed"
                    class="q-mr-xs"
                  >
                    <q-tooltip>确认数据无误</q-tooltip>
                  </q-btn>
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="primary"
                    icon="edit"
                    @click="editRow(props.row)"
                  >
                    <q-tooltip>修改数据</q-tooltip>
                  </q-btn>
                </div>
              </q-td>
            </template>
            <template v-slot:body-cell-orderNo="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 客房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="row items-center text-weight-medium">
              <div class="col">汇总</div>
              <div class="col text-center">房费: ¥{{ hotelSummary.roomFee.toFixed(2) }}</div>
              <div class="col text-center">押金: ¥{{ hotelSummary.deposit.toFixed(2) }}</div>
              <div class="col text-center">合计: ¥{{ (hotelSummary.roomFee + hotelSummary.deposit).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 休息房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="text-subtitle1 q-mb-sm text-weight-medium">休息房数据</div>
          <q-table
            :rows="restRoomData"
            :columns="roomColumns"
            row-key="orderNo"
            flat
            bordered
            hide-pagination
            :pagination="{ rowsPerPage: 0 }"
            class="data-check-table"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="text-center">
                <div class="action-buttons">
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="positive"
                    icon="check"
                    @click="confirmRow(props.row, 'rest')"
                    :disable="props.row.confirmed"
                    class="q-mr-xs"
                  >
                    <q-tooltip>确认数据无误</q-tooltip>
                  </q-btn>
                  <q-btn
                    size="sm"
                    round
                    dense
                    color="primary"
                    icon="edit"
                    @click="editRow(props.row)"
                  >
                    <q-tooltip>修改数据</q-tooltip>
                  </q-btn>
                </div>
              </q-td>
            </template>
            <template v-slot:body-cell-orderNo="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 休息房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="row items-center text-weight-medium">
              <div class="col">汇总</div>
              <div class="col text-center">房费: ¥{{ restSummary.roomFee.toFixed(2) }}</div>
              <div class="col text-center">押金: ¥{{ restSummary.deposit.toFixed(2) }}</div>
              <div class="col text-center">合计: ¥{{ (restSummary.roomFee + restSummary.deposit).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <!-- 确认核对按钮 -->
        <div class="text-center">
          <q-btn
            :color="dataCheckCompleted ? 'grey-6' : 'positive'"
            :icon="dataCheckCompleted ? 'check_circle' : 'verified'"
            :label="dataCheckCompleted ? '数据核对已完成' : '确认核对'"
            size="md"
            @click="confirmDataCheck"
            :loading="isConfirmingData"
            :disable="isConfirmingData || !allDataConfirmed || dataCheckCompleted"
          />
        </div>
      </q-card-section>
    </q-card>

    <!-- 修改数据对话框 -->
    <q-dialog v-model="editDialog.show" persistent>
      <q-card style="min-width: 400px;">
        <q-card-section>
          <div class="text-h6">修改数据</div>
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <strong>订单号：</strong>{{ editDialog.data.orderNo }}
          </div>
          <div class="row q-gutter-md">
            <div class="col">
              <q-input
                v-model.number="editDialog.data.roomFee"
                type="number"
                label="房费"
                outlined
                prefix="¥"
              />
            </div>
            <div class="col">
              <q-input
                v-model.number="editDialog.data.deposit"
                type="number"
                label="押金"
                outlined
                prefix="¥"
              />
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            color="negative"
            icon="close"
            label="取消"
            flat
            @click="cancelEdit"
          />
          <q-btn
            color="positive"
            icon="check"
            label="确认"
            @click="saveEdit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

// 响应式数据
const isConfirmingData = ref(false)
const dataCheckCompleted = ref(false) // 数据核对是否已完成

// 表格列定义
const roomColumns = [
  {
    name: 'orderNo',
    label: '订单号',
    field: 'orderNo',
    align: 'left',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'roomNo',
    label: '房号',
    field: 'roomNo',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'guestName',
    label: '姓名',
    field: 'guestName',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'roomFee',
    label: '房费',
    field: 'roomFee',
    align: 'center',
    headerStyle: 'font-weight: bold;',
    format: val => `¥${val.toFixed(2)}`
  },
  {
    name: 'deposit',
    label: '押金',
    field: 'deposit',
    align: 'center',
    headerStyle: 'font-weight: bold;',
    format: val => `¥${val.toFixed(2)}`
  },
  {
    name: 'actions',
    label: '操作',
    field: 'actions',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  }
]

// 客房数据
const hotelRoomData = ref([
  {
    orderNo: 'H001',
    roomNo: '101',
    guestName: '张三',
    roomFee: 288.00,
    deposit: 100.00,
    confirmed: false
  },
  {
    orderNo: 'H002',
    roomNo: '102',
    guestName: '李四',
    roomFee: 328.00,
    deposit: 100.00,
    confirmed: false
  },
  {
    orderNo: 'H003',
    roomNo: '201',
    guestName: '王五',
    roomFee: 388.00,
    deposit: 200.00,
    confirmed: false
  }
])

// 休息房数据
const restRoomData = ref([
  {
    orderNo: 'R001',
    roomNo: '301',
    guestName: '赵六',
    roomFee: 88.00,
    deposit: 50.00,
    confirmed: false
  },
  {
    orderNo: 'R002',
    roomNo: '302',
    guestName: '钱七',
    roomFee: 98.00,
    deposit: 50.00,
    confirmed: false
  }
])

// 编辑对话框数据
const editDialog = ref({
  show: false,
  data: {
    orderNo: '',
    roomFee: 0,
    deposit: 0
  },
  originalData: null
})

// 计算属性 - 客房汇总
const hotelSummary = computed(() => {
  const roomFee = hotelRoomData.value.reduce((sum, item) => sum + item.roomFee, 0)
  const deposit = hotelRoomData.value.reduce((sum, item) => sum + item.deposit, 0)
  return { roomFee, deposit }
})

// 计算属性 - 休息房汇总
const restSummary = computed(() => {
  const roomFee = restRoomData.value.reduce((sum, item) => sum + item.roomFee, 0)
  const deposit = restRoomData.value.reduce((sum, item) => sum + item.deposit, 0)
  return { roomFee, deposit }
})

// 计算属性 - 是否所有数据都已确认
const allDataConfirmed = computed(() => {
  const allHotelConfirmed = hotelRoomData.value.every(item => item.confirmed)
  const allRestConfirmed = restRoomData.value.every(item => item.confirmed)
  return allHotelConfirmed && allRestConfirmed
})

// 方法
// 确认行数据
const confirmRow = (row, type) => {
  row.confirmed = true
  $q.notify({
    type: 'positive',
    message: `订单 ${row.orderNo} 数据确认完成`,
    position: 'top'
  })
}

// 编辑行数据
const editRow = (row) => {
  editDialog.value.data = { ...row }
  editDialog.value.originalData = row
  editDialog.value.show = true
}

// 取消编辑
const cancelEdit = () => {
  editDialog.value.show = false
  editDialog.value.data = {
    orderNo: '',
    roomFee: 0,
    deposit: 0
  }
  editDialog.value.originalData = null
}

// 保存编辑
const saveEdit = () => {
  if (editDialog.value.originalData) {
    editDialog.value.originalData.roomFee = editDialog.value.data.roomFee
    editDialog.value.originalData.deposit = editDialog.value.data.deposit
    editDialog.value.originalData.confirmed = false // 修改后需要重新确认

    // 数据修改后重置核对完成状态
    dataCheckCompleted.value = false

    $q.notify({
      type: 'positive',
      message: `订单 ${editDialog.value.data.orderNo} 数据修改成功，请重新确认数据`,
      position: 'top'
    })
  }

  cancelEdit()
}

// 确认数据核对
const confirmDataCheck = async () => {
  // 如果已经完成，直接返回
  if (dataCheckCompleted.value) {
    $q.notify({
      type: 'info',
      message: '数据核对已完成，无需重复操作',
      position: 'top'
    })
    return
  }

  try {
    isConfirmingData.value = true

    $q.notify({
      type: 'info',
      message: '正在确认数据核对...',
      position: 'top'
    })

    // 模拟确认延迟
    await new Promise(resolve => setTimeout(resolve, 1500))

    // 设置为已完成状态
    dataCheckCompleted.value = true

    $q.notify({
      type: 'positive',
      message: '数据核对确认完成',
      position: 'top'
    })

  } catch (error) {
    console.error('确认数据核对失败:', error)
    $q.notify({
      type: 'negative',
      message: '确认数据核对失败，请重试',
      position: 'top'
    })
  } finally {
    isConfirmingData.value = false
  }
}

// 生命周期
onMounted(() => {
  console.log('CheckData component mounted')
})
</script>

<style scoped>
.check-data-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

/* 数据检查表格样式 */
.data-check-table {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
}

.data-check-table :deep(.q-table__top) {
  padding: 16px;
}

.data-check-table :deep(.q-table__bottom) {
  display: none;
}

.data-check-table :deep(th) {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.data-check-table :deep(td) {
  padding: 12px 8px;
  vertical-align: middle; /* 确保垂直居中 */
}

/* 汇总行样式 */
.summary-row {
  border-radius: 0 0 8px 8px;
  border: 1px solid #e0e0e0;
  border-top: none;
  background-color: #f8f9fa !important;
}

/* 数据检查部分样式 */
.data-check-section {
  margin-bottom: 24px;
}

.data-check-section .text-subtitle1 {
  color: #1976d2;
  border-bottom: 2px solid #e3f2fd;
  padding-bottom: 8px;
}

/* 操作按钮居中样式 */
.action-buttons {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px; /* 按钮间距 */
}

/* 响应式设计 */
@media (max-width: 768px) {
  .check-data-container {
    padding: 16px;
  }

  .data-check-table :deep(td) {
    padding: 8px 4px;
  }

  .data-check-table :deep(.q-btn) {
    min-width: 32px;
  }

  .action-buttons {
    gap: 2px; /* 移动端减小按钮间距 */
  }

  .summary-row .row > div {
    font-size: 12px;
  }
}
</style>
