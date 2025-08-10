<template>
  <!-- 整个创建订单页面的主容器，使用q-page组件 -->
  <q-page class="check-in">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-md">创建订单</h1>

    <!-- 添加测试数据按钮 -->
    <div class="row q-mb-md">
      <q-btn label="填充测试数据" color="orange" icon="bug_report" @click="fillTestData" class="q-mr-sm" />
      <q-btn v-if="isDev" label="随机数据" color="purple" icon="auto_awesome" @click="fillRandomData" class="q-mr-sm" />
      <q-btn label="快速休息房" color="teal" icon="hotel" @click="fillRestRoomData" class="q        if (selectedRoom) {
          // 如果是休息房，价格按半价计算
          const basePrice = Number(selectedRoom.price);
          orderData.value.roomPrice = isRestRoom.value ?
            Math.round(basePrice / 2) : basePrice;
        }" />
    </div>

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
              <!-- 身份证号输入框 -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.idNumber" label="身份证号" filled type="text" maxlength="18"
                  @input="validateIdNumber" :rules="[
                    val => !!val || '请输入身份证号',
                    val => (val.length === 18) || '身份证号必须为18位',
                    val => /^[0-9X]+$/.test(val) || '身份证号只能包含数字和X'
                  ]">
                  <!-- 提示文本 -->
                  <template v-slot:hint>
                    请输入18位身份证号，最后一位可以是数字或X
                  </template>
                </q-input>
              </div>
              <!-- 手机号输入框 -->
              <div class="col-md-4 col-xs-12">
                <q-input v-model="orderData.phone" label="手机号" filled mask="###########" :rules="[
                  val => !!val || '请输入手机号',
                  val => (val.length === 11) || '手机号必须为11位'
                ]" />
              </div>
            </div>
          </div>

          <!-- 入住信息部分 -->
          <div class="form-section q-mb-md">
            <div class="text-subtitle1 q-mb-sm">入住时间</div>
            <div class="row">
              <!-- 日期范围选择器，占满整行 -->
              <div class="col-12">
                <q-date v-model="dateRange" range filled emit-value landscape today-btn color="primary"
                  :options="dateOptions" @update:model-value="onDateRangeChange" :locale="langZhCn.date">
                  <!-- 底部确认按钮 -->
                  <div class="row items-center justify-end q-pr-sm q-pb-sm">
                    <q-btn label="确定" color="primary" flat v-close-popup />
                  </div>
                </q-date>
              </div>
              <!-- 入住日期显示框 -->
              <div class="col-md-4 col-xs-12 q-mt-md">
                <q-input v-model="orderData.checkInDate"
                  label="入住日期" filled readonly
                  :rules="[val => !!val || '请选择入住日期']">
                  <template v-slot:prepend>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy ref="qDateCheckInProxy" cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="orderData.checkInDate" @update:model-value="onCheckInDateChange"
                          :options="date => date >= today" :locale="langZhCn.date">
                          <!-- 底部确认按钮 -->
                          <div class="row items-center justify-end">
                            <q-btn label="确定" color="primary" flat v-close-popup />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                  <!-- 日期选择图标和弹出日历 -->
                </q-input>
              </div>

              <!-- 离店日期显示框 -->
              <div class="col-md-4 col-xs-12 q-mt-md">
                <q-input v-model="orderData.checkOutDate" label="离店日期" filled readonly :rules="[
                  val => !!val || '请选择离店日期',
                  val => val >= orderData.checkInDate || '离店日期不能早于入住日期'
                ]">
                  <!-- 日期选择图标和弹出日历 -->
                  <template v-slot:prepend>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy ref="qDateCheckOutProxy" cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="orderData.checkOutDate" :options="date => date >= orderData.checkInDate"
                          @update:model-value="onCheckOutDateChange" :locale="langZhCn.date">
                          <!-- 底部确认按钮 -->
                          <div class="row items-center justify-end">
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
                  <!-- 调试信息 -->
                  <div class="col-auto q-ml-sm text-caption text-grey-6" v-if="isDev">
                    (调试: 入住={{orderData.checkInDate}}, 离店={{orderData.checkOutDate}}, 休息房={{isRestRoom}})
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
              <div class="col-md-6 col-xs-12">
                <div class="row items-center">
                  <div class="col">
                    <q-select v-model="orderData.roomType" :options="roomTypeOptionsWithCount" label="房间类型" filled
                      emit-value map-options @update:model-value="onRoomTypeChange"
                      :rules="[val => !!val || '请选择房间类型']">
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
                  <!-- 当前房型剩余房间信息 -->
                  <div class="col-auto q-ml-md" v-if="orderData.roomType">
                    <q-chip :color="getRoomCountColor(availableRoomCount)" text-color="white" icon="hotel">
                      剩余: {{ availableRoomCount }}间
                    </q-chip>
                  </div>
                </div>
              </div>

              <!-- 房间号选择 -->
              <div class="col-md-6 col-xs-12">
                <q-select v-model="orderData.roomNumber" :options="availableRoomOptions" label="房间号" filled emit-value
                  map-options :rules="[val => !!val || '请选择房间号']" :disable="!orderData.roomType">
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
              <!-- 多日价格设置 -->
              <div class="col-md-8 col-xs-12" v-if="isMultiDay">
                <q-card class="multi-day-pricing-card" bordered>
                  <q-card-section class="q-pb-sm">
                    <div class="row items-center q-mb-md">
                      <div class="col">
                        <div class="text-h6 text-primary q-mb-xs">
                          <q-icon name="event_note" class="q-mr-sm" />
                          每日房间价格设置
                        </div>
                        <div class="text-caption text-grey-6">
                          共 {{ dateList.length }} 天，可为每天设置不同价格
                        </div>
                      </div>
                      <div class="col-auto">
                        <q-chip
                          color="blue-1"
                          text-color="blue-8"
                          icon="hotel"
                          :label="`${dateList.length}天住宿`"
                          outline
                        />
                      </div>
                    </div>
                  </q-card-section>

                  <!-- 价格设置列表 -->
                  <q-card-section class="q-pt-none">
                    <div class="pricing-list">
                      <q-card
                        v-for="(date, index) in dateList"
                        :key="date"
                        class="price-item-card q-mb-sm"
                        flat
                        bordered
                      >
                        <q-card-section class="row items-center q-pa-md">
                          <!-- 日期显示 -->
                          <div class="col-auto q-mr-md">
                            <div class="date-badge">
                              <div class="date-number">{{ new Date(date).getDate() }}</div>
                              <div class="date-info">
                                <div class="month-day">{{ new Date(date).getMonth() + 1 }}月</div>
                                <div class="weekday">{{ ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()] }}</div>
                              </div>
                            </div>
                          </div>

                          <!-- 价格输入 -->
                          <div class="col">
                            <q-input
                              v-model.number="dailyPrices[date]"
                              :label="`第${index + 1}天价格`"
                              filled
                              type="number"
                              prefix="¥"
                              :rules="[val => val > 0 || '价格必须大于0']"
                              class="price-input"
                            >
                              <template v-slot:append>
                                <q-icon
                                  name="trending_up"
                                  :color="dailyPrices[date] > (index > 0 ? dailyPrices[dateList[index-1]] : 0) ? 'positive' : 'grey-5'"
                                />
                              </template>
                            </q-input>
                          </div>
                        </q-card-section>
                      </q-card>
                    </div>
                  </q-card-section>

                  <!-- 操作按钮和总计 -->
                  <q-card-section class="q-pt-none">
                    <div class="row items-center q-gutter-md">
                      <div class="col-auto">
                        <q-btn
                          unelevated
                          color="orange"
                          icon="content_copy"
                          label="应用首日价格"
                          @click="applyFirstDayPriceToAll"
                          :disable="!firstDatePrice"
                          class="apply-price-btn"
                        />
                      </div>

                      <q-space />

                      <!-- 总计显示 -->
                      <div class="col-auto">
                        <q-card class="total-price-card" flat>
                          <q-card-section class="q-pa-md text-center">
                            <div class="text-caption q-mb-xs">住宿总价</div>
                            <div class="text-h5 text-weight-bold">
                              <q-icon name="payments" class="q-mr-xs" />
                              ¥{{ totalPrice }}
                            </div>
                            <div class="text-caption">
                              平均 ¥{{ Math.round(totalPrice / dateList.length) }}/天
                            </div>
                          </q-card-section>
                        </q-card>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>

              <!-- 单日价格输入（单日或休息房） -->
              <div class="col-md-4 col-xs-12" v-else>
                <q-card class="single-day-pricing-card" flat bordered>
                  <q-card-section class="q-pa-md">
                    <div class="row items-center q-mb-sm">
                      <q-icon name="payments" color="primary" size="20px" class="q-mr-sm" />
                      <div class="text-subtitle2 text-weight-medium">
                        {{ isRestRoom ? '休息房价格' : '住宿价格' }}
                      </div>
                      <q-space />
                      <q-chip
                        :color="isRestRoom ? 'orange-2' : 'blue-2'"
                        :text-color="isRestRoom ? 'orange-8' : 'blue-8'"
                        :icon="isRestRoom ? 'hotel' : 'night_shelter'"
                        :label="isRestRoom ? '当日' : '单日'"
                        size="sm"
                        outline
                      />
                    </div>
                    <q-input
                      v-model.number="orderData.roomPrice"
                      label="房间金额"
                      filled
                      type="number"
                      prefix="¥"
                      :rules="[val => val > 0 || '房间金额必须大于0']"
                      class="single-price-input"
                    >
                      <template v-slot:append>
                        <q-icon name="attach_money" color="positive" />
                      </template>
                    </q-input>
                  </q-card-section>
                </q-card>
              </div>

              <!-- 押金输入 -->
              <div class="col-md-4 col-xs-12">
                <q-input
                      v-model.number="orderData.deposit"
                      label="押金金额"
                      filled
                      type="number"
                      prefix="¥"
                      :rules="[val => val >= 0 || '押金不能为负数']"
                      class="deposit-input"
                    >
                    </q-input>
                <!-- 支付方式 -->
                <q-select v-model="orderData.paymentMethod"
                  :options="viewStore.paymentMethodOptions"
                  label="支付方式"
                  filled :rules="[val => !!val || '请选择支付方式']" />
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
  </q-page>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { date, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useOrderStore } from '../stores/orderStore' // 导入订单 store
