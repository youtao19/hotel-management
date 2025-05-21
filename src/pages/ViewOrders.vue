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
                      <!-- Debug: {{ currentOrder ? currentOrder.status : 'N/A' }} -->
                      <div class="row items-center">
                        <q-item-label class="q-mr-sm">{{ currentOrder.roomNumber }}</q-item-label>
                        <q-btn
                          v-if="currentOrder && currentOrder.status === 'pending'"
                          flat
                          dense
                          color="primary"
                          icon="swap_horiz"
                          @click="openChangeRoomDialog"
                        >
                          <q-tooltip>更换房间</q-tooltip>
                        </q-btn>
                      </div>
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
              @click="openChangeRoomDialog"
            >
              <q-tooltip>更换房间</q-tooltip>
            </q-btn>
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
                  :options="availableRoomOptions"
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
                  :color="availableRoomOptions.length > 0 ? (availableRoomOptions.length <= 3 ? 'warning' : 'positive') : 'negative'"
                  text-color="white"
                  icon="hotel"
                >
                  可用: {{ availableRoomOptions.length }}间
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
    </div>
  </template>

  <script setup>
  import { ref, computed, onMounted } from 'vue'
  import { date, useQuasar } from 'quasar'
  import { useOrderStore } from '../stores/orderStore' // 导入订单 store
  import { useRoomStore } from '../stores/roomStore' // 导入房间 store
  import { useViewStore } from '../stores/viewStore' // 导入视图 store

  // 初始化 stores
  const orderStore = useOrderStore()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()
  const $q = useQuasar() // 初始化 $q 对象

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
      loadingOrders.value = true;
      await orderStore.fetchAllOrders(); // <--- 修改这里的函数名为 fetchAllOrders
      console.log('获取到的订单数据:', orderStore.orders);
    } catch (error) {
      console.error('获取订单数据失败:', error);
      $q.notify({
        type: 'negative',
        message: '获取订单数据失败，请刷新页面重试',
        position: 'top'
      });
    } finally {
      loadingOrders.value = false;
    }
  }

  // 订单详情相关
  const showOrderDetails = ref(false)
  const currentOrder = ref(null)
  const showChangeRoomDialog = ref(false)
  const newRoomNumber = ref(null)

  // 房型选项
  const roomTypeOptions = viewStore.roomTypeOptions.filter(option => option.value !== null)  // 使用roomStore获取可用房间
  const availableRooms = computed(() => {
    return roomStore.rooms
      .filter(room => room.status === 'available')
      .map(room => ({
        label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)}`,
        value: room.room_number,
        type: room.type_code,
        price: room.price,
        room_id: room.room_id
      }))
  })
  // 当前选择的房型（用于筛选可用房间）
  const selectedRoomType = ref(null)

  // 在 script 部分添加相关变量和方法
  const availableRoomOptions = ref([]); // 用于存储从API获取的可用房间选项

  // 查看订单详情
  function viewOrderDetails(order) {
    currentOrder.value = order;
    console.log('Viewing order details. Status:', currentOrder.value ? currentOrder.value.status : 'currentOrder is null');
    showOrderDetails.value = true;
  }

  // 取消订单
  async function cancelOrder(order) {
    if (!order || !order.orderNumber) {
      $q.notify({ type: 'negative', message: '订单信息无效，无法取消', position: 'top' });
      return;
    }

    if (confirm(`确定要取消订单 ${order.orderNumber} 吗？`)) {
      loadingOrders.value = true;
      try {
        console.log('取消订单:', order.orderNumber);

        // 记录原订单状态，用于判断是否需要释放房间
        const originalStatus = order.status;

        // 调用 API 更新订单状态为 'cancelled'
        // 注意：API 期望的状态值是 'cancelled' (小写)
        const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'cancelled');

        if (!updatedOrderFromApi) {
          $q.notify({ type: 'negative', message: '取消订单失败，API未返回更新后的订单', position: 'top' });
          loadingOrders.value = false;
          return;
        }

        // 如果原订单是 'pending' (待入住) 状态，且房间已预订，则尝试释放房间
        // 注意：order.status 现在是 'cancelled'，所以要用 originalStatus
        if (originalStatus === 'pending' || originalStatus === '待入住') { // 兼容中文状态
          const room = roomStore.getRoomByNumber(order.roomNumber);
          if (room && room.status === 'reserved') {
            const roomUpdateSuccess = await roomStore.updateRoomStatus(room.room_id, 'available');
            if (!roomUpdateSuccess) {
              // 房间状态更新失败，但订单已取消。这是一个需要注意的情况。
              $q.notify({ type: 'warning', message: '订单已取消，但释放预订房间失败，请检查房间状态！', position: 'top', multiLine: true });
            } else {
              await roomStore.fetchAllRooms(); // 刷新房间列表确保状态更新
            }
          }
        }

        // 更新当前正在查看的订单详情 (如果适用)
        if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
          currentOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) }; // 从store获取最新数据
        }

        $q.notify({ type: 'positive', message: '订单已取消', position: 'top' });

      } catch (error) {
        console.error('取消订单操作失败:', error);
        const errorMessage = error.response?.data?.message || error.message || '未知错误';
        $q.notify({
          type: 'negative',
          message: `取消订单失败: ${errorMessage}`,
          position: 'top',
          multiLine: true
        });
      } finally {
        loadingOrders.value = false;
        // 确保订单列表刷新以反映任何变化
        fetchAllOrders();
      }
    }
  }

  // 办理退房
  async function checkoutOrder(order) {
    if (!order || !order.orderNumber) {
      $q.notify({ type: 'negative', message: '订单信息无效，无法办理退房', position: 'top' });
      return;
    }

    if (confirm(`确定要为订单 ${order.orderNumber} 办理退房吗？`)) {
      loadingOrders.value = true;
      try {
        console.log('办理退房:', order.orderNumber);

        const checkOutTime = new Date().toISOString(); // 使用ISO格式给API

        // 调用 API 更新订单状态为 'checked-out' 并记录退房时间
        const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-out', { checkOutTime });

        if (!updatedOrderFromApi) {
          $q.notify({ type: 'negative', message: '办理退房失败，API未返回更新后的订单', position: 'top' });
          loadingOrders.value = false;
          return;
        }

        // 获取房间并将状态更改为清洁中
        const room = roomStore.getRoomByNumber(order.roomNumber);
        if (room && room.room_id) { // 确保 room_id 存在
          // 根据规则，退房后房间状态应为 cleaning
          // roomStore 可能没有 checkOutRoom，或者我们可以用通用的 updateRoomStatus
          const roomUpdateSuccess = await roomStore.updateRoomStatus(room.room_id, 'cleaning');
          if (!roomUpdateSuccess) {
            $q.notify({ type: 'warning', message: '订单已退房，但更新房间状态为清洁中失败，请检查房间状态！', position: 'top', multiLine: true });
          } else {
            await roomStore.fetchAllRooms(); // 刷新房间列表
          }
        } else {
          $q.notify({ type: 'warning', message: '订单已退房，但未找到关联房间信息，无法更新房间状态。', position: 'top', multiLine: true });
        }

        // 更新当前正在查看的订单详情 (如果适用)
        if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
          currentOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) }; // 从store获取最新数据
        }

        $q.notify({ type: 'positive', message: '退房成功', position: 'top' });

      } catch (error) {
        console.error('办理退房操作失败:', error);
        const errorMessage = error.response?.data?.message || error.message || '未知错误';
        $q.notify({
          type: 'negative',
          message: `办理退房失败: ${errorMessage}`,
          position: 'top',
          multiLine: true
        });
      } finally {
        loadingOrders.value = false;
        // 确保订单列表刷新以反映任何变化
        fetchAllOrders();
      }
    }
  }

  // 从详情页办理退房
  function checkoutOrderFromDetails() {
    if (currentOrder.value) {
      checkoutOrder(currentOrder.value); // 直接调用已修改的 checkoutOrder 函数
      // 关闭对话框的逻辑可以保留，或者在 checkoutOrder 成功后处理
      // 为简化，暂时保留在这里，如果 checkoutOrder 内部有更复杂的UI交互，可能需要调整
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
  async function checkInOrder(order) {
    if (!order) {
      console.error('订单信息不存在');
      $q.notify({ type: 'negative', message: '操作失败：订单信息不存在', position: 'top' });
      return;
    }

    // 确认办理入住
    if (!confirm(`确定要为订单 ${order.orderNumber} (房间: ${order.roomNumber}) 办理入住吗？`)) {
      return;
    }

    loadingOrders.value = true;
    try {
      console.log('办理入住:', order.orderNumber, '房间:', order.roomNumber);

      // 获取当前时间用于入住时间
      const checkInTime = new Date().toISOString();

      // 调用新的 store action 更新订单状态和入住时间
      const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-in', { checkInTime });

      if (!updatedOrderFromApi) {
        // store action 应该会抛出错误，但以防万一
        $q.notify({ type: 'negative', message: '办理入住失败，API未返回更新后的订单', position: 'top' });
        loadingOrders.value = false;
        return;
      }

      // 获取房间信息 (主要为了拿到 room_id)
      const room = roomStore.getRoomByNumber(order.roomNumber);
      if (!room) {
        console.error('预订房间未找到:', order.roomNumber);
        // 注意：此时订单状态可能已经更新，但房间状态未更新。需要考虑回滚或提示用户手动处理。
        $q.notify({ type: 'warning', message: '订单已更新为入住，但预订的房间信息未找到，请检查房间状态！', position: 'top', multiLine: true });
        loadingOrders.value = false;
        // 刷新订单列表以显示最新状态
        fetchAllOrders();
        return;
      }

      // 更新房间状态为已入住
      const roomUpdateSuccess = await roomStore.occupyRoom(
        room.room_id,
        order.guestName,
        order.checkOutDate // 确保传递的是预计退房日期
      );

      if (!roomUpdateSuccess) {
        // 订单状态已更新，但房间状态更新失败。这是一个关键问题。
        // 尝试回滚订单状态或强烈建议用户检查数据一致性。
        $q.notify({ type: 'negative', message: '房间状态更新失败！订单已标记为入住，但房间可能仍显示为可用。请立即核实！', position: 'top', multiLine: true, timeout: 0, actions: [{ label: '关闭', color: 'white' }] });
        // 理想情况下，这里应该有回滚订单状态的逻辑
        // await orderStore.updateOrderStatusViaApi(order.orderNumber, 'pending', { checkInTime: null });
        loadingOrders.value = false;
        fetchAllOrders(); // 刷新确保用户看到潜在的不一致
        return;
      }

      // 入住成功后刷新房间列表，确保房间状态页面能显示最新的客人信息
      await roomStore.fetchAllRooms();

      // 本地订单列表已由 orderStore.updateOrderStatusViaApi 更新，
      // 但如果 currentOrder 正在显示此订单，也需要更新它
      if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
        currentOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) }; // 从store获取最新数据
      }

      $q.notify({ type: 'positive', message: '入住成功', position: 'top' });

    } catch (error) {
      console.error('办理入住操作失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '未知错误';
      $q.notify({
        type: 'negative',
        message: `办理入住失败: ${errorMessage}`,
        position: 'top',
        multiLine: true
      });
    } finally {
      loadingOrders.value = false;
      // 确保订单列表刷新以反映任何变化（即使是失败的情况）
      fetchAllOrders();
    }
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
      }      // 根据订单状态更新房间状态
      if (order.status === '已入住') {
        roomStore.updateRoomStatus(oldRoom.room_id, 'cleaning')
        roomStore.occupyRoom(newRoom.room_id, order.guestName, order.checkOutDate)
      } else if (order.status === '待入住') {
        roomStore.updateRoomStatus(oldRoom.room_id, 'available')
        roomStore.reserveRoom(newRoom.room_id)
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
  async function changeRoom() {
    if (!currentOrder.value || !newRoomNumber.value) {
      return;
    }

    try {
      // 调用API更换房间
      const response = await api.post('/api/rooms/change-room', {
        orderNumber: currentOrder.value.orderNumber,
        oldRoomNumber: currentOrder.value.roomNumber,
        newRoomNumber: newRoomNumber.value
      });

      if (response.data.success) {
        // 更新当前订单信息
        currentOrder.value.roomNumber = newRoomNumber.value;
        currentOrder.value.roomType = response.data.newRoom.type_code;
        currentOrder.value.roomPrice = response.data.newRoom.price;

        // 刷新房间状态
        await roomStore.refreshData();

        // 刷新订单列表
        await fetchAllOrders();

        // 显示成功消息
        $q.notify({
          type: 'positive',
          message: '房间更换成功',
          position: 'top'
        });

        // 关闭对话框
        showChangeRoomDialog.value = false;
        newRoomNumber.value = null;
      }
    } catch (error) {
      console.error('更换房间失败:', error);
      $q.notify({
        type: 'negative',
        message: error.response?.data?.message || '更换房间失败',
        position: 'top'
      });
    }
  }

  // 打开更换房间对话框时获取可用房间
  async function openChangeRoomDialog() {
    console.log('openChangeRoomDialog function called'); // 确认函数被调用

    if (!currentOrder.value) {
      console.error('currentOrder is null or undefined in openChangeRoomDialog');
      return;
    }
    console.log('currentOrder in openChangeRoomDialog:', JSON.parse(JSON.stringify(currentOrder.value))); // 打印当前订单信息

    try {
      // 从订单中获取入住和离店日期
      const startDate = formatDate(currentOrder.value.checkInDate);
      const endDate = formatDate(currentOrder.value.checkOutDate);
      console.log('Formatted dates for API call:', { startDate, endDate }); // 打印格式化后的日期

      if (!startDate || !endDate) {
        console.error('Start date or end date is missing after formatting.');
        $q.notify({
          type: 'negative',
          message: '无法获取订单的入住或离店日期',
          position: 'top'
        });
        return;
      }

      // 调用 roomStore 中的方法获取可用房间
      console.log('Calling roomStore.getAvailableRoomsByDate...');
      const rooms = await roomStore.getAvailableRoomsByDate(startDate, endDate);
      console.log('Rooms received from API:', rooms); // 打印从API获取的房间

      // 更新 availableRoomOptions
      availableRoomOptions.value = rooms
        .filter(room => room.room_number !== currentOrder.value.roomNumber)
        .map(room => ({
          label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (${room.price}元)`,
          value: room.room_number,
          type: room.type_code,
          price: room.price
        }));
      console.log('Processed availableRoomOptions:', availableRoomOptions.value); // 打印处理后的可用房间选项

      showChangeRoomDialog.value = true;
      console.log('showChangeRoomDialog set to true'); // 确认对话框状态已改变
    } catch (error) {
      console.error('获取可用房间失败 (Error in openChangeRoomDialog):', error);
      $q.notify({
        type: 'negative',
        message: '获取可用房间列表失败: ' + (error.message || '未知错误'), // 提供更详细的错误信息
        position: 'top'
      });
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
