<template>
    <div class="view-orders q-pa-md">
      <h1 class="text-h4 q-mb-md">查看订单</h1>
      
      <div class="search-section q-mb-md">
        <div class="row q-col-gutter-md">
          <div class="col-md-6 col-xs-12">
            <q-input 
              v-model="searchQuery" 
              label="搜索订单" 
              filled
              clearable
              @keyup.enter="searchOrders"
            >
              <template v-slot:append>
                <q-icon name="search" class="cursor-pointer" @click="searchOrders" />
              </template>
              <template v-slot:hint>
                输入订单号、客人姓名或手机号
              </template>
            </q-input>
          </div>
          <div class="col-md-4 col-xs-12">
            <q-select
              v-model="filterStatus"
              :options="statusOptions"
              label="订单状态"
              filled
              clearable
              emit-value
              map-options
              @update:model-value="searchOrders"
            />
          </div>
          <div class="col-md-2 col-xs-12">
            <q-btn 
              color="primary" 
              label="搜索" 
              class="full-width" 
              @click="searchOrders" 
            />
          </div>
        </div>
      </div>
      
      <q-card>
        <q-card-section>
          <q-table
            :rows="filteredOrders"
            :columns="orderColumns"
            row-key="orderNumber"
            :pagination="{ rowsPerPage: 10 }"
            :loading="loadingOrders"
            no-data-label="没有找到订单"
          >
            <template v-slot:loading>
              <q-inner-loading showing color="primary" />
            </template>
            
            <template v-slot:body-cell-actions="props">
              <q-td :props="props">
                <q-btn-group flat>
                  <q-btn flat round dense color="primary" icon="visibility" @click="viewOrderDetails(props.row)">
                    <q-tooltip>查看详情</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense color="info" icon="hotel" @click="checkInOrder(props.row)" v-if="props.row.status === '待入住'">
                    <q-tooltip>办理入住</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense color="negative" icon="cancel" @click="cancelOrder(props.row)" v-if="props.row.status === '已入住' || props.row.status === '待入住'">
                    <q-tooltip>取消订单</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense color="positive" icon="check_circle" @click="checkoutOrder(props.row)" v-if="props.row.status === '已入住'">
                    <q-tooltip>办理退房</q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
      
      <!-- 订单详情对话框 -->
      <q-dialog v-model="showOrderDetails" persistent>
        <q-card style="min-width: 350px; max-width: 80vw;">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">订单详情</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>
          
          <q-card-section v-if="currentOrder">
            <div class="row q-col-gutter-md">
              <!-- 订单基本信息 -->
              <div class="col-md-6 col-xs-12">
                <q-list bordered separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>订单号</q-item-label>
                      <q-item-label>{{ currentOrder.orderNumber }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>状态</q-item-label>
                      <q-item-label>
                        <q-badge :color="getStatusColor(currentOrder.status)">
                          {{ currentOrder.status }}
                        </q-badge>
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>订单创建时间</q-item-label>
                      <q-item-label>{{ currentOrder.createTime }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>入住时间</q-item-label>
                      <q-item-label>{{ currentOrder.actualCheckInTime || '未入住' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              
              <!-- 客人信息 -->
              <div class="col-md-6 col-xs-12">
                <q-list bordered separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>客人姓名</q-item-label>
                      <q-item-label>{{ currentOrder.guestName }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>手机号</q-item-label>
                      <q-item-label>{{ currentOrder.phone }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>身份证号</q-item-label>
                      <q-item-label>{{ currentOrder.idNumber }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>退房时间</q-item-label>
                      <q-item-label>{{ currentOrder.actualCheckOutTime || '未退房' }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              
              <!-- 房间信息 -->
              <div class="col-md-6 col-xs-12">
                <q-list bordered separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>房间类型</q-item-label>
                      <q-item-label>{{ getRoomTypeName(currentOrder.roomType) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>房间号</q-item-label>
                      <q-item-label>{{ currentOrder.roomNumber }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>预定入住日期</q-item-label>
                      <q-item-label>{{ currentOrder.checkInDate }} 至 {{ currentOrder.checkOutDate }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              
              <!-- 支付信息 -->
              <div class="col-md-6 col-xs-12">
                <q-list bordered separator>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>支付方式</q-item-label>
                      <q-item-label>{{ currentOrder.paymentMethod?.label || getPaymentMethodName(currentOrder.paymentMethod?.value) }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>房间金额</q-item-label>
                      <q-item-label class="text-primary text-weight-medium">¥{{ currentOrder.roomPrice }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>押金</q-item-label>
                      <q-item-label class="text-primary text-weight-medium">¥{{ currentOrder.deposit }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
              
              <!-- 备注信息 -->
              <div class="col-md-12 col-xs-12" v-if="currentOrder.remarks">
                <q-list bordered>
                  <q-item>
                    <q-item-section>
                      <q-item-label caption>备注</q-item-label>
                      <q-item-label>{{ currentOrder.remarks }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </div>
            </div>
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="关闭" color="primary" v-close-popup />
            <q-btn 
              v-if="currentOrder && currentOrder.status === '待入住'" 
              flat 
              label="办理入住" 
              color="info" 
              @click="checkInOrderFromDetails" 
            />
            <q-btn 
              v-if="currentOrder && currentOrder.status === '已入住'" 
              flat 
              label="更改房间" 
              color="warning" 
              @click="showChangeRoomDialog = true" 
            />
            <q-btn 
              v-if="currentOrder && currentOrder.status === '已入住'" 
              flat 
              label="办理退房" 
              color="positive" 
              @click="checkoutOrderFromDetails" 
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
      
      <!-- 更改房间对话框 -->
      <q-dialog v-model="showChangeRoomDialog" persistent>
        <q-card style="min-width: 350px">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">更改房间</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>
          
          <q-card-section>
            <p>当前房间: {{ currentOrder ? currentOrder.roomNumber : '' }}</p>
            <q-select
              v-model="selectedRoomType"
              :options="roomTypeOptions"
              label="选择房型"
              filled
              emit-value
              map-options
              class="q-mb-md"
            />
            <q-select
              v-model="newRoomNumber"
              :options="filteredAvailableRooms"
              label="选择新房间"
              filled
              emit-value
              map-options
              :disable="!selectedRoomType"
            />
          </q-card-section>
          
          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn flat label="确认更改" color="positive" @click="changeRoom" :disable="!newRoomNumber" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </template>
  
  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { date } from 'quasar'
  import { useOrderStore } from '../stores/orderStore' // 导入订单 store
  
  // 初始化订单 store
  const orderStore = useOrderStore()
  
  // 搜索和过滤
  const searchQuery = ref('')
  const filterStatus = ref(null)
  const loadingOrders = ref(false)
  
  // 订单状态选项
  const statusOptions = [
    { label: '全部', value: null },
    { label: '已入住', value: '已入住' },
    { label: '已退房', value: '已退房' },
    { label: '已取消', value: '已取消' }
  ]
  
  // 订单表格列定义
  const orderColumns = [
    { name: 'orderNumber', align: 'left', label: '订单号', field: 'orderNumber', sortable: true },
    { name: 'guestName', align: 'left', label: '客人姓名', field: 'guestName', sortable: true },
    { name: 'phone', align: 'left', label: '手机号', field: 'phone' },
    { name: 'roomNumber', align: 'left', label: '房间号', field: 'roomNumber', sortable: true },
    { name: 'roomType', align: 'left', label: '房间类型', field: 'roomType',
      format: val => val === 'standard' ? '标准间' : val === 'deluxe' ? '豪华间' : '套房' 
    },
    { name: 'checkInDate', align: 'left', label: '入住日期', field: 'checkInDate', sortable: true },
    { name: 'checkOutDate', align: 'left', label: '离店日期', field: 'checkOutDate', sortable: true },
    { name: 'status', align: 'left', label: '状态', field: 'status' },
    { name: 'actions', align: 'center', label: '操作', field: 'actions' }
  ]
  
  // 所有订单数据
  const allOrders = ref([])
  
  // 根据搜索和过滤条件筛选订单
  const filteredOrders = computed(() => {
    let result = allOrders.value
    
    // 根据搜索条件筛选
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(order => 
        order.orderNumber.toLowerCase().includes(query) ||
        order.guestName.toLowerCase().includes(query) ||
        order.phone.includes(query)
      )
    }
    
    // 根据状态筛选
    if (filterStatus.value) {
      result = result.filter(order => order.status === filterStatus.value)
    }
    
    return result
  })
  
  // 获取所有订单数据
  function fetchAllOrders() {
    loadingOrders.value = true
    
    // 从 store 获取订单数据
    setTimeout(() => {
      allOrders.value = orderStore.getAllOrders()
      loadingOrders.value = false
    }, 500) // 保留一点延迟以显示加载效果
  }
  
  // 订单详情相关
  const showOrderDetails = ref(false)
  const currentOrder = ref(null)
  const showChangeRoomDialog = ref(false)
  const newRoomNumber = ref(null)
  const selectedRoomType = ref(null)
  
  // 房型选项
  const roomTypeOptions = [
    { label: '标准间', value: 'standard' },
    { label: '豪华间', value: 'deluxe' },
    { label: '套房', value: 'suite' }
  ]
  
  // 所有可用房间
  const allAvailableRooms = ref([
    { label: '101 - 标准间', value: '101', type: 'standard' },
    { label: '102 - 标准间', value: '102', type: 'standard' },
    { label: '201 - 豪华间', value: '201', type: 'deluxe' },
    { label: '202 - 豪华间', value: '202', type: 'deluxe' },
    { label: '301 - 套房', value: '301', type: 'suite' }
  ])
  
  // 根据选择的房型筛选可用房间
  const filteredAvailableRooms = computed(() => {
    if (!selectedRoomType.value) return []
    return allAvailableRooms.value.filter(room => room.type === selectedRoomType.value)
  })
  
  // 查看订单详情
  function viewOrderDetails(order) {
    currentOrder.value = order
    showOrderDetails.value = true
  }
  
  // 取消订单
  function cancelOrder(order) {
    if (confirm(`确定要取消订单 ${order.orderNumber} 吗？`)) {
      console.log('取消订单:', order)
      
      // 更新订单状态
      orderStore.updateOrderStatus(order.orderNumber, '已取消')
      
      // 更新本地数据
      const index = allOrders.value.findIndex(o => o.orderNumber === order.orderNumber)
      if (index !== -1) {
        allOrders.value[index].status = '已取消'
      }
      
      alert('订单已取消')
    }
  }
  
  // 办理退房
  function checkoutOrder(order) {
    if (confirm(`确定要为订单 ${order.orderNumber} 办理退房吗？`)) {
      console.log('办理退房:', order)
      
      // 获取当前时间
      const checkOutTime = new Date()
      const formattedCheckOutTime = date.formatDate(checkOutTime, 'YYYY-MM-DD HH:mm')
      
      // 更新订单状态和退房时间
      orderStore.updateOrderStatus(order.orderNumber, '已退房')
      orderStore.updateOrderCheckOut(order.orderNumber, formattedCheckOutTime)
      
      // 更新本地数据
      const index = allOrders.value.findIndex(o => o.orderNumber === order.orderNumber)
      if (index !== -1) {
        allOrders.value[index].status = '已退房'
        allOrders.value[index].actualCheckOutTime = formattedCheckOutTime
      }
      
      alert('退房成功')
    }
  }
  
  // 从详情页办理退房
  function checkoutOrderFromDetails() {
    if (currentOrder.value) {
      checkoutOrder(currentOrder.value)
      showOrderDetails.value = false
    }
  }
  
  // 搜索订单
  function searchOrders() {
    console.log('搜索订单:', searchQuery.value, filterStatus.value)
    // 实际中可能需要从后端获取过滤后的数据
    // 这里直接使用计算属性进行客户端过滤
  }
  
  // 获取房间类型名称
  function getRoomTypeName(type) {
    switch(type) {
      case 'standard':
        return '标准间'
      case 'deluxe':
        return '豪华间'
      case 'suite':
        return '套房'
      default:
        return type
    }
  }
  
  // 获取支付方式名称
  function getPaymentMethodName(method) {
    switch(method) {
      case 'cash':
        return '现金支付'
      case 'wechat':
        return '微信支付'
      case 'alipay':
        return '支付宝支付'
      case 'card':
        return '银行卡支付'
      default:
        return method || '未指定'
    }
  }
  
  // 获取状态颜色
  function getStatusColor(status) {
    switch(status) {
      case '已入住':
        return 'positive'
      case '已退房':
        return 'primary'
      case '已取消':
        return 'negative'
      default:
        return 'grey'
    }
  }
  
  // 办理入住
  function checkInOrder(order) {
    if (confirm(`确定要为订单 ${order.orderNumber} 办理入住吗？`)) {
      console.log('办理入住:', order)
      
      // 获取当前时间
      const checkInTime = new Date()
      const formattedCheckInTime = date.formatDate(checkInTime, 'YYYY-MM-DD HH:mm')
      
      // 更新订单状态和入住时间
      orderStore.updateOrderCheckIn(order.orderNumber, formattedCheckInTime)
      
      // 更新本地数据
      const index = allOrders.value.findIndex(o => o.orderNumber === order.orderNumber)
      if (index !== -1) {
        allOrders.value[index].status = '已入住'
        allOrders.value[index].actualCheckInTime = formattedCheckInTime
      }
      
      alert('入住成功')
    }
  }
  
  // 从详情页办理入住
  function checkInOrderFromDetails() {
    if (currentOrder.value) {
      checkInOrder(currentOrder.value)
      showOrderDetails.value = false
    }
  }
  
  // 更改房间
  function changeRoom() {
    if (currentOrder.value && newRoomNumber.value) {
      console.log('更改房间:', currentOrder.value.roomNumber, '->', newRoomNumber.value)
      
      // 更新房间号和房型
      const index = allOrders.value.findIndex(o => o.orderNumber === currentOrder.value.orderNumber)
      if (index !== -1) {
        allOrders.value[index].roomNumber = newRoomNumber.value
        allOrders.value[index].roomType = selectedRoomType.value
        currentOrder.value.roomNumber = newRoomNumber.value
        currentOrder.value.roomType = selectedRoomType.value
      }
      
      // 关闭对话框并重置
      showChangeRoomDialog.value = false
      newRoomNumber.value = null
      selectedRoomType.value = null
      
      alert('房间更改成功')
    }
  }
  
  onMounted(() => {
    // 获取所有订单
    fetchAllOrders()
  })
  </script>
  
  <style scoped>
  .view-orders {
    max-width: 1200px;
    margin: 0 auto;
  }
  </style>