import { useRoomStore } from '../stores/roomStore' // 导入房间 store
import { useViewStore } from '../stores/viewStore' // 导入视图 store
import langZhCn from 'quasar/lang/zh-CN' // 导入中文语言包

// 获取路由和store
const router = useRouter()
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const $q = useQuasar() // For notifications

// 检查是否为开发环境
const isDev = ref(process.env.NODE_ENV === 'development')

// roomStore 已导入，可以直接使用其方法

const availableRoomsByDate = ref([]); // 存储当前时间范围下所有可用房间

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
  { label: '携程', value: 'ctrip' },
  { label: '飞猪', value: 'fliggy' },
  { label: '美团', value: 'meituan' },
  { label: '去哪儿', value: 'qunar' },
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
  idNumber: '',                        // 身份证号
  phone: '',                           // 手机号
  roomType: null,                      // 房间类型
  roomNumber: null,                    // 房间号
  checkInDate: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD'),  // 入住日期，默认今天
  checkOutDate: date.formatDate(date.addToDate(getCurrentTimeToMinute(), { days: 1 }), 'YYYY-MM-DD'), // 离店日期，默认明天
  deposit: 0,                        // 押金，默认100元
  paymentMethod: viewStore.paymentMethodOptions[0].label,               // 支付方式，默认微邮付
  roomPrice: 0,                        // 房间价格，会根据选择的房间自动设置
  remarks: '',                         // 备注信息（可选）
  createTime: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD HH:mm:ss'), // 创建时间
  isRestRoom: false,                   // 是否为休息房
})

