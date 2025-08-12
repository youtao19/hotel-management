<template>
  <q-page class="view-orders">
    <div class="q-pa-md">
      <h1 class="text-h4 q-mb-md">查看订单</h1>
    <div class="search-section q-mb-md">
      <div class="row q-col-gutter-md">
        <div class="col-md-6 col-xs-12">
          <q-input v-model="searchQuery" label="搜索订单" filled clearable @keyup.enter="searchOrders">
            <template v-slot:append>
              <q-icon name="search" class="cursor-pointer" @click="searchOrders" />
            </template>
            <template v-slot:hint>
              输入订单号、客人姓名或手机号
            </template>
          </q-input>
        </div>
        <div class="col-md-4 col-xs-12">
          <q-select v-model="filterStatus" :options="statusOptions" label="订单状态" filled clearable emit-value map-options
            @update:model-value="searchOrders" />
        </div>
        <div class="col-md-2 col-xs-12">
          <q-btn color="primary" label="搜索" class="full-width" @click="searchOrders" />
        </div>
      </div>
    </div>

    <q-card>
      <q-card-section>
        <q-table :rows="filteredOrders" :columns="orderColumns" row-key="orderNumber" :pagination="{ rowsPerPage: 10 }"
          :loading="loadingOrders" no-data-label="没有找到订单">
          <template v-slot:loading>
            <q-inner-loading showing color="primary" />
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn-group flat>
                <q-btn flat round dense color="primary" icon="visibility" @click="viewOrderDetails(props.row)">
                  <q-tooltip>查看详情</q-tooltip>
                </q-btn>
                <q-btn flat round dense color="info" icon="hotel" @click="checkInOrder(props.row)"
                  v-if="props.row.status === 'pending'">
                  <q-tooltip>办理入住</q-tooltip>
                </q-btn>
                <q-btn flat round dense color="negative" icon="cancel" @click="cancelOrder(props.row)"
                  v-if="props.row.status === 'checked-in' || props.row.status === 'pending'">
                  <q-tooltip>取消订单</q-tooltip>
                </q-btn>
                <q-btn flat round dense color="positive" icon="check_circle" @click="checkoutOrder(props.row)"
                  v-if="props.row.status === 'checked-in'">
                  <q-tooltip>办理退房</q-tooltip>
                </q-btn>
                <q-btn flat round dense color="orange" icon="hotel_class" @click="openExtendStayDialog(props.row)"
                  v-if="props.row.status === 'checked-out'">
                  <q-tooltip>续住</q-tooltip>
                </q-btn>
                <q-btn flat round dense color="purple" icon="account_balance_wallet" @click="openRefundDepositDialog(props.row)"
                  v-if="canRefundDeposit(props.row)">
                  <q-tooltip>退押金</q-tooltip>
                </q-btn>
              </q-btn-group>
            </q-td>
          </template>

          <template v-slot:body-cell-orderType="props">
            <q-td :props="props">
              <q-chip
                v-if="isRestRoom(props.row)"
                color="orange"
                text-color="white"
                icon="access_time"
                size="sm"
              >
                休息房
              </q-chip>
              <span v-else class="text-grey-6">住宿</span>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-badge :color="getStatusColor(props.row.status)"
                :label="viewStore.getOrderStatusText(props.row.status)" />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <!-- 订单详情对话框 -->
    <OrderDetailsDialog
      v-model="showOrderDetails"
      :currentOrder="currentOrder"
      :getStatusColor="getStatusColor"
      :getOrderStatusText="viewStore.getOrderStatusText"
      :getRoomTypeName="getRoomTypeName"
      :getPaymentMethodName="getPaymentMethodName"
      :formatDate="formatDate"
      :formatDateTime="formatDateTime"
      @check-in="checkInOrderFromDetails"
      @change-room="openChangeRoomDialog"
      @checkout="checkoutOrderFromDetails"
      @refund-deposit="openRefundDepositFromDetails"
    />


    <!-- 更改房间对话框 -->
    <ChangeRoomDialog
      v-model="showChangeRoomDialog"
      :currentOrder="currentOrder"
      :availableRoomOptions="availableRoomOptions"
      :getRoomTypeName="getRoomTypeName"
      @change-room="changeRoom"
    />

    <!-- 账单对话框 -->
    <Bill
      v-model="showBillDialog"
      :currentOrder="billOrder"
      @bill-created="handleBillCreated"
    />

    <!-- 续住对话框 -->
    <ExtendStayDialog
      v-model="showExtendStayDialog"
      :currentOrder="extendStayOrder"
      :availableRoomOptions="extendStayRoomOptions"
      :getRoomTypeName="getRoomTypeName"
      :loadingRooms="loadingExtendStayRooms"
      @extend-stay="handleExtendStay"
      @refresh-rooms="handleRefreshExtendStayRooms"
    />

    <!-- 退押金对话框 -->
    <RefundDepositDialog
      v-model="showRefundDepositDialog"
      :order="refundDepositOrder"
      :getStatusColor="getStatusColor"
      :getOrderStatusText="viewStore.getOrderStatusText"
      @refund-deposit="handleRefundDeposit"
    />



    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { date, useQuasar } from 'quasar'
