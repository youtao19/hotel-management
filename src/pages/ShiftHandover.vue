<template>
  <q-page class="shift-handover">
    <div class="q-pa-md">
      <div class="row q-col-gutter-md">
        <!-- 收款明细表区域 -->
        <div class="col-md-8 col-xs-12">
          <q-card>
            <q-card-section class="bg-secondary text-white">
              <div class="row items-center justify-between">
                <div class="text-h6">
                  <q-icon name="receipt_long" class="q-mr-xs" />
                  收款明细表
                  <q-tooltip class="bg-white text-primary" anchor="bottom left" self="top left">
                    <div class="text-body2">
                      <strong>客房住宿</strong>：跨日期订单或房价>150元<br/>
                      <strong>休息房</strong>：当日订单且房价≤150元
                    </div>
                  </q-tooltip>
                </div>
                <q-btn-toggle
                  v-model="roomType"
                  :options="[
                    {label: '客房住宿', value: 'hotel'},
                    {label: '休息房', value: 'rest'}
                  ]"
                  color="white"
                  text-color="primary"
                  toggle-color="primary"
                  size="sm"
                  @update:model-value="switchRoomType"
                />
              </div>
            </q-card-section>

            <!-- 日期选择和筛选区域 -->
            <q-card-section class="bg-grey-1">
              <div class="row q-col-gutter-md items-center">
                <div class="col-md-4 col-xs-12">
                  <q-input
                    v-model="selectedDate"
                    filled
                    label="查看日期"
                    mask="####-##-##"
                    dense
                  >
                    <template v-slot:append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                          <q-date
                            v-model="selectedDate"
                            @update:model-value="loadReceiptsByDate"
                          >
                            <div class="row items-center justify-end">
                              <q-btn v-close-popup label="确定" color="primary" flat />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
                <div class="col-md-5 col-xs-12">
                  <div class="row q-gutter-sm">
                    <q-btn
                      color="primary"
                      icon="today"
                      label="今天"
                      size="sm"
                      @click="setToday"
                      :disable="loading"
                    />
                    <q-btn
                      color="secondary"
                      icon="skip_previous"
                      label="昨天"
                      size="sm"
                      @click="setYesterday"
                      :disable="loading"
                    />
                    <q-btn
                      color="accent"
                      icon="date_range"
                      label="本周"
                      size="sm"
                      @click="setThisWeek"
                      :disable="loading"
                    />
                    <q-btn
                      color="orange"
                      icon="calendar_month"
                      label="本月"
                      size="sm"
                      @click="setThisMonth"
                      :disable="loading"
                    />
                  </div>
                </div>
                <div class="col-md-3 col-xs-12 text-right">
                  <q-chip
                    :color="isToday ? 'positive' : 'info'"
                    text-color="white"
                    icon="date_range"
                  >
                    {{ formatDisplayDate(selectedDate) }}
                  </q-chip>
                </div>
              </div>
            </q-card-section>

            <!-- 明细表格 -->
            <q-card-section class="q-pa-none">
              <q-table
                :rows="receiptDetails"
                :columns="receiptColumns"
                row-key="id"
                :loading="loading"
                :pagination="pagination"
                dense
                flat
                bordered
              >
                <!-- 自定义支付方式列 -->
                <template v-slot:body-cell-paymentMethod="props">
                  <q-td :props="props">
                    <q-chip
                      :color="getPaymentMethodColor(props.value)"
                      text-color="white"
                      dense
                      size="sm"
                    >
                      {{ props.value }}
                    </q-chip>
                  </q-td>
                </template>

                <!-- 自定义金额列 -->
                <template v-slot:body-cell-roomFee="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-medium">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <template v-slot:body-cell-deposit="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-medium">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <template v-slot:body-cell-totalAmount="props">
                  <q-td :props="props" class="text-right">
                    <span class="text-weight-bold text-primary">¥{{ props.value.toFixed(2) }}</span>
                  </q-td>
                </template>

                <!-- 底部汇总行 -->
                <template v-slot:bottom>
                  <div class="full-width q-pa-md bg-grey-1">
                    <div class="row q-col-gutter-md">
                      <div class="col-md-6 col-xs-12">
                        <div class="text-subtitle2 q-mb-sm">按支付方式统计：</div>
                        <div class="row q-col-gutter-xs">
                          <div v-for="(amount, method) in paymentSummary" :key="method" class="col-auto">
                            <q-chip
                              :color="getPaymentMethodColor(method)"
                              text-color="white"
                              size="sm"
                            >
                              {{ method }}：¥{{ amount.toFixed(2) }}
                            </q-chip>
                          </div>
                        </div>
                      </div>
                      <div class="col-md-6 col-xs-12 text-right">
                        <div class="text-subtitle2">总计：<span class="text-h6 text-primary">¥{{ totalAmount.toFixed(2) }}</span></div>
                        <div class="text-caption text-grey-7">共 {{ receiptDetails.length }} 条记录</div>
                      </div>
                    </div>
                  </div>
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

            <q-card-section class="q-pa-none">
              <!-- 收入统计 -->
              <q-list bordered separator>
                <q-item-label header class="text-weight-bold bg-blue-1">收入统计</q-item-label>

                <q-item>
                  <q-item-section>
                    <q-item-label>备用金</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.reserveCash"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>客房住宿收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-positive">¥{{ statistics.hotelIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>休息房收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-weight-bold text-positive">¥{{ statistics.restIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>租车收入</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.carRentalIncome"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item class="bg-amber-1">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">合计</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-h6 text-positive">¥{{ statistics.totalIncome.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>

                <q-item-label header class="text-weight-bold bg-orange-1">退押统计</q-item-label>

                <q-item>
                  <q-item-section>
                    <q-item-label>客房退押</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.hotelDeposit"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>休息退押</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.restDeposit"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-item-label>留存款</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-input
                      v-model.number="statistics.retainedAmount"
                      type="number"
                      dense
                      filled
                      prefix="¥"
                      class="text-right"
                      style="width: 100px"
                      @update:model-value="updateStatistics"
                    />
                  </q-item-section>
                </q-item>

                <q-item class="bg-green-1">
                  <q-item-section>
                    <q-item-label class="text-weight-bold">交接款</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-h6 text-green-8">¥{{ statistics.handoverAmount.toFixed(2) }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>

              <!-- 特殊统计项 -->
              <div class="q-pa-md">
                <div class="text-subtitle2 q-mb-sm">特殊统计</div>
                <div class="row q-col-gutter-sm">
                  <div class="col-6">
                    <q-card class="bg-green-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">好评</div>
                        <q-input
                          v-model.number="statistics.goodReviews"
                          type="number"
                          dense
                          borderless
                          class="text-center text-h6"
                        />
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-blue-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">大美卡</div>
                        <q-input
                          v-model.number="statistics.vipCards"
                          type="number"
                          dense
                          borderless
                          class="text-center text-h6"
                        />
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-purple-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">开房</div>
                        <div class="text-h6">{{ statistics.totalRooms }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                  <div class="col-6">
                    <q-card class="bg-orange-1 text-center">
                      <q-card-section class="q-pa-sm">
                        <div class="text-caption">休息房</div>
                        <div class="text-h6">{{ statistics.restRooms }}</div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { date } from 'quasar'
import { useQuasar } from 'quasar'
import api from '../api/index.js'

const $q = useQuasar()

// 基础数据
const currentDate = computed(() => {
  return date.formatDate(new Date(), 'YYYY年MM月DD日')
})

const getCurrentDayOfWeek = () => {
  const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return days[new Date().getDay()]
}

const shiftTime = ref(date.formatDate(new Date(), 'HH:mm'))
const roomType = ref('hotel')
const loading = ref(false)
const selectedDate = ref(date.formatDate(new Date(), 'YYYY-MM-DD'))

// 分页设置
const pagination = ref({
  rowsPerPage: 0 // 显示所有行
})

// 明细表格列定义
const receiptColumns = [
  { name: 'roomNumber', label: '房号', field: 'room_number', align: 'center', style: 'width: 80px' },
  { name: 'guestName', label: '客户姓名', field: 'guest_name', align: 'center', style: 'width: 100px' },
  { name: 'orderNumber', label: '单号', field: 'order_number', align: 'left', style: 'width: 120px' },
  { name: 'roomFee', label: '房费', field: 'room_fee', align: 'right', style: 'width: 100px' },
  { name: 'deposit', label: '押金', field: 'deposit', align: 'right', style: 'width: 100px' },
  { name: 'paymentMethod', label: '支付方式', field: 'payment_method', align: 'center', style: 'width: 100px' },
  { name: 'totalAmount', label: '总额', field: 'total_amount', align: 'right', style: 'width: 120px' },
  { name: 'checkInTime', label: '开房时间', field: 'check_in_date', align: 'center', style: 'width: 140px' },
  { name: 'checkOutTime', label: '退房时间', field: 'check_out_date', align: 'center', style: 'width: 140px' }
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
  vipCards: 0,
  totalRooms: 0,
  restRooms: 0
})

// 计算属性
const totalAmount = computed(() => {
  return receiptDetails.value.reduce((sum, item) => sum + (item.total_amount || 0), 0)
})

const paymentSummary = computed(() => {
  const summary = {}
  receiptDetails.value.forEach(item => {
    const method = item.payment_method || '现金'
    summary[method] = (summary[method] || 0) + (item.total_amount || 0)
  })
  return summary
})

const isToday = computed(() => {
  return selectedDate.value === date.formatDate(new Date(), 'YYYY-MM-DD')
})

// 监听统计数据变化
watch(statistics, () => {
  updateHandoverAmount()
}, { deep: true })

// 获取支付方式对应的颜色
function getPaymentMethodColor(method) {
  const colors = {
    '现金': 'green',
    '微信': 'green-7',
    '支付宝': 'blue',
    '银行卡': 'purple',
    '其他': 'grey'
  }
  return colors[method] || 'grey'
}

// 更新交接款金额
function updateHandoverAmount() {
  statistics.value.totalIncome =
    statistics.value.hotelIncome +
    statistics.value.restIncome +
    statistics.value.carRentalIncome +
    statistics.value.reserveCash

  statistics.value.handoverAmount =
    statistics.value.totalIncome -
    statistics.value.hotelDeposit -
    statistics.value.restDeposit -
    statistics.value.retainedAmount
}

// 更新统计数据
function updateStatistics() {
  updateHandoverAmount()
}

// 切换房间类型
async function switchRoomType(type, customStartDate = null, customEndDate = null) {
  loading.value = true
  try {
    // 确定查询的日期范围
    let startDate, endDate

    if (customStartDate && customEndDate) {
      // 使用自定义日期范围
      startDate = customStartDate
      endDate = customEndDate
    } else {
      // 使用选中的日期（单天查询）
      try {
        const formattedDate = date.formatDate(new Date(selectedDate.value), 'YYYY-MM-DD')
        startDate = endDate = formattedDate
      } catch (e) {
        // 如果日期无效，使用今天的日期
        const today = date.formatDate(new Date(), 'YYYY-MM-DD')
        selectedDate.value = today
        startDate = endDate = today
      }
    }

    console.log('🔍 交接班明细查询调试信息:')
    console.log('查询类型:', type)
    console.log('查询开始日期:', startDate)
    console.log('查询结束日期:', endDate)
    console.log('是否为范围查询:', startDate !== endDate)

    const response = await api.get('/shift-handover/receipts', {
      params: {
        type: type,
        startDate: startDate,
        endDate: endDate
      }
    })

    console.log('📊 API返回的原始数据:', response)
    console.log('📊 返回数据数量:', response?.length || 0)

    if (response && response.length > 0) {
      console.log('📋 第一条订单示例:', response[0])
    } else {
      console.log('❌ 未获取到任何明细数据')

      // 调试：检查今天是否有订单数据
      try {
        const debugResponse = await api.get('/orders')
        console.log('🔍 /orders API原始返回:', debugResponse)
        console.log('🔍 返回数据类型:', typeof debugResponse)
        console.log('🔍 是否为数组:', Array.isArray(debugResponse))

        // 处理不同的数据结构
        let orders = []
        if (Array.isArray(debugResponse)) {
          orders = debugResponse
        } else if (debugResponse && debugResponse.data && Array.isArray(debugResponse.data)) {
          orders = debugResponse.data
        } else if (debugResponse && debugResponse.orders && Array.isArray(debugResponse.orders)) {
          orders = debugResponse.orders
        } else {
          console.log('🚫 无法识别的订单数据结构')
          return
        }

        console.log('🔍 订单总数:', orders.length)

        if (orders.length > 0) {
          console.log('📋 第一条订单示例:', orders[0])
          console.log('📋 订单字段列表:', Object.keys(orders[0]))

          // 查找指定日期范围内的订单
          const rangeOrders = orders.filter(order => {
            // 尝试不同的日期字段
            const createTime = order.createTime || order.create_time || order.created_at || order.createdAt
            if (!createTime) {
              console.log('⚠️ 订单缺少创建时间字段:', order)
              return false
            }

            try {
              const orderDate = date.formatDate(new Date(createTime), 'YYYY-MM-DD')
              return orderDate >= startDate && orderDate <= endDate
            } catch (e) {
              console.log('⚠️ 日期解析失败:', createTime, e)
              return false
            }
          })

          console.log(`🔍 ${startDate === endDate ? '当天' : '日期范围内'}创建的订单数量:`, rangeOrders.length)
          console.log(`🔍 ${startDate === endDate ? '当天' : '日期范围内'}的订单:`, rangeOrders)

          if (rangeOrders.length > 0) {
              console.log(`📋 ${startDate === endDate ? '当天' : '日期范围内'}订单状态分布:`,
                rangeOrders.reduce((acc, order) => {
                  const status = order.status || '未知状态'
                  acc[status] = (acc[status] || 0) + 1
                  return acc
                }, {})
              )

              // 详细检查每个订单的关键字段
              console.log(`📋 ${startDate === endDate ? '当天' : '日期范围内'}订单详细信息:`)
              rangeOrders.forEach((order, index) => {
                console.log(`   订单${index + 1}:`, {
                  id: order.id || order.order_id,
                  guest_name: order.guest_name,
                  status: order.status,
                  create_time: order.create_time || order.createTime,
                  room_number: order.room_number,
                  room_price: order.room_price,
                  check_in_date: order.check_in_date,
                  check_out_date: order.check_out_date
                })
              })

            // 检查符合明细表条件的订单
            const validOrders = rangeOrders.filter(order => {
              const status = order.status
              return status === 'checked_in' || status === 'checked_out' || status === 'completed' ||
                     status === 'checked-in' || status === 'checked-out'
            })
            console.log('🔍 符合明细表条件的订单数量:', validOrders.length)
            console.log('🔍 符合条件的订单:', validOrders)

            if (validOrders.length === 0) {
              console.log('❌ 没有找到符合明细表条件的订单')
              console.log('💡 可能的原因：')
              console.log('   1. 订单状态不是 checked_in、checked_out、completed、checked-in 或 checked-out')
              console.log('   2. 订单还在 pending、confirmed 等状态')
              console.log('   3. 需要手动执行入住/退房操作')

              // 输出所有状态以便分析
              const allStatuses = rangeOrders.map(order => order.status).filter(Boolean)
              console.log(`📋 ${startDate === endDate ? '当天' : '日期范围内'}所有订单的状态:`, [...new Set(allStatuses)])
              console.log('💡 状态格式说明: 后端已兼容 checked-out 和 checked_out 两种格式')
            } else {
              console.log('✅ 找到符合条件的订单，应该显示在明细表中')
            }
          }
        }
      } catch (debugError) {
        console.log('🚫 无法获取调试订单数据:', debugError)
      }

      // 调试：检查明细表API的查询条件
      console.log('🔍 明细表API查询参数:')
      console.log('   - type:', type)
      console.log('   - startDate:', startDate)
      console.log('   - endDate:', endDate)
      console.log('   - 完整URL:', `/api/shift-handover/receipts?type=${type}&startDate=${startDate}&endDate=${endDate}`)
    }

    receiptDetails.value = response.map(item => ({
      ...item,
      room_fee: parseFloat(item.room_fee || 0),
      deposit: parseFloat(item.deposit || 0),
      total_amount: parseFloat(item.total_amount || 0),
      guest_name: item.guest_name || '未知客户',
      check_in_date: item.check_in_date ? date.formatDate(new Date(item.check_in_date), 'MM-DD HH:mm') : '',
      check_out_date: item.check_out_date ? date.formatDate(new Date(item.check_out_date), 'MM-DD HH:mm') : ''
    }))

    await loadStatistics(customStartDate, customEndDate)
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

// 加载统计数据
async function loadStatistics(customStartDate = null, customEndDate = null) {
  try {
    // 确定查询的日期范围
    let startDate, endDate

    if (customStartDate && customEndDate) {
      // 使用自定义日期范围
      startDate = customStartDate
      endDate = customEndDate
    } else {
      // 使用选中的日期（单天查询）
      try {
        const formattedDate = date.formatDate(new Date(selectedDate.value), 'YYYY-MM-DD')
        startDate = endDate = formattedDate
      } catch (e) {
        // 如果日期无效，使用今天的日期
        const today = date.formatDate(new Date(), 'YYYY-MM-DD')
        selectedDate.value = today
        startDate = endDate = today
      }
    }

    const response = await api.get('/shift-handover/statistics', {
      params: {
        startDate: startDate,
        endDate: endDate
      }
    })

    // 合并统计数据，保留用户输入的值
    const currentReserveCash = statistics.value.reserveCash
    const currentCarRentalIncome = statistics.value.carRentalIncome
    const currentHotelDeposit = statistics.value.hotelDeposit
    const currentRestDeposit = statistics.value.restDeposit
    const currentRetainedAmount = statistics.value.retainedAmount
    const currentGoodReviews = statistics.value.goodReviews
    const currentVipCards = statistics.value.vipCards

    Object.assign(statistics.value, {
      ...response,
      reserveCash: currentReserveCash,
      carRentalIncome: currentCarRentalIncome,
      hotelDeposit: currentHotelDeposit,
      restDeposit: currentRestDeposit,
      retainedAmount: currentRetainedAmount,
      goodReviews: currentGoodReviews,
      vipCards: currentVipCards
    })

    updateHandoverAmount()
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 打印交接单
function printHandover() {
  // 创建打印样式
  const printStyles = `
    <style>
      @media print {
        body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; }
        .print-header { text-align: center; margin-bottom: 20px; }
        .print-title { font-size: 18px; font-weight: bold; }
        .print-date { font-size: 14px; margin-top: 5px; }
        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        .print-table th, .print-table td { border: 1px solid #000; padding: 5px; text-align: center; }
        .print-table th { background-color: #f0f0f0; }
        .print-summary { display: flex; justify-content: space-between; }
        .print-section { margin-bottom: 15px; }
        .print-section h3 { margin: 0 0 10px 0; font-size: 14px; }
        @page { margin: 15mm; }
      }
    </style>
  `

  // 生成打印内容
  const printContent = `
    ${printStyles}
    <div class="print-header">
      <div class="print-title">交接班记录单</div>
      <div class="print-date">${currentDate.value}</div>
    </div>

    <div class="print-section">
      <h3>${roomType.value === 'hotel' ? '客房住宿' : '休息房'}收款明细</h3>
      <table class="print-table">
        <thead>
          <tr>
            <th>房号</th>
            <th>客户姓名</th>
            <th>单号</th>
            <th>房费</th>
            <th>押金</th>
            <th>支付方式</th>
            <th>总额</th>
            <th>开房时间</th>
            <th>退房时间</th>
          </tr>
        </thead>
        <tbody>
          ${receiptDetails.value.map(item => `
            <tr>
              <td>${item.room_number}</td>
              <td>${item.guest_name || '未知客户'}</td>
              <td>${item.order_number}</td>
              <td>¥${(item.room_fee || 0).toFixed(2)}</td>
              <td>¥${(item.deposit || 0).toFixed(2)}</td>
              <td>${item.payment_method}</td>
              <td>¥${(item.total_amount || 0).toFixed(2)}</td>
              <td>${item.check_in_date}</td>
              <td>${item.check_out_date}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="print-summary">
      <div class="print-section">
        <h3>统计信息</h3>
        <div>备用金：¥${statistics.value.reserveCash.toFixed(2)}</div>
        <div>客房收入：¥${statistics.value.hotelIncome.toFixed(2)}</div>
        <div>休息房收入：¥${statistics.value.restIncome.toFixed(2)}</div>
        <div>租车收入：¥${statistics.value.carRentalIncome.toFixed(2)}</div>
        <div><strong>合计：¥${statistics.value.totalIncome.toFixed(2)}</strong></div>
        <div>客房退押：¥${statistics.value.hotelDeposit.toFixed(2)}</div>
        <div>休息退押：¥${statistics.value.restDeposit.toFixed(2)}</div>
        <div>留存款：¥${statistics.value.retainedAmount.toFixed(2)}</div>
        <div><strong>交接款：¥${statistics.value.handoverAmount.toFixed(2)}</strong></div>
      </div>

      <div class="print-section">
        <h3>特殊统计</h3>
        <div>好评：${statistics.value.goodReviews}</div>
        <div>大美卡：${statistics.value.vipCards}</div>
        <div>开房数：${statistics.value.totalRooms}</div>
        <div>休息房数：${statistics.value.restRooms}</div>
      </div>
    </div>
  `

  // 打开新窗口并打印
  const printWindow = window.open('', '_blank')
  printWindow.document.write(printContent)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}

// 导出Excel
async function exportToExcel() {
  try {
    const response = await api.post('/shift-handover/export', {
      type: roomType.value,
      details: receiptDetails.value,
      statistics: statistics.value,
      date: date.formatDate(new Date(), 'YYYY-MM-DD')
    }, {
      responseType: 'blob'
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `交接班记录_${date.formatDate(new Date(), 'YYYY-MM-DD')}.xlsx`)
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

// 按指定日期加载收款明细
async function loadReceiptsByDate(dateValue) {
  if (!dateValue) return

  // 确保日期格式正确并更新selectedDate
  let formattedDate
  try {
    formattedDate = date.formatDate(new Date(dateValue), 'YYYY-MM-DD')
    selectedDate.value = formattedDate
  } catch (e) {
    console.error('日期格式错误:', dateValue, e)
    $q.notify({
      type: 'negative',
      message: '日期格式无效'
    })
    return
  }

  loading.value = true
  try {
    await switchRoomType(roomType.value)

    $q.notify({
      type: 'positive',
      message: `已加载 ${formatDisplayDate(formattedDate)} 的收款明细`,
      timeout: 1500
    })
  } catch (error) {
    console.error('获取指定日期明细失败:', error)
    $q.notify({
      type: 'negative',
      message: '获取指定日期明细失败'
    })
  } finally {
    loading.value = false
  }
}

// 设置今天
function setToday() {
  selectedDate.value = date.formatDate(new Date(), 'YYYY-MM-DD')
  loadReceiptsByDate(selectedDate.value)
}

// 设置昨天
function setYesterday() {
  const yesterday = date.subtractFromDate(new Date(), { days: 1 })
  selectedDate.value = date.formatDate(yesterday, 'YYYY-MM-DD')
  loadReceiptsByDate(selectedDate.value)
}

// 设置本周第一天（周一）
function setThisWeek() {
  const today = new Date()
  const startOfWeek = date.startOfDate(today, 'week')
  const endOfWeek = date.endOfDate(today, 'week')

  // 设置显示日期为本周第一天
  selectedDate.value = date.formatDate(startOfWeek, 'YYYY-MM-DD')

  // 查询整周的数据
  const startDate = date.formatDate(startOfWeek, 'YYYY-MM-DD')
  const endDate = date.formatDate(endOfWeek, 'YYYY-MM-DD')

  console.log('📅 查询本周数据:', startDate, '到', endDate)

  loading.value = true
  switchRoomType(roomType.value, startDate, endDate).finally(() => {
    loading.value = false
  })

  $q.notify({
    type: 'positive',
    message: `已加载本周(${date.formatDate(startOfWeek, 'MM月DD日')} - ${date.formatDate(endOfWeek, 'MM月DD日')})的收款明细`,
    timeout: 2000
  })
}

// 设置本月第一天
function setThisMonth() {
  const today = new Date()
  const startOfMonth = date.startOfDate(today, 'month')
  const endOfMonth = date.endOfDate(today, 'month')

  // 设置显示日期为本月第一天
  selectedDate.value = date.formatDate(startOfMonth, 'YYYY-MM-DD')

  // 但查询整个月的数据
  const startDate = date.formatDate(startOfMonth, 'YYYY-MM-DD')
  const endDate = date.formatDate(endOfMonth, 'YYYY-MM-DD')

  console.log('📅 查询本月数据:', startDate, '到', endDate)

  loading.value = true
  switchRoomType(roomType.value, startDate, endDate).finally(() => {
    loading.value = false
  })

  $q.notify({
    type: 'positive',
    message: `已加载本月(${date.formatDate(startOfMonth, 'MM月DD日')} - ${date.formatDate(endOfMonth, 'MM月DD日')})的收款明细`,
    timeout: 2000
  })
}

// 格式化显示日期
function formatDisplayDate(dateStr) {
  if (!dateStr) return ''
  try {
    const targetDate = new Date(dateStr)
    const today = new Date()
    const yesterday = date.subtractFromDate(today, { days: 1 })

    if (date.formatDate(targetDate, 'YYYY-MM-DD') === date.formatDate(today, 'YYYY-MM-DD')) {
      return '今天'
    } else if (date.formatDate(targetDate, 'YYYY-MM-DD') === date.formatDate(yesterday, 'YYYY-MM-DD')) {
      return '昨天'
    } else {
      return date.formatDate(targetDate, 'MM月DD日')
    }
  } catch (e) {
    return dateStr
  }
}

// 组件挂载时初始化
onMounted(async () => {
  await switchRoomType(roomType.value)
})
</script>
