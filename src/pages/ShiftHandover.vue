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
          <q-input v-model="selectedDate" type="date" label="交接日期" filled @update:model-value="loadShiftData" />
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

const $q = useQuasar()

// 基础数据
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))
const handoverPerson = ref('')
const receivePerson = ref('')
const cashierName = ref('张')
const notes = ref('')
const savingAmounts = ref(false)
const goodReview = ref('邀1得1')

// 备忘录列表相关
const newTaskTitle = ref('')
const taskList = ref([])

// 历史记录组件引用
const historyDialogRef = ref(null)





// 支付方式数据结构
const paymentData = ref({
  cash: { // 现金行
    reserveCash: 320, // 默认备用金（会根据前一天的留存款更新）
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 320,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 320 // 现金行默认留存款为320
  },
  wechat: { // 微信行
    reserveCash: 0, // 默认为0（会根据前一天的交接款更新）
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  digital: { // 数码付行
    reserveCash: 0, // 默认为0（会根据前一天的交接款更新）
    hotelIncome: 0,
    restIncome: 0,
    carRentIncome: 0,
    total: 0,
    hotelDeposit: 0,
    restDeposit: 0,
    retainedAmount: 0
  },
  other: { // 其他行
    reserveCash: 0, // 默认为0（会根据前一天的交接款更新）
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

// 特殊统计
const totalRooms = ref(29)
const restRooms = ref(3)
const vipCards = ref(6)





// 加载数据
async function loadShiftData() {
  try {
    console.log('开始加载交接班数据，日期:', selectedDate.value)

    // 获取统计数据、收款明细和前一天的交接班记录
    const [statisticsResponse, receiptsResponse, previousHandoverResponse] = await Promise.all([
      shiftHandoverApi.getStatistics({
        date: selectedDate.value
      }),
      shiftHandoverApi.getReceiptDetails({
        date: selectedDate.value
      }),
      shiftHandoverApi.getPreviousHandoverData({
        date: selectedDate.value
      }).catch(error => {
        console.error('获取前一天交接班记录失败:', error)
        return null
      })
    ])

    console.log('API响应数据:', {
      statisticsResponse: statisticsResponse ? '已获取' : '未获取',
      receiptsResponse: receiptsResponse ? `获取了${receiptsResponse.length || 0}条记录` : '未获取',
      previousHandoverResponse: previousHandoverResponse ? `ID=${previousHandoverResponse.id || '未知'}` : '未获取'
    })

    if (previousHandoverResponse) {
      console.log('交接班记录详情:', {
        id: previousHandoverResponse.id,
        date: previousHandoverResponse.shift_date,
        isCurrentDay: previousHandoverResponse.isCurrentDay || false,
        hasPaymentData: !!previousHandoverResponse.paymentData,
        hasDetailsPaymentData: !!(previousHandoverResponse.details && previousHandoverResponse.details.paymentData),
        cashRetainedAmount: previousHandoverResponse.paymentData?.cash?.retainedAmount ||
                           previousHandoverResponse.details?.paymentData?.cash?.retainedAmount || 'undefined'
      })
    }

    if (statisticsResponse) {
      // 更新支付数据
      updatePaymentData(statisticsResponse, receiptsResponse, previousHandoverResponse)
    }

  } catch (error) {
    console.error('加载数据失败:', error)

    // 即使出错，也要尝试加载当天的统计数据
    try {
      const statisticsResponse = await shiftHandoverApi.getStatistics({
        date: selectedDate.value
      })
      if (statisticsResponse) {
        updatePaymentData(statisticsResponse, null, null)
      } else {
        // 如果统计数据也获取失败，至少保持默认的备用金设置
        console.log('统计数据获取失败，保持默认设置')
        // 不调用 updatePaymentData，保持初始的默认值
        calculateTotals()
      }
    } catch (fallbackError) {
      console.error('备用加载失败:', fallbackError)
      // 保持默认设置，不重置数据
      console.log('保持默认的支付数据设置')
      calculateTotals()
    }

    $q.notify({
      type: 'negative',
      message: '加载数据失败，已使用默认备用金'
    })
  }
}

// 更新支付数据
function updatePaymentData(statistics, receipts, previousHandover) {
  console.log('🔄 开始更新支付数据...')

  // 检查当天是否有已保存的数据（来自"保存金额"或"保存交接记录"）
  const todaysSavedPaymentData = previousHandover && previousHandover.isCurrentDay
    ? (previousHandover.details && previousHandover.details.paymentData) || previousHandover.paymentData
    : null

  if (todaysSavedPaymentData) {
    console.log('🔄 发现当天已保存的数据，恢复支付数据')
    console.log('📋 当天保存的完整数据:', previousHandover.details)
    const savedPaymentData = todaysSavedPaymentData

    // 直接恢复已保存的支付数据
    Object.keys(savedPaymentData).forEach(paymentType => {
      if (paymentData.value[paymentType]) {
        paymentData.value[paymentType] = {
          ...paymentData.value[paymentType],
          ...savedPaymentData[paymentType]
        }
      }
    })

    // 恢复其他页面信息
    if (previousHandover.details) {
      const details = previousHandover.details
      console.log('📋 恢复页面数据:', details)

      // 恢复基本信息
      if (details.notes) {
        notes.value = details.notes
        console.log('📝 恢复备注:', details.notes)
      }
      if (details.handoverPerson) {
        handoverPerson.value = details.handoverPerson
        console.log('👤 恢复交接人:', details.handoverPerson)
      }
      if (details.receivePerson) {
        receivePerson.value = details.receivePerson
        console.log('👤 恢复接收人:', details.receivePerson)
      }
      if (details.cashierName) {
        cashierName.value = details.cashierName
        console.log('👤 恢复收银员:', details.cashierName)
      }

      // 恢复备忘录
      if (details.taskList && Array.isArray(details.taskList)) {
        taskList.value = details.taskList
        console.log('📋 恢复备忘录:', details.taskList.length, '条')
      }

      // 恢复特殊统计数据
      if (details.specialStats) {
        const stats = details.specialStats
        console.log('📊 恢复特殊统计:', stats)
        if (stats.totalRooms !== undefined) {
          totalRooms.value = stats.totalRooms
          console.log('🏠 恢复开房数:', stats.totalRooms)
        }
        if (stats.restRooms !== undefined) {
          restRooms.value = stats.restRooms
          console.log('🛏️ 恢复休息房数:', stats.restRooms)
        }
        if (stats.vipCards !== undefined) {
          vipCards.value = stats.vipCards
          console.log('💳 恢复大美卡:', stats.vipCards)
        }
        if (stats.goodReview !== undefined) {
          goodReview.value = stats.goodReview
          console.log('⭐ 恢复好评:', stats.goodReview)
        }
      }
    }

    // 🔒 恢复数据时，只有在用户没有手动设置过现金备用金的情况下才强制设置为320
    // 如果用户已经保存了自定义的现金备用金，则保持用户的设置
    if (!savedPaymentData.cash || savedPaymentData.cash.reserveCash === undefined || savedPaymentData.cash.reserveCash === null) {
      console.log('🔧 用户未设置现金备用金，使用默认值320')
      paymentData.value.cash.reserveCash = 320
    } else {
      console.log('✅ 保持用户设置的现金备用金:', savedPaymentData.cash.reserveCash)
    }

    // 🔒 对于现金留存款，只有在用户没有手动设置过的情况下才强制设置为320
    if (!savedPaymentData.cash || savedPaymentData.cash.retainedAmount === undefined || savedPaymentData.cash.retainedAmount === null) {
      console.log('🔧 用户未设置现金留存款，使用默认值320')
      paymentData.value.cash.retainedAmount = 320
    } else {
      console.log('✅ 保持用户设置的现金留存款:', savedPaymentData.cash.retainedAmount)
    }

    calculateTotals()

    $q.notify({
      type: 'positive',
      message: '已恢复当天保存的交接班数据',
      caption: `记录ID: ${previousHandover.id}`,
      timeout: 3000
    })

    return // 直接返回，不执行下面的统计数据更新逻辑
  }

  // 只有在有统计数据时才重置支付数据，否则保持当前状态
  if (statistics) {
    resetPaymentData()
    console.log('📝 已重置支付数据，现金备用金:', paymentData.value.cash.reserveCash)
  } else {
    console.log('📝 无统计数据，保持当前支付数据状态')
  }

  // 保存前一天的备用金数据，稍后设置
  let correctReserveCash = {
    cash: 320,
    wechat: 0,
    digital: 0,
    other: 0
  }

  // 先解析前一天的交接班记录，保存正确的备用金值
  if (previousHandover) {
    const prevPaymentData = previousHandover.paymentData ||
                           (previousHandover.details && previousHandover.details.paymentData) ||
                           null
    console.log('📊 解析前一天交接班记录:', prevPaymentData)

    if (prevPaymentData && prevPaymentData.cash) {
      // 🔒 现金留存款应该始终是320，不管数据库中存储的是什么
      correctReserveCash.cash = 320
      console.log(`💰 现金备用金强制设置为: 320 (现金留存款固定值)`)

      // 如果数据库中的值不是320，记录警告
      const rawRetainedAmount = prevPaymentData.cash.retainedAmount
      if (rawRetainedAmount && Number(rawRetainedAmount) !== 320) {
        console.warn(`⚠️ 数据库中的留存款是 ${rawRetainedAmount}，但应该是320`)
      }
    }

    // 其他支付方式的备用金计算
    if (prevPaymentData && prevPaymentData.wechat) {
      const wechatHandover = (prevPaymentData.wechat.total || 0) -
                            (prevPaymentData.wechat.hotelDeposit || 0) -
                            (prevPaymentData.wechat.restDeposit || 0) -
                            (prevPaymentData.wechat.retainedAmount || 0)
      correctReserveCash.wechat = Math.max(0, wechatHandover)
    }

    if (prevPaymentData && prevPaymentData.digital) {
      const digitalHandover = (prevPaymentData.digital.total || 0) -
                             (prevPaymentData.digital.hotelDeposit || 0) -
                             (prevPaymentData.digital.restDeposit || 0) -
                             (prevPaymentData.digital.retainedAmount || 0)
      correctReserveCash.digital = Math.max(0, digitalHandover)
    }

    if (prevPaymentData && prevPaymentData.other) {
      const otherHandover = (prevPaymentData.other.total || 0) -
                           (prevPaymentData.other.hotelDeposit || 0) -
                           (prevPaymentData.other.restDeposit || 0) -
                           (prevPaymentData.other.retainedAmount || 0)
      correctReserveCash.other = Math.max(0, otherHandover)
    }
  }

  console.log('💰 计算得到的正确备用金:', correctReserveCash)

  // 从统计数据更新基础信息
  if (statistics) {
    // 更新房间统计
    if (statistics.totalRooms) totalRooms.value = statistics.totalRooms
    if (statistics.restRooms) restRooms.value = statistics.restRooms
    if (statistics.vipCards) vipCards.value = statistics.vipCards

    // 优先使用后端返回的paymentDetails
    if (statistics.paymentDetails) {
      // 现金
      if (statistics.paymentDetails['现金']) {
        const cashData = statistics.paymentDetails['现金']
        paymentData.value.cash.hotelIncome = Math.round(cashData.hotelIncome || 0)
        paymentData.value.cash.restIncome = Math.round(cashData.restIncome || 0)
        paymentData.value.cash.hotelDeposit = Math.round(cashData.hotelDeposit || 0)
        paymentData.value.cash.restDeposit = Math.round(cashData.restDeposit || 0)
      }

      // 微信
      if (statistics.paymentDetails['微信']) {
        const wechatData = statistics.paymentDetails['微信']
        paymentData.value.wechat.hotelIncome = Math.round(wechatData.hotelIncome || 0)
        paymentData.value.wechat.restIncome = Math.round(wechatData.restIncome || 0)
        paymentData.value.wechat.hotelDeposit = Math.round(wechatData.hotelDeposit || 0)
        paymentData.value.wechat.restDeposit = Math.round(wechatData.restDeposit || 0)
      }

      // 支付宝/微邮付
      if (statistics.paymentDetails['支付宝']) {
        const alipayData = statistics.paymentDetails['支付宝']
        paymentData.value.digital.hotelIncome = Math.round(alipayData.hotelIncome || 0)
        paymentData.value.digital.restIncome = Math.round(alipayData.restIncome || 0)
        paymentData.value.digital.hotelDeposit = Math.round(alipayData.hotelDeposit || 0)
        paymentData.value.digital.restDeposit = Math.round(alipayData.restDeposit || 0)
      }

      // 其他方式（银行卡等）
      const bankData = statistics.paymentDetails['银行卡'] || { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }
      const otherData = statistics.paymentDetails['其他'] || { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }

      paymentData.value.other.hotelIncome = Math.round((bankData.hotelIncome || 0) + (otherData.hotelIncome || 0))
      paymentData.value.other.restIncome = Math.round((bankData.restIncome || 0) + (otherData.restIncome || 0))
      paymentData.value.other.hotelDeposit = Math.round((bankData.hotelDeposit || 0) + (otherData.hotelDeposit || 0))
      paymentData.value.other.restDeposit = Math.round((bankData.restDeposit || 0) + (otherData.restDeposit || 0))

    } else if (receipts && Array.isArray(receipts)) {
      // 如果后端没有返回paymentDetails，使用收款明细数据进行精确分类

      const paymentStats = {
        '现金': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '微信': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '支付宝': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '银行卡': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 },
        '其他': { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }
      }

      // 处理收款明细
      receipts.forEach(receipt => {
        const paymentMethod = receipt.payment_method || '现金'
        const businessType = receipt.business_type || 'hotel'
        const totalAmount = Number(receipt.total_amount || 0) // 总收入（房费+押金）
        const refundedDeposit = 0 // 收款明细中暂时无法获取退押金信息，设为0

        // 确保支付方式存在
        if (!paymentStats[paymentMethod]) {
          paymentStats[paymentMethod] = { hotelIncome: 0, restIncome: 0, hotelDeposit: 0, restDeposit: 0 }
        }

        // 按业务类型分类 - 收入是总收入（房费+押金），退押金另算
        if (businessType === 'hotel') {
          paymentStats[paymentMethod].hotelIncome += totalAmount // 总收入（房费+押金）
          paymentStats[paymentMethod].hotelDeposit += refundedDeposit // 退还的押金
        } else if (businessType === 'rest') {
          paymentStats[paymentMethod].restIncome += totalAmount // 总收入（房费+押金）
          paymentStats[paymentMethod].restDeposit += refundedDeposit // 退还的押金
        }
      })

      // 更新前端数据
      // 现金
      if (paymentStats['现金']) {
        paymentData.value.cash.hotelIncome = Math.round(paymentStats['现金'].hotelIncome)
        paymentData.value.cash.restIncome = Math.round(paymentStats['现金'].restIncome)
        paymentData.value.cash.hotelDeposit = Math.round(paymentStats['现金'].hotelDeposit)
        paymentData.value.cash.restDeposit = Math.round(paymentStats['现金'].restDeposit)
      }

      // 微信
      if (paymentStats['微信']) {
        paymentData.value.wechat.hotelIncome = Math.round(paymentStats['微信'].hotelIncome)
        paymentData.value.wechat.restIncome = Math.round(paymentStats['微信'].restIncome)
        paymentData.value.wechat.hotelDeposit = Math.round(paymentStats['微信'].hotelDeposit)
        paymentData.value.wechat.restDeposit = Math.round(paymentStats['微信'].restDeposit)
      }

      // 支付宝/微邮付
      if (paymentStats['支付宝']) {
        paymentData.value.digital.hotelIncome = Math.round(paymentStats['支付宝'].hotelIncome)
        paymentData.value.digital.restIncome = Math.round(paymentStats['支付宝'].restIncome)
        paymentData.value.digital.hotelDeposit = Math.round(paymentStats['支付宝'].hotelDeposit)
        paymentData.value.digital.restDeposit = Math.round(paymentStats['支付宝'].restDeposit)
      }

      // 其他方式（银行卡等）
      const otherStats = {
        hotelIncome: (paymentStats['银行卡']?.hotelIncome || 0) + (paymentStats['其他']?.hotelIncome || 0),
        restIncome: (paymentStats['银行卡']?.restIncome || 0) + (paymentStats['其他']?.restIncome || 0),
        hotelDeposit: (paymentStats['银行卡']?.hotelDeposit || 0) + (paymentStats['其他']?.hotelDeposit || 0),
        restDeposit: (paymentStats['银行卡']?.restDeposit || 0) + (paymentStats['其他']?.restDeposit || 0)
      }

      paymentData.value.other.hotelIncome = Math.round(otherStats.hotelIncome)
      paymentData.value.other.restIncome = Math.round(otherStats.restIncome)
      paymentData.value.other.hotelDeposit = Math.round(otherStats.hotelDeposit)
      paymentData.value.other.restDeposit = Math.round(otherStats.restDeposit)

    } else if (statistics.paymentBreakdown) {
      // 如果没有明细数据，使用统计数据的分解（兜底方案）
      const totalIncome = statistics.totalIncome || 1

      // 现金 - 使用新的逻辑：收入是总收入，退押金是实际退还金额
      if (statistics.paymentBreakdown['现金']) {
        const cashRatio = statistics.paymentBreakdown['现金'] / totalIncome
        paymentData.value.cash.hotelIncome = Math.round((statistics.hotelIncome || 0) * cashRatio) // 总收入按比例分配
        paymentData.value.cash.restIncome = Math.round((statistics.restIncome || 0) * cashRatio)
        paymentData.value.cash.hotelDeposit = Math.round((statistics.hotelDeposit || 0) * cashRatio) // 退押金按比例分配
        paymentData.value.cash.restDeposit = Math.round((statistics.restDeposit || 0) * cashRatio)
      }

      // 微信
      if (statistics.paymentBreakdown['微信']) {
        const wechatRatio = statistics.paymentBreakdown['微信'] / totalIncome
        paymentData.value.wechat.hotelIncome = Math.round((statistics.hotelIncome || 0) * wechatRatio)
        paymentData.value.wechat.restIncome = Math.round((statistics.restIncome || 0) * wechatRatio)
        paymentData.value.wechat.hotelDeposit = Math.round((statistics.hotelDeposit || 0) * wechatRatio)
        paymentData.value.wechat.restDeposit = Math.round((statistics.restDeposit || 0) * wechatRatio)
      }

      // 支付宝
      if (statistics.paymentBreakdown['支付宝']) {
        const alipayRatio = statistics.paymentBreakdown['支付宝'] / totalIncome
        paymentData.value.digital.hotelIncome = Math.round((statistics.hotelIncome || 0) * alipayRatio)
        paymentData.value.digital.restIncome = Math.round((statistics.restIncome || 0) * alipayRatio)
        paymentData.value.digital.hotelDeposit = Math.round((statistics.hotelDeposit || 0) * alipayRatio)
        paymentData.value.digital.restDeposit = Math.round((statistics.restDeposit || 0) * alipayRatio)
      }

      // 其他方式
      const otherTotal = (statistics.paymentBreakdown['银行卡'] || 0) + (statistics.paymentBreakdown['其他'] || 0)
      if (otherTotal > 0) {
        const otherRatio = otherTotal / totalIncome
        paymentData.value.other.hotelIncome = Math.round((statistics.hotelIncome || 0) * otherRatio)
        paymentData.value.other.restIncome = Math.round((statistics.restIncome || 0) * otherRatio)
        paymentData.value.other.hotelDeposit = Math.round((statistics.hotelDeposit || 0) * otherRatio)
        paymentData.value.other.restDeposit = Math.round((statistics.restDeposit || 0) * otherRatio)
      }
    }
  }

  // 🎯 最后设置正确的备用金（这样不会被其他操作覆盖）
  console.log('🎯 最后设置正确的备用金...')
  paymentData.value.cash.reserveCash = correctReserveCash.cash
  paymentData.value.wechat.reserveCash = correctReserveCash.wechat
  paymentData.value.digital.reserveCash = correctReserveCash.digital
  paymentData.value.other.reserveCash = correctReserveCash.other

  // 🔒 强制设置现金留存款为320（固定值）
  paymentData.value.cash.retainedAmount = 320

  console.log('✅ 备用金和留存款设置完成:', {
    现金备用金: paymentData.value.cash.reserveCash,
    现金留存款: paymentData.value.cash.retainedAmount,
    微信: paymentData.value.wechat.reserveCash,
    微邮付: paymentData.value.digital.reserveCash,
    其他: paymentData.value.other.reserveCash
  })

  calculateTotals()
}

// 重置支付数据（但保留已设置的备用金）
function resetPaymentData() {
  Object.keys(paymentData.value).forEach(paymentType => {
    const payment = paymentData.value[paymentType]

    // 备用金设置默认值
    // 现金默认备用金为320，其他为0
    if (paymentType === 'cash') {
      payment.reserveCash = 320
    } else {
      payment.reserveCash = 0
    }

    // 留存款只对现金默认设置为320（固定值）
    if (paymentType === 'cash') {
      payment.retainedAmount = 320  // 现金留存款固定为320
    } else {
      payment.retainedAmount = 0
    }

    // 清空其他数据
    payment.hotelIncome = 0
    payment.restIncome = 0
    payment.carRentIncome = 0
    payment.hotelDeposit = 0
    payment.restDeposit = 0
    // total会在calculateTotals中重新计算
  })

  console.log('重置支付数据完成，设置默认值:')
  console.log('- 现金备用金:', paymentData.value.cash.reserveCash)
  console.log('- 现金留存款:', paymentData.value.cash.retainedAmount)

  // 重置后立即计算总计
  calculateTotals()
}



// 保存交接记录
async function saveHandover() {
  try {
    // 调试：保存前检查备用金
    console.log('保存前的现金备用金:', paymentData.value.cash.reserveCash)
    console.log('保存前的现金留存款:', paymentData.value.cash.retainedAmount)

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

    console.log('即将保存的支付数据:', handoverData.paymentData.cash)

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

    console.log('保存页面数据:', pageData)

    // 调用保存API端点
    const result = await shiftHandoverApi.saveAmountChanges(pageData)

    $q.notify({
      type: 'positive',
      message: '页面数据保存成功',
      caption: '所有数据已保存到数据库',
      position: 'top',
      timeout: 3000
    })

    console.log('页面数据保存成功:', result)

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

function deleteTask(index) {
  taskList.value.splice(index, 1)
}

function editTask(index) {
  // 可以扩展为内联编辑功能
  const task = taskList.value[index]
  const newTitle = prompt('编辑备忘录:', task.title)
  if (newTitle && newTitle.trim()) {
    task.title = newTitle.trim()
  }
}

function updateTaskStatus(taskId, completed) {
  const task = taskList.value.find(t => t.id === taskId)
  if (task) {
    task.completed = completed
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
  console.log('历史记录对话框已关闭')
}



// 监听支付数据变化
watch(paymentData, () => {
  calculateTotals()
}, { deep: true })



// 组件挂载时初始化
onMounted(async () => {
  await loadShiftData()
  // 确保总计正确计算
  calculateTotals()
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
