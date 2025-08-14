<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <!-- 标题和操作区域 -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-weight-bold">交接班</div>
        <div class="row q-gutter-md">
          <q-btn color="primary" icon="print" label="打印" @click="printHandover" />
          <q-btn color="green" icon="download" label="导出Excel" @click="exportToExcel" />
          <q-btn color="purple" icon="save" label="保存页面" @click="savePageData" :loading="savingAmounts" />
          <q-btn color="orange" icon="save" label="保存交接记录" @click="saveHandover" />
          <q-btn color="blue" icon="history" label="历史记录" @click="openHistoryDialog" />
        </div>
      </div>

      <!-- 日期和人员信息 -->
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-md-4">
          <q-input v-model="selectedDate" type="date" label="查询日期" filled />
        </div>
        <div class="col-md-4">
          <q-input v-model="handoverPerson" label="交班人" filled />
        </div>
        <div class="col-md-4">
          <q-input v-model="receivePerson" label="接班人" filled />
        </div>
      </div>

      <!-- 引用交接班表格组件 -->
      <ShiftHandoverTable
        v-model:paymentData="paymentData"
        :taskList="taskList"
        v-model:newTaskTitle="newTaskTitle"
        v-model:cashierName="cashierName"
        v-model:notes="notes"
        v-model:totalRooms="totalRooms"
        v-model:restRooms="restRooms"
        v-model:vipCards="vipCards"
        v-model:goodReview="goodReview"
        @updateTaskStatus="updateTaskStatus"
        @addNewTask="addNewTask"
        @deleteTask="deleteTask"
        @editTask="editTask"
      />
    </div>

    <!-- 历史记录组件 -->
    <ShiftHandoverHistory ref="historyDialogRef" @close="onHistoryDialogClose" />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../api/index.js'
import ShiftHandoverHistory from '../components/ShiftHandoverHistory.vue'
import ShiftHandoverTable from '../components/ShiftHandoverTable.vue'
import { useShiftHandoverStore } from 'src/stores/shiftHandoverStore.js'

const $q = useQuasar()

// 基础数据
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const handoverPerson = ref('')
const receivePerson = ref('')
const cashierName = ref('张')
const notes = ref('')
const savingAmounts = ref(false)
const goodReview = ref('邀1得1')
const shiftHandoverStore = useShiftHandoverStore()

// 备忘录列表相关
const newTaskTitle = ref('')
const taskList = ref([])

// 历史记录组件引用
const historyDialogRef = ref(null)


// 支付方式数据结构
const paymentData = ref({
  cash: {
    reserveCash: 320,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 320
  },
  wechat: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  digital: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  other: {
    reserveCash: 0,
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  }
})
// 计算各项合计
function calculateTotals() {
  // 现金行：备用金 + 客房收入 + 休息房收入 + 租车收入 = 合计
  paymentData.value.cash.total = (paymentData.value.cash.reserveCash || 0) +
                                 (paymentData.value.cash.hotelIncome || 0) +
                                 (paymentData.value.cash.restIncome || 0) +
                                 (paymentData.value.cash.carRentIncome || 0)
  // 其他支付方式：备用金 + 客房收入 + 休息房收入 + 租车收入 = 合计
  Object.keys(paymentData.value).forEach(paymentType => {
    if (paymentType !== 'cash') {
      const payment = paymentData.value[paymentType]
      payment.total = (payment.reserveCash || 0) + (payment.hotelIncome || 0) + (payment.restIncome || 0) + (payment.carRentIncome || 0)
    }
  })
}

