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
                  <q-btn
                    flat
                    round
                    dense
                    color="info"
                    icon="hotel"
                    @click="checkInOrder(props.row)"
                    v-if="props.row.status === 'pending'"
                  >
                    <q-tooltip>办理入住</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    color="negative"
                    icon="cancel"
                    @click="cancelOrder(props.row)"
                    v-if="props.row.status === 'checked-in' || props.row.status === 'pending'"
                  >
                    <q-tooltip>取消订单</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    round
                    dense
                    color="positive"
                    icon="check_circle"
                    @click="checkoutOrder(props.row)"
                    v-if="props.row.status === 'checked-in'"
                  >
                    <q-tooltip>办理退房</q-tooltip>
                  </q-btn>
                </q-btn-group>
              </q-td>
            </template>

            <template v-slot:body-cell-status="props">
              <q-td :props="props">
                <q-badge
                  :color="getStatusColor(props.row.status)"
                  :label="viewStore.getOrderStatusText(props.row.status)"
                />
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
                        <q-badge
                          :color="getStatusColor(currentOrder.status)"
                          :label="viewStore.getOrderStatusText(currentOrder.status)"
                        />
                      </q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label caption>订单创建时间</q-item-label>
                      <q-item-label>{{ formatDateTime(currentOrder.createTime) }}</q-item-label>
                    </q-item-section>
                  </q-item>

                  <q-item>
                    <q-item-section>
                      <q-item-label caption>入住时间</q-item-label>
                      <q-item-label>{{ currentOrder.actualCheckInTime ? formatDateTime(currentOrder.actualCheckInTime) : '未入住' }}</q-item-label>
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
                      <q-item-label>{{ formatDate(currentOrder.checkInDate) }} 至 {{ formatDate(currentOrder.checkOutDate) }}</q-item-label>
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
            <div class="q-mb-md">
              <div class="text-subtitle2">当前房间:</div>
              <div class="text-bold">{{ currentOrder ? currentOrder.roomNumber + ' (' + getRoomTypeName(currentOrder.roomType) + ')' : '' }}</div>
            </div>

            <div class="row items-center">
              <div class="col">
                <q-select
                  v-model="newRoomNumber"
                  :options="availableRooms"
                  label="选择新房间"
                  filled
                  emit-value
                  map-options
                >
                  <!-- 没有可用房间时显示的内容 -->
                  <template v-slot:no-option>
                    <q-item>
                      <q-item-section class="text-negative">
                        <q-icon name="warning" color="negative" />
                        没有可用房间
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>

              <!-- 可用房间数量提示 -->
              <div class="col-auto q-ml-md">
                <q-chip
                  :color="availableRooms.length > 0 ? (availableRooms.length <= 3 ? 'warning' : 'positive') : 'negative'"
                  text-color="white"
                  icon="hotel"
                >
                  可用: {{ availableRooms.length }}间
                </q-chip>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn flat label="确认更改" color="positive" @click="changeRoom" :disable="!newRoomNumber" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- 入住选择房间对话框 -->
      <q-dialog v-model="showCheckInDialog" persistent>
        <q-card style="min-width: 350px">
          <q-card-section class="row items-center q-pb-none">
            <div class="text-h6">选择入住房间</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section>
            <div class="q-mb-md">
              <div class="text-subtitle2">订单房间信息:</div>
              <div class="text-bold">
                房间类型: {{ checkInOrderData ? getRoomTypeName(checkInOrderData.roomType) : '' }}
              </div>
              <div class="text-bold q-mb-md">
                预订房间: {{ checkInOrderData ? checkInOrderData.roomNumber : '' }}
              </div>
            </div>

            <div class="row items-center">
              <div class="col">
                <q-select
                  v-model="checkInRoomNumber"
                  :options="availableRooms"
                  label="选择入住房间"
                  filled
                  emit-value
                  map-options
                >
                  <!-- 没有可用房间时显示的内容 -->
                  <template v-slot:no-option>
                    <q-item>
                      <q-item-section class="text-negative">
                        <q-icon name="warning" color="negative" />
                        没有可用房间
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
              </div>

              <!-- 可用房间数量提示 -->
              <div class="col-auto q-ml-md">
                <q-chip
                  :color="availableRooms.length > 0 ? (availableRooms.length <= 3 ? 'warning' : 'positive') : 'negative'"
                  text-color="white"
                  icon="hotel"
                >
                  可用: {{ availableRooms.length }}间
                </q-chip>
              </div>
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn flat label="确认入住" color="positive" @click="confirmCheckIn" :disable="!checkInRoomNumber" />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </template>

  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { date } from 'quasar'
  import { useOrderStore } from '../stores/orderStore' // 导入订单 store
  import { useRoomStore } from '../stores/roomStore' // 导入房间 store
  import { useViewStore } from '../stores/viewStore' // 导入视图 store

  // 初始化 stores
  const orderStore = useOrderStore()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()

  // 搜索和过滤
  const searchQuery = ref('')
  const filterStatus = ref(null)
  const loadingOrders = ref(false)

  // 订单状态选项
  const statusOptions = [
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' }
  ]

  // 根据状态获取显示文本
  function getStatusText(status) {
    const option = statusOptions.find(opt => opt.value === status)
    return option ? option.label : status
  }

  // 订单表格列定义
  const orderColumns = [
    { name: 'orderNumber', align: 'left', label: '订单号', field: 'orderNumber', sortable: true },
    { name: 'guestName', align: 'left', label: '客人姓名', field: 'guestName', sortable: true },
    { name: 'phone', align: 'left', label: '手机号', field: 'phone' },
    { name: 'roomNumber', align: 'left', label: '房间号', field: 'roomNumber', sortable: true },
    {
      name: 'roomType',
      align: 'left',
      label: '房间类型',
      field: 'roomType',
      format: val => viewStore.getRoomTypeName(val)
    },
    {
      name: 'checkInDate',
      align: 'left',
      label: '入住日期',
      field: 'checkInDate',
      sortable: true,
      format: val => {
        if (!val) return ''
        // 移除时区信息，只显示日期
        return val.split('T')[0]
      }
    },
    {
      name: 'checkOutDate',
      align: 'left',
      label: '离店日期',
      field: 'checkOutDate',
      sortable: true,
      format: val => {
        if (!val) return ''
        // 移除时区信息，只显示日期
        return val.split('T')[0]
      }
    },
    {
      name: 'status',
      align: 'left',
      label: '状态',
      field: 'status',
      sortable: true,
      format: val => getStatusText(val)
    },
    {
      name: 'actions',
      align: 'center',
      label: '操作',
      field: 'actions',
      required: true
    }
  ]

  // 根据搜索和过滤条件筛选订单
  const filteredOrders = computed(() => {
    let result = orderStore.orders

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
  async function fetchAllOrders() {
    try {
      loadingOrders.value = true
      await orderStore.fetchOrders() // 确保orderStore中有这个方法
      console.log('获取到的订单数据:', orderStore.orders)
    } catch (error) {
      console.error('获取订单数据失败:', error)
      $q.notify({
        type: 'negative',
        message: '获取订单数据失败，请刷新页面重试',
        position: 'top'
      })
    } finally {
      loadingOrders.value = false
    }
  }

  // 订单详情相关
  const showOrderDetails = ref(false)
  const currentOrder = ref(null)
  const showChangeRoomDialog = ref(false)
  const newRoomNumber = ref(null)

  // 入住选择房间相关
  const showCheckInDialog = ref(false)
  const checkInOrderData = ref(null)
  const checkInRoomNumber = ref(null)

  // 房型选项
  const roomTypeOptions = viewStore.roomTypeOptions.filter(option => option.value !== null)

  // 使用roomStore获取可用房间
  const availableRooms = computed(() => {
    return roomStore.rooms
      .filter(room => room.status === 'available')
      .map(room => ({
        label: `${room.number} - ${viewStore.getRoomTypeName(room.type)}`,
        value: room.number,
        type: room.type,
        price: room.price
      }))
  })

  // 根据选择的房型筛选可用房间
  const filteredAvailableRooms = computed(() => {
    if (!selectedRoomType.value) return []
    return availableRooms.value.filter(room => room.type === selectedRoomType.value)
  })

  // 查看订单详情
  function viewOrderDetails(order) {
    currentOrder.value = order
    showOrderDetails.value = true
  }

  // 取消订单
  function cancelOrder(order) {
    if (confirm(`确定要取消订单 ${order.orderNumber} 吗？`)) {
      console.log('取消订单:', order);

      // 使用orderStore更新订单状态
      orderStore.updateOrderStatus(order.orderNumber, '已取消');

      // 如果房间已预订但未入住，释放房间
      if (order.status === '待入住') {
        const room = roomStore.getRoomByNumber(order.roomNumber);
        if (room && room.status === 'reserved') {
          roomStore.updateRoomStatus(room.id, 'available');
        }
      }

      // 直接更新当前订单对象 - 确保界面立即响应
      const updatedOrder = orderStore.orders.find(o => o.orderNumber === order.orderNumber);
      if (updatedOrder) {
        // 如果当前订单是正在查看的订单，则更新它
        if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
          currentOrder.value = { ...updatedOrder };
        }

        // 强制重新计算过滤后的订单列表
        searchOrders();
      }

      alert('订单已取消');
    }
  }

  // 办理退房
  function checkoutOrder(order) {
    if (confirm(`确定要为订单 ${order.orderNumber} 办理退房吗？`)) {
      console.log('办理退房:', order);

      // 获取当前时间
      const checkOutTime = new Date();
      const formattedCheckOutTime = date.formatDate(checkOutTime, 'YYYY-MM-DD HH:mm');

      // 更新订单状态和退房时间
      orderStore.updateOrderCheckOut(order.orderNumber, formattedCheckOutTime);

      // 获取房间并将状态更改为清洁中
      const room = roomStore.getRoomByNumber(order.roomNumber);
      if (room) {
        roomStore.checkOutRoom(room.id);
      }

      // 直接更新当前订单对象 - 确保界面立即响应
      const updatedOrder = orderStore.orders.find(o => o.orderNumber === order.orderNumber);
      if (updatedOrder) {
        // 如果当前订单是正在查看的订单，则更新它
        if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
          currentOrder.value = { ...updatedOrder };
        }

        // 强制重新计算过滤后的订单列表
        searchOrders();
      }

      alert('退房成功');
    }
  }

  // 从详情页办理退房
  function checkoutOrderFromDetails() {
    if (currentOrder.value) {
      checkoutOrder(currentOrder.value);

      // 更新订单详情页面中显示的数据
      const updatedOrder = orderStore.orders.find(o => o.orderNumber === currentOrder.value.orderNumber);
      if (updatedOrder) {
        currentOrder.value = { ...updatedOrder };
      }

      showOrderDetails.value = false;
    }
  }

  // 搜索订单
  function searchOrders() {
    console.log('搜索订单:', searchQuery.value, filterStatus.value);

    // 设置加载状态
    loadingOrders.value = true;

    // 短暂延迟模拟数据刷新，确保UI能够响应数据变化
    setTimeout(() => {
      // 不需要额外操作，filteredOrders计算属性会自动重新计算
      // 这里的setTimeout只是为了确保UI触发更新
      loadingOrders.value = false;
    }, 100);
  }

  // 获取房间类型名称
  const getRoomTypeName = viewStore.getRoomTypeName

  // 获取支付方式名称
  const getPaymentMethodName = viewStore.getPaymentMethodName

  // 获取状态颜色
  const getStatusColor = viewStore.getStatusColor

  // 办理入住
  function checkInOrder(order) {
    // 设置当前入住订单
    checkInOrderData.value = order;

    // 默认选择原房间（如果可用）
    const originalRoom = availableRooms.value.find(r => r.value === order.roomNumber);
    if (originalRoom) {
      checkInRoomNumber.value = order.roomNumber;
    } else {
      checkInRoomNumber.value = null;
    }

    // 显示入住选择对话框
    showCheckInDialog.value = true;
  }

  // 确认办理入住
  async function confirmCheckIn() {
    if (!checkInOrderData.value) {
      console.error('没有选择当前订单');
      alert('操作失败：没有找到当前订单');
      return;
    }

    if (!checkInRoomNumber.value) {
      console.error('未选择房间号');
      alert('请选择入住房间');
      return;
    }

    console.log('办理入住:', checkInOrderData.value.orderNumber, '房间:', checkInRoomNumber.value);

    // 找到新房间
    const selectedRoom = availableRooms.value.find(r => r.value === checkInRoomNumber.value);
    if (!selectedRoom) {
      console.error('所选房间不可用');
      alert('所选房间不可用');
      return;
    }

    // 确认入住
    if (!confirm(`确定要为订单 ${checkInOrderData.value.orderNumber} 办理入住到房间 ${checkInRoomNumber.value} 吗？`)) {
      return;
    }

    // 获取当前时间
    const checkInTime = new Date();
    const formattedCheckInTime = date.formatDate(checkInTime, 'YYYY-MM-DD HH:mm');

    // 原房间号与选择的房间号不同，需要先更新订单房间信息
    if (checkInOrderData.value.roomNumber !== checkInRoomNumber.value) {
      // 获取旧房间
      const oldRoom = roomStore.getRoomByNumber(checkInOrderData.value.roomNumber);
      if (oldRoom && oldRoom.status === 'reserved') {
        // 释放原预订的房间
        roomStore.updateRoomStatus(oldRoom.id, 'available');
      }

      // 更新订单房间信息
      orderStore.updateOrderRoom(
        checkInOrderData.value.orderNumber,
        selectedRoom.type,
        checkInRoomNumber.value,
        selectedRoom.price
      );
    }

    // 更新订单状态和入住时间
    orderStore.updateOrderCheckIn(checkInOrderData.value.orderNumber, formattedCheckInTime);

    // 使用选中的房间ID，并await异步操作
    if (selectedRoom) {
       const success = await roomStore.occupyRoom(
         selectedRoom.id,
         checkInOrderData.value.guestName,
         checkInOrderData.value.checkOutDate
       );
       if (!success) {
         alert('办理入住失败，请检查日志了解详情');
         loadingOrders.value = false; // 停止加载状态
         return; // 停止后续操作
       }
       // 入住成功后刷新房间列表，确保房间状态页面能显示最新的客人信息
       await roomStore.fetchAllRooms();
    }

    // 直接更新当前订单对象 - 确保界面立即响应
    const updatedOrder = orderStore.orders.find(o => o.orderNumber === checkInOrderData.value.orderNumber);
    if (updatedOrder) {
      // 如果当前订单是正在查看的订单，则更新它
      if (currentOrder.value && currentOrder.value.orderNumber === checkInOrderData.value.orderNumber) {
        currentOrder.value = { ...updatedOrder };
      }

      // 更新入住订单对象
      checkInOrderData.value = { ...updatedOrder };
    }

    // 关闭对话框并重置
    showCheckInDialog.value = false;
    checkInRoomNumber.value = null;

    // 强制重新计算过滤后的订单列表
    searchOrders();

    alert('入住成功');
  }

  // 从详情页办理入住
  function checkInOrderFromDetails() {
    if (currentOrder.value) {
      checkInOrder(currentOrder.value);
      showOrderDetails.value = false;
    }
  }

  /**
   * 更新房间信息函数 - 直接集成到组件中
   * @param {string} orderNum - 订单号
   * @param {string} roomType - 新房型
   * @param {string} roomNum - 新房间号
   * @param {number} roomPrice - 新房间价格
   * @returns {boolean} 操作是否成功
   */
  function updateRoomInfo(orderNum, roomType, roomNum, roomPrice) {
    try {
      // 查找订单
      const orderIndex = orderStore.orders.findIndex(o => o.orderNumber === orderNum)

      if (orderIndex === -1) {
        console.error('没有找到订单:', orderNum)
        return false
      }

      // 获取订单对象
      const order = orderStore.orders[orderIndex]

      // 查找旧房间和新房间
      const oldRoomNum = order.roomNumber
      const oldRoom = roomStore.getRoomByNumber(oldRoomNum)
      const newRoom = roomStore.getRoomByNumber(roomNum)

      // 检查房间是否存在
      if (!oldRoom || !newRoom) {
        console.error('房间不存在:', oldRoomNum, roomNum)
        return false
      }

      // 检查新房间是否可用
      if (newRoom.status !== 'available') {
        console.error('新房间不可用:', roomNum, newRoom.status)
        return false
      }

      // 根据订单状态更新房间状态
      if (order.status === '已入住') {
        roomStore.updateRoomStatus(oldRoom.id, 'cleaning')
        roomStore.occupyRoom(newRoom.id, order.guestName, order.checkOutDate)
      } else if (order.status === '待入住') {
        roomStore.updateRoomStatus(oldRoom.id, 'available')
        roomStore.reserveRoom(newRoom.id)
      }

      // 更新订单信息
      orderStore.updateOrderRoom(orderNum, roomType, roomNum, roomPrice)

      return true
    } catch (error) {
      console.error('房间更新失败:', error)
      return false
    }
  }

  // 更改房间
  function changeRoom() {
    if (!currentOrder.value) {
      console.error('没有选择当前订单');
      alert('操作失败：没有找到当前订单');
      return;
    }

    if (!newRoomNumber.value) {
      console.error('未选择房间号');
      alert('请选择新房间');
      return;
    }

    console.log('更改房间:', currentOrder.value.roomNumber, '->', newRoomNumber.value);

    // 找到新房间
    const newRoom = availableRooms.value.find(r => r.value === newRoomNumber.value);
    if (!newRoom) {
      console.error('所选房间不可用');
      alert('所选房间不可用');
      return;
    }

    // 确认更改
    if (!confirm(`确定要将订单 ${currentOrder.value.orderNumber} 的房间从 ${currentOrder.value.roomNumber} 更改为 ${newRoomNumber.value} 吗？`)) {
      return;
    }

    // 使用集成的updateRoomInfo方法更新房间信息
    const success = updateRoomInfo(
      currentOrder.value.orderNumber,
      newRoom.type,
      newRoomNumber.value,
      newRoom.price
    );

    if (success) {
      // 关闭对话框并重置
      showChangeRoomDialog.value = false;
      newRoomNumber.value = null;

      // 更新当前订单的显示
      const updatedOrder = orderStore.orders.find(o => o.orderNumber === currentOrder.value.orderNumber);
      if (updatedOrder) {
        currentOrder.value = updatedOrder;
      }

      alert('房间更改成功');
    } else {
      alert('房间更改失败，请检查日志了解详情');
    }
  }

  /**
   * 格式化日期时间
   * @param {string} dateTimeStr - 日期时间字符串
   * @returns {string} 格式化后的日期时间
   */
  function formatDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    // 如果是ISO格式的时间戳
    if (dateTimeStr.includes('T')) {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '-');
    }
    return dateTimeStr;
  }

  /**
   * 格式化日期（仅显示年月日）
   * @param {string} dateStr - 日期字符串
   * @returns {string} 格式化后的日期
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    // 如果是ISO格式的时间戳
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  }

  onMounted(async () => {
    await fetchAllOrders()
  })
  </script>

  <style scoped>
  .view-orders {
    max-width: 1200px;
    margin: 0 auto;
  }
  </style>
