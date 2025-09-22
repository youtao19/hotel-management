<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <!-- 标题和操作区域 -->
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h4 text-weight-bold">交接班</div>
        <div class="row q-gutter-md">
          <q-btn label="使用计算结果" color="orange" @click="loadComputedPaymentData" />
          <q-btn color="primary" icon="print" label="打印" @click="printHandover" />
          <q-btn color="green" icon="download" label="导出Excel" @click="exportToExcel" />
          <q-btn color="blue" icon="start" label="开始交接班" @click="startHandover" />
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
          :read-only="true"
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
              @update:vip-cards="v => vipCards = Number(v) || 0"
              @update:good-review="v => goodReview = v"
              @save-vip-cards="handleVipCardSave"
            />
          </div>
        </div>
      </div>
    </div>


  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
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

const paymentData = ref({}) // 交接班支付数据
const isRefreshing = ref(false) // 防止重入标志

// 备忘录列表相关
const newTaskTitle = ref('')
const taskList = ref([])

// 页面状态
const hasChanges = ref(false) // 用于追踪数据是否有变更

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(Number(6))

// VipCard回车键自动保存函数
async function handleVipCardSave(value) {
  try {
    console.log('VipCard回车键触发自动保存，值:', value)

    if (!selectedDate.value) {
      $q.notify({
        type: 'negative',
        message: '请先选择日期',
        position: 'top',
        timeout: 2000
      })
      return
    }

    // 更新本地vipCards值
    vipCards.value = Number(value) || 0

    // 调用保存API，只保存vipCard
    const saveData = {
      date: selectedDate.value,
      vipCards: vipCards.value,
      taskList: taskList.value || []
    }

    const response = await shiftHandoverApi.saveAmountChanges(saveData)

    if (response.success) {
      $q.notify({
        type: 'positive',
        message: `大美卡已自动保存: ${vipCards.value}`,
        position: 'top',
        timeout: 2000
      })
      console.log('VipCard自动保存成功:', response)
    } else {
      throw new Error(response.message || '保存失败')
    }

  } catch (error) {
    console.error('VipCard自动保存失败:', error)
    $q.notify({
      type: 'negative',
      message: `保存失败: ${error.message}`,
      position: 'top',
      timeout: 3000
    })
  }
}

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