// 将 store 的 shiftTable_data 映射到本地 paymentData
function syncPaymentDataFromStore(table) {
  const data = table?.data || table
  if (!data || typeof data !== 'object') return

  // 如果是按中文键的表格数据
  if (data['现金'] || data['微信'] || data['微邮付'] || data['支付宝'] || data['数字支付'] || data['其他']) {
    const mapCurrency = (src, destKey) => {
      if (!src) return
      paymentData.value[destKey].reserveCash = Number(src['备用金'] ?? (paymentData.value[destKey].reserveCash || 0))
      paymentData.value[destKey].hotelIncome = Number(src['客房收入'] ?? 0)
      paymentData.value[destKey].restIncome = Number(src['休息房收入'] ?? 0)
      paymentData.value[destKey].carRentIncome = Number(src['租车收入'] ?? 0)
      paymentData.value[destKey].hotelDeposit = Number(src['客房退押'] ?? 0)
      paymentData.value[destKey].restDeposit = Number(src['休息退押'] ?? 0)
      paymentData.value[destKey].retainedAmount = Number(src['留存款'] ?? (destKey === 'cash' ? 320 : 0))
    }
    mapCurrency(data['现金'], 'cash')
    mapCurrency(data['微信'], 'wechat')
    mapCurrency(data['微邮付'] || data['支付宝'] || data['数字支付'], 'digital')
    mapCurrency(data['其他'], 'other')
    calculateTotals()
  }

  // 如果是 { records, refunds } 结构，按备注分类到现金行
  if (Array.isArray(data?.records) || Array.isArray(data?.refunds)) {
    applyShiftTableRemarks(data)
  }
}

// 从交接表records/refunds根据备注(住宿/休息房)分类并累加到表格
function applyShiftTableRemarks(raw, destKey = 'cash') {
  if (!raw || typeof raw !== 'object') return
  const records = Array.isArray(raw.records) ? raw.records : []
  const refunds = Array.isArray(raw.refunds) ? raw.refunds : []

  let hotelIncomeSum = 0
  let restIncomeSum = 0
  let hotelRefundSum = 0
  let restRefundSum = 0

  // 备注分类：更健壮的关键词匹配
  const classifyRemark = (txt) => {
    const r = (txt ?? '').toString()
    // 优先匹配“休息类”
    const restKeywords = ['休息房', '休息', '钟点', '钟点房']
    const hotelKeywords = ['住宿', '客房', '住', '房费']
    const hasAny = (arr) => arr.some(k => r.includes(k))
    if (hasAny(restKeywords)) return 'rest'
    if (hasAny(hotelKeywords)) return 'hotel'
    return null
  }

  // 汇总收入
  for (const r of records) {
    const remark = r?.remarks || ''
    const amt = Number(r?.total_income || 0) || 0
    const t = classifyRemark(remark)
    if (t === 'hotel') hotelIncomeSum += amt
    if (t === 'rest') restIncomeSum += amt
  }

  // 汇总退押金（使用绝对值）
  for (const rf of refunds) {
    const remark = rf?.remarks || ''
    const amt = Math.abs(Number(rf?.refund_deposit || 0) || 0)
    const t = classifyRemark(remark)
    if (t === 'hotel') hotelRefundSum += amt
    if (t === 'rest') restRefundSum += amt
  }

  // 将结果累加到指定支付方式行（默认现金）。为防止重复累加，先重置这些目标字段
  if (!paymentData.value[destKey]) destKey = 'cash'
  paymentData.value[destKey].hotelIncome = 0
  paymentData.value[destKey].restIncome = 0
  paymentData.value[destKey].hotelDeposit = 0
  paymentData.value[destKey].restDeposit = 0

  paymentData.value[destKey].hotelIncome += hotelIncomeSum
  paymentData.value[destKey].restIncome += restIncomeSum
  paymentData.value[destKey].hotelDeposit += hotelRefundSum
  paymentData.value[destKey].restDeposit += restRefundSum

  // 注：已去除冗余日志，保持控制台整洁

  calculateTotals()
}

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(6)

// 移除复杂的页面级数据加载，统一依赖 store 及 watchers 进行同步

// 保存交接记录
async function saveHandover() {
  try {
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value,
        goodReview: goodReview.value
      }
    }

    await shiftHandoverApi.saveHandover(handoverData)

    $q.notify({
      type: 'positive',
      message: '交接记录保存成功'
    })
  } catch (error) {
    console.error('保存交接记录失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存交接记录失败'
    })
  }
}

