<template>
  <!-- 整个创建订单页面的主容器，使用q-page组件 -->
  <q-page class="check-in">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-md">创建订单</h1>
    <!-- 主卡片容器，包含整个表单 -->
    <q-card>
      <q-card-section>
        <!-- 创建订单表单，使用Quasar的q-form组件 -->
        <q-form @submit="submitOrder" class="q-gutter-md">

          <!-- 订单信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">订单信息</div>
            <div class="row q-col-gutter-md">
              <!-- 订单号输入框 -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.orderNumber" label="订单号" filled :rules="[val => !!val || '请输入订单号']"
                  hint="自动生成，可手动修改" />
              </div>
              <!-- 订单状态选择框 -->
              <div class="col-md-4 col-xs-12">
                <q-select v-model="orderData.status" :options="statusOptions" label="订单状态" filled emit-value map-options
                  :rules="[val => !!val || '请选择订单状态']" />
              </div>
              <!-- 订单来源选择框 -->
              <div class="col-md-4 col-xs-12">
                <q-select v-model="orderData.source" :options="sourceOptions" label="订单来源" filled emit-value
                  map-options />
              </div>
              <!-- 来源编号输入框 -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.sourceNumber" label="来源编号" filled hint="OTA订单号/旅行社单号等" />
              </div>
            </div>
          </div>

          <!-- 客人信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">客人信息</div>
            <div class="row q-col-gutter-md">
              <!-- 姓名输入框 -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.guestName" label="姓名" filled :rules="[val => !!val || '请输入姓名']" />
              </div>
              <!-- 手机号输入框（可选） -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.phone" label="手机号（可选）" filled mask="###########"
                  hint="选填，用于联系客人" />
              </div>
            </div>
          </div>

          <!-- 入住信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">入住时间</div>
            <div class="row q-col-gutter-md">
              <!-- 入住日期输入 -->
              <div class="col-md-4 col-xs-12">
                <q-input
                  v-model="orderData.checkInDate"
                  label="入住日期"
                  filled
                  clearable
                  placeholder="YYYY-MM-DD"
                  :rules="[dateRule]"
                  @blur="() => normalizeInputDate('checkInDate')"
                  @keyup.enter="() => normalizeInputDate('checkInDate')"
                  @update:model-value="onCheckInDateChange"
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date
                          v-model="orderData.checkInDate"
                          :options="d => d >= minDate"
                          @update:model-value="val => { normalizeInputDate('checkInDate'); onCheckInDateChange(); }"
                          :locale="langZhCn.date"
                        >
                          <div class="row items-center justify-end q-pa-sm">
                            <q-btn label="确定" color="primary" flat v-close-popup />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <!-- 离店日期输入 -->
              <div class="col-md-4 col-xs-12">
                <q-input
                  v-model="orderData.checkOutDate"
                  label="离店日期"
                  filled
                  clearable
                  placeholder="YYYY-MM-DD"
                  :rules="[dateRule, checkoutAfterCheckinRule]"
                  @blur="() => normalizeInputDate('checkOutDate')"
                  @keyup.enter="() => normalizeInputDate('checkOutDate')"
                  @update:model-value="onCheckOutDateChange"
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date
                          v-model="orderData.checkOutDate"
                          :options="d => !isValidFullDate(orderData.checkInDate) || d >= orderData.checkInDate"
                          @update:model-value="val => { normalizeInputDate('checkOutDate'); onCheckOutDateChange(); }"
                          :locale="langZhCn.date"
                        >
                          <div class="row items-center justify-end q-pa-sm">
                            <q-btn label="确定" color="primary" flat v-close-popup />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>

              <!-- 休息房/住宿类型提示 -->
              <div class="col-12 q-mt-md" v-if="orderData.checkInDate && orderData.checkOutDate">
                <div class="row items-center">
                  <div class="col-auto">
                    <q-chip
                      :color="isRestRoom ? 'orange' : 'blue'"
                      text-color="white"
                      :icon="isRestRoom ? 'hotel' : 'calendar_month'"
                      :label="isRestRoom ? '休息房' : '住宿'"
                    />
                  </div>
                  <div class="col-auto q-ml-sm text-caption text-grey-6" v-if="isRestRoom">
                    当日入住，当日离店
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 房间信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">房间信息</div>

            <div class="row q-col-gutter-md">
              <!-- 房间类型选择 -->
              <div class="col-md-4 col-xs-12">
                <q-select
                  v-model="orderData.roomType"
                  :options="roomTypeOptionsWithCount"
                  label="房间类型"
                  filled
                  emit-value
                  map-options
                  @update:model-value="onRoomTypeChange"
                  :rules="[val => !!val || '请选择房间类型']"
                  :hint="orderData.roomType ? `剩余 ${availableRoomCount} 间可用` : ''"
                >
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                      </q-item-section>
                      <q-item-section side>
                        <q-badge :color="getRoomCountColor(scope.opt.availableCount)"
                          :label="scope.opt.availableCount + '间'" />
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>

              <!-- 房间号选择 -->
              <div class="col-md-4 col-xs-12">
                <q-select
                  v-model="orderData.roomNumber"
                  :options="availableRoomOptions"
                  label="房间号"
                  filled
                  emit-value
                  map-options
                  :rules="[val => !!val || '请选择房间号']"
                  :disable="!orderData.roomType"
                >
                  <!-- 自定义选项显示 -->
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                      </q-item-section>
                      <q-item-section side v-if="scope.opt.status === 'cleaning'">
                        <q-chip size="sm" color="orange" text-color="white" icon="cleaning_services">
                          清扫中
                        </q-chip>
                      </q-item-section>
                    </q-item>
                  </template>
                  <!-- 没有可用房间时显示的内容 -->
                  <template v-slot:no-option>
                    <q-item>
                      <q-item-section class="text-negative">
                        <q-icon name="warning" color="negative" />
                        当前没有可用的{{ orderData.roomType ? viewStore.getRoomTypeName(orderData.roomType) : '房间' }}
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>
            </div>
          </div>

          <!-- 支付信息部分 -->
          <div class="form-section q-mb-md">
            <!-- 分区标题 -->
            <div class="text-subtitle1 q-mb-sm">支付信息</div>
            <div class="row q-col-gutter-md">
              <!-- 价格设置区域（统一处理单日和多日） -->
              <div class="col-12">
                <div class="simple-pricing-container">
                  <!-- 标题和操作区（仅多日显示） -->
                  <div class="row items-center q-mb-md" v-if="isMultiDay">
                    <div class="col-auto">
                      <span class="text-subtitle2 text-grey-8">
                        每日房间价格设置 (共 {{ dateList.length }} 天)
                      </span>
                    </div>
                    <div class="col-auto q-ml-sm">
                      <q-btn
                        flat
                        dense
                        color="orange"
                        label="应用首日价格"
                        @click="applyFirstDayPriceToAll"
                        :disable="!firstDatePrice"
                        class="simple-btn"
                      />
                    </div>
                  </div>

                  <!-- 总价输入框（仅多日显示） -->
                  <div class="row q-mb-md" v-if="isMultiDay">
                    <div class="col-md-4 col-xs-12">
                      <q-input
                        v-model.number="totalPriceInput"
                        label="住宿总价"
                        filled
                        type="number"
                        prefix="¥"
                        hint="输入总价后自动平均分配"
                        @update:model-value="distributeTotalPrice"
                        class="simple-input"
                      >
                        <template v-slot:append>
                          <q-icon name="calculate" color="primary" />
                        </template>
                      </q-input>
                    </div>
                  </div>

                  <!-- 每日价格输入列表（单日和多日统一） -->
                  <div class="row q-col-gutter-md">
                    <div
                      v-for="(date, index) in dateList"
                      :key="date"
                      :class="dateList.length === 1 ? 'col-md-4 col-xs-12' : 'col-md-3 col-sm-4 col-xs-6'"
                    >
                      <q-input
                        v-model.number="dailyPrices[date]"
                        :label="dateList.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : formatDateLabel(date)"
                        filled
                        type="number"
                        prefix="¥"
                        :rules="[val => val > 0 || '价格必须大于0']"
                        :hint="dateList.length === 1 ? (isRestRoom ? '当日入住，当日离店' : '单日住宿') : ''"
                        class="simple-input"
                        @update:model-value="updateTotalFromDaily"
                      />
                    </div>

                    <!-- 支付方式（紧跟在价格后面） -->
                    <div :class="dateList.length === 1 ? 'col-md-4 col-xs-12' : 'col-md-3 col-sm-4 col-xs-6'">
                      <q-select
                        v-model="orderData.paymentMethod"
                        :options="viewStore.paymentMethodOptions"
                        label="支付方式"
                        filled
                        :rules="[val => !!val || '请选择支付方式']"
                        class="simple-input"
                      />
                    </div>
                  </div>

                  <!-- 预收房费选项 -->
                  <div class="row q-col-gutter-md q-mt-md">
                    <div class="col-md-4 col-xs-12">
                      <div class="text-body2 text-grey-7 q-mb-xs">当前是否收房费</div>
                      <q-option-group
                        v-model="orderData.isPrepaid"
                        :options="prepayOptions"
                        type="radio"
                        inline
                        color="primary"
                      />
                    </div>
                    <div class="col-md-4 col-xs-12" v-if="orderData.isPrepaid">
                      <q-input
                        v-model.number="orderData.prepaidAmount"
                        label="已收房费金额"
                        filled
                        type="number"
                        prefix="¥"
                        :rules="[val => val > 0 || '金额必须大于0']"
                        hint="请输入已收取的房费金额"
                      />
                    </div>
                  </div>

                  <!-- 总计显示（仅多日显示） -->
                  <div class="row q-mt-md" v-if="isMultiDay">
                    <div class="col-12">
                      <div class="total-display">
                        <span class="text-grey-7">住宿总价：</span>
                        <span class="text-h6 text-primary q-ml-sm">¥{{ totalPrice.toFixed(2) }}</span>
                        <span class="text-caption text-grey-6 q-ml-md">平均 ¥{{ averageDailyPrice.toFixed(2) }}/天</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 备注信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">备注信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-md-12 col-xs-12">
                <q-input v-model="orderData.remarks" label="备注" filled type="textarea" autogrow />
              </div>
            </div>
          </div>

          <!-- 底部按钮区域 -->
          <div class="row justify-end q-mt-md">
            <!-- 取消按钮，返回首页 -->
            <q-btn label="取消" flat class="q-mr-sm" to="/" />
            <!-- 提交按钮，触发表单提交 -->
            <q-btn label="确认创建" type="submit" color="primary" />
          </div>

        </q-form>
      </q-card-section>
    </q-card>
    </div>

    <!-- 入住确认对话框 -->
    <CheckInConfirmDialog
      v-model="showCheckInDialog"
      :order="pendingCheckInOrder"
      :get-room-type-name="viewStore.getRoomTypeName"
      :get-payment-method-name="getPaymentMethodName"
      :format-date="formatDateForDialog"
      @confirm="handleCheckInConfirm"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { date, useQuasar } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import Decimal from 'decimal.js'