import { useOrderStore } from '../stores/orderStore' // 导入订单 store
import { useRoomStore } from '../stores/roomStore' // 导入房间 store
import { useViewStore } from '../stores/viewStore' // 导入视图 store
import { useBillStore } from '../stores/billStore' // 导入账单 store
import { roomApi } from '../api/index.js' // 导入房间API
import OrderDetailsDialog from 'src/components/OrderDetailsDialog.vue';
import ChangeRoomDialog from 'src/components/ChangeRoomDialog.vue';
import Bill from 'src/components/Bill.vue';
import ExtendStayDialog from 'src/components/ExtendStayDialog.vue';
import RefundDepositDialog from 'src/components/RefundDepositDialog.vue';


// 初始化 stores
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const billStore = useBillStore()
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

// 判断是否为休息房（入住和退房是同一天）
function isRestRoom(order) {
  if (!order.checkInDate || !order.checkOutDate) return false;

  // 比较日期部分，忽略时间
  const checkInDate = new Date(order.checkInDate).toISOString().split('T')[0];
  const checkOutDate = new Date(order.checkOutDate).toISOString().split('T')[0];

  return checkInDate === checkOutDate;
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
    format: val => formatDate(val)
  },
  {
    name: 'checkOutDate',
    align: 'left',
    label: '离店日期',
    field: 'checkOutDate',
    sortable: true,
    format: val => formatDate(val)
  },
  {
    name: 'orderType',
    align: 'center',
    label: '类型',
    field: 'orderType',
    sortable: false
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
    await orderStore.fetchAllOrders();
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

// 在 script 部分添加相关变量和方法
const availableRoomOptions = ref([]); // 用于存储从API获取的可用房间选项

// 查看订单详情
function viewOrderDetails(order) {
  currentOrder.value = order;
  console.log('Viewing order details. Status:', currentOrder.value ? currentOrder.value.status : 'currentOrder is null');
  console.log('currentOrder', currentOrder.value)
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


      // 调用 API 更新订单状态为 'cancelled'
      // 注意：API 期望的状态值是 'cancelled' (小写)
      const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'cancelled');

      if (!updatedOrderFromApi) {
        $q.notify({ type: 'negative', message: '取消订单失败，API未返回更新后的订单', position: 'top' });
        loadingOrders.value = false;
        return;
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

const showBillDialog = ref(false)
const billOrder = ref(null)

// 续住相关变量
const showExtendStayDialog = ref(false)
const extendStayOrder = ref(null)
const extendStayRoomOptions = ref([])
const loadingExtendStayRooms = ref(false)

// 退押金相关变量
const showRefundDepositDialog = ref(false)
const refundDepositOrder = ref(null)

// 办理退房
async function checkoutOrder(order) {
  if (!order || !order.orderNumber) {
    $q.notify({ type: 'negative', message: '订单信息无效，无法办理退房', position: 'top' });
    return;
  }

  // 使用 Quasar Dialog 显示确认对话框
  $q.dialog({
    title: '确认办理退房',
    message: `确定要为订单 ${order.orderNumber} (客人: ${order.guestName}, 房间: ${order.roomNumber}) 办理退房吗？\n\n办理退房后房间将设置为清扫中状态。`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    // 用户点击确定，执行退房操作
    await performCheckOut(order);
  }).onCancel(() => {
    // 用户点击取消，什么也不做
    console.log('用户取消了退房操作');
  });
}

// 执行退房操作
async function performCheckOut(order) {
  loadingOrders.value = true;
  try {
    console.log('办理退房:', order.orderNumber, '房间:', order.roomNumber);

    // 更新订单状态为已退房
    const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-out');

    if (!updatedOrderFromApi) {
      $q.notify({
        type: 'negative',
        message: '办理退房失败，请重试',
        position: 'top'
      });
      return;
    }

    // 获取房间并将状态更改为清洁中
    const room = roomStore.getRoomByNumber(order.roomNumber);
    if (room && room.room_id) {
      const roomUpdateSuccess = await roomStore.checkOutRoom(room.room_id);
      if (!roomUpdateSuccess) {
        $q.notify({
          type: 'warning',
          message: '订单已退房，但更新房间状态为清洁中失败，请检查房间状态！',
          position: 'top',
          multiLine: true
        });
      } else {
        await roomStore.fetchAllRooms(); // 刷新房间列表
      }
    }

    // 更新当前正在查看的订单详情
    if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
      currentOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) };
    }

    // 刷新订单列表
    await fetchAllOrders();

    $q.notify({
      type: 'positive',
      message: '退房成功',
      position: 'top'
    });

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
  }
}

