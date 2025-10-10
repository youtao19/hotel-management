<template>
  <div class="check-data-container">
    <!-- 加载状态 -->
    <div v-if="isLoadingData" class="loading-container">
      <q-spinner-dots color="primary" size="50px" />
      <div class="text-body1 text-grey-7 q-mt-md">正在加载账单数据...</div>
    </div>

    <!-- 核对数据卡片 -->
    <q-card v-else flat bordered>
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="fact_check" color="primary" class="q-mr-sm" />
          请核对交接数据
        </div>

        <!-- 客房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="text-subtitle1 q-mb-sm text-weight-medium">客房数据</div>

          <!-- 无数据提示 -->
          <div v-if="hotelRoomData.length === 0" class="no-data-hint q-pa-md text-center">
            <q-icon name="info" size="32px" color="grey-5" />
            <div class="text-body2 text-grey-6 q-mt-sm">今日暂无客房账单数据</div>
          </div>

          <q-table
            v-else
            :rows="hotelRoomData"
            :columns="roomColumns"
            row-key="billId"
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
            <template v-slot:body-cell-billId="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 客房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="text-weight-medium">
              <div class="row items-center q-mb-xs">
                <div class="col-2">汇总</div>
                <div class="col">
                  <span v-for="(amount, type) in hotelSummary.byType" :key="type" class="q-mr-md">
                    {{ type }}: ¥{{ amount.toFixed(2) }}
                  </span>
                </div>
                <div class="col-auto text-primary text-h6">
                  合计: ¥{{ hotelSummary.totalAmount.toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 休息房数据表格 -->
        <div class="data-check-section q-mb-lg">
          <div class="text-subtitle1 q-mb-sm text-weight-medium">休息房数据</div>

          <!-- 无数据提示 -->
          <div v-if="restRoomData.length === 0" class="no-data-hint q-pa-md text-center">
            <q-icon name="info" size="32px" color="grey-5" />
            <div class="text-body2 text-grey-6 q-mt-sm">今日暂无休息房账单数据</div>
          </div>

          <q-table
            v-else
            :rows="restRoomData"
            :columns="roomColumns"
            row-key="billId"
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
            <template v-slot:body-cell-billId="props">
              <q-td :props="props">
                <span :class="props.row.confirmed ? 'text-positive' : ''">
                  {{ props.value }}
                </span>
              </q-td>
            </template>
          </q-table>

          <!-- 休息房汇总行 -->
          <div class="summary-row q-pa-md bg-grey-1">
            <div class="text-weight-medium">
              <div class="row items-center q-mb-xs">
                <div class="col-2">汇总</div>
                <div class="col">
                  <span v-for="(amount, type) in restSummary.byType" :key="type" class="q-mr-md">
                    {{ type }}: ¥{{ amount.toFixed(2) }}
                  </span>
                </div>
                <div class="col-auto text-primary text-h6">
                  合计: ¥{{ restSummary.totalAmount.toFixed(2) }}
                </div>
              </div>
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
            <strong>账单ID：</strong>{{ editDialog.data.billId }}
          </div>
          <div class="q-mb-md">
            <strong>订单号：</strong>{{ editDialog.data.orderNo }}
          </div>
          <div class="q-mb-md">
            <q-select
              v-model="editDialog.data.changeType"
              :options="changeTypeOptions"
              label="账单类型"
              outlined
              emit-value
              map-options
            />
          </div>
          <div class="q-mb-md">
            <q-input
              v-model.number="editDialog.data.amount"
              type="number"
              label="金额"
              outlined
              prefix="¥"
              hint="正数表示收入，负数表示支出"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            color="negative"
            icon="close"
            label="取消"
            flat
            @click="cancelEdit"
            :disable="isSavingEdit"
          />
          <q-btn
            color="positive"
            icon="check"
            label="确认"
            @click="saveEdit"
            :loading="isSavingEdit"
            :disable="isSavingEdit"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { billApi } from '../../api/index.js'

const $q = useQuasar()

// 账单类型选项
const changeTypeOptions = [
  '房费',
  '收押',
  '押金',
  '补收',
  '退押',
  '退押金',
  '退款',
  '订单账单'
]

// 响应式数据
const isConfirmingData = ref(false)
const dataCheckCompleted = ref(false) // 数据核对是否已完成
const isLoadingData = ref(false) // 是否正在加载数据
const isSavingEdit = ref(false) // 是否正在保存编辑

// 表格列定义
const roomColumns = [
  {
    name: 'billId',
    label: '账单ID',
    field: 'billId',
    align: 'left',
    headerStyle: 'font-weight: bold;'
  },
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
    name: 'changeType',
    label: '账单类型',
    field: 'changeType',
    align: 'center',
    headerStyle: 'font-weight: bold;'
  },
  {
    name: 'amount',
    label: '金额',
    field: 'amount',
    align: 'center',
    headerStyle: 'font-weight: bold;',
    format: val => {
      if (val === 0) return '-'
      const prefix = val > 0 ? '+' : ''
      return `${prefix}¥${val.toFixed(2)}`
    }
  },
  {
    name: 'payWay',
    label: '支付方式',
    field: 'payWay',
    align: 'center',
    headerStyle: 'font-weight: bold;'
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
const hotelRoomData = ref([])

// 休息房数据
const restRoomData = ref([])

// 编辑对话框数据
const editDialog = ref({
  show: false,
  data: {
    billId: '',
    orderNo: '',
    changeType: '',
    amount: 0
  },
  originalData: null
})

// 汇总数据对象（按支付方式统计）
const summaryDataObject = ref({
  // 客房收入（按支付方式）- 包含：房费 + 收押 + 补收 + 订单账单
  hotelIncome: {
    '现金': 0,
    '微信': 0,
    '微邮付': 0,
    '其他': 0
  },
  // 休息房收入（按支付方式）- 包含：房费 + 收押 + 补收 + 订单账单
  restIncome: {
    '现金': 0,
    '微信': 0,
    '微邮付': 0,
    '其他': 0
  },
  // 客房退押（按支付方式）- 实退金额（包含退押金和退款）
  hotelRefundDeposit: {
    '现金': 0,
    '微信': 0,
    '微邮付': 0,
    '其他': 0
  },
  // 休息房退押（按支付方式）- 实退金额（包含退押金和退款）
  restRefundDeposit: {
    '现金': 0,
    '微信': 0,
    '微邮付': 0,
    '其他': 0
  }
})

// 计算属性 - 客房汇总
const hotelSummary = computed(() => {
  const totalAmount = hotelRoomData.value.reduce((sum, item) => sum + item.amount, 0)
  const byType = {}

  hotelRoomData.value.forEach(bill => {
    if (!byType[bill.changeType]) {
      byType[bill.changeType] = 0
    }
    byType[bill.changeType] += bill.amount
  })

  return { totalAmount, byType }
})

// 计算属性 - 休息房汇总
const restSummary = computed(() => {
  const totalAmount = restRoomData.value.reduce((sum, item) => sum + item.amount, 0)
  const byType = {}

  restRoomData.value.forEach(bill => {
    if (!byType[bill.changeType]) {
      byType[bill.changeType] = 0
    }
    byType[bill.changeType] += bill.amount
  })

  return { totalAmount, byType }
})

// 计算属性 - 是否所有数据都已确认
const allDataConfirmed = computed(() => {
  const hotelData = hotelRoomData.value || []
  const restData = restRoomData.value || []

  // 如果没有数据，返回 true（允许跳过）
  const totalCount = hotelData.length + restData.length
  if (totalCount === 0) {
    return true
  }

  // 检查所有数据是否都已确认
  const allHotelConfirmed = hotelData.every(item => item.confirmed)
  const allRestConfirmed = restData.every(item => item.confirmed)

  return allHotelConfirmed && allRestConfirmed
})

// 方法
// 计算并更新汇总数据对象
const calculateSummaryData = () => {
  // 重置汇总对象
  summaryDataObject.value = {
    hotelIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
    restIncome: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
    hotelRefundDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 },
    restRefundDeposit: { '现金': 0, '微信': 0, '微邮付': 0, '其他': 0 }
  }

  // 统计客房数据
  hotelRoomData.value.forEach(bill => {
    const payWay = bill.payWay || '其他'
    const changeType = bill.changeType
    const amount = bill.amount || 0

    // 确保支付方式存在于对象中
    const normalizedPayWay = ['现金', '微信', '微邮付'].includes(payWay) ? payWay : '其他'

    // 根据账单类型分类统计
    if (changeType === '房费' || changeType === '收押' || changeType === '押金' || changeType === '补收' || changeType === '订单账单') {
      // 收入类型：房费 + 收押 + 补收 + 订单账单（兼容旧数据）
      summaryDataObject.value.hotelIncome[normalizedPayWay] += amount
      console.log(`💰 [收入统计] 客房收入: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else if (changeType === '退押' || changeType === '退押金' || changeType === '退款') {
      // 退押金/退款是负数，取绝对值统计实退金额（合并到退押列）
      summaryDataObject.value.hotelRefundDeposit[normalizedPayWay] += Math.abs(amount)
      console.log(`💰 [退款统计] 客房退款/退押: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else {
      // 未知类型，记录警告
      console.warn(`⚠️ [未知类型] 客房账单: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}`)
    }
  })

  // 统计休息房数据
  restRoomData.value.forEach(bill => {
    const payWay = bill.payWay || '其他'
    const changeType = bill.changeType
    const amount = bill.amount || 0

    // 确保支付方式存在于对象中
    const normalizedPayWay = ['现金', '微信', '微邮付'].includes(payWay) ? payWay : '其他'

    // 根据账单类型分类统计
    if (changeType === '房费' || changeType === '收押' || changeType === '押金' || changeType === '补收' || changeType === '订单账单') {
      // 收入类型：房费 + 收押 + 补收 + 订单账单（兼容旧数据）
      summaryDataObject.value.restIncome[normalizedPayWay] += amount
      console.log(`💰 [收入统计] 休息房收入: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else if (changeType === '退押' || changeType === '退押金' || changeType === '退款') {
      // 退押金/退款是负数，取绝对值统计实退金额（合并到退押列）
      summaryDataObject.value.restRefundDeposit[normalizedPayWay] += Math.abs(amount)
      console.log(`💰 [退款统计] 休息房退款/退押: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}, 支付方式: ${normalizedPayWay}`)
    } else {
      // 未知类型，记录警告
      console.warn(`⚠️ [未知类型] 休息房账单: ${bill.orderNo}, 类型: ${changeType}, 金额: ${amount}`)
    }
  })

  console.log('📊 [汇总对象更新]:', JSON.parse(JSON.stringify(summaryDataObject.value)))
  console.log('📊 [客房退押详情]:', summaryDataObject.value.hotelRefundDeposit)
  console.log('📊 [休息退押详情]:', summaryDataObject.value.restRefundDeposit)
}

// 确认行数据
const confirmRow = (row, type) => {
  row.confirmed = true
  // 确认后重新计算汇总数据
  calculateSummaryData()
}

// 编辑行数据
const editRow = (row) => {
  editDialog.value.data = {
    billId: row.billId,
    orderNo: row.orderNo,
    changeType: row.changeType,
    amount: row.amount
  }
  editDialog.value.originalData = row
  editDialog.value.show = true
}

// 取消编辑
const cancelEdit = () => {
  editDialog.value.show = false
  editDialog.value.data = {
    billId: '',
    orderNo: '',
    changeType: '',
    amount: 0
  }
  editDialog.value.originalData = null
}

// 保存编辑
const saveEdit = async () => {
  if (!editDialog.value.originalData) {
    return
  }

  try {
    isSavingEdit.value = true

    // 准备更新数据
    const updateData = {
      change_type: editDialog.value.data.changeType,
      change_price: editDialog.value.data.amount
    }

    console.log('📝 [saveEdit] 准备更新账单:', {
      billId: editDialog.value.data.billId,
      updateData
    })

    // 调用后端 API 更新账单
    const response = await billApi.updateBill(editDialog.value.data.billId, updateData)

    console.log('✅ [saveEdit] API返回数据:', response)

    if (response.success && response.data) {
      // 用返回的数据更新表格中的对应行
      const updatedBill = response.data
      const originalRow = editDialog.value.originalData

      // 更新显示数据
      originalRow.changeType = updatedBill.change_type
      originalRow.amount = parseFloat(updatedBill.change_price) || 0
      originalRow.payWay = updatedBill.pay_way
      originalRow.confirmed = false // 修改后需要重新确认

      // 数据修改后重置核对完成状态
      dataCheckCompleted.value = false

      // 重新计算汇总数据
      calculateSummaryData()

      $q.notify({
        type: 'positive',
        message: `账单 ${editDialog.value.data.billId} 更新成功，请重新确认数据`,
        position: 'top'
      })

      // 关闭对话框
      cancelEdit()
    } else {
      throw new Error(response.message || '更新失败')
    }

  } catch (error) {
    console.error('❌ [saveEdit] 更新账单失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '更新账单失败，请重试',
      position: 'top'
    })
  } finally {
    isSavingEdit.value = false
  }
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

    // 计算最终汇总数据
    calculateSummaryData()

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

// 辅助函数：将Date对象转换为本地日期字符串（YYYY-MM-DD）
const formatLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 加载账单数据
const loadBillsData = async () => {
  try {
    isLoadingData.value = true

    // 交接班业务逻辑：
    // 1. 营业日从每天8:00开始，到次日8:00结束
    // 2. 核对的是"前一个营业日"的账单数据
    const now = new Date()
    const currentHour = now.getHours()

    // 计算当前营业日
    let currentBusinessDate = new Date(now)
    if (currentHour < 8) {
      // 还没到8点，还在昨天营业日的时间范围内
      currentBusinessDate.setDate(currentBusinessDate.getDate() - 1)
    }

    // 计算要核对的营业日（当前营业日的前一天）
    let checkDate = new Date(currentBusinessDate)
    checkDate.setDate(checkDate.getDate() - 1)
    const checkDateStr = formatLocalDate(checkDate)

    console.log('📅 [CheckData] 日期计算:', {
      currentTime: now.toLocaleString('zh-CN'),
      currentHour,
      currentBusinessDate: formatLocalDate(currentBusinessDate),
      checkDate: checkDateStr,
      logic: '核对"前一个营业日"的账单数据'
    })

    // 调用API获取指定日期的账单数据
    const response = await billApi.getBillsByDate(checkDateStr)

    if (response.success) {
      const { hotelBills, restBills, totalCount } = response.data

      console.log('📊 [CheckData] API返回数据:', {
        hotelBills: hotelBills.length,
        restBills: restBills.length,
        totalCount,
        hotelBillsData: hotelBills,
        restBillsData: restBills
      })

      // 转换客房数据格式 - 每条账单一行
      hotelRoomData.value = hotelBills.map(bill => ({
        billId: bill.bill_id,
        orderNo: bill.order_id,
        roomNo: bill.room_number || '未知',
        guestName: bill.guest_name || '未知',
        changeType: bill.change_type,
        amount: parseFloat(bill.change_price) || 0,
        payWay: bill.pay_way,
        stayDate: bill.stay_date,
        createTime: bill.create_time,
        confirmed: false
      }))

      // 转换休息房数据格式 - 每条账单一行
      restRoomData.value = restBills.map(bill => ({
        billId: bill.bill_id,
        orderNo: bill.order_id,
        roomNo: bill.room_number || '未知',
        guestName: bill.guest_name || '未知',
        changeType: bill.change_type,
        amount: parseFloat(bill.change_price) || 0,
        payWay: bill.pay_way,
        stayDate: bill.stay_date,
        createTime: bill.create_time,
        confirmed: false
      }))

      console.log('✅ [CheckData] 数据转换完成:', {
        checkDate: checkDateStr,
        hotelCount: hotelRoomData.value.length,
        restCount: restRoomData.value.length,
        totalCount
      })

      // 加载数据后初始计算汇总数据
      calculateSummaryData()
    } else {
      throw new Error(response.message || '加载失败')
    }

  } catch (error) {
    console.error('加载账单数据失败:', error)
    $q.notify({
      type: 'negative',
      message: error.message || '加载账单数据失败，请重试',
      position: 'top'
    })
  } finally {
    isLoadingData.value = false
  }
}

// 生命周期
onMounted(() => {
  // 自动加载当天的账单数据
  loadBillsData()
})

// 暴露数据给父组件
defineExpose({
  hotelRoomData,
  restRoomData,
  hotelSummary,
  restSummary,
  dataCheckCompleted,
  allDataConfirmed,
  summaryDataObject  // 暴露汇总数据对象给步骤4使用
})
</script>

<style scoped>
.check-data-container {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

/* 加载状态样式 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  min-height: 400px;
}

/* 无数据提示样式 */
.no-data-hint {
  background: rgba(245, 245, 245, 0.5);
  border: 1px dashed #d0d0d0;
  border-radius: 8px;
  margin-bottom: 16px;
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