import { useOrderStore } from '../stores/orderStore' // 导入订单 store
import { useRoomStore } from '../stores/roomStore' // 导入房间 store
import { useViewStore } from '../stores/viewStore' // 导入视图 store
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包
import CheckInConfirmDialog from '../components/CheckInConfirmDialog.vue' // 导入入住确认对话框

// 获取路由和store
const router = useRouter()
const route = useRoute()
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const $q = useQuasar() // For notifications

const prepayOptions = [
  { label: '否', value: false },
  { label: '是', value: true }
]

// 规范化路由查询参数，支持数组与空值
function normalizeQueryParam(param) {
  if (Array.isArray(param)) {
    param = param[0]
  }
  if (param === undefined || param === null) {
    return null
  }
  const str = String(param).trim()
  return str === '' ? null : str
}

// 路由传递的待预选房间信息
const pendingRouteSelection = ref({
  roomNumber: normalizeQueryParam(route.query.roomNumber),
  roomType: normalizeQueryParam(route.query.roomType)
})

const isDataInitialized = ref(false)
let suppressRoomTypeWatcher = false
let isApplyingPreselectedRoom = false
let shouldAutoSelectRoom = false
let pendingRoomTypeChange = null

// 检查是否为开发环境
const isDev = ref(process.env.NODE_ENV === 'development')

