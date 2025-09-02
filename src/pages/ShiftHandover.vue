<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <!-- 标题和操作区域 -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-weight-bold">交接班</div>
        <div class="row q-gutter-md">
          <q-btn @click="test1">测试</q-btn>
          <q-btn color="primary" icon="print" label="打印" @click="printHandover" />
          <q-btn color="green" icon="download" label="导出Excel" @click="exportToExcel" />
          <q-btn color="purple" icon="save" label="保存页面" @click="savePageData" :loading="savingAmounts" />
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

      <!-- 交接班内容区域 -->
      <div class="shift-handover-container">
        <!-- 支付表格 -->
        <ShiftHandoverPaymentTable
          :payment-data="paymentData"
          :read-only="false"
        />

        <!-- 备忘录 -->
        <div class="row q-mt-lg">
          <div class="col-12">
            <ShiftHandoverMemoList
              :task-list="taskList"
              :new-task-title="newTaskTitle"
              :read-only="false"
              @update:new-task-title="v => newTaskTitle = v"
              @update-task-status="updateTaskStatus"
              @add-new-task="addNewTask"
              @delete-task="deleteTask"
              @edit-task="editTask"
            />
          </div>
        </div>

        <!-- 特殊统计 -->
        <div class="row q-mt-md q-col-gutter-md">
          <div class="col-md-6">
            <ShiftHandoverSpecialStats
              :total-rooms="totalRooms"
              :rest-rooms="restRooms"
              :vip-cards="vipCards"
              :cashier-name="cashierName"
              :notes="notes"
              :good-review="goodReview"
              :read-only="false"
              @update:cashier-name="v => cashierName = v"
              @update:notes="v => notes = v"
              @update:total-rooms="v => totalRooms = v"
              @update:rest-rooms="v => restRooms = v"
              @update:vip-cards="v => vipCards = v"
              @update:good-review="v => goodReview = v"
            />
          </div>
        </div>
      </div>
    </div>


  </q-page>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import { shiftHandoverApi } from '../api/index.js'
import ShiftHandoverPaymentTable from '../components/ShiftHandoverPaymentTable.vue'
import ShiftHandoverMemoList from '../components/ShiftHandoverMemoList.vue'
import ShiftHandoverSpecialStats from '../components/ShiftHandoverSpecialStats.vue'
import { useShiftHandoverStore } from 'src/stores/shiftHandoverStore.js'

const $q = useQuasar()

// 安全封装：避免在 Loading 插件未启用时抛错
const loadingShow = (opts) => {
  try { $q?.loading?.show?.(opts) } catch (_) { /* noop */ }
}
const loadingHide = () => {
  try { $q?.loading?.hide?.() } catch (_) { /* noop */ }
}

// 基础数据
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD')) // 选中的日期
const handoverPerson = ref('') // 交班人
const receivePerson = ref('') // 接班人
const cashierName = ref('张') // 收银员姓名
const notes = ref('') // 备注
const savingAmounts = ref(false) // 保存金额状态
const goodReview = ref('邀1得1')
const shiftHandoverStore = useShiftHandoverStore()

// 备忘录列表相关
const newTaskTitle = ref('')
const taskList = ref([])

// 页面状态
const isLoading = ref(false)
const hasChanges = ref(false) // 用于追踪数据是否有变更

// 计算属性：获取总收入
const totalIncome = computed(() => {
  let total = 0
  Object.keys(paymentData.value).forEach(key => {
    const row = paymentData.value[key]
    total += (row.hotelIncome || 0) + (row.restIncome || 0) + (row.carRentIncome || 0)
  })
  return total
})

// 计算属性：获取总退押金
const totalDeposit = computed(() => {
  let total = 0
  Object.keys(paymentData.value).forEach(key => {
    const row = paymentData.value[key]
    total += (row.hotelDeposit || 0) + (row.restDeposit || 0)
  })
  return total
})


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
  Object.keys(paymentData.value).forEach(paymentType => {
    const payment = paymentData.value[paymentType]
    payment.total = (payment.reserveCash || 0) + (payment.hotelIncome || 0) + (payment.restIncome || 0) + (payment.carRentIncome || 0)
  })
}

