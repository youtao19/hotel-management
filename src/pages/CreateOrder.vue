<template>
    <div class="check-in q-pa-md">
      <h1 class="text-h4 q-mb-md">创建订单</h1>
      
      <q-card>
        <q-card-section>
          <q-form @submit="submitOrder" class="q-gutter-md">
            <!-- 订单信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">订单信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-input 
                    v-model="orderData.orderNumber" 
                    label="订单号" 
                    filled 
                    :rules="[val => !!val || '请输入订单号']"
                    hint="自动生成，可手动修改"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
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
              </div>
            </div>
  
            <!-- 客人信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">客人信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-input 
                    v-model="orderData.guestName" 
                    label="姓名" 
                    filled 
                    :rules="[val => !!val || '请输入姓名']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
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
                    <template v-slot:hint>
                      请输入18位身份证号，最后一位可以是数字或X
                    </template>
                  </q-input>
                </div>
                <div class="col-md-4 col-xs-12">
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
            
            <!-- 房间信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">房间信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-select
                    v-model="orderData.roomType"
                    :options="roomTypeOptions"
                    label="房间类型"
                    filled
                    emit-value
                    map-options
                    @update:model-value="onRoomTypeChange"
                    :rules="[val => !!val || '请选择房间类型']"
                  />
                </div>
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
                    <template v-slot:no-option>
                      <q-item>
                        <q-item-section class="text-grey">
                          无可用房间
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                </div>
              </div>
            </div>
  
            <!-- 支付信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">支付信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-select
                    v-model="orderData.paymentMethod"
                    :options="[
                      {label: '现金支付', value: 'cash'},
                      {label: '微信支付', value: 'wechat'},
                      {label: '支付宝支付', value: 'alipay'},
                      {label: '银行卡支付', value: 'card'}
                    ]"
                    label="支付方式"
                    filled
                    :rules="[val => !!val || '请选择支付方式']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <q-input
                    v-model.number="orderData.roomPrice"
                    label="房间金额"
                    filled
                    type="number"
                    prefix="¥"
                    :rules="[val => val > 0 || '房间金额必须大于0']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
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
            
            <!-- 入住信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">入住时间</div>
              <div class="row">
                <div class="col-12">
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
                    <div class="row items-center justify-end q-pr-sm q-pb-sm">
                      <q-btn label="确定" color="primary" flat v-close-popup />
                    </div>
                  </q-date>
                </div>
                <div class="col-md-6 col-xs-12 q-mt-md">
                  <q-input 
                    v-model="orderData.checkInDate" 
                    label="入住日期" 
                    filled 
                    readonly
                    :rules="[val => !!val || '请选择入住日期']"
                  >
                    <template v-slot:append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy ref="qDateCheckInProxy" cover transition-show="scale" transition-hide="scale">
                          <q-date 
                            v-model="orderData.checkInDate"
                            @update:model-value="updateCheckOutMinDate"
                            :options="date => date >= today"
                          >
                            <div class="row items-center justify-end">
                              <q-btn label="确定" color="primary" flat v-close-popup />
                            </div>
                          </q-date>
                        </q-popup-proxy>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
                <div class="col-md-6 col-xs-12 q-mt-md">
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
                    <template v-slot:append>
                      <q-icon name="event" class="cursor-pointer">
                        <q-popup-proxy ref="qDateCheckOutProxy" cover transition-show="scale" transition-hide="scale">
                          <q-date 
                            v-model="orderData.checkOutDate"
                            :options="date => date > orderData.checkInDate"
                          >
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
            
            <!-- 备注信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">备注信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-12 col-xs-12">
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
            
            <div class="row justify-end q-mt-md">
              <q-btn label="取消" flat class="q-mr-sm" to="/" />
              <q-btn label="确认创建" type="submit" color="primary" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed, nextTick, watch } from 'vue'
  import { date } from 'quasar'
  import { useRouter } from 'vue-router'
  import { useOrderStore } from '../stores/orderStore' // 导入订单 store
  
  // 获取路由和订单 store
  const router = useRouter()
  const orderStore = useOrderStore()
  
  // 生成订单号
  function generateOrderNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `O${year}${month}${day}${random}`
  }
  
  // 获取当前时间精确到分钟
  function getCurrentTimeToMinute() {
    const now = new Date()
    // 重置秒和毫秒
    now.setSeconds(0)
    now.setMilliseconds(0)
    return now
  }
  
  // 今天的日期字符串
  const today = date.formatDate(new Date(), 'YYYY-MM-DD')
  
  // 订单状态选项
  const statusOptions = [
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' }
  ]
  
  // 订单表单数据 - 必须先定义这个，再定义dateRange
  const orderData = ref({
    orderNumber: generateOrderNumber(),
    status: 'pending', // 默认状态为"待入住"
    guestName: '',
    idNumber: '',
    phone: '',
    roomType: null,
    roomNumber: null,
    checkInDate: date.formatDate(getCurrentTimeToMinute(), 'YYYY-MM-DD'),
    checkOutDate: date.formatDate(date.addToDate(getCurrentTimeToMinute(), { days: 1 }), 'YYYY-MM-DD'),
    deposit: 100,
    paymentMethod: null,
    roomPrice: 0,
    remarks: ''
  })
  
  // 日期范围对象 - 需要在orderData之后定义
  const dateRange = ref({
    from: orderData.value.checkInDate,
    to: orderData.value.checkOutDate
  })
  
  // 日期选项函数 - 只允许选择今天及以后的日期
  const dateOptions = (dateStr) => {
    const currentDate = date.formatDate(new Date(), 'YYYY-MM-DD')
    return dateStr >= currentDate
  }
  
  // 更新入住和离店日期
  function updateDates() {
    if (dateRange.value.from) {
      orderData.value.checkInDate = dateRange.value.from
    }
    if (dateRange.value.to) {
      orderData.value.checkOutDate = dateRange.value.to
    }
  }
  
  // 更新离店日期的最小值
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
  
  // 监听入住日期变化
  watch(() => orderData.value.checkInDate, (newVal) => {
    dateRange.value.from = newVal
    updateCheckOutMinDate()
  })
  
  // 监听离店日期变化
  watch(() => orderData.value.checkOutDate, (newVal) => {
    dateRange.value.to = newVal
  })
  
  // 房间类型选项
  const roomTypeOptions = [
    { label: '标准间', value: 'standard' },
    { label: '豪华间', value: 'deluxe' },
    { label: '套房', value: 'suite' }
  ]
  
  // 模拟可用房间数据
  const availableRooms = ref([
    // 标准间
    { id: 1, number: '101', type: 'standard', status: 'available' },
    { id: 2, number: '102', type: 'standard', status: 'available' },
    { id: 3, number: '103', type: 'standard', status: 'available' },
    // 豪华间
    { id: 4, number: '201', type: 'deluxe', status: 'available' },
    { id: 5, number: '202', type: 'deluxe', status: 'available' },
    { id: 6, number: '203', type: 'deluxe', status: 'available' },
    // 套房
    { id: 7, number: '301', type: 'suite', status: 'available' },
    { id: 8, number: '302', type: 'suite', status: 'available' },
    { id: 9, number: '303', type: 'suite', status: 'available' }
  ])
  
  // 根据选择的房型过滤可用房间
  const availableRoomOptions = computed(() => {
    if (!orderData.value.roomType) return []
    
    const filtered = availableRooms.value
      .filter(room => room.type === orderData.value.roomType && room.status === 'available')
    
    return filtered.map(room => ({
      label: `${room.number} (${room.type === 'standard' ? '标准间' : room.type === 'deluxe' ? '豪华间' : '套房'})`,
      value: room.number
    }))
  })
  
  // 当房型改变时的处理
  function onRoomTypeChange(value) {
    orderData.value.roomNumber = null
    
    // 强制计算属性更新
    nextTick(() => {
      // 如果有可用房间，自动选择第一个
      if (availableRoomOptions.value.length > 0) {
        orderData.value.roomNumber = availableRoomOptions.value[0].value
      }
    })
    
    // 根据房型设置房间金额
    switch(orderData.value.roomType) {
      case 'standard':
        orderData.value.roomPrice = 288;
        break;
      case 'deluxe':
        orderData.value.roomPrice = 388;
        break;
      case 'suite':
        orderData.value.roomPrice = 588;
        break;
      default:
        orderData.value.roomPrice = 0;
    }
  }
  
  // 身份证号验证函数
  function validateIdNumber() {
    // 移除非数字和X/x字符
    orderData.value.idNumber = orderData.value.idNumber.replace(/[^0-9X]/g, '');
    
    // 如果最后一位不是X/x，则确保只有数字
    if (orderData.value.idNumber.length < 18) {
      orderData.value.idNumber = orderData.value.idNumber.replace(/[^0-9]/g, '');
    }
  }
  
  // 提交订单
  function submitOrder() {
    // 入住时将时间优化到当前时间的分钟
    const checkInTime = getCurrentTimeToMinute()
    const orderToSubmit = { 
      ...orderData.value,
      actualCheckInTime: checkInTime
    }
    
    console.log('提交订单:', orderToSubmit)
    
    // 在实际应用中，这里应该调用API保存订单数据
    
    // 添加到订单 store
    orderStore.addOrder(orderToSubmit)
    
    // 模拟API调用成功
    setTimeout(() => {
      // 显示成功提示
      alert('订单创建成功！')
      
      // 修正路由路径 - 使用大写的ViewOrders路径
      router.push('/ViewOrders')
    }, 500)
  }
  
  onMounted(() => {
    // 页面加载时的初始化操作
  })
  </script>
  
  <style scoped>
  .check-in {
    max-width: 1200px;
    margin: 0 auto;
  }
  </style>