// roomStore 已导入，可以直接使用其方法

const availableRoomsByDate = ref([]); // 存储当前时间范围下所有可用房间

// 入住确认对话框控制
const showCheckInDialog = ref(false)
const pendingCheckInOrder = ref(null) // 待办理入住的订单数据

/**
 * 生成唯一的订单号
 * 格式：O + 年月日 + 4位随机数
 * @returns {string} 生成的订单号
 */
function generateOrderNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `O${year}${month}${day}${random}`
}

/**
 * 获取当前时间，精确到分钟（秒和毫秒为0）
 * @returns {Date} 当前时间（精确到分钟）
 */
function getCurrentTimeToMinute() {
  const now = new Date()
  // 重置秒和毫秒
  now.setSeconds(0)
  now.setMilliseconds(0)
  return now
}

// 今天的日期字符串，格式为YYYY-MM-DD
const today = date.formatDate(new Date(), 'YYYY-MM-DD')

// 订单状态选项数组 - 从viewStore获取
const statusOptions = [
  { label: '所有状态', value: 'all' },
  { label: '待入住', value: 'pending' },
  { label: '已入住', value: 'checked-in' }
]

// 订单来源选项数组
const sourceOptions = [
  { label: '前台录入', value: 'front_desk' },
  { label: '电话预订', value: 'phone' },
  { label: '抖音', value: 'douyin' },
  { label: '美团', value: 'meituan' },
  { label: '携程', value: 'ctrip' },
  { label: '飞猪', value: 'fliggy' },
  { label: '旅行社', value: 'agency' },
  { label: '其他', value: 'other' }
]

// 订单表单数据 - 使用响应式引用，包含所有订单字段
const orderData = ref({
  orderNumber: generateOrderNumber(),  // 自动生成订单号
  status: 'pending',                   // 默认状态为"待入住"
  source: 'front_desk',                // 默认订单来源为前台录入
  sourceNumber: '',                    // 来源编号（可选）
  guestName: '',                       // 客人姓名
  phone: '',                           // 手机号
  roomType: null,                      // 房间类型
  roomNumber: null,                    // 房间号
  checkInDate: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD'),  // 入住日期，默认今天
  checkOutDate: date.formatDate(date.addToDate(getCurrentTimeToMinute(), { days: 1 }), 'YYYY-MM-DD'), // 离店日期，默认明天
  deposit: 0,                          // 押金默认0元，办理入住时才收取
  paymentMethod: viewStore.paymentMethodOptions[0]?.value || 'cash',    // 支付方式使用 value
  roomPrice: 0,                        // 房间价格，会根据选择的房间自动设置
  remarks: '',                         // 备注信息（可选）
  createTime: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD HH:mm:ss'), // 创建时间
  isRestRoom: false,                   // 是否为休息房
  isPrepaid: false,                    // 是否在创建时收房费
  prepaidAmount: 0                     // 预收房费金额
})

// 多日价格管理
const dailyPrices = ref({}) // 存储每日价格 {date: price}
const totalPriceInput = ref(0) // 总价输入

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP
})

function toDecimal(value) {
  if (Decimal.isDecimal(value)) {
    return value
  }
  if (value === undefined || value === null || value === '') {
    return new Decimal(0)
  }
  try {
    return new Decimal(value)
  } catch (error) {
    return new Decimal(0)
  }
}

function toAmountNumber(value) {
  const decimalValue = Decimal.isDecimal(value) ? value : toDecimal(value)
  return Number(decimalValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
}

function calculateAdjustedRoomPrice(rawPrice, restRoomFlag = orderData.value.isRestRoom) {
  const base = toDecimal(rawPrice)
  if (!base.gt(0)) {
    return 0
  }
  const adjusted = restRoomFlag ? base.div(2) : base
  return toAmountNumber(adjusted)
}

// 判断是否为多日订单
const isMultiDay = computed(() => {
  if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(orderData.value.checkOutDate)) return false;
  const checkIn = new Date(orderData.value.checkInDate);
  const checkOut = new Date(orderData.value.checkOutDate);
  const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  console.log('🔍 多日判断：', {
    checkInDate: orderData.value.checkInDate,
    checkOutDate: orderData.value.checkOutDate,
    daysDiff,
    isMultiDay: daysDiff > 1
  });

  return daysDiff > 1; // 超过1天算多日
});