// 将后端数据插入到交接表中
async function insertDataToShiftTable(date) {
  //拿到后端数据
  const response = await shiftHandoverStore.fetchShiftTable(date)
  const records = response.data.records

  for (const record of Object.values(records)) {
    // 如果是休息房
    if (record.check_in_date === record.check_out_date){
      switch (record.payment_method) {
        case '现金':
          paymentData.value.cash.restIncome += record.totalIncome || 0
          break
        case '微信':
          paymentData.value.wechat.restIncome += record.totalIncome || 0
          break
        case '微邮付':
          paymentData.value.digital.restIncome += record.totalIncome || 0
          break
        default:
          paymentData.value.other.restIncome += record.totalIncome || 0
          break
      }
      continue;
    }else{// 客房
      switch (record.payment_method) {
        case '现金':
          paymentData.value.cash.hotelIncome += record.totalIncome || 0
          break
        case '微信':
          paymentData.value.wechat.hotelIncome += record.totalIncome || 0
          break
        case '微邮付':
          paymentData.value.digital.hotelIncome += record.totalIncome || 0
          break
        case '其他':
          paymentData.value.other.hotelIncome += record.totalIncome || 0
          break
        default:
          break
      }
    }
  }

  const refunds = response.data.refunds

  for (const refund of Object.values(refunds)) {
    switch (refund.payment_method) {
      case '现金':
        paymentData.value.cash.hotelDeposit += refund.amount || 0
        break
      case '微信':
        paymentData.value.wechat.hotelDeposit += refund.amount || 0
        break
      case '支付宝':
        paymentData.value.digital.hotelDeposit += refund.amount || 0
        break
      case '其他':
        paymentData.value.other.hotelDeposit += refund.amount || 0
      default:
        break
    }
  }
  shiftHandoverStore.updateTableData(paymentData.value)
}

// 监听支付数据变化
watch(paymentData, () => {
  calculateTotals()
  hasChanges.value = true // 标记数据已变更
}, { deep: true })

// 加载交接表数据
async function loadShiftTableData() {
  try {
  const data = shiftHandoverStore.shiftTable_data?.value ?? shiftHandoverStore.shiftTable_data
  // 深拷贝到本地，避免直接引用 store 导致联动副作用
  paymentData.value = JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.error('加载交接表格失败:', error)
    throw error
  }
}

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(6)

// 保存页面数据（保存所有页面数据，包括金额、统计数据等）
async function savePageData() {
  try {
    // 数据验证
    if (!selectedDate.value) {
      throw new Error('请选择日期')
    }

    if (!cashierName.value) {
      throw new Error('请填写收银员姓名')
    }

  savingAmounts.value = true;
  loadingShow({ message: '保存数据中...' });

    const pageData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value,
      receivePerson: receivePerson.value,
      cashierName: cashierName.value,
      notes: notes.value,
      taskList: JSON.parse(JSON.stringify(taskList.value)),
      paymentData: JSON.parse(JSON.stringify(paymentData.value)),
      specialStats: {
        totalRooms: totalRooms.value,
        restRooms: restRooms.value,
        vipCards: vipCards.value,
        goodReview: goodReview.value,
        totalIncome: totalIncome.value,
        totalDeposit: totalDeposit.value
      }
    };

    // 调用保存API端点
    await shiftHandoverApi.saveAmountChanges(pageData);

    hasChanges.value = false;
    $q.notify({
      type: 'positive',
      message: '页面数据保存成功',
      position: 'top',
      timeout: 3000
    });

    console.log('保存的页面数据:', pageData);

  } catch (error) {
    console.error('保存页面数据失败:', error);
    $q.notify({
      type: 'negative',
      message: '保存页面数据失败',
      caption: error.message || '请检查数据并重试',
      position: 'top',
      timeout: 5000
    });
  } finally {
    savingAmounts.value = false;
    loadingHide();
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
        const room = r?.room_number || '未知房间'
        const remarkText = r?.remarks || '无备注'
        const rawTime = r?.time || r?.created_at || r?.create_time || r?.createdAt || r?.updatedAt
        const timeStr = rawTime
          ? new Date(rawTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

        return {
          id: `order-${r.order_id}-${r.remarks ? r.remarks.replace(/\s/g, '_') : 'no_remark'}-${idx}`, // More stable ID
          title: `房间号：${room}，备注：${remarkText}`,
          time: timeStr,
          completed: false,
          // 保存原始数据，便于后续处理
          raw: r
        }
      })

      // 覆盖显示为后端当天结果
      // taskList.value = formatted
      // 合并订单备注到现有备忘录列表
      // 过滤掉可能重复的项，例如基于id
      const existingTaskIds = new Set(taskList.value.map(task => task.id));
      const newRemarks = formatted.filter(remark => !existingTaskIds.has(remark.id));
      taskList.value = [...taskList.value, ...newRemarks];
    } else {
      // If list.length is 0, do not clear taskList.value, as it might contain admin-added tasks.
      // taskList.value = []
    }
  } catch (e) {
    console.error('加载备忘录失败:', e)
    $q.notify({
      type: 'negative',
      message: '加载备忘录失败',
      caption: e.message,
      timeout: 3000
    })
  }
}