// 保存页面数据（保存所有页面数据，包括金额、统计数据等）
async function savePageData() {
  try {
    savingAmounts.value = true

    // 准备完整的页面数据
    const pageData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value,
        goodReview: goodReview.value
      }
    }

    // 调用保存API端点
    const result = await shiftHandoverApi.saveAmountChanges(pageData)

    $q.notify({
      type: 'positive',
      message: '页面数据保存成功',
      caption: '所有数据已保存到数据库',
      position: 'top',
      timeout: 3000
    })

  // 成功日志简化，避免控制台噪音

  } catch (error) {
    console.error('保存页面数据失败:', error)
    $q.notify({
      type: 'negative',
      message: '保存页面数据失败',
      caption: error.message,
      position: 'top'
    })
  } finally {
    savingAmounts.value = false
  }
}

// 打印交接单
function printHandover() {
  // 直接调用浏览器打印当前页面
  window.print()
}

// 导出Excel
async function exportToExcel() {
  try {
    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: taskList.value,
      paymentData: paymentData.value,
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value
      }
    }

    const response = await shiftHandoverApi.exportNewHandover(handoverData)

    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交接班记录_${selectedDate.value}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    $q.notify({
      type: 'positive',
      message: 'Excel文件已下载'
    })
  } catch (error) {
    console.error('导出Excel失败:', error)
    $q.notify({
      type: 'negative',
      message: '导出Excel失败'
    })
  }
}

// 备忘录管理方法
function addNewTask() {
  if (!newTaskTitle.value.trim()) return

  const newTask = {
    id: Date.now(),
    title: newTaskTitle.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    completed: false
  }

  taskList.value.push(newTask)
  newTaskTitle.value = ''
}

// 删除备忘录
function deleteTask(index) {
  taskList.value.splice(index, 1)
}

// 编辑备忘录
function editTask(index) {
  // 可以扩展为内联编辑功能
  const task = taskList.value[index]
  const newTitle = prompt('编辑备忘录:', task.title)
  if (newTitle && newTitle.trim()) {
    task.title = newTitle.trim()
  }
}

// 更新备忘录状态
function updateTaskStatus(taskId, completed) {
  const task = taskList.value.find(t => t.id === taskId)
  if (task) {
    task.completed = completed
  }
}

