<template>
    <!-- 整个创建订单页面的主容器，添加内边距 -->
    <div class="check-in q-pa-md">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-md">创建订单</h1>

      <!-- 添加测试数据按钮 -->
      <div class="row q-mb-md">
        <q-btn
          label="填充测试数据"
          color="orange"
          icon="bug_report"
          @click="fillTestData"
          class="q-mr-sm"
        />
        <q-btn
          v-if="isDev"
          label="随机数据"
          color="purple"
          icon="auto_awesome"
          @click="fillRandomData"
          class="q-mr-sm"
        />
        <q-btn
          v-if="isDev && roomStore.rooms.length === 0"
          label="创建测试房间"
          color="negative"
          icon="add_home"
          @click="createTestRooms"
        />
      </div>

      <!-- 警告信息显示 -->
      <q-banner v-if="roomStore.rooms.length === 0" class="bg-red text-white q-mb-md">
        <template v-slot:avatar>
          <q-icon name="warning" />
        </template>
        系统中没有房间数据，无法创建订单。请先添加房间，或点击"创建测试房间"按钮初始化测试数据。
      </q-banner>

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

            <!-- 入住信息部分 - 移到房间信息之前 -->
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
                    @update:model-value="updateDatesAndRooms"
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
                            @update:model-value="updateCheckOutMinDateAndRooms"
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
                            @update:model-value="updateAvailableRooms"
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
                    label="房间号"
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
  import { roomApi } from '../api' // 导入房间API模块

  // 获取路由和store
  const router = useRouter()
  const orderStore = useOrderStore()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const $q = useQuasar() // For notifications

  // 检查是否为开发环境
  const isDev = ref(process.env.NODE_ENV === 'development')

  // 使用roomStore中的状态常量
  const { ROOM_STATES } = roomStore

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
    { label: '所有状态', value: 'all'},
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
    deposit: 100,                        // 押金，默认100元
    paymentMethod: '微信',               // 支付方式，默认微信
    roomPrice: 0,                        // 房间价格，会根据选择的房间自动设置
    remarks: '',                         // 备注信息（可选）
    createTime: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD HH:mm:ss'), // 创建时间
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
   * 更新入住和离店日期，并刷新可用房间列表
   */
  async function updateDatesAndRooms() {
    if (dateRange.value.from) {
      // 将日期格式化为 YYYY-MM-DD 再赋值
      orderData.value.checkInDate = date.formatDate(dateRange.value.from, 'YYYY-MM-DD');
    }
    if (dateRange.value.to) {
      // 将日期格式化为 YYYY-MM-DD 再赋值
      orderData.value.checkOutDate = date.formatDate(dateRange.value.to, 'YYYY-MM-DD');
    }
    await updateAvailableRooms();
  }

  /**
   * 更新离店日期的最小值并刷新可用房间列表
   */
  async function updateCheckOutMinDateAndRooms() {
    // 如果离店日期小于等于入住日期，重置离店日期
    if (orderData.value.checkOutDate <= orderData.value.checkInDate) {
      // 设置为入住日期后一天，并格式化为 YYYY-MM-DD
      orderData.value.checkOutDate = date.formatDate(
        date.addToDate(new Date(orderData.value.checkInDate), { days: 1 }),
        'YYYY-MM-DD'
      );

      // 同步更新日期范围，注意这里dateRange存储的是YYYY/MM/DD格式，但我们已经确保orderData.value中的是YYYY-MM-DD
      // 这里可以保持dateRange的格式不变，因为它只用于q-date组件内部显示
      // 或者，为了保持一致性，也可以将dateRange.to也格式化，但这会影响q-date内部逻辑，不推荐修改dateRange的格式
      // 保持dateRange的YYYY/MM/DD格式，只格式化赋值给orderData即可
       dateRange.value.to = date.formatDate(orderData.value.checkOutDate, 'YYYY/MM/DD');

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
    orderData.value.roomNumber = null;

    // 获取指定日期范围和房型的可用房间（API返回所有可用房间，不仅仅是当前房型）
    const rooms = await roomStore.getAvailableRoomsByDate(
      orderData.value.checkInDate,
      orderData.value.checkOutDate
      // 不传typeCode，获取所有类型
    );
    console.log('API返回的可用房间:', rooms); // 重点调试
    availableRoomsByDate.value = rooms; // 保存下来
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
    dateRange.value.from = orderData.value.checkInDate;
    await updateAvailableRooms();
  });

  watch(() => orderData.value.checkOutDate, async () => {
    dateRange.value.to = orderData.value.checkOutDate;
    await updateAvailableRooms();
  });

  // 监听房型变化
  watch(() => orderData.value.roomType, async () => {
    await updateAvailableRooms();
  });

  // 修改计算可用房间的选项
  const roomTypeOptionsWithCount = computed(() => {
    // 用当前时间范围下的可用房间统计
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

  const availableRoomOptions = computed(() => {
    if (!orderData.value.roomType) return [];
    return availableRoomsByDate.value
      .filter(room => room.type_code === orderData.value.roomType)
      .map(room => ({
        label: `${room.room_number} (${viewStore.getRoomTypeName(room.type_code)})`,
        value: room.room_number,
        type: room.type_code,
        price: room.price,
        id: room.room_id
      }));
  });

  // 计算当前选择房型的可用房间数量
  const availableRoomCount = computed(() => {
    if (!orderData.value.roomType) return 0;
    // 用当前时间范围下的可用房间统计
    return availableRoomsByDate.value.filter(
      room => room.type_code === orderData.value.roomType
    ).length;
  })
  // 从roomStore获取房间类型选项数组和可用房间数量
  const roomTypeOptionsWithCountFromStore = computed(() => roomStore.getRoomTypeOptionsWithCount());

  // 根据房间数量获取对应的颜色
  const getRoomCountColor = roomStore.getRoomCountColor;

  /**
   * 当房型改变时的处理函数
   * 1. 重置房间号
   * 2. 根据新房型选择第一个可用房间
   * 3. 根据房型设置房间金额
   * @param {string} value - 选择的房型值
   */
  function onRoomTypeChange(value) {
    orderData.value.roomNumber = null;
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
            orderData.value.roomPrice = selectedRoom.price;
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

    // 获取选择的房间 (client-side check before API call)
    const selectedRoom = roomStore.getRoomByNumber(orderData.value.roomNumber)

    // 添加更详细的调试信息
    console.log('提交订单前的房间信息:', {
      roomNumber: orderData.value.roomNumber,
      selectedRoom: selectedRoom
    })

    // 改进房间检查逻辑
    if (!selectedRoom) {
      $q.notify({
        type: 'negative',
        message: `房间 ${orderData.value.roomNumber} 数据不存在，请重新选择`,
        position: 'top'
      });
      return
    }

    // 确认选择的房间确实是可用状态 (client-side check)
    const displayStatus = roomStore.getRoomDisplayStatus(selectedRoom)
    if (displayStatus !== ROOM_STATES.AVAILABLE) {
      $q.notify({
        type: 'negative',
        message: `房间 ${orderData.value.roomNumber} 当前状态为 ${roomStore.getRoomStatusText(selectedRoom)}，无法预订`,
        position: 'top'
      });
      return
    }

    try {
      // 使用 orderStore.addOrder 创建订单
      const newOrder = await orderStore.addOrder({
        ...orderData.value,
        createTime: date.formatDate(now, 'YYYY-MM-DD HH:mm:ss'),
        paymentMethod: typeof orderData.value.paymentMethod === 'object' ?
          orderData.value.paymentMethod.value :
          orderData.value.paymentMethod,
        roomPrice: Number(orderData.value.roomPrice),
        deposit: Number(orderData.value.deposit)
      });

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

      if (error.response && error.response.data) {
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
   * 创建测试房间数据
   */
  async function createTestRooms() {
    try {
      $q.loading.show({
        message: '正在创建测试房间数据...'
      })

      // 测试房型数据
      const roomTypes = [
        { type_code: 'standard', name: '标准间', price: 288 },
        { type_code: 'deluxe', name: '豪华间', price: 388 },
        { type_code: 'suite', name: '套房', price: 588 }
      ]

      // 为每种房型创建测试房间
      const createdRooms = []
      let roomIdCounter = 1

      for (const type of roomTypes) {
        // 每种类型创建2个房间
        for (let i = 1; i <= 2; i++) {
          const floorNum = type.type_code === 'standard' ? 1 : (type.type_code === 'deluxe' ? 2 : 3)
          const roomNumber = `${floorNum}0${i}`

          const room = {
            room_id: roomIdCounter++,
            room_number: roomNumber,
            type_code: type.type_code,
            status: 'available',
            price: type.price
          }

          try {
            // 调用API添加房间
            await roomApi.addRoom(room)
            createdRooms.push(room)
            console.log(`创建测试房间成功: ${roomNumber}`)
          } catch (err) {
            console.error(`创建房间 ${roomNumber} 失败:`, err)
          }
        }
      }

      // 重新加载房间数据
      await roomStore.fetchAllRooms()

      $q.loading.hide()
      $q.notify({
        type: 'positive',
        message: `已成功创建 ${createdRooms.length} 个测试房间`,
        position: 'top',
        timeout: 3000
      })

      console.log('创建的测试房间:', createdRooms)
    } catch (err) {
      $q.loading.hide()
      console.error('创建测试房间失败:', err)
      $q.notify({
        type: 'negative',
        message: '创建测试房间失败: ' + (err.message || String(err)),
        position: 'top',
        timeout: 5000
      })
    }
  }

  // 组件挂载时执行的钩子函数
  onMounted(async () => {
    // 页面加载时，主动拉取一次可用房间，保证房型数量能显示
    await updateAvailableRooms();
  });
  </script>

  <style scoped>
  /* 页面主容器样式，限制最大宽度并居中 */
  .check-in {
     max-width: 1200px;
    margin: 0 auto;
  }
  </style>