// 监听备忘录变化
watch(taskList, () => {
  hasChanges.value = true // 标记数据已变更
}, { deep: true })

// 监听其他关键数据变化
watch([cashierName, notes, totalRooms, restRooms, vipCards, goodReview], () => {
  hasChanges.value = true // 标记数据已变更
})



// 刷新所有数据的统一入口函数
async function refreshAllData() {
  try {
    loadingShow({ message: '加载数据中...' });

    let handoverRecord = null;

    // Simply fetch the record for the selected date
    try {
      handoverRecord = await shiftHandoverApi.getCurrentHandover(selectedDate.value);
    } catch (e) {
      console.warn('未找到记录或获取失败:', e);
    }

    // 3. 根据获取到的记录填充页面数据
    if (handoverRecord) {
      handoverPerson.value = handoverRecord.handover_person || '';
      receivePerson.value = handoverRecord.receive_person || '';
      cashierName.value = handoverRecord.cashier_name || '';
      notes.value = handoverRecord.remarks || '';
      taskList.value = handoverRecord.task_list || [];
      paymentData.value = handoverRecord.paymentData || {}; // Changed from handoverRecord.details
      // specialStats needs to be handled from handoverRecord.statistics
      totalRooms.value = handoverRecord.statistics?.totalRooms || 0;
      restRooms.value = handoverRecord.statistics?.restRooms || 0;
      vipCards.value = handoverRecord.statistics?.vipCards || 0;
      goodReview.value = handoverRecord.statistics?.goodReview || '邀1得1';
    } else {
      // If no record found for the day, clear page data or load default values
      handoverPerson.value = '';
      receivePerson.value = '';
      cashierName.value = '张'; // Default value
      notes.value = '';
      taskList.value = [];
      // Reset paymentData to initial structure
      paymentData.value = {
        cash: { reserveCash: 320, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 320 },
        wechat: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
        digital: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 },
        other: { reserveCash: 0, hotelIncome: 0, restIncome: 0, carRentIncome: 0, total: 0, hotelDeposit: 0, restDeposit: 0, retainedAmount: 0 }
      };
    }

    // 确保合计正确计算
    calculateTotals();

    // 加载特殊统计 (确保 specialStats 总是最新的)
    await loadSpecialStats();

    // 先根据选中日期汇总交接表数据到 store
    await shiftHandoverStore.insertDataToShiftTable(selectedDate.value);

    // 加载交接表数据
    await loadShiftTableData();

    // 加载订单备注到备忘录
    await loadRemarksIntoMemo();

  } catch (error) {
    console.error('刷新数据失败:', error);
    $q.notify({
      type: 'negative',
      message: '刷新数据失败',
      caption: error.message,
      timeout: 3000
    });
  } finally {
    loadingHide();
  }
}

// 加载特殊统计数据
async function loadSpecialStats() {
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
  } catch (error) {
    console.error('加载特殊统计失败:', error)
    throw error
  }
}



// 监听日期变更：刷新所有数据
watch(selectedDate, async () => {
  await refreshAllData()
})

// 组件挂载时初始化
onMounted(async () => {
  // 使用统一的数据刷新入口函数
  await refreshAllData()
  console.log('日期变更，已刷新数据', paymentData.value)

})

async function test1() {
  const content = await shiftHandoverStore.fetchSpecialStats('2025-08-26');
  console.log('测试按钮被点击', content.data);
}

</script>

<style scoped>
.shift-handover {
  background-color: #f5f5f5;
  min-height: 100vh;
}

.shift-handover-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
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