// 从后端加载备注并填充到备忘录
async function loadRemarksIntoMemo() {
  try {
    // 调用 Pinia 的 action 获取指定日期的备注，并使用其返回值
    const res = await shiftHandoverStore.fetchRemarks(selectedDate.value)
    // 兼容不同返回结构
    let list = []
    if (Array.isArray(res)) list = res
    else if (Array.isArray(res?.data)) list = res.data
    else if (Array.isArray(res?.data?.data)) list = res.data.data
    else if (Array.isArray(res?.rows)) list = res.rows
    else if (Array.isArray(res?.data?.rows)) list = res.data.rows
    else if (Array.isArray(res?.list)) list = res.list
    else if (Array.isArray(res?.data?.list)) list = res.data.list

    if (list.length) {
      // 转成备忘录任务，格式：房间号：（），备注：（）
      const formatted = list.map((r, idx) => {
      const room =  r?.room_number
      const remarkText = r?.remarks
      const rawTime = r?.time || r?.created_at || r?.create_time || r?.createdAt || r?.updatedAt
        const timeStr = rawTime
          ? new Date(rawTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        return {
          id: r?.id ?? (Date.now() + idx),
          title: `房间号：${room}，备注：${remarkText}`,
          time: timeStr,
          completed: false
        }
      })

      // 覆盖显示为后端当天结果
      taskList.value = formatted
    } else {
  taskList.value = []
    }
  } catch (e) {
    console.error('加载备忘录失败:', e)
  }
}

// 历史记录相关方法
function openHistoryDialog() {
  if (historyDialogRef.value) {
    historyDialogRef.value.openDialog()
  }
}

function onHistoryDialogClose() {
  // 历史记录对话框关闭时的处理
  // 省略冗余日志
}

// 监听支付数据变化
watch(paymentData, () => {
  calculateTotals()
}, { deep: true })

// 监听 store 中的表格数据变化，自动同步到 paymentData
watch(shiftHandoverStore.shiftTable_data, (val) => {
  try {
    syncPaymentDataFromStore(val)
  } catch (e) {
    console.error('同步交接表到 paymentData 失败:', e)
  }
}, { deep: true, immediate: false })

// 监听日期变更：刷新备忘录、特殊统计，并拉取交接表（映射由 store-watch 负责）
watch(selectedDate, async () => {
  // 先确保合计不为空
  calculateTotals()
  await loadRemarksIntoMemo()
  // 日期变化时刷新特殊统计
  try {
    const res = await shiftHandoverStore.fetchSpecialStats(selectedDate.value)
    const data = res?.data || res
    if (data) {
      const openCount = data.openCount ?? data.totalRooms ?? data.open ?? 0
      const restCount = data.restCount ?? data.restRooms ?? data.rest ?? 0
      const invited = data.invited ?? data.invite ?? 0
      const positive = data.positive ?? data.good ?? 0
      totalRooms.value = Number(openCount) || 0
      restRooms.value = Number(restCount) || 0
      goodReview.value = `邀${invited}得${positive}`
    }
  } catch (e) {
    console.error('加载特殊统计失败:', e)
  }

  // 日期变化时刷新交接表格（来自 store），映射通过 store-watch 自动完成
  try {
    await shiftHandoverStore.fetchShiftTable(selectedDate.value)
  } catch (e) {
    console.error('加载交接表格失败:', e)
  }
})

// 组件挂载时初始化
onMounted(async () => {
  // 确保总计正确计算
  calculateTotals()
  // 通过 store 首次拉取交接表并同步到 paymentData
  try {
    const res = await shiftHandoverStore.fetchShiftTable(selectedDate.value)
    syncPaymentDataFromStore(res)
  } catch (e) {
    console.error('首次加载交接表失败:', e)
  }
  // 加载备忘录：从后端获取备注并填入“房间号：（），备注：（）”格式
  await loadRemarksIntoMemo()
  // 加载交接班特殊统计（开房数、休息房数、好评邀/得）
  try {
    const res = await shiftHandoverStore.fetchSpecialStats(selectedDate.value)
    const data = res?.data || res // 兼容拦截器返回
    if (data) {
      const openCount = data.openCount ?? data.totalRooms ?? data.open ?? 0
      const restCount = data.restCount ?? data.restRooms ?? data.rest ?? 0
      const invited = data.invited ?? data.invite ?? 0
      const positive = data.positive ?? data.good ?? 0
      totalRooms.value = Number(openCount) || 0
      restRooms.value = Number(restCount) || 0
      goodReview.value = `邀${invited}得${positive}`
    }
  } catch (e) {
    console.error('加载特殊统计失败:', e)
  }
})
</script>

<style scoped>
.shift-handover {
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* 打印样式 */
@media print {
  .shift-handover {
    background-color: white !important;
    min-height: auto !important;
  }

  /* 隐藏不需要打印的元素 */
  .q-btn, .q-card-actions, .q-toolbar, .q-header {
    display: none !important;
  }

  /* 打印时的页面设置 */
  @page {
    margin: 15mm;
    size: A4;
  }

  /* 确保表格在打印时正确显示 */
  .shift-table-container {
    box-shadow: none !important;
    border: 1px solid #000 !important;
  }

  .shift-table {
    font-size: 12px !important;
  }

  .shift-table th,
  .shift-table td {
    border: 1px solid #000 !important;
    padding: 4px !important;
  }

  /* 打印时的标题样式 */
  .q-card-section:first-child {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 20px;
  }

  /* 确保备忘录在打印时正确显示 */
  .task-management-container {
    box-shadow: none !important;
    border: 1px solid #000 !important;
    page-break-inside: avoid;
  }

  .task-card {
    border: 1px solid #ccc !important;
    background: white !important;
  }

  /* 特殊统计表格打印样式 */
  .special-stats-table {
    font-size: 12px !important;
  }

  .special-stats-table td {
    border: 1px solid #000 !important;
    padding: 4px !important;
  }
}
</style>