// 生成日期列表（包括单日、休息房和多日）
const dateList = computed(() => {
  if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(orderData.value.checkOutDate)) return [];
  const checkIn = new Date(orderData.value.checkInDate);
  const checkOut = new Date(orderData.value.checkOutDate);
  const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  const dates = [];

  // 休息房（同日入住退房）：只有入住日期
  if (daysDiff === 0) {
    dates.push(date.formatDate(checkIn, 'YYYY-MM-DD'));
    console.log('📅 休息房订单，dateList包含1天');
    return dates;
  }

  // 单日或多日住宿：生成每一晚的日期（不包括退房日期）
  for (let i = 0; i < daysDiff; i++) {
    const currentDate = new Date(checkIn);
    currentDate.setDate(currentDate.getDate() + i);
    dates.push(date.formatDate(currentDate, 'YYYY-MM-DD'));
  }

  console.log(`🗓️ ${daysDiff === 1 ? '单日' : '多日'}订单，dateList包含${dates.length}天`);
  return dates;
});

function sumDailyPricesDecimal() {
  if (!Array.isArray(dateList.value) || dateList.value.length === 0) {
    return new Decimal(0)
  }

  return dateList.value.reduce((sum, currentDate) => {
    const price = dailyPrices.value[currentDate]
    if (price === undefined || price === null || price === '') {
      return sum
    }
    return sum.plus(toDecimal(price))
  }, new Decimal(0))
}

// 首日价格（用于应用到所有天）
const firstDatePrice = computed(() => {
  if (dateList.value.length === 0) return 0;
  return dailyPrices.value[dateList.value[0]] || 0;
});


/**
 * 日期选项函数 - 控制日期选择器可选择的日期
 * 只允许选择今天及以后的日期
 * @param {string} dateStr - 日期字符串，格式为YYYY-MM-DD
 * @returns {boolean} 如果日期可选则返回true，否则返回false
 */
const dateOptions = (dateStr) => {
  const currentDate = date.formatDate(new Date(), 'YYYY-MM-DD')
  return dateStr >= currentDate
}


/**
 * 更新可用房间列表
 */
async function updateAvailableRooms(preserveSelection = true) {
  try {
    if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(orderData.value.checkOutDate)) {
      return;
    }
    // 强制格式化
    const startDate = date.formatDate(orderData.value.checkInDate, 'YYYY-MM-DD');
    const endDate = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD');

    const previousRoomNumber = preserveSelection ? orderData.value.roomNumber : null;

    const rooms = await roomStore.getAvailableRoomsByDate(
      startDate,
      endDate
    );
    availableRoomsByDate.value = rooms;

    if (preserveSelection && previousRoomNumber) {
      const stillAvailable = rooms.some(room => String(room.room_number) === String(previousRoomNumber));
      if (!stillAvailable) {
        orderData.value.roomNumber = null;
        shouldAutoSelectRoom = true;
      }
    } else if (!preserveSelection) {
      orderData.value.roomNumber = null;
      shouldAutoSelectRoom = true;
    } else if (!previousRoomNumber) {
      orderData.value.roomNumber = null;
      shouldAutoSelectRoom = true;
    }

    if (pendingRoomTypeChange && pendingRoomTypeChange === orderData.value.roomType) {
      const roomTypeText = viewStore.getRoomTypeName(orderData.value.roomType);
      const countForType = rooms.filter(room => room.type_code === orderData.value.roomType).length;
      if (countForType === 0) {
        $q.notify({
          type: 'warning',
          message: `当前没有可用的${roomTypeText}，请联系管理员。`,
          position: 'top'
        });
      }
      pendingRoomTypeChange = null;
    } else if (pendingRoomTypeChange) {
      pendingRoomTypeChange = null;
    }

    const canAutoAssign = !isApplyingPreselectedRoom && !pendingRouteSelection.value.roomNumber;
    if (!canAutoAssign) {
      shouldAutoSelectRoom = false;
      return;
    }

    await nextTick();

    if (shouldAutoSelectRoom || !orderData.value.roomNumber) {
      autoSelectFirstAvailableRoom();
      shouldAutoSelectRoom = false;
    }
  } catch (error) {
    console.error('获取可用房间失败:', error);
    $q.notify({
      type: 'negative',
      message: '获取可用房间失败: ' + error.message,
      position: 'top'
    });
  }
}

// 监听日期变化
// 简单防抖
let roomsUpdateTimer = null;
function scheduleUpdateRooms() {
  if (roomsUpdateTimer) clearTimeout(roomsUpdateTimer);
  roomsUpdateTimer = setTimeout(() => {
    updateAvailableRooms();
  }, 250);
}

function isValidFullDate(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y,m,d] = s.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.getFullYear() === y && dt.getMonth() === m-1 && dt.getDate() === d;
}

const minDate = date.formatDate(new Date(), 'YYYY-MM-DD');