// 多日价格管理
const dailyPrices = ref({}) // 存储每日价格 {date: price}

// 判断是否为多日订单
const isMultiDay = computed(() => {
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

// 生成日期列表（住宿的每一晚）
const dateList = computed(() => {
  const checkIn = new Date(orderData.value.checkInDate);
  const checkOut = new Date(orderData.value.checkOutDate);
  const daysDiff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  const dates = [];

  // 对于休息房（同日入住退房）或单日住宿，返回空数组（单日订单不使用dateList）
  if (daysDiff <= 1) {
    console.log('📅 单日/休息房订单，dateList为空');
    return dates;
  }

  // 多日订单：生成每一晚的日期（不包括退房日期）
  for (let i = 0; i < daysDiff; i++) {
    const currentDate = new Date(checkIn);
    currentDate.setDate(currentDate.getDate() + i);
    dates.push(date.formatDate(currentDate, 'YYYY-MM-DD'));
  }

  console.log('🗓️ 多日订单日期列表：', dates);
  return dates;
});

// 首日价格（用于应用到所有天）
const firstDatePrice = computed(() => {
  if (dateList.value.length === 0) return 0;
  return dailyPrices.value[dateList.value[0]] || 0;
});

// 日期范围对象 - 用于日期选择器的范围选择模式
const dateRange = ref({
  from: orderData.value.checkInDate,   // 开始日期，默认为入住日期
  to: orderData.value.checkOutDate     // 结束日期，默认为离店日期
})

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
 * 更新入住和离店日期，并刷新可用房间列表
 */
async function updateDatesAndRooms() {
  if (dateRange.value.from) {
    dateRange.value.from = date.formatDate(dateRange.value.from, 'YYYY-MM-DD');
    orderData.value.checkInDate = dateRange.value.from;
  }
  if (dateRange.value.to) {
    dateRange.value.to = date.formatDate(dateRange.value.to, 'YYYY-MM-DD');
    orderData.value.checkOutDate = dateRange.value.to;
  }

  await updateAvailableRooms();
}

/**
 * 更新离店日期的最小值并刷新可用房间列表
 */
async function updateCheckOutMinDateAndRooms() {
  // 如果离店日期小于入住日期，重置离店日期
  if (orderData.value.checkOutDate < orderData.value.checkInDate) {
    // 设置为入住日期（允许同一天，即休息房）
    orderData.value.checkOutDate = orderData.value.checkInDate;
    dateRange.value.to = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD');
  }

  await updateAvailableRooms();
}

/**
 * 更新可用房间列表
 */
async function updateAvailableRooms() {
  try {
    if (!orderData.value.checkInDate || !orderData.value.checkOutDate) {
      return;
    }
    // 强制格式化
    const startDate = date.formatDate(orderData.value.checkInDate, 'YYYY-MM-DD');
    const endDate = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD');
    orderData.value.roomNumber = null;

    const rooms = await roomStore.getAvailableRoomsByDate(
      startDate,
      endDate
    );
    availableRoomsByDate.value = rooms;
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
watch(() => orderData.value.checkInDate, async () => {
  dateRange.value.from = date.formatDate(orderData.value.checkInDate, 'YYYY-MM-DD');
  await updateAvailableRooms();

  // 如果是多日订单且有房间选择，重新初始化价格
  if (isMultiDay.value && orderData.value.roomNumber) {
    const selectedRoom = availableRoomsByDate.value.find(
      room => room.room_number === orderData.value.roomNumber
    );
    if (selectedRoom) {
      const basePrice = Number(selectedRoom.price);
      const finalPrice = orderData.value.isRestRoom ? Math.round(basePrice / 2) : basePrice;
      initializeDailyPrices(finalPrice);
    }
  }
});

watch(() => orderData.value.checkOutDate, async () => {
  dateRange.value.to = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD');
  await updateAvailableRooms();

  // 如果是多日订单且有房间选择，重新初始化价格
  if (isMultiDay.value && orderData.value.roomNumber) {
    const selectedRoom = availableRoomsByDate.value.find(
      room => room.room_number === orderData.value.roomNumber
    );
    if (selectedRoom) {
      const basePrice = Number(selectedRoom.price);
      const finalPrice = orderData.value.isRestRoom ? Math.round(basePrice / 2) : basePrice;
      initializeDailyPrices(finalPrice);
    }
  }
});

// 监听房型变化
watch(() => orderData.value.roomType, async () => {
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
        id: room.room_id,
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

  nextTick(() => {
    const roomTypeText = viewStore.getRoomTypeName(value);
    const count = availableRoomCount.value;
    if (count === 0) {
      alert(`当前没有可用的${roomTypeText}，请联系管理员。`)
    } else {
      if (availableRoomOptions.value.length > 0) {
        orderData.value.roomNumber = availableRoomOptions.value[0].value;
        const selectedRoom = availableRoomsByDate.value.find(
          room => room.room_number === orderData.value.roomNumber
        );
        if (selectedRoom) {
          // 计算基础价格
          const basePrice = Number(selectedRoom.price);
          const finalPrice = orderData.value.isRestRoom ?
            Math.round(basePrice / 2) : basePrice;

          if (isMultiDay.value) {
            // 多日订单：初始化每日价格
            initializeDailyPrices(finalPrice);
          } else {
            // 单日订单：设置单价
            orderData.value.roomPrice = finalPrice;
          }
        }
      }
    }
  });
}

/**
 * 身份证号验证函数
 * 确保身份证号只包含数字和最后一位的X
 */
function validateIdNumber() {
  // 移除非数字和X/x字符
  orderData.value.idNumber = orderData.value.idNumber.replace(/[^0-9X]/g, '');

  // 如果最后一位不是X/x，则确保只有数字
  if (orderData.value.idNumber.length < 18) {
    orderData.value.idNumber = orderData.value.idNumber.replace(/[^0-9]/g, '');
  }
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
 * 应用首日价格到所有天
 */
function applyFirstDayPriceToAll() {
  const firstPrice = firstDatePrice.value
  if (firstPrice > 0) {
    dateList.value.forEach(date => {
      dailyPrices.value[date] = firstPrice
    })
    $q.notify({
      type: 'positive',
      message: `已将首日价格 ¥${firstPrice} 应用到所有 ${dateList.value.length} 天`,
      position: 'top',
      icon: 'content_copy'
    })
  }
}


/**
 * 初始化多日价格
 * @param {number} basePrice - 基础价格
 */
function initializeDailyPrices(basePrice) {
  if (isMultiDay.value && basePrice > 0) {
    dateList.value.forEach(date => {
      if (!dailyPrices.value[date]) {
        dailyPrices.value[date] = basePrice
      }
    })
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

      // 构建价格数据
  let roomPriceData

  // 调试信息
  console.log('🏨 订单日期信息：');
  console.log('  入住日期：', orderData.value.checkInDate);
  console.log('  退房日期：', orderData.value.checkOutDate);
  console.log('  是否多日：', isMultiDay.value);
  console.log('  日期列表：', dateList.value);
  console.log('  每日价格：', dailyPrices.value);

  if (isMultiDay.value) {
    // 多日订单：使用JSON格式
    roomPriceData = { ...dailyPrices.value }
    console.log('📊 多日订单价格数据：', roomPriceData);

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
  } else {
    // 单日订单：转换为JSON格式 {date: price}
    if (!orderData.value.roomPrice || orderData.value.roomPrice <= 0) {
      $q.notify({
        type: 'negative',
        message: '请设置房间价格',
        position: 'top'
      });
      return
    }

    roomPriceData = {
      [orderData.value.checkInDate]: Number(orderData.value.roomPrice)
    }
    console.log('📅 单日订单价格数据：', roomPriceData);
  }

  // 最终验证价格数据
  if (!roomPriceData || (typeof roomPriceData === 'object' && Object.keys(roomPriceData).length === 0)) {
    $q.notify({
      type: 'negative',
      message: '价格数据异常，请重新设置价格',
      position: 'top'
    });
    return;
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

  try {
    // 构建要提交的订单数据
    const submitData = {
      ...orderData.value,
      createTime: date.formatDate(now, 'YYYY-MM-DD HH:mm:ss'),
      paymentMethod: typeof orderData.value.paymentMethod === 'object' ?
        orderData.value.paymentMethod.value :
        orderData.value.paymentMethod,
      roomPrice: roomPriceData, // 发送JSON格式的价格数据
      deposit: Number(orderData.value.deposit)
    };



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
    let errorMessage = '订单创建失败，请稍后再试。';

    if (error.response) {
      if (error.response.data) {
        console.log('服务器返回的详细错误:', error.response.data);

        if (error.response.data.errors) {
          if (Array.isArray(error.response.data.errors)) {
            error.response.data.errors.forEach((err, index) => {
              console.log(`错误 ${index + 1}:`, err);
            });

            errorMessage = '表单验证失败：\n' +
              error.response.data.errors.map(e => `- ${e.msg}`).join('\n');
          }
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
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

/**
 * 填充测试数据
 */
function fillTestData() {
  // 填充基本订单数据
  orderData.value.guestName = '张测试'
  orderData.value.idNumber = '110101199001011234'
  orderData.value.phone = '13800138000'
  orderData.value.remarks = '测试订单，请勿处理'

  // 获取第一个可用的房间类型
  const availableRoomTypes = roomTypeOptionsWithCount.value
    .filter(type => type.availableCount > 0)

  if (availableRoomTypes.length > 0) {
    // 设置房间类型
    orderData.value.roomType = availableRoomTypes[0].value

    // 等待DOM更新
    nextTick(() => {
      // 设置第一个可用房间
      if (availableRoomOptions.value.length > 0) {
        orderData.value.roomNumber = availableRoomOptions.value[0].value

        // 根据选择的房间直接设置房间价格
        const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)
        if (selectedRoom) {
          console.log('设置房间价格:', selectedRoom.price)
          orderData.value.roomPrice = Number(selectedRoom.price)
        } else {
          console.error('无法获取选择房间的价格信息')
          // 设置一个默认价格
          orderData.value.roomPrice = 299
        }
      }
    })
  }

  // 设置支付信息
  orderData.value.paymentMethod = 'cash'
  orderData.value.deposit = 200

  // 显示通知
  $q.notify({
    type: 'positive',
    message: '测试数据已填充',
    position: 'top'
  })

  // 添加验证
  nextTick(() => {
    // 验证房间是否正确选择
    const room = roomStore.getRoomByNumber(orderData.value.roomNumber)
    if (!room) {
      console.error('测试数据填充后，无法找到选择的房间')
    } else {
      console.log('测试数据填充后，房间状态:', room.status)
      console.log('测试数据填充后，房间价格:', room.price)
    }
  })
}

/**
 * 填充随机测试数据
 */
function fillRandomData() {
  // 随机名字
  const firstNames = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄']
  const lastNames = ['明', '芳', '军', '华', '英', '伟', '强', '勇', '静', '敏']
  const randomName = firstNames[Math.floor(Math.random() * firstNames.length)] +
    lastNames[Math.floor(Math.random() * lastNames.length)]

  // 随机身份证
  const randomIdPrefix = '1101011990'
  const randomMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  const randomDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')
  const randomSuffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  const randomId = `${randomIdPrefix}${randomMonth}${randomDay}${randomSuffix}`

  // 随机手机号
  const phonePrefix = ['138', '139', '186', '187', '158', '159']
  const randomPhone = phonePrefix[Math.floor(Math.random() * phonePrefix.length)] +
    String(Math.floor(Math.random() * 100000000)).padStart(8, '0')

  // 填充数据
  orderData.value.guestName = randomName
  orderData.value.idNumber = randomId
  orderData.value.phone = randomPhone
  orderData.value.remarks = `随机生成的测试订单 - ${new Date().toLocaleString()}`

  // 随机选择一个可用房型
  const availableRoomTypes = roomTypeOptionsWithCount.value
    .filter(type => type.availableCount > 0)

  if (availableRoomTypes.length > 0) {
    const randomRoomType = availableRoomTypes[Math.floor(Math.random() * availableRoomTypes.length)]
    orderData.value.roomType = randomRoomType.value

    // 等待DOM更新
    nextTick(() => {
      // 随机选择一个可用房间
      if (availableRoomOptions.value.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableRoomOptions.value.length)
        orderData.value.roomNumber = availableRoomOptions.value[randomIndex].value

        // 根据选择的房间直接设置房间价格
        const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)
        if (selectedRoom) {
          console.log('设置随机房间价格:', selectedRoom.price)
          orderData.value.roomPrice = Number(selectedRoom.price)
        } else {
          // 设置一个随机默认价格 (200-800)
          orderData.value.roomPrice = Math.floor(Math.random() * 601) + 200
        }
      }
    })
  }

  // 随机支付方式
  const paymentMethods = viewStore.paymentMethodOptions
  orderData.value.paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)].value

  // 随机押金 (100-500)
  orderData.value.deposit = Math.floor(Math.random() * 401) + 100

  // 显示通知
  $q.notify({
    type: 'positive',
    message: '随机测试数据已填充',
    position: 'top'
  })

  // 添加随机数据的验证
  setTimeout(() => {
    console.log('房间价格设置情况:', {
      roomNumber: orderData.value.roomNumber,
      roomPrice: orderData.value.roomPrice,
      selectedRoom: roomStore.getRoomByNumber(orderData.value.roomNumber)
    })
  }, 500)
}

/**
 * 填充休息房测试数据
 */
function fillRestRoomData() {
  // 填充基本订单数据
  orderData.value.guestName = '李休息'
  orderData.value.idNumber = '110101199002021234'
  orderData.value.phone = '13900139000'

  // 设置当天入住和离店
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  orderData.value.checkInDate = today
  orderData.value.checkOutDate = today

  // 更新日期范围
  dateRange.value.from = today
  dateRange.value.to = today

  // 获取第一个可用的房间类型
  const availableRoomTypes = roomTypeOptionsWithCount.value
    .filter(type => type.availableCount > 0)

  if (availableRoomTypes.length > 0) {
    // 设置房间类型
    orderData.value.roomType = availableRoomTypes[0].value

    // 等待DOM更新
    nextTick(() => {
      // 设置第一个可用房间
      if (availableRoomOptions.value.length > 0) {
        orderData.value.roomNumber = availableRoomOptions.value[0].value

        // 根据选择的房间设置房间价格（休息房半价）
        const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)
        if (selectedRoom) {
          console.log('设置休息房价格:', Math.round(selectedRoom.price / 2))
          orderData.value.roomPrice = Math.round(Number(selectedRoom.price) / 2)
        } else {
          // 设置一个默认的休息房价格
          orderData.value.roomPrice = 150
        }
      }
    })
  }

  // 设置休息房特有的支付信息
  orderData.value.paymentMethod = 'cash'
  orderData.value.deposit = 50  // 休息房押金较低

  // 显示通知
  $q.notify({
    type: 'positive',
    message: '休息房数据已填充',
    position: 'top'
  })

  // 刷新可用房间
  setTimeout(() => {
    updateAvailableRooms()
  }, 100)
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
  const wasRestRoom = orderData.value.isRestRoom
  orderData.value.isRestRoom = checkIfRestRoom()

  // 如果状态发生变化，更新备注
  if (wasRestRoom !== orderData.value.isRestRoom) {
    if (orderData.value.isRestRoom) {
      // 变成休息房，添加标识
      if (!orderData.value.remarks.includes('【休息房】')) {
        orderData.value.remarks = orderData.value.remarks ?
          `【休息房】${orderData.value.remarks}` : '【休息房】'
      }
      // 调整价格为半价（如果当前价格大于0）
      if (orderData.value.roomPrice > 0) {
        orderData.value.roomPrice = Math.round(orderData.value.roomPrice / 2)
      }
      // 调整押金
      if (orderData.value.deposit > 50) {
        orderData.value.deposit = 50
      }
    } else {
      // 不再是休息房，移除标识
      orderData.value.remarks = orderData.value.remarks.replace(/【休息房】/g, '').trim()
      // 恢复原价（如果当前是半价）
      if (orderData.value.roomPrice > 0) {
        orderData.value.roomPrice = orderData.value.roomPrice * 2
      }
      // 恢复押金
      if (orderData.value.deposit < 100) {
        orderData.value.deposit = 100
      }
    }
  }
}

/**
 * 离店日期变化时的处理函数
 */
async function onCheckOutDateChange() {
  // 更新可用房间
  await updateAvailableRooms();
}

/**
 * 入住日期变化时的处理函数
 */
async function onCheckInDateChange() {
  // 如果离店日期小于入住日期，重置离店日期
  if (orderData.value.checkOutDate < orderData.value.checkInDate) {
    // 设置为入住日期（允许同一天，即休息房）
    orderData.value.checkOutDate = orderData.value.checkInDate;
    dateRange.value.to = date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD');
  }

  // 更新休息房状态
  updateRestRoomStatus();

  // 更新可用房间
  await updateAvailableRooms();
}

/**
 * 日期范围变化时的处理函数
 */
async function onDateRangeChange() {
  if (dateRange.value.from) {
    dateRange.value.from = date.formatDate(dateRange.value.from, 'YYYY-MM-DD');
    orderData.value.checkInDate = dateRange.value.from;
  }
  if (dateRange.value.to) {
    dateRange.value.to = date.formatDate(dateRange.value.to, 'YYYY-MM-DD');
    orderData.value.checkOutDate = dateRange.value.to;
  }

  // 更新可用房间
  await updateAvailableRooms();
}

// 计算属性：休息房状态
const isRestRoom = computed(() => {
  return orderData.value.checkInDate === orderData.value.checkOutDate
});



// 计算属性：总价格（多日情况下）
const totalPrice = computed(() => {
  if (isMultiDay.value) {
    return dateList.value.reduce((sum, date) => {
      return sum + (dailyPrices.value[date] || 0)
    }, 0)
  }
  return orderData.value.roomPrice || 0
});

// 监听休息房状态变化，自动处理价格和备注
watch(isRestRoom, (newValue, oldValue) => {
  // 同步到数据对象中（为了兼容性）
  orderData.value.isRestRoom = newValue;

  // 如果状态发生变化，处理备注和价格
  if (newValue !== oldValue) {
    if (newValue) {
      // 变成休息房，添加标识
      if (!orderData.value.remarks.includes('【休息房】')) {
        orderData.value.remarks = orderData.value.remarks ?
          `【休息房】${orderData.value.remarks}` : '【休息房】'
      }
      // 调整价格为半价（如果当前价格大于0）
      if (orderData.value.roomPrice > 0) {
        orderData.value.roomPrice = Math.round(orderData.value.roomPrice / 2)
      }
      // 调整押金
      if (orderData.value.deposit > 50) {
        orderData.value.deposit = 50
      }
    } else {
      // 不再是休息房，移除标识
      orderData.value.remarks = orderData.value.remarks.replace(/【休息房】/g, '').trim()
      // 恢复原价（如果当前是半价）
      if (orderData.value.roomPrice > 0) {
        orderData.value.roomPrice = orderData.value.roomPrice * 2
      }
      // 恢复押金
      if (orderData.value.deposit < 100) {
        orderData.value.deposit = 100
      }
    }
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

/* 多日价格设置卡片 */
.multi-day-pricing-card {
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
}

/* 价格项卡片 */
.price-item-card {
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid #e0e0e0;
  background: #ffffff;
}

.price-item-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 日期徽章样式 */
.date-badge {
  display: flex;
  align-items: center;
  background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
  color: white;
  border-radius: 8px;
  padding: 8px 12px;
  min-width: 80px;
  box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.date-number {
  font-size: 24px;
  font-weight: bold;
  line-height: 1;
  margin-right: 8px;
}

.date-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.month-day {
  font-size: 12px;
  opacity: 0.9;
  line-height: 1;
}

.weekday {
  font-size: 11px;
  opacity: 0.8;
  line-height: 1;
  margin-top: 2px;
}

/* 价格输入框 */
.price-input {
  border-radius: 6px;
}

.price-input .q-field__control {
  border-radius: 6px;
}

/* 按钮样式 */
.apply-price-btn {
  border-radius: 6px;
  padding: 8px 16px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
}

.smart-pricing-btn {
  border-radius: 6px;
  padding: 8px 16px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(96, 125, 139, 0.3);
}

/* 总价卡片 */
.total-price-card {
  background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  min-width: 140px;
}

.total-price-card .text-caption:first-child {
  color: rgba(255, 255, 255, 0.9) !important;
}

.total-price-card .text-caption:last-child {
  color: rgba(255, 255, 255, 0.8) !important;
}

.total-price-card .text-h5 {
  color: white !important;
}

.total-price-card .q-icon {
  color: white !important;
}

/* 价格列表动画 */
.pricing-list {
  animation: fadeInUp 0.6s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .date-badge {
    min-width: 70px;
    padding: 6px 10px;
  }

  .date-number {
    font-size: 20px;
  }

  .month-day, .weekday {
    font-size: 10px;
  }

  .apply-price-btn, .smart-pricing-btn {
    padding: 6px 12px;
    font-size: 12px;
  }

  .total-price-card {
    min-width: 120px;
  }
}

/* 深色模式适配 */
.body--dark .multi-day-pricing-card {
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  border-color: #404040;
}

.body--dark .price-item-card {
  background: #2d2d2d;
  border-color: #404040;
}

.body--dark .price-item-card:hover {
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
}

/* 输入框聚焦效果 */
.price-input .q-field--focused .q-field__control {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

/* 价格趋势图标动画 */
.q-icon[name="trending_up"] {
  transition: all 0.3s ease;
}

/* 卡片进入动画 */
.price-item-card {
  animation: slideInLeft 0.4s ease-out;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 按钮悬停效果 */
.apply-price-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(255, 152, 0, 0.4);
}

.smart-pricing-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(96, 125, 139, 0.4);
}

/* 总价卡片悬停效果 */
.total-price-card:hover {
  transform: scale(1.02);
  box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4);
}

/* 单日价格卡片 */
.single-day-pricing-card {
  border-radius: 8px;
  border: 1px solid #e3f2fd;
  background: linear-gradient(135deg, #f8fffe 0%, #ffffff 100%);
  transition: all 0.3s ease;
}

.single-day-pricing-card:hover {
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.15);
  transform: translateY(-1px);
}

/* 单日价格输入框 */
.single-price-input {
  border-radius: 6px;
}

.single-price-input .q-field__control {
  border-radius: 6px;
}

/* 押金卡片 */
.deposit-card {
  border-radius: 8px;
  border: 1px solid #fff3e0;
  background: linear-gradient(135deg, #fffcf8 0%, #ffffff 100%);
  transition: all 0.3s ease;
}

.deposit-card:hover {
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
  transform: translateY(-1px);
}

/* 押金输入框 */
.deposit-input {
  border-radius: 6px;
}

.deposit-input .q-field__control {
  border-radius: 6px;
}

/* 深色模式适配 - 单日价格和押金卡片 */
.body--dark .single-day-pricing-card {
  background: linear-gradient(135deg, #1e2328 0%, #2d2d2d 100%);
  border-color: #404040;
}

.body--dark .deposit-card {
  background: linear-gradient(135deg, #2d1e1e 0%, #2d2d2d 100%);
  border-color: #404040;
}

.body--dark .single-day-pricing-card:hover,
.body--dark .deposit-card:hover {
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
}

/* 卡片标题图标动画 */
.single-day-pricing-card .q-icon,
.deposit-card .q-icon {
  transition: transform 0.3s ease;
}

.single-day-pricing-card:hover .q-icon,
.deposit-card:hover .q-icon {
  transform: scale(1.1);
}

/* 输入框聚焦效果增强 */
.single-price-input .q-field--focused .q-field__control {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.deposit-input .q-field--focused .q-field__control {
  box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.2);
}
</style>
