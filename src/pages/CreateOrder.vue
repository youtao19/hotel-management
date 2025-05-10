<template>
    <!-- 整个创建订单页面的主容器，添加内边距 -->
    <div class="check-in q-pa-md">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-md">创建订单</h1>

      <!-- 主卡片容器，包含整个表单 -->
      <q-card>
        <q-card-section>
          <!-- 表单组件，提交时调用submitOrder方法，各输入框之间有间距 -->
          <q-form @submit="submitOrder" class="q-gutter-md">
            <!-- 订单信息部分 -->
            <div class="form-section q-mb-md">
              <!-- 分区标题 -->
              <div class="text-subtitle1 q-mb-sm">订单信息</div>
              <!-- 栅格布局，各列之间有间距 -->
              <div class="row q-col-gutter-md">
                <!-- 订单号输入框（中等屏幕占1/3宽度，小屏幕占满） -->
                <div class="col-md-4 col-xs-12">
                  <!-- 自动生成订单号的输入框，必填 -->
                  <q-input
                    v-model="orderData.orderNumber"
                    label="订单号"
                    filled
                    :rules="[val => !!val || '请输入订单号']"
                    hint="自动生成，可手动修改"
                  />
                </div>
                <!-- 订单状态选择框（中等屏幕占1/3宽度，小屏幕占满） -->
                <div class="col-md-4 col-xs-12">
                  <!-- 订单状态下拉选择，默认为待入住，必填 -->
                  <q-select
                    v-model="orderData.status"
                    :options="statusOptions"
                    label="订单状态"
                    filled
                    emit-value
                    map-options
                    :rules="[val => !!val || '请选择订单状态']"
                  />
                </div>
                <!-- 订单来源选择框（中等屏幕占1/3宽度，小屏幕占满） -->
                <div class="col-md-4 col-xs-12">
                  <!-- 订单来源下拉选择 -->
                  <q-select
                    v-model="orderData.source"
                    :options="sourceOptions"
                    label="订单来源"
                    filled
                    emit-value
                    map-options
                  />
                </div>
                <!-- 来源编号输入框（中等屏幕占1/3宽度，小屏幕占满） -->
                <div class="col-md-4 col-xs-12">
                  <!-- 来源编号输入框 -->
                  <q-input
                    v-model="orderData.sourceNumber"
                    label="来源编号"
                    filled
                    hint="OTA订单号/旅行社单号等"
                  />
                </div>
              </div>
            </div>

            <!-- 客人信息部分 -->
            <div class="form-section q-mb-md">
              <!-- 分区标题 -->
              <div class="text-subtitle1 q-mb-sm">客人信息</div>
              <!-- 栅格布局，各列之间有间距 -->
              <div class="row q-col-gutter-md">
                <!-- 姓名输入框 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 客人姓名输入框，必填 -->
                  <q-input
                    v-model="orderData.guestName"
                    label="姓名"
                    filled
                    :rules="[val => !!val || '请输入姓名']"
                  />
                </div>
                <!-- 身份证号输入框 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 身份证号输入框，有格式验证，必填，最多18位 -->
                  <q-input
                    v-model="orderData.idNumber"
                    label="身份证号"
                    filled
                    type="text"
                    maxlength="18"
                    @input="validateIdNumber"
                    :rules="[
                      val => !!val || '请输入身份证号',
                      val => (val.length === 18) || '身份证号必须为18位',
                      val => /^[0-9X]+$/.test(val) || '身份证号只能包含数字和X'
                    ]"
                  >
                    <!-- 提示文本 -->
                    <template v-slot:hint>
                      请输入18位身份证号，最后一位可以是数字或X
                    </template>
                  </q-input>
                </div>
                <!-- 手机号输入框 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 手机号输入框，必填，11位数字 -->
                  <q-input
                    v-model="orderData.phone"
                    label="手机号"
                    filled
                    mask="###########"
                    :rules="[
                      val => !!val || '请输入手机号',
                      val => (val.length === 11) || '手机号必须为11位'
                    ]"
                  />
                </div>
              </div>
            </div>

            <!-- 房间信息部分 -->
            <div class="form-section q-mb-md">
              <!-- 分区标题 -->
              <div class="text-subtitle1 q-mb-sm">房间信息</div>

              <!-- 房间选择区域 - 水平布局 -->
              <div class="row q-col-gutter-md">
                <!-- 房间类型选择 -->
                <div class="col-md-6 col-xs-12">
                  <div class="row items-center">
                    <!-- 房间类型下拉选择，必填，选择后会触发onRoomTypeChange方法 -->
                    <div class="col">
                      <q-select
                        v-model="orderData.roomType"
                        :options="roomTypeOptionsWithCount"
                        label="房间类型"
                        filled
                        emit-value
                        map-options
                        @update:model-value="onRoomTypeChange"
                        :rules="[val => !!val || '请选择房间类型']"
                      >
                        <!-- 在选项中显示房间数量徽章 -->
                        <template v-slot:option="scope">
                          <q-item v-bind="scope.itemProps">
                            <q-item-section>
                              <q-item-label>{{ scope.opt.label }}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                              <q-badge
                                :color="getRoomCountColor(scope.opt.availableCount)"
                                :label="scope.opt.availableCount + '间'"
                              />
                            </q-item-section>
                          </q-item>
                        </template>
                      </q-select>
                    </div>
                    <!-- 当前房型剩余房间信息 -->
                    <div class="col-auto q-ml-md" v-if="orderData.roomType">
                      <q-chip
                        :color="getRoomCountColor(availableRoomCount)"
                        text-color="white"
                        icon="hotel"
                      >
                        剩余: {{ availableRoomCount }}间
                      </q-chip>
                    </div>
                  </div>
                </div>

                <!-- 房间号选择 -->
                <div class="col-md-6 col-xs-12">
                  <!-- 房间号下拉选择，根据房型筛选可用房间，必填 -->
                  <q-select
                    v-model="orderData.roomNumber"
                    :options="availableRoomOptions"
                    :label="orderData.roomType ? `房间号` : '房间号'"
                    filled
                    emit-value
                    map-options
                    :rules="[val => !!val || '请选择房间号']"
                    :disable="!orderData.roomType"
                  >
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
              <!-- 栅格布局，各列之间有间距 -->
              <div class="row q-col-gutter-md">
                <!-- 支付方式选择 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 支付方式下拉选择，必填 -->
                  <q-select
                    v-model="orderData.paymentMethod"
                    :options="viewStore.paymentMethodOptions"
                    label="支付方式"
                    filled
                    :rules="[val => !!val || '请选择支付方式']"
                  />
                </div>
                <!-- 房间金额输入 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 房间金额输入框，数字类型，自动根据房型设置默认值 -->
                  <q-input
                    v-model.number="orderData.roomPrice"
                    label="房间金额"
                    filled
                    type="number"
                    prefix="¥"
                    :rules="[val => val > 0 || '房间金额必须大于0']"
                  />
                </div>
                <!-- 押金输入 -->
                <div class="col-md-4 col-xs-12">
                  <!-- 押金输入框，数字类型，默认100元 -->
                  <q-input
                    v-model.number="orderData.deposit"
                    label="押金"
                    filled
                    type="number"
                    prefix="¥"
                    :rules="[val => val >= 0 || '押金不能为负数']"
                  />
                </div>
              </div>
            </div>

            <!-- 入住信息部分 -->
            <div class="form-section q-mb-md">
              <!-- 分区标题 -->
              <div class="text-subtitle1 q-mb-sm">入住时间</div>
              <!-- 栅格布局 -->
              <div class="row">
                <!-- 日期范围选择器，占满整行 -->
                <div class="col-12">
                  <!-- 横向日期范围选择器，可选择入住和离店日期 -->
                  <q-date
                    v-model="dateRange"
                    range
                    filled
                    emit-value
                    landscape
                    today-btn
                    color="primary"
                    :options="dateOptions"
                    @update:model-value="updateDates"
                  >
                    <!-- 底部确认按钮 -->
                    <div class="row items-center justify-end q-pr-sm q-pb-sm">
                      <q-btn label="确定" color="primary" flat v-close-popup />
                    </div>
                  </q-date>
                </div>
                <!-- 入住日期显示框 -->
                <div class="col-md-6 col-xs-12 q-mt-md">
                  <!-- 入住日期输入框，只读，显示选择的日期 -->
                  <q-input
                    v-model="orderData.checkInDate"
                    label="入住日期"
                    filled
                    readonly
                    :rules="[val => !!val || '请选择入住日期']"
                  >
                    <!-- 日期选择图标和弹出日历 -->
                    <template v-slot:append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy ref="qDateCheckInProxy" cover transition-show="scale" transition-hide="scale">
                          <!-- 单独的入住日期选择器，最早可选今天 -->
                          <q-date
                            v-model="orderData.checkInDate"
                            @update:model-value="updateCheckOutMinDate"
                            :options="date => date >= today"
                          >
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
                <!-- 离店日期显示框 -->
                <div class="col-md-6 col-xs-12 q-mt-md">
                  <!-- 离店日期输入框，只读，显示选择的日期 -->
                  <q-input
                    v-model="orderData.checkOutDate"
                    label="离店日期"
                    filled
                    readonly
                    :rules="[
                      val => !!val || '请选择离店日期',
                      val => val > orderData.checkInDate || '离店日期必须晚于入住日期'
                    ]"
                  >
                    <!-- 日期选择图标和弹出日历 -->
                    <template v-slot:append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy ref="qDateCheckOutProxy" cover transition-show="scale" transition-hide="scale">
                          <!-- 单独的离店日期选择器，最早可选入住日期后一天 -->
                          <q-date
                            v-model="orderData.checkOutDate"
                            :options="date => date > orderData.checkInDate"
                          >
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
              </div>
            </div>

            <!-- 备注信息部分 -->
            <div class="form-section q-mb-md">
              <!-- 分区标题 -->
              <div class="text-subtitle1 q-mb-sm">备注信息</div>
              <!-- 栅格布局，各列之间有间距 -->
              <div class="row q-col-gutter-md">
                <!-- 备注文本区域 -->
                <div class="col-md-12 col-xs-12">
                  <!-- 备注输入框，文本域，可自动增高 -->
                  <q-input
                    v-model="orderData.remarks"
                    label="备注"
                    filled
                    type="textarea"
                    autogrow
                  />
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
  </template>

  <script setup>
  import { ref, onMounted, computed, nextTick, watch } from 'vue'
  import { date, useQuasar } from 'quasar'
  import { useRouter } from 'vue-router'
  import { useOrderStore } from '../stores/orderStore' // 导入订单 store
  import { useRoomStore } from '../stores/roomStore' // 导入房间 store
  import { useViewStore } from '../stores/viewStore' // 导入视图 store
  import { api } from 'boot/axios' // Assuming api is exported from boot/axios.js

  // 获取路由和store
  const router = useRouter()
  const orderStore = useOrderStore()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const $q = useQuasar() // For notifications

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
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' }
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
    status: 'pending',                   // 默认状态为"待入住"，使用英文代码
    source: 'front_desk',                // 默认订单来源为前台录入
    sourceNumber: '',                    // 来源编号
    guestName: '',                       // 客人姓名
    idNumber: '',                        // 身份证号
    phone: '',                           // 手机号
    roomType: null,                      // 房间类型
    roomNumber: null,                    // 房间号
    checkInDate: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD'),        // 入住日期，默认今天
    checkOutDate: date.formatDate(date.addToDate(getCurrentTimeToMinute(), { days: 1 }), 'YYYY-MM-DD'), // 离店日期，默认明天
    deposit: 100,                        // 押金，默认100元
    paymentMethod: 'cash',               // 支付方式，默认现金
    roomPrice: 0,                        // 房间价格
    remarks: ''                          // 备注信息
  })

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
   * 更新入住和离店日期
   * 在日期范围选择器中选择日期后调用
   */
  function updateDates() {
    if (dateRange.value.from) {
      orderData.value.checkInDate = dateRange.value.from
    }
    if (dateRange.value.to) {
      orderData.value.checkOutDate = dateRange.value.to
    }
  }

  /**
   * 更新离店日期的最小值
   * 确保离店日期始终晚于入住日期
   */
  function updateCheckOutMinDate() {
    // 如果离店日期小于等于入住日期，重置离店日期
    if (orderData.value.checkOutDate <= orderData.value.checkInDate) {
      // 设置为入住日期后一天
      orderData.value.checkOutDate = date.formatDate(
        date.addToDate(new Date(orderData.value.checkInDate), { days: 1 }),
        'YYYY-MM-DD'
      )

      // 同步更新日期范围
      dateRange.value.to = orderData.value.checkOutDate
    }
  }

  // 监听入住日期变化，同步更新日期范围和离店日期
  watch(() => orderData.value.checkInDate, (newVal) => {
    dateRange.value.from = newVal
    updateCheckOutMinDate()
  })

  // 监听离店日期变化，同步更新日期范围
  watch(() => orderData.value.checkOutDate, (newVal) => {
    dateRange.value.to = newVal
  })

  // 监听房间号变化，更新房间价格
  watch(() => orderData.value.roomNumber, (newVal) => {
    if (newVal) {
      const selectedRoom = roomStore.getRoomByNumber(newVal)
      if (selectedRoom) {
        orderData.value.roomPrice = selectedRoom.price
      }
    }
  })

  // 计算当前选择房型的可用房间数量
  const availableRoomCount = computed(() => {
    if (!orderData.value.roomType) return 0;
    return roomStore.getAvailableRoomCountByType(orderData.value.roomType);
  })

  // 从roomStore获取房间类型选项数组和可用房间数量
  const roomTypeOptionsWithCount = computed(() => roomStore.getRoomTypeOptionsWithCount());

  /**
   * 根据房间数量获取对应的颜色
   * @param {number} count - 房间数量
   * @returns {string} 对应的颜色
   */
  const getRoomCountColor = roomStore.getRoomCountColor;

  // 计算可用房间的选项
  const availableRoomOptions = computed(() => {
    // 如果未选择房型，返回空数组
    if (!orderData.value.roomType) return [];

    // 使用roomStore的getAvailableRoomOptions方法获取特定房型的可用房间
    return roomStore.getAvailableRoomOptions(orderData.value.roomType);
  })

  /**
   * 当房型改变时的处理函数
   * 1. 重置房间号
   * 2. 根据新房型选择第一个可用房间
   * 3. 根据房型设置房间金额
   * @param {string} value - 选择的房型值
   */
  function onRoomTypeChange(value) {
    // 重置房间号
    orderData.value.roomNumber = null

    // 等待DOM更新完成后执行
    nextTick(() => {
      // 获取当前房型的数量信息
      const roomTypeText = viewStore.getRoomTypeName(value);
      const count = availableRoomCount.value;

      // 检查当前房型是否有可用房间
      if (count === 0) {
        // 如果没有可用房间，显示提示信息
        alert(`当前没有可用的${roomTypeText}，请联系管理员。`)
      } else {
        // 有可用房间，自动选择第一个
        orderData.value.roomNumber = availableRoomOptions.value[0].value

        // 根据选择的房间设置房间金额
        const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)
        if (selectedRoom) {
          orderData.value.roomPrice = selectedRoom.price
        }

        // 当房间数量较少时提醒用户
        if (count <= 3) {
          console.log(`当前${roomTypeText}仅剩${count}间可用`)
        }
      }
    })
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
   * 提交订单函数
   * 收集表单数据，调用后端API创建订单，并导航到订单列表页面
   */
  async function submitOrder() { // Made function async
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

    // 获取选择的房间 (client-side check before API call)
    const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)
    if (!selectedRoom) {
      $q.notify({
        type: 'negative',
        message: '所选房间数据不存在，请重新选择',
        position: 'top'
      });
      return
    }

    // 确认选择的房间确实是可用状态 (client-side check)
    // Backend should also validate this, but good to have a client-side check
    if (selectedRoom.status !== 'available') {
      $q.notify({
        type: 'negative',
        message: `房间 ${selectedRoom.number} 当前状态为 ${viewStore.getStatusText(selectedRoom.status)}，无法预订`,
        position: 'top'
      });
      return
    }

    // 创建包含所有字段的订单对象，用于发送到后端
    // Field names should match what backend `orderRoute.js` expects in `req.body`
    const orderToSubmit = {
      ...orderData.value,
      // 确保状态值是英文代码，而不是中文显示文本
      status: orderData.value.status,
      // 确保日期格式正确 (YYYY-MM-DD)
      checkInDate: date.formatDate(orderData.value.checkInDate, 'YYYY-MM-DD'),
      checkOutDate: date.formatDate(orderData.value.checkOutDate, 'YYYY-MM-DD'),
      createTime: date.formatDate(now, 'YYYY-MM-DD HH:mm:ss'),
      actualCheckInTime: orderData.value.status === 'checked-in' ?
        date.formatDate(now, 'YYYY-MM-DD HH:mm:ss') : null,
      actualCheckOutTime: orderData.value.status === 'checked-out' ?
        date.formatDate(now, 'YYYY-MM-DD HH:mm:ss') : null,
      // 确保支付方式是字符串
      paymentMethod: typeof orderData.value.paymentMethod === 'object' ?
        orderData.value.paymentMethod.value :
        (orderData.value.paymentMethod || 'cash'),
      // 确保数值字段被转换为数字
      roomPrice: Number(orderData.value.roomPrice),
      deposit: Number(orderData.value.deposit),
    };

    // 打印提交的数据，用于调试
    console.log('提交的订单数据:', orderToSubmit);

    try {
      // 调用后端API创建订单
      const response = await api.post('/api/orders', orderToSubmit);

      if (response.data && response.data.order) {
        // 订单创建成功
        // 可选：将后端返回的订单添加到本地store
        orderStore.addOrder(response.data.order);

        // 重要提示：房间状态的更新 (e.g., setting room to 'reserved' or 'occupied')
        // 应该由后端处理，或者通过后续的API调用来完成。
        // 当前的 /api/orders 端点仅创建订单，不修改房间状态。
        // 原先的 roomStore.reserveRoom(), occupyRoom() 等调用已移除。

        $q.notify({
          type: 'positive',
          message: response.data.message || '订单创建成功！',
          position: 'top'
        });

        // 导航到订单列表页面
        router.push('/ViewOrders');
      } else {
        // 响应成功但数据格式不符合预期
        $q.notify({
          type: 'warning',
          message: '订单创建请求成功，但服务器响应异常。' + (response.data.message || ''),
          position: 'top'
        });
      }
    } catch (error) {
      console.error('订单创建失败:', error);
      let errorMessage = '订单创建失败，请稍后再试。';
      if (error.response && error.response.data) {
        console.log('服务器返回的详细错误:', error.response.data);

        // 更清晰地展示错误信息
        if (error.response.data.errors && Array.isArray(error.response.data.errors)) {
          // 在控制台中显示每个验证错误
          error.response.data.errors.forEach((err, index) => {
            console.log(`错误 ${index + 1}:`, err);
          });

          // 格式化错误消息
          errorMessage = '表单验证失败：\n' +
            error.response.data.errors.map(e => `- ${e.msg}`).join('\n');
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      $q.notify({
        type: 'negative',
        message: errorMessage,
        position: 'top',
        timeout: 10000, // 延长显示时间
        multiLine: true // 允许多行显示
      });
    }
  }

  // 组件挂载时执行的钩子函数
  onMounted(() => {
    // 检查可用房间数量
    const availableRoomsCount = roomStore.filterRooms({status: 'available'}).length
    console.log('可用房间数量:', availableRoomsCount)

    // 如果没有可用房间，在控制台输出提示信息
    if (availableRoomsCount === 0) {
      console.warn('系统中没有可用房间，请联系管理员设置房间状态。')
    }

    // 获取URL查询参数
    const query = router.currentRoute.value.query

    // 如果有查询参数且包含房间信息，则自动填充表单
    if (query && Object.keys(query).length > 0) {
      console.log('检测到URL查询参数:', query)

      // 设置房间类型
      if (query.roomType) {
        orderData.value.roomType = query.roomType

        // 等待DOM更新完成后再设置房间号
        nextTick(() => {
          // 如果有指定房间号，则设置该房间
          if (query.roomNumber) {
            orderData.value.roomNumber = query.roomNumber

            // 根据房间号获取房间信息，设置房间价格
            const selectedRoom = roomStore.getRoomByNumber(query.roomNumber)
            if (selectedRoom) {
              orderData.value.roomPrice = selectedRoom.price
            }
          }
        })
      }

      // 如果有指定订单状态，则设置状态
      if (query.status) {
        orderData.value.status = query.status
      }
    }
  })
  </script>

  <style scoped>
  /* 页面主容器样式，限制最大宽度并居中 */
  .check-in {
    max-width: 1200px;
    margin: 0 auto;
  }
  </style>