function normalizeInputDate(field) {
  let v = orderData.value[field];
  if (!v) return;
  v = String(v).trim().replace(/\//g,'-');
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const mm = m[2].padStart(2,'0');
    const dd = m[3].padStart(2,'0');
    v = `${m[1]}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    orderData.value[field] = v;
  }
  if (field === 'checkOutDate' && isValidFullDate(orderData.value.checkInDate) && isValidFullDate(v) && v < orderData.value.checkInDate) {
    orderData.value.checkOutDate = orderData.value.checkInDate; // auto-fix
  }
}

const dateRule = (val) => {
  if (!val) return '请选择日期';
  const s = String(val).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '格式应为 YYYY-MM-DD';
  return true;
};
const checkoutAfterCheckinRule = (val) => {
  if (!isValidFullDate(orderData.value.checkInDate) || !isValidFullDate(val)) return true;
  return val >= orderData.value.checkInDate || '离店日期不能早于入住日期';
};

// removed old normalizeAndValidate (replaced by normalizeInputDate)

watch(() => orderData.value.checkInDate, async () => {
  if (!isValidFullDate(orderData.value.checkInDate)) return; // 等待完整输入
  scheduleUpdateRooms();

  // 如果有房间选择，重新初始化价格（适用于单日和多日）
  if (orderData.value.roomNumber) {
    const selectedRoom = findAvailableRoomByNumber(orderData.value.roomNumber);
    if (selectedRoom) {
      const finalPrice = calculateAdjustedRoomPrice(selectedRoom.price);
      initializeDailyPrices(finalPrice);
    }
  }
});

watch(() => orderData.value.checkOutDate, async () => {
  if (!isValidFullDate(orderData.value.checkOutDate)) return;
  scheduleUpdateRooms();

  // 如果有房间选择，重新初始化价格（适用于单日和多日）
  if (orderData.value.roomNumber) {
    const selectedRoom = findAvailableRoomByNumber(orderData.value.roomNumber);
    if (selectedRoom) {
      const finalPrice = calculateAdjustedRoomPrice(selectedRoom.price);
      initializeDailyPrices(finalPrice);
    }
  }
});

// 监听房型变化
watch(() => orderData.value.roomType, async () => {
  if (suppressRoomTypeWatcher) {
    return;
  }
  await updateAvailableRooms();
});

/**
 * 计算可用房间的选项
 * 1. 过滤掉空值选项
 * 2. 将每个选项的可用房间数量计算出来
 * @returns {Array} 可用房间选项数组
 */
const roomTypeOptionsWithCount = computed(() => {
  // 优先使用数据库中的房型数据
  if (roomStore.roomTypes && roomStore.roomTypes.length > 0) {
    return roomStore.roomTypes.map(roomType => {
      const availableCount = availableRoomsByDate.value.filter(
        room => room.type_code === roomType.type_code
      ).length;
      return {
        label: roomType.type_name,
        value: roomType.type_code,
        availableCount,
        basePrice: roomType.base_price || 0
      };
    });
  }

  // 如果数据库房型数据未加载，使用viewStore中的备用选项
  const typeOptions = viewStore.roomTypeOptions.filter(option => option.value !== null);
  return typeOptions.map(option => {
    const availableCount = availableRoomsByDate.value.filter(
      room => room.type_code === option.value
    ).length;
    return {
      ...option,
      availableCount
    };
  });
});



/**
 * 计算当前选择房型的可用房间数量
 * 1. 如果未选择房型，返回空数组
 * 2. 根据当前选择房型过滤可用房间
 * 3. 将过滤后的房间信息转换为选项格式
 * @returns {Array} 当前选择房型的可用房间选项数组
 */
const availableRoomOptions = computed(() => {
  if (!orderData.value.roomType) return [];
  return availableRoomsByDate.value
    .filter(room => room.type_code === orderData.value.roomType)
    .map(room => {
      // 获取房间状态文本
      const statusText = room.status === 'cleaning' ? ' [清扫中]' :
                        room.status === 'repair' ? ' [维修中]' : '';

      return {
        label: `${room.room_number} (${viewStore.getRoomTypeName(room.type_code)})${statusText}`,
        value: room.room_number,
        type: room.type_code,
        price: room.price,
        status: room.status
      };
    });
});

// 计算当前选择房型的可用房间数量
const availableRoomCount = computed(() => {
  if (!orderData.value.roomType) return 0;
  // 用当前时间范围下的可用房间统计
  return availableRoomsByDate.value.filter(
    room => room.type_code === orderData.value.roomType
  ).length;
})

function findAvailableRoomByNumber(roomNumber) {
  if (!roomNumber && roomNumber !== 0) return null;
  const normalized = String(roomNumber);
  return availableRoomsByDate.value.find(room => String(room.room_number) === normalized) || null;
}

function applyRoomSelection(room, { resetPricing = true } = {}) {
  if (!room) return false;

  const roomNumber = room.room_number ?? room.value;
  if (roomNumber === undefined || roomNumber === null) return false;

  orderData.value.roomNumber = roomNumber;
  shouldAutoSelectRoom = false;

  if (resetPricing) {
    dailyPrices.value = {};
    const finalPrice = calculateAdjustedRoomPrice(room.price || 0);
    if (finalPrice > 0) {
      initializeDailyPrices(finalPrice);
    } else {
      totalPriceInput.value = 0;
    }
  }

  return true;
}

function autoSelectFirstAvailableRoom() {
  if (!orderData.value.roomType) return false;
  if (!Array.isArray(availableRoomOptions.value) || availableRoomOptions.value.length === 0) return false;
  const firstOption = availableRoomOptions.value[0];
  const candidate = findAvailableRoomByNumber(firstOption.value);
  if (!candidate) return false;
  return applyRoomSelection(candidate);
}

/**
 * 根据路由参数预选房间
 */
async function applyPreselectedRoom() {
  if (!isDataInitialized.value) return;
  if (isApplyingPreselectedRoom) return;

  const targetNumber = pendingRouteSelection.value.roomNumber;
  if (!targetNumber) return;

  const normalizedNumber = String(targetNumber);
  const matchedRoom = findAvailableRoomByNumber(normalizedNumber);

  pendingRoomTypeChange = null;
  if (!matchedRoom) {
    console.warn(`房间 ${normalizedNumber} 在当前日期不可预订，已忽略预选`);
    $q.notify({
      type: 'warning',
      message: `房间 ${normalizedNumber} 当前不可预订`,
      position: 'top'
    });
    pendingRouteSelection.value = { roomNumber: null, roomType: null };
    return;
  }

  const targetTypeCode = pendingRouteSelection.value.roomType || matchedRoom.type_code;
  if (!targetTypeCode) {
    console.warn(`未找到房间 ${normalizedNumber} 对应的房型信息`);
    pendingRouteSelection.value = { roomNumber: null, roomType: null };
    return;
  }

  isApplyingPreselectedRoom = true;
  suppressRoomTypeWatcher = true;
  shouldAutoSelectRoom = false;

  orderData.value.roomType = targetTypeCode;
  await nextTick();

  const optionExists = availableRoomOptions.value.some(option => String(option.value) === normalizedNumber);
  if (!optionExists) {
    console.warn(`房间 ${normalizedNumber} 未出现在当前房型的可选列表中`);
    $q.notify({
      type: 'warning',
      message: `房间 ${normalizedNumber} 当前不可预订`,
      position: 'top'
    });
    suppressRoomTypeWatcher = false;
    isApplyingPreselectedRoom = false;
    pendingRouteSelection.value = { roomNumber: null, roomType: null };
    return;
  }

  applyRoomSelection(matchedRoom);

  pendingRouteSelection.value = { roomNumber: null, roomType: null };
  suppressRoomTypeWatcher = false;
  isApplyingPreselectedRoom = false;
}

watch(
  () => [route.query.roomNumber, route.query.roomType],
  ([roomNumberParam, roomTypeParam]) => {
    pendingRouteSelection.value = {
      roomNumber: normalizeQueryParam(roomNumberParam),
      roomType: normalizeQueryParam(roomTypeParam)
    };
    shouldAutoSelectRoom = false;
    pendingRoomTypeChange = null;
    applyPreselectedRoom();
  }
);
// // 从roomStore获取房间类型选项数组和可用房间数量
// const roomTypeOptionsWithCountFromStore = computed(
//   () => roomStore.getRoomTypeOptionsWithCount()
// );

// 根据房间数量获取对应的颜色
const getRoomCountColor = roomStore.getRoomCountColor;

/**
 * 当房型改变时的处理函数
 * 1. 重置房间号
 * 2. 根据新房型选择第一个可用房间
 * 3. 根据房型设置房间金额（休息房按半价计算，多日订单初始化每日价格）
 * @param {string} value - 选择的房型值
 */
function onRoomTypeChange(value) {
  orderData.value.roomNumber = null;

  // 清空多日价格数据
  dailyPrices.value = {};

  shouldAutoSelectRoom = true;
  pendingRoomTypeChange = value;
}


/**
 * 格式化日期显示
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @returns {string} 格式化后的日期显示
 */
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[d.getDay()]
  return `${month}月${day}日(${weekday})`
}

/**
 * 格式化日期标签（用于输入框label）
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @returns {string} 格式化后的日期标签
 */
function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[d.getDay()]
  return `${month}月${day}日 周${weekday}`
}

/**
 * 分配总价到每日价格
 */
function distributeTotalPrice() {
  if (dateList.value.length === 0) return;
  const total = toDecimal(totalPriceInput.value);
  if (!total.gt(0)) return;

  const days = dateList.value.length;
  const totalCents = total.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const baseCents = totalCents.div(days).floor();
  let remainder = totalCents.minus(baseCents.mul(days));

  dateList.value.forEach(date => {
    let cents = baseCents;
    if (remainder.gt(0)) {
      cents = cents.plus(1);
      remainder = remainder.minus(1);
    }
    dailyPrices.value[date] = cents.div(100).toNumber();
  });
  updateTotalFromDaily();
}

/**
 * 从每日价格更新总价输入框
 */
function updateTotalFromDaily() {
  if (!dateList.value.length) {
    totalPriceInput.value = 0;
    return;
  }
  const sumDecimal = sumDailyPricesDecimal();
  totalPriceInput.value = toAmountNumber(sumDecimal);
}

/**
 * 应用首日价格到所有天
 */
function applyFirstDayPriceToAll() {
  const firstPriceDecimal = toDecimal(firstDatePrice.value);
  if (!firstPriceDecimal.gt(0)) {
    $q.notify({ type: 'warning', message: '首日价格未设置或无效', position: 'top' });
    return;
  }
  const normalized = toAmountNumber(firstPriceDecimal);
  dateList.value.forEach(d => { dailyPrices.value[d] = normalized; });
  updateTotalFromDaily();
  $q.notify({
    type: 'positive',
    message: `已将首日价格 ¥${firstPriceDecimal.toFixed(2)} 应用到所有 ${dateList.value.length} 天`,
    position: 'top',
    icon: 'content_copy'
  });
}


/**
 * 初始化每日价格（适用于单日、休息房和多日）
 * @param {number} basePrice - 基础价格
 */
function initializeDailyPrices(basePrice) {
  if (dateList.value.length === 0) {
    totalPriceInput.value = 0;
    return;
  }
  const normalized = toAmountNumber(basePrice);
  if (!(normalized > 0)) {
    totalPriceInput.value = 0;
    return;
  }
  dateList.value.forEach(date => {
    if (!dailyPrices.value[date]) {
      dailyPrices.value[date] = normalized;
    }
  });
  updateTotalFromDaily();
}

/**
 * 格式化日期显示（用于 CheckInConfirmDialog）
 * @param {string} dateStr - 日期字符串
 * @returns {string} 格式化后的日期
 */
function formatDateForDialog(dateStr) {
  if (!dateStr) return ''
  return date.formatDate(dateStr, 'YYYY-MM-DD')
}

/**
 * 获取支付方式名称（用于 CheckInConfirmDialog）
 * @param {string} value - 支付方式值
 * @returns {string} 支付方式名称
 */
function getPaymentMethodName(value) {
  const option = viewStore.paymentMethodOptions.find(opt => opt.value === value)
  return option ? option.label : value
}

/**
 * 处理入住确认
 * 在 CheckInConfirmDialog 中点击确认后调用
 * @param {Object} orderWithDeposit - 包含押金信息的订单数据
 */
async function handleCheckInConfirm(orderWithDeposit) {
  try {
    console.log('🚀 准备使用快速入住API，数据:', orderWithDeposit);

    // 直接调用新的 fastCheckIn action
    const result = await orderStore.fastCheckIn(orderWithDeposit);

    console.log('✅ 快速入住成功，后端返回:', result);

    // 刷新房间状态
    await roomStore.refreshData();

    // 关闭对话框
    showCheckInDialog.value = false;
    pendingCheckInOrder.value = null;

    $q.notify({
      type: 'positive',
      message: '快速入住成功！订单和账单已创建。',
      position: 'top'
    });

    // 导航到订单列表页面
    router.push('/ViewOrders');

  } catch (error) {
    console.error('快速入住失败:', error);
    let errorMessage = '操作失败，请稍后再试。';

    // 错误处理逻辑保持不变
    if (error.response?.data) {
      if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
        errorMessage = '表单验证失败：\n' +
          error.response.data.errors.map(e => `- ${e.msg}`).join('\n');
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 10000,
      multiLine: true
    });
  }
}

/**
 * 提交订单函数
 * 收集表单数据，调用后端API创建订单，并导航到订单列表页面
 */
async function submitOrder() {
  // 获取当前时间
  const now = getCurrentTimeToMinute()

  // 判断是否选择了房间
  if (!orderData.value.roomNumber) {
    $q.notify({
      type: 'negative',
      message: '请选择房间',
      position: 'top'
    });
    return
  }

  // 构建价格数据（统一使用 dailyPrices）
  const roomPriceData = { ...dailyPrices.value }

  // 验证所有日期都有价格
  const missingPrices = dateList.value.filter(date => !dailyPrices.value[date] || dailyPrices.value[date] <= 0)
  if (missingPrices.length > 0) {
    $q.notify({
      type: 'negative',
      message: `请设置以下日期的价格：${missingPrices.map(formatDateDisplay).join('、')}`,
      position: 'top'
    });
    return
  }

  // 最终验证价格数据
  if (!roomPriceData || Object.keys(roomPriceData).length === 0) {
    $q.notify({
      type: 'negative',
      message: '价格数据异常，请重新设置价格',
      position: 'top'
    });
    return;
  }

  console.log(`📅 ${dateList.value.length === 1 ? '单日' : '多日'}订单价格数据：`, roomPriceData);

  if (orderData.value.isPrepaid) {
    const totalPriceValue = toDecimal(totalPrice.value);
    const prepaidAmount = toDecimal(orderData.value.prepaidAmount);
    if (!prepaidAmount.gt(0)) {
      $q.notify({
        type: 'negative',
        message: '请输入有效的预收房费金额',
        position: 'top'
      });
      return;
    }
    if (totalPriceValue.gt(0) && prepaidAmount.minus(totalPriceValue).gt(0.01)) {
      $q.notify({
        type: 'negative',
        message: '预收房费金额不能超过房费总额',
        position: 'top'
      });
      return;
    }
  }

  // 获取选择的房间 (client-side check before API call)
  const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)

  // 检查房间是否存在
  if (!selectedRoom) {
    $q.notify({
      type: 'negative',
      message: `房间 ${orderData.value.roomNumber} 不存在`,
      position: 'top'
    });
    return
  }

  // 检查房间是否关闭
  if (selectedRoom.is_closed) {
    $q.notify({
      type: 'negative',
      message: `房间 ${orderData.value.roomNumber} 已关闭，无法预订`,
      position: 'top'
    });
    return
  }

  // 注意：移除了对房间状态的严格检查，允许清扫中的房间创建订单
  // 冲突检测将由后端API处理，确保不会创建真正冲突的订单

  // 构建要提交的订单数据
  const prepaidAtISO = orderData.value.isPrepaid ? new Date().toISOString() : null;
  const submitData = {
    ...orderData.value,
    createTime: date.formatDate(now, 'YYYY-MM-DD HH:mm:ss'),
    paymentMethod: typeof orderData.value.paymentMethod === 'object' ?
      orderData.value.paymentMethod.value :
      orderData.value.paymentMethod,
    roomPrice: roomPriceData, // 发送JSON格式的价格数据
    deposit: Number(orderData.value.deposit),
    isPrepaid: orderData.value.isPrepaid,
    prepaidAmount: orderData.value.isPrepaid ? Number(orderData.value.prepaidAmount) : 0,
    ...(orderData.value.isPrepaid && prepaidAtISO ? { prepaidAt: prepaidAtISO } : {})
  };

  // 如果订单状态是"已入住"，需要先确认入住信息
  if (orderData.value.status === 'checked-in') {
    $q.dialog({
      title: '确认立即入住',
      message: '创建订单后将立即办理入住，是否继续？',
      cancel: {
        label: '取消',
        color: 'grey',
        flat: true
      },
      ok: {
        label: '确定',
        color: 'primary'
      },
      persistent: true
    }).onOk(() => {
      // 用户确认后，显示入住确认对话框
      pendingCheckInOrder.value = submitData
      showCheckInDialog.value = true
    })
    return
  }

  // 普通订单创建流程
  try {
    // 使用 orderStore.addOrder 创建订单
    await orderStore.addOrder(submitData);

    // 刷新房间状态
    await roomStore.refreshData();

    $q.notify({
      type: 'positive',
      message: '订单创建成功！',
      position: 'top'
    });

    // 导航到订单列表页面
    router.push('/ViewOrders');
  } catch (error) {
    console.error('订单创建失败:', error);
    const defaultMessage = '订单创建失败，请稍后再试。';
    let errorMessage = defaultMessage;

    if (error.response?.data) {
      console.log('服务器返回的详细错误:', error.response.data);

      if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
        error.response.data.errors.forEach((err, index) => {
          console.log(`错误 ${index + 1}:`, err);
        });
        errorMessage = '表单验证失败：\n' +
          error.response.data.errors.map(e => `- ${e.msg}`).join('\n');
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    }

    if (errorMessage === defaultMessage) {
      const fallbackMessage = error.userFacingMessage || error.message;
      if (typeof fallbackMessage === 'string') {
        const trimmed = fallbackMessage.trim();
        if (trimmed && trimmed !== 'Error') {
          const match = trimmed.match(/^\[(.+?)\]\s*(.*)$/);
          errorMessage = match && match[2] ? match[2] : trimmed;
        }
      }
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 10000,
      multiLine: true
    });
  }
}

// 组件挂载时执行的钩子函数
onMounted(async () => {
  console.log('CreateOrder组件已挂载，开始初始化数据')

  // 首先获取房型数据，确保房型选择列表是最新的
  await roomStore.fetchRoomTypes()

  // 然后获取房间数据
  await roomStore.fetchAllRooms()

  // 页面加载时，主动拉取一次可用房间，保证房型数量能显示
  await updateAvailableRooms()

  isDataInitialized.value = true
  await applyPreselectedRoom()

  console.log('CreateOrder组件数据初始化完成')
});


/**
 * 检查是否为休息房
 * 如果入住日期和离店日期是同一天，则为休息房
 * @returns {boolean} 是否为休息房
 */
function checkIfRestRoom() {
  return orderData.value.checkInDate === orderData.value.checkOutDate
}

/**
 * 更新休息房状态并处理相关逻辑
 */
function updateRestRoomStatus() {
  // 仅同步标志，实际价格/押金调整在 watch(isRestRoom) 中集中处理
  orderData.value.isRestRoom = checkIfRestRoom();
}

/**
 * 离店日期变化时的处理函数
 */
async function onCheckOutDateChange() {
  if (!isValidFullDate(orderData.value.checkOutDate)) return;
  await updateAvailableRooms();
}

/**
 * 入住日期变化时的处理函数
 */
async function onCheckInDateChange() {
  if (!isValidFullDate(orderData.value.checkInDate)) return;
  // 如果离店日期小于入住日期，重置离店日期
  if (orderData.value.checkOutDate < orderData.value.checkInDate) {
    // 设置为入住日期（允许同一天，即休息房）
  orderData.value.checkOutDate = orderData.value.checkInDate;
  }

  // 更新休息房状态
  updateRestRoomStatus();

  // 更新可用房间
  await updateAvailableRooms();
}

/**
 * 日期范围变化时的处理函数
 */
// 移除日期范围选择器，使用两个独立 date 输入

// 计算属性：休息房状态
const isRestRoom = computed(() => orderData.value.checkInDate === orderData.value.checkOutDate);

// 清理不再使用的多日价格键
watch(dateList, (newList) => {
  const set = new Set(newList);
  Object.keys(dailyPrices.value).forEach(k => { if (!set.has(k)) delete dailyPrices.value[k]; });
  updateTotalFromDaily();
});



// 计算属性：总价格（统一从 dailyPrices 计算）
const totalPrice = computed(() => {
  const totalDecimal = sumDailyPricesDecimal();
  return Number(totalDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
});

const averageDailyPrice = computed(() => {
  const days = dateList.value.length;
  if (!days) return 0;
  const avgDecimal = toDecimal(totalPrice.value).div(days);
  return Number(avgDecimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
});

watch(() => orderData.value.isPrepaid, (now) => {
  if (now) {
    const total = toDecimal(totalPrice.value);
    orderData.value.prepaidAmount = total.gt(0) ? toAmountNumber(total) : 0;
  } else {
    orderData.value.prepaidAmount = 0;
  }
});

watch(totalPrice, (val) => {
  if (!orderData.value.isPrepaid) return;
  const total = toDecimal(val);
  orderData.value.prepaidAmount = total.gt(0) ? toAmountNumber(total) : 0;
});

// 监听休息房状态变化，自动处理价格和备注
watch(isRestRoom, (now, prev) => {
  if (now === prev) return;
  if (now) {
    // 进入休息房模式：自动在备注中添加标记
    if (!orderData.value.remarks.includes('【休息房】')) {
      orderData.value.remarks = orderData.value.remarks ? `【休息房】${orderData.value.remarks}` : '【休息房】';
    }
    // 价格调整已在 initializeDailyPrices 中处理，这里不需要额外操作
  } else {
    // 退出休息房模式：移除备注标记
    orderData.value.remarks = orderData.value.remarks.replace(/【休息房】/g, '').trim();
    // 价格调整已在 initializeDailyPrices 中处理，这里不需要额外操作
  }
});
</script>

<style scoped>
/* 页面主容器样式，限制最大宽度并居中 */
.check-in {
  /* max-width: 1200px; */
  max-width: 90%;
  margin: 0 auto;
}

/* 简洁价格设置容器 */
.simple-pricing-container {
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

/* 简洁输入框样式 */
.simple-input .q-field__control {
  border-radius: 4px;
}

/* 简洁按钮样式 */
.simple-btn {
  border-radius: 4px;
  font-weight: 400;
  text-transform: none;
}

/* 总计显示 */
.total-display {
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
}

/* 深色模式适配 */
.body--dark .simple-pricing-container {
  background: #1e1e1e;
  border-color: #404040;
}

.body--dark .total-display {
  background: #2d2d2d;
  border-color: #404040;
}

</style>