// 从详情页办理退房
function checkoutOrderFromDetails() {
  if (currentOrder.value) {
    checkoutOrder(currentOrder.value); // 直接调用已修改的 checkoutOrder 函数
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

  // 使用 Quasar Dialog 显示确认对话框
  $q.dialog({
    title: '确认办理入住',
    message: `确定要为订单 ${order.orderNumber} (客人: ${order.guestName}, 房间: ${order.roomNumber}) 办理入住吗？\n\n办理入住后将自动创建账单。`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    // 用户点击确定，执行入住操作
    await performCheckIn(order);
  }).onCancel(() => {
    // 用户点击取消，什么也不做
    console.log('用户取消了入住操作');
  });
}

// 执行入住操作
async function performCheckIn(order) {

  loadingOrders.value = true;
  try {
    console.log('办理入住:', order.orderNumber, '房间:', order.roomNumber);

    // 调用新的 store action 更新订单状态
    const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-in');

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

    // 入住成功后刷新房间列表，确保房间状态页面能显示最新的客人信息
    await roomStore.fetchAllRooms();

    // 本地订单列表已由 orderStore.updateOrderStatusViaApi 更新，
    // 但如果 currentOrder 正在显示此订单，也需要更新它
    if (currentOrder.value && currentOrder.value.orderNumber === order.orderNumber) {
      currentOrder.value = { ...orderStore.getOrderByNumber(order.orderNumber) }; // 从store获取最新数据
    }

    // 办理入住成功后，显示账单创建对话框（支持单日和多日订单）
    const updatedOrder = orderStore.getOrderByNumber(order.orderNumber);

    showBillDialog.value = true;
    billOrder.value = { ...updatedOrder };

    const isMultiDay = checkIfMultiDayOrder(updatedOrder);
    const message = isMultiDay
      ? '入住成功，请编辑每日房费并创建多日账单'
      : '入住成功，请完成账单创建';

    $q.notify({ type: 'positive', message, position: 'top' });

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


// 更改房间
async function changeRoom(newRoomNumber) {
  if (!currentOrder.value || !newRoomNumber) {
    console.error('缺少必要的参数：currentOrder 或 newRoomNumber');
    $q.notify({
      type: 'negative',
      message: '参数错误，无法更换房间',
      position: 'top'
    });
    return;
  }

  try {

    const requestData = {
      orderNumber: currentOrder.value.orderNumber,
      oldRoomNumber: currentOrder.value.roomNumber,
      newRoomNumber: newRoomNumber
    };

    console.log('准备更换房间:', requestData);

    // 调用API更换房间
    const response = await roomApi.changePendingRoom(requestData);

    console.log('更换房间API响应:', response);

    if (response.success) {
      // 更新当前订单信息
      currentOrder.value.roomNumber = newRoomNumber;
      if (response.newRoom) {
        currentOrder.value.roomType = response.newRoom.type_code;
        currentOrder.value.roomPrice = response.newRoom.price;
      }

      // 刷新房间状态
      await roomStore.fetchAllRooms();

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
    } else {
      console.error('API返回成功状态为false:', response);
      $q.notify({
        type: 'negative',
        message: response.message || '更换房间失败',
        position: 'top'
      });
    }
  } catch (error) {
    console.error('更换房间失败:', error);
    console.error('错误响应:', error.response);

    let errorMessage = '更换房间失败';

    if (error.response?.data) {
      // 显示后端返回的具体错误信息
      errorMessage = error.response.data.message || '更换房间失败';
      console.error('后端错误详情:', error.response.data);

      // 如果有参数验证失败的详细信息，也显示出来
      if (error.response.data.received) {
        console.error('后端接收到的参数:', error.response.data.received);
      }
    } else {
      errorMessage = error.message || '更换房间失败';
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      multiLine: true
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
  console.log('Current order for date check:', JSON.parse(JSON.stringify(currentOrder.value))); // 打印当前订单信息

  try {
    // 从订单中获取入住和离店日期
    const rawCheckInDate = currentOrder.value.checkInDate;
    const rawCheckOutDate = currentOrder.value.checkOutDate;
    console.log('Raw dates from order:', { rawCheckInDate, rawCheckOutDate });

    // 确保日期格式正确（YYYY-MM-DD）
    const startDate = formatDate(rawCheckInDate);
    const endDate = formatDate(rawCheckOutDate);
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

  try {
    let dateObj;

    // 如果是ISO格式的时间戳
    if (typeof dateTimeStr === 'string' && dateTimeStr.includes('T')) {
      dateObj = new Date(dateTimeStr);
    }
    // 如果是其他格式的字符串或Date对象
    else {
      dateObj = new Date(dateTimeStr);
    }

    // 检查日期是否有效
    if (isNaN(dateObj.getTime())) {
      console.warn('无效的日期时间格式:', dateTimeStr);
      return dateTimeStr; // 返回原始值
    }

    // 使用toLocaleString格式化日期时间
    return dateObj.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/\//g, '-');
  } catch (error) {
    console.error('日期时间格式化错误:', error, dateTimeStr);
    return dateTimeStr; // 出错时返回原始值
  }
}

/**
 * 格式化日期（仅显示年月日）
 * @param {string} dateStr - 日期字符串
 * @returns {string} 格式化后的日期，格式为 YYYY-MM-DD
 */
function formatDate(dateStr) {
  if (!dateStr) return '';

  try {
    // 处理各种可能的日期格式
    let dateObj;

    // 如果是ISO格式的时间戳 (包含T)
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    // 如果是Date对象或其他格式
    else {
      dateObj = new Date(dateStr);

      // 检查是否是有效日期
      if (isNaN(dateObj.getTime())) {
        console.warn('无效的日期格式:', dateStr);
        return dateStr; // 返回原始值
      }

      // 格式化为 YYYY-MM-DD
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.error('日期格式化错误:', error, dateStr);
    return dateStr; // 出错时返回原始值
  }
}

// 处理账单创建成功
async function handleBillCreated() {
  try {
    if (!billOrder.value || !billOrder.value.orderNumber) {
      console.error('订单信息无效');
      return;
    }

    console.log('账单创建成功，订单:', billOrder.value.orderNumber);

    // 更新当前正在查看的订单详情
    if (currentOrder.value && currentOrder.value.orderNumber === billOrder.value.orderNumber) {
      currentOrder.value = { ...orderStore.getOrderByNumber(billOrder.value.orderNumber) };
    }

    // 刷新订单列表
    await fetchAllOrders();

    $q.notify({
      type: 'positive',
      message: '账单创建成功，入住手续已完成',
      position: 'top'
    });

  // 关闭账单对话框（双保险）
  showBillDialog.value = false;

  } catch (error) {
    console.error('处理账单创建成功事件失败:', error);
    $q.notify({
      type: 'negative',
      message: '账单创建成功，但更新界面失败，请刷新页面',
      position: 'top'
    });
  }
}

// 打开续住对话框
async function openExtendStayDialog(order) {
  console.log('openExtendStayDialog function called for order:', order.orderNumber);

  if (!order || order.status !== 'checked-out') {
    $q.notify({
      type: 'negative',
      message: '只有已退房的订单才能申请续住',
      position: 'top'
    });
    return;
  }

  extendStayOrder.value = order;
  loadingExtendStayRooms.value = true;

  try {
    // 获取今天开始的可用房间（续住一般从今天开始）
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log('Getting available rooms for extend stay from:', today, 'to:', tomorrowStr);

    // 获取可用房间
    const rooms = await roomStore.getAvailableRoomsByDate(today, tomorrowStr);
    console.log('Available rooms for extend stay:', rooms);

    // 更新可用房间选项
    extendStayRoomOptions.value = rooms.map(room => ({
      label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (¥${room.price}/晚)`,
      value: room.room_number,
      type: room.type_code,
      price: room.price
    }));

    console.log('Processed extend stay room options:', extendStayRoomOptions.value);
    showExtendStayDialog.value = true;

  } catch (error) {
    console.error('获取续住可用房间失败:', error);
    $q.notify({
      type: 'negative',
      message: '获取可用房间列表失败: ' + (error.message || '未知错误'),
      position: 'top'
    });
  } finally {
    loadingExtendStayRooms.value = false;
  }
}

// 处理续住
async function handleExtendStay(extendStayData) {
  console.log('🏨 处理续住请求:', extendStayData);

  try {
    // 使用对话框中用户设置的订单号
    const newOrderNumber = extendStayData.orderNumber;

    // 创建新订单数据，使用 addOrder 期望的格式
    const newOrderData = {
      orderNumber: newOrderNumber,
      guestName: extendStayData.guestName,
      phone: extendStayData.phone,
      idNumber: extendStayData.idNumber || '000000000000000000', // 使用原订单的身份证号，如果没有则使用默认值
      roomType: extendStayData.roomType,
      roomNumber: extendStayData.roomNumber,
      checkInDate: extendStayData.checkInDate,
      checkOutDate: extendStayData.checkOutDate,
      status: 'pending', // 新订单默认为待入住状态
      paymentMethod: 'cash', // 默认现金支付，管理员可以修改
      roomPrice: extendStayData.roomPrice, // 单日房价
      deposit: 0, // 续住默认押金为0
      remarks: `续住订单，原订单号：${extendStayData.originalOrderNumber}。${extendStayData.notes || ''}`.trim(),
      source: 'extend_stay', // 标记为续住来源
      sourceNumber: extendStayData.originalOrderNumber || ''
    };

    console.log('📋 准备创建续住订单:', newOrderData);

    // 使用 addOrder 方法创建新订单
    const createdOrder = await orderStore.addOrder(newOrderData);

    if (createdOrder) {
      // 关闭对话框
      showExtendStayDialog.value = false;

      // 刷新订单列表
      await fetchAllOrders();

      $q.notify({
        type: 'positive',
        message: `🎉 续住订单创建成功！\n订单号：${newOrderNumber}`,
        position: 'top',
        multiLine: true,
        timeout: 5000,
        actions: [
          {
            label: '查看订单',
            color: 'white',
            handler: () => {
              // 找到新创建的订单并查看详情
              const newOrder = orderStore.getOrderByNumber(newOrderNumber);
              if (newOrder) {
                viewOrderDetails(newOrder);
              }
            }
          }
        ]
      });

      console.log('✅ 续住订单创建成功:', createdOrder);
    }

  } catch (error) {
    console.error('❌ 创建续住订单失败:', error);
    const errorMessage = error.response?.data?.message || error.message || '未知错误';
    $q.notify({
      type: 'negative',
      message: `创建续住订单失败: ${errorMessage}`,
      position: 'top',
      multiLine: true
    });
  }
}

// 处理续住房间刷新
async function handleRefreshExtendStayRooms(dateRange) {
  console.log('刷新续住房间，日期范围:', dateRange);

  if (!dateRange.startDate || !dateRange.endDate) {
    return;
  }

  loadingExtendStayRooms.value = true;

  try {
    // 获取指定日期范围的可用房间
    const rooms = await roomStore.getAvailableRoomsByDate(dateRange.startDate, dateRange.endDate);
    console.log('刷新获取的可用房间:', rooms);

    // 更新可用房间选项
    extendStayRoomOptions.value = rooms.map(room => ({
      label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (¥${room.price}/晚)`,
      value: room.room_number,
      type: room.type_code,
      price: room.price
    }));

    console.log('刷新后的续住房间选项:', extendStayRoomOptions.value);

  } catch (error) {
    console.error('刷新续住可用房间失败:', error);
    $q.notify({
      type: 'negative',
      message: '刷新可用房间列表失败: ' + (error.message || '未知错误'),
      position: 'top'
    });
  } finally {
    loadingExtendStayRooms.value = false;
  }
}

// 判断是否可以退押金
// 账单退款信息映射 (order_id -> refund_deposit)
const billRefundDepositMap = computed(() => {
  const map = {}
  billStore.bills.forEach(b => {
    // 只记录第一条含押金账单，或若尚未记录
    if (!map[b.order_id]) {
      if ((b.deposit || 0) > 0) {
        map[b.order_id] = b.refund_deposit
      } else {
        map[b.order_id] = b.refund_deposit
      }
    }
  })
  return map
})

function canRefundDeposit(order) {
  if (!order) return false
  // 仍要求订单状态必须为已退房或已取消，且存在押金
  const statusOk = ['checked-out', 'cancelled'].includes(order.status)
  const hasDeposit = (order.deposit || 0) > 0
  // 新逻辑：只有对应账单 refund_deposit === 0 时显示退押按钮
  const billRefund = billRefundDepositMap.value[order.orderNumber]
  return statusOk && hasDeposit && billRefund === 0
}

// 打开退押金对话框
function openRefundDepositDialog(order) {
  if (!canRefundDeposit(order)) {
    $q.notify({
      type: 'negative',
      message: '该订单不满足退押金条件',
      position: 'top'
    })
    return
  }

  refundDepositOrder.value = order
  showRefundDepositDialog.value = true
}

// 从订单详情页面打开退押金对话框
function openRefundDepositFromDetails() {
  if (currentOrder.value) {
    openRefundDepositDialog(currentOrder.value)
  }
}

// 处理退押金
async function handleRefundDeposit(refundData) {
  try {
    console.log('处理退押金请求:', refundData)

    // 调用 orderStore 的退押金方法
    await orderStore.refundDeposit(refundData)

    // 更新当前正在查看的订单详情
    if (currentOrder.value && currentOrder.value.orderNumber === refundData.orderNumber) {
      const updatedOrder = orderStore.getOrderByNumber(refundData.orderNumber)
      if (updatedOrder) {
        currentOrder.value = updatedOrder
      }
    }

  // 关闭对话框
  showRefundDepositDialog.value = false

  // 刷新订单与账单数据（账单 refund_deposit 更新后隐藏按钮）
  await fetchAllOrders()
  await billStore.fetchAllBills()

    $q.notify({
      type: 'positive',
      message: `退押金成功！实际退款：¥${refundData.actualRefundAmount}，已自动记录到交接班系统`,
      position: 'top'
    })

  } catch (error) {
    console.error('退押金处理失败:', error)
    $q.notify({
      type: 'negative',
      message: '退押金处理失败: ' + (error.message || '未知错误'),
      position: 'top'
    })
  }
}

// 检查是否为多日订单
function checkIfMultiDayOrder(order) {
  if (!order || !order.roomPrice) return false;

  // 如果roomPrice是对象格式且包含多个日期
  if (typeof order.roomPrice === 'object') {
    const priceDates = Object.keys(order.roomPrice);
    return priceDates.length > 1;
  }

  return false;
}

onMounted(async () => {
  await fetchAllOrders()
  // 加载账单数据以支持退押按钮显示逻辑
  try { await billStore.fetchAllBills() } catch (e) { console.warn('加载账单失败(不影响订单显示):', e.message) }
})
</script>

<style scoped>
.view-orders {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