// 计算前一天日期（YYYY-MM-DD）
function getPrevDateStr(ymd) {
  try {
    if (!ymd) return ''
    const d = new Date(ymd)
    d.setDate(d.getDate() - 1)
    return date.formatDate(d, 'YYYY-MM-DD')
  } catch (_) {
    return ''
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
async function addNewTask() {
  if (!newTaskTitle.value.trim()) return

  const newTask = {
    id: Date.now(),
    title: newTaskTitle.value.trim(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    completed: false
  }

  // 添加到本地列表
  taskList.value.push(newTask)
  const memoContent = newTaskTitle.value.trim()
  newTaskTitle.value = ''

  // 自动保存到交接班表（支付方式1）
  try {
    const saveResult = await shiftHandoverApi.saveAdminMemo({
      date: selectedDate.value,
      memo: memoContent
    })

    if (saveResult.success) {
      $q.notify({
        type: 'positive',
        message: '备忘录已自动保存到交接班表',
        position: 'top',
        timeout: 2000
      })
      console.log('备忘录自动保存成功:', saveResult)
    } else {
      throw new Error(saveResult.message || '保存失败')
    }
  } catch (error) {
    console.error('自动保存备忘录失败:', error)
    $q.notify({
      type: 'warning',
      message: '备忘录添加成功，但自动保存失败',
      caption: error.message || '请手动保存页面数据',
      position: 'top',
      timeout: 3000
    })
  }
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
    console.log('开始加载备忘录数据...')

    // 1. 加载订单备注
    console.log('调用 fetchRemarks API...')
    const remarksRes = await shiftHandoverStore.fetchRemarks(selectedDate.value)
    console.log('fetchRemarks API 返回:', remarksRes)

    // 2. 加载管理员备忘录
    console.log('调用 getAdminMemos API...')
    const adminMemosRes = await shiftHandoverApi.getAdminMemos({ date: selectedDate.value })
    console.log('getAdminMemos API 返回:', adminMemosRes)

    // 处理订单备注
    let orderRemarks = []
    if (Array.isArray(remarksRes)) orderRemarks = remarksRes
    else if (Array.isArray(remarksRes?.data)) orderRemarks = remarksRes.data
    else if (Array.isArray(remarksRes?.data?.data)) orderRemarks = remarksRes.data.data
    else if (Array.isArray(remarksRes?.rows)) orderRemarks = remarksRes.rows
    else if (Array.isArray(remarksRes?.data?.rows)) orderRemarks = remarksRes.data.rows
    else if (Array.isArray(remarksRes?.list)) orderRemarks = remarksRes.list
    else if (Array.isArray(remarksRes?.data?.list)) orderRemarks = remarksRes.data.list

    // 处理管理员备忘录
    let adminMemos = []
    if (Array.isArray(adminMemosRes?.data)) {
      adminMemos = adminMemosRes.data
    } else if (Array.isArray(adminMemosRes)) {
      adminMemos = adminMemosRes
    }

    // 格式化订单备注
    const formattedOrderRemarks = orderRemarks.map((r, idx) => {
      const room = r?.room_number || '未知房间'
      const remarkText = r?.remarks || '无备注'
      const rawTime = r?.time || r?.created_at || r?.create_time || r?.createdAt || r?.updatedAt
      const timeStr = rawTime
        ? new Date(rawTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

      return {
        id: `order-${r.order_id}-${r.remarks ? r.remarks.replace(/\s/g, '_') : 'no_remark'}-${idx}`,
        title: `房间号：${room}，备注：${remarkText}`,
        time: timeStr,
        completed: false,
        type: 'order', // 标识为订单备注
        raw: r
      }
    })

    // 格式化管理员备忘录（保持原有格式）
    const formattedAdminMemos = adminMemos.map((memo) => ({
      id: memo.id,
      title: memo.title,
      time: memo.time,
      completed: memo.completed,
      type: 'admin' // 标识为管理员备忘录
    }))

    // 合并所有备忘录，先显示管理员备忘录，再显示订单备注
    const allMemos = [...formattedAdminMemos, ...formattedOrderRemarks]

    // 过滤掉可能重复的项
    const existingTaskIds = new Set(taskList.value.map(task => task.id));
    const newMemos = allMemos.filter(memo => !existingTaskIds.has(memo.id));

    // 如果是首次加载或者没有现有任务，则直接设置
    if (taskList.value.length === 0) {
      taskList.value = allMemos
      console.log('首次加载备忘录，共', allMemos.length, '条（管理员:', formattedAdminMemos.length, '条，订单:', formattedOrderRemarks.length, '条）')
    } else {
      // 否则只添加新的备忘录
      taskList.value = [...taskList.value, ...newMemos]
      console.log('增量加载备忘录，新增', newMemos.length, '条')
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
});


// 刷新所有数据（带loading状态）
async function refreshAllData() {
  if (isRefreshing.value) {
    console.log('正在刷新中，跳过重复调用')
    return
  }
  try {
    isRefreshing.value = true
    loadingShow({ message: '加载数据中...' });
    await refreshAllDataInternal();
  } catch (error) {
    console.error('刷新数据失败:', error);
    $q.notify({
      type: 'negative',
      message: '刷新数据失败',
      caption: error.message,
      timeout: 3000
    });
  } finally {
    isRefreshing.value = false
    loadingHide();
  }
}

// 内部刷新数据（不带loading状态）
async function refreshAllDataInternal() {
  console.log('开始加载特殊统计...')
  // 加载特殊统计 (确保 specialStats 总是最新的)
  await loadSpecialStats();
  console.log('特殊统计加载完成')

  console.log('开始加载备忘录...')
  // 加载订单备注到备忘录
  await loadRemarksIntoMemo();
  console.log('备忘录加载完成')

  console.log('开始加载支付数据...')
  // 加载支付数据
  await loadPaymentDataInternal()
  console.log('支付数据加载完成')
}

// 加载特殊统计数据
async function loadSpecialStats() {
  try {
    console.log('调用 fetchSpecialStats API...')
    const res = await shiftHandoverStore.fetchSpecialStats(selectedDate.value)
    console.log('fetchSpecialStats API 返回:', res)
    const data = res?.data || res

    if (data) {
      const openCount = data.openCount ?? data.totalRooms ?? data.open ?? 0
      const restCount = data.restCount ?? data.restRooms ?? data.rest ?? 0
      const invited = data.invited ?? data.invite ?? 0
      const positive = data.positive ?? data.good ?? 0

      totalRooms.value = Number(openCount) || 0
      restRooms.value = Number(restCount) || 0
      goodReview.value = `邀${invited}得${positive}`
      console.log('特殊统计数据设置完成')
    }
  } catch (error) {
    console.error('加载特殊统计失败:', error)
    throw error
  }
}


// 直接调用计算接口并显示数据
async function loadComputedPaymentData() {
  try {
    loadingShow({ message: '加载计算结果...' })
    await loadComputedPaymentDataInternal()
    $q.notify({ type: 'positive', message: '已显示计算结果' })
  } catch (error) {
    console.error('加载计算结果失败:', error)
    $q.notify({ type: 'negative', message: '加载计算结果失败' })
  } finally {
    loadingHide()
  }
}

async function loadComputedPaymentDataInternal() {
  const res = await shiftHandoverStore.fetchShiftTable(selectedDate.value)
  const data = res?.data || res
  paymentData.value = data

  // 即使使用计算数据，也尝试加载已保存的vipCard数据
  try {
    console.log('尝试加载已保存的vipCard数据...')
    const handoverResponse = await shiftHandoverStore.fetchHandoverTableData(selectedDate.value)
    if (handoverResponse.success && handoverResponse.data && typeof handoverResponse.data.vipCards !== 'undefined') {
      vipCards.value = Number(handoverResponse.data.vipCards) || 0
      console.log('从保存的数据中加载vipCards:', vipCards.value)
    } else {
      console.log('没有找到已保存的vipCard数据，使用默认值')
    }
  } catch (error) {
    console.warn('加载vipCard数据失败，使用默认值:', error)
  }
}

async function loadPaymentData() {
  try {
    loadingShow({ message: '加载支付数据...' })
    await loadPaymentDataInternal()
  } catch (error) {
    console.error('加载支付数据失败:', error)
    $q.notify({ type: 'negative', message: '加载支付数据失败' })
  } finally {
    loadingHide()
  }
}

async function loadPaymentDataInternal() {
  console.log('获取可用日期列表...')
  const datesResponse = await shiftHandoverStore.fetchAvailableDates()
  const dates = datesResponse.success ? datesResponse.data : []
  console.log('可用日期:', dates, '当前日期:', selectedDate.value)

  if (selectedDate.value && dates.includes(selectedDate.value.toString())) {
    console.log('使用已保存的交接班数据')
    const response = await shiftHandoverStore.fetchHandoverTableData(selectedDate.value)
    if (response.success) {
      paymentData.value = response.data

      // 处理vipCards数据
      if (response.data && typeof response.data.vipCards !== 'undefined') {
        vipCards.value = Number(response.data.vipCards) || 0
        console.log('从交接班数据中加载vipCards:', vipCards.value)
      }

      console.log('加载交接班数据完成')
    } else {
      throw new Error(response.message || '获取交接班数据失败')
    }
  } else {
    console.log('!!!!!使用计算结果')
    await loadComputedPaymentDataInternal()
    console.log('加载计算结果完成')
  }
}

// 监听日期变更：刷新所有数据
watch(selectedDate, async () => {
  if (!isRefreshing.value) {
    await refreshAllData()
  }
})

// 组件挂载时初始化
onMounted(async () => {
  // 使用统一的数据刷新入口函数
  await refreshAllData()
  // await loadPaymentData()
  console.log('日期变更，已刷新数据', paymentData.value)
})

// 开始交接班
async function startHandover() {
  try {
    // 数据验证
    if (!selectedDate.value) {
      throw new Error('请选择交接班日期')
    }

    if (!paymentData.value || Object.keys(paymentData.value).length === 0) {
      throw new Error('支付数据为空，请先加载数据')
    }

    loadingShow({ message: '开始交接班中...' });

    const handoverData = {
      date: selectedDate.value,
      handoverPerson: handoverPerson.value || '',
      receivePerson: receivePerson.value || '',
      cashierName: cashierName.value || '',
      notes: notes.value || '',
      paymentData: JSON.parse(JSON.stringify(paymentData.value)),
      vipCard: vipCards.value || 0,
    }

    console.log('开始交接班数据', handoverData)

    const res = await shiftHandoverStore.startHandover(handoverData)
    console.log('开始交接班成功:', res)

    $q.notify({
      type: 'positive',
      message: '交接班成功！',
      caption: '数据已保存到数据库',
      position: 'top',
      timeout: 3000
    })

    console.log('开始刷新数据...')
    await refreshAllDataInternal()
    console.log('数据刷新完成')

  } catch (error) {
    console.error('开始交接班失败:', error)

    let errorMessage = '开始交接班失败'
    let errorCaption = '请检查数据后重试'

    if (error.response?.data?.message) {
      errorCaption = error.response.data.message
    } else if (error.message) {
      errorCaption = error.message
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      caption: errorCaption,
      position: 'top',
      timeout: 5000
    })
  } finally {
    loadingHide();
  }
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
