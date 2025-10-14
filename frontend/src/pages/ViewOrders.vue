<template>
  <q-page class="view-orders">
    <div class="q-pa-md">
      <h1 class="text-h4 q-mb-md">查看订单</h1>
    <div class="search-section q-mb-md">
      <div class="row q-col-gutter-md">
        <div class="col-md-4 col-xs-12">
          <q-input v-model="searchQuery" label="搜索订单" filled clearable @keyup.enter="searchOrders">
            <template v-slot:append>
              <q-icon name="search" class="cursor-pointer" @click="searchOrders" />
            </template>
            <template v-slot:hint>
              输入订单号、客人姓名、手机号或房间号
            </template>
          </q-input>
        </div>
        <div class="col-md-3 col-xs-12">
          <q-select v-model="filterStatus" :options="statusOptions" label="订单状态" filled clearable emit-value map-options
            @update:model-value="searchOrders" />
        </div>
        <div class="col-md-3 col-xs-12">
          <q-input v-model="filterDate" label="筛选日期" filled clearable @update:model-value="searchOrders" readonly>
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="filterDate" @update:model-value="onDateSelected">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="确定" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
            <template v-slot:hint>
              选择入住或离店日期进行筛选
            </template>
          </q-input>
        </div>
        <div class="col-md-1 col-xs-6">
          <q-btn color="primary" label="搜索" class="full-width" @click="searchOrders" />
        </div>
        <div class="col-md-1 col-xs-6">
          <q-btn color="grey" label="清除" class="full-width" @click="clearFilters" />
        </div>
      </div>
    </div>

    <!-- 添加错误提示和重试按钮 -->
    <div v-if="fetchError" class="q-pa-md bg-red-1 text-red q-mb-md">
      <div class="row items-center">
        <q-icon name="error" size="md" class="q-mr-sm" />
        <div class="col">
          <div class="text-bold">加载订单数据失败</div>
          <div>{{ fetchError }}</div>
        </div>
        <q-btn color="primary" label="重试" @click="retryFetchOrders" :loading="loadingOrders" />
      </div>
    </div>

    <q-card>
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-h6">订单列表</div>
          <div class="text-caption">
            显示 {{ filteredOrders.length }} / {{ orderStore.orders.length }} 条订单
          </div>
        </div>
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
      @change-order="openChangeOrderDialog"
    />


    <!-- 修改订单对话框 -->
    <ChangeOrderDialog
      v-model="showChangeOrderDialog"
      :order="currentOrder"
      :availableRooms="changeOrderRooms"
      :getRoomTypeName="getRoomTypeName"
      @order-updated="handleOrderUpdated"
    />

    <!-- 更改房间对话框 -->
    <ChangeRoomDialog
      v-model="showChangeRoomDialog"
      :currentOrder="currentOrder"
      :availableRoomOptions="availableRoomOptions"
      :getRoomTypeName="getRoomTypeName"
      @change-room="changeRoom"
    />

    <!-- 入住对话框 -->
    <CheckIn
      v-model="showCheckInDialog"
      :currentOrder="billOrder"
      @complete_check_in="handleCheckInCompleted"
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

    <!-- 办理入住确认对话框 -->
    <CheckInConfirmDialog
      v-model="showCheckInConfirmDialog"
      :order="checkInOrder_ref"
      :getRoomTypeName="getRoomTypeName"
      :getPaymentMethodName="getPaymentMethodName"
      :formatDate="formatDate"
      @confirm="handleCheckInConfirm"
    />

    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import { date, useQuasar } from 'quasar'
import { useOrderStore } from '../stores/orderStore' // 导入订单 store
import { useRoomStore } from '../stores/roomStore' // 导入房间 store
import { useViewStore } from '../stores/viewStore' // 导入视图 store
import { useBillStore } from '../stores/billStore' // 导入账单 store
import { roomApi } from '../api/index.js' // 导入房间API
import { billApi } from '../api/index.js' // 导入账单API
import OrderDetailsDialog from 'src/components/OrderDetailsDialog.vue';
import ChangeOrderDialog from 'src/components/ChangeOrderDialog.vue';
import ChangeRoomDialog from 'src/components/ChangeRoomDialog.vue';
import CheckIn from 'src/components/CheckIn.vue';
import ExtendStayDialog from 'src/components/ExtendStayDialog.vue';
import RefundDepositDialog from 'src/components/RefundDepositDialog.vue';
import CheckInConfirmDialog from 'src/components/CheckInConfirmDialog.vue';
import { watch } from 'vue'


// 初始化 stores
const orderStore = useOrderStore()
const roomStore = useRoomStore()
const viewStore = useViewStore()
const billStore = useBillStore()
const $q = useQuasar() // 初始化 $q 对象

// 搜索和过滤
const searchQuery = ref('')
const filterStatus = ref(null)
const filterDate = ref(null) // 新增：日期筛选
const loadingOrders = ref(false)
const fetchError = ref(null) // 新增：用于显示获取订单数据的错误

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
    const query = String(searchQuery.value).toLowerCase()
    result = result.filter(order => {
      const orderNo = order.orderNumber != null ? String(order.orderNumber).toLowerCase() : ''
      const guest = order.guestName != null ? String(order.guestName).toLowerCase() : ''
      const phone = order.phone != null ? String(order.phone) : ''
      const room = order.roomNumber != null ? String(order.roomNumber).toLowerCase() : ''
      return orderNo.includes(query) || guest.includes(query) || phone.includes(query) || room.includes(query)
    })
  }

  // 根据状态筛选
  if (filterStatus.value) {
    result = result.filter(order => order.status === filterStatus.value)
  }

  // 根据日期筛选（匹配入住或离店日期）
  if (filterDate.value) {
    result = result.filter(order => {
      // 确保filterDate也经过相同的格式化处理
      const filterDateStr = formatDate(filterDate.value)
      const checkInDateStr = order.checkInDate ? formatDate(order.checkInDate) : ''
      const checkOutDateStr = order.checkOutDate ? formatDate(order.checkOutDate) : ''
      return checkInDateStr === filterDateStr || checkOutDateStr === filterDateStr
    })
  }

  return result
})

// 日期选择处理函数
function onDateSelected(date) {
  console.log('日期选择器返回的日期:', date, '格式化后:', formatDate(date));
  filterDate.value = date
  searchOrders()
}

// 清除所有筛选条件
function clearFilters() {
  searchQuery.value = ''
  filterStatus.value = null
  filterDate.value = null
  console.log('已清除所有筛选条件');
  searchOrders()
}

// 获取所有订单数据 - 增强错误处理
async function fetchAllOrders() {
  try {
    fetchError.value = null // 清除之前的错误
    loadingOrders.value = true

    await orderStore.fetchAllOrders()

  } catch (error) {
    console.error('获取订单数据失败:', error)
    const errorMessage = error.code === 'ECONNABORTED'
      ? '请求超时，服务器响应时间过长，请稍后重试'
      : (error.message || '请刷新页面重试')

    fetchError.value = errorMessage

    $q.notify({
      type: 'negative',
      message: '获取订单数据失败: ' + errorMessage,
      position: 'top',
      timeout: 5000
    })
  } finally {
    loadingOrders.value = false
  }
}

// 重试获取订单
async function retryFetchOrders() {
  await fetchAllOrders()
}

// 订单详情相关
const showOrderDetails = ref(false)
const currentOrder = ref(null)
const showChangeRoomDialog = ref(false)
const showChangeOrderDialog = ref(false)
const changeOrderRooms = ref([])
const showCheckInDialog = ref(false)
const billOrder = ref(null)

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
        const latest = await orderStore.getOrderByNumber(order.orderNumber)
        if (latest) currentOrder.value = { ...latest } // 从store获取最新数据
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
    }
  }
}



// 续住相关变量
const showExtendStayDialog = ref(false)
const extendStayOrder = ref(null)
const extendStayRoomOptions = ref([])
const loadingExtendStayRooms = ref(false)

// 退押金相关变量
const showRefundDepositDialog = ref(false)
const refundDepositOrder = ref(null)

// 办理入住确认对话框
const showCheckInConfirmDialog = ref(false)
const checkInOrder_ref = ref(null)
// 退押按钮可见性的本地缓存：true 可退；false 不可退；未定义 表示尚未计算
const refundableMap = ref({})

// 计算单个订单是否可退押（异步，结果写入 refundableMap）
async function computeRefundable(order) {
  try {
    if (!order) return;
    const key = String(order.orderNumber);
    // 仅对已退房且押金>0的订单计算
    const deposit = Number(order.deposit) || 0;
    if (!allowedRefundStatuses.includes(order.status) || deposit <= 0) {
      refundableMap.value[key] = false;
      return;
    }

    // 拉取该订单的账单
    const bills = await billStore.getBillsByOrderId(key);
    let refundedFromBills = 0;
    let hasRefundRow = false;
    (bills || []).forEach(b => {
      if (b?.change_type === '退押') {
        hasRefundRow = true;
        const cp = Number(b?.change_price) || 0;
        if (cp < 0) refundedFromBills += -cp;
      }
    });
    const legacyRefund = (bills || []).reduce((sum, b) => {
      const rd = Number(b?.refund_deposit);
      if (!isNaN(rd) && rd < 0) return sum + (-rd);
      return sum;
    }, 0);
    const totalRefunded = Math.max(refundedFromBills + legacyRefund, Number(order.refundedDeposit || 0));

    // 规则：发生过退押记录或累计退额>=押金，则不可再次退押
    refundableMap.value[key] = !(hasRefundRow || totalRefunded >= deposit);
  } catch (e) {
    console.warn('computeRefundable 失败，按不可退处理:', e);
    if (order?.orderNumber) refundableMap.value[String(order.orderNumber)] = false;
  }
}

// 办理退房
async function checkoutOrder(order) {
  if (!order || !order.orderNumber) {
    $q.notify({ type: 'negative', message: '订单信息无效，无法办理退房', position: 'top' });
    return;
  }

  // 使用 Quasar Dialog 显示确认对话框
  $q.dialog({
    title: '确认办理退房',
    message: `确定要为订单 ${order.orderNumber} (客人: ${order.guestName}, 房间: ${order.roomNumber}) 办理退房吗？

办理退房后房间将设置为清扫中状态。`,
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
      const latest = await orderStore.getOrderByNumber(order.orderNumber)
      if (latest) currentOrder.value = { ...latest }
    }

    // 刷新订单列表，确保退房状态实时更新
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
  if (process.env.NODE_ENV === 'development') {
    console.log('搜索订单参数:', {
      searchQuery: searchQuery.value,
      filterStatus: filterStatus.value,
      filterDate: filterDate.value,
      formattedFilterDate: filterDate.value ? formatDate(filterDate.value) : null
    });
  }

  // 设置加载状态
  loadingOrders.value = true;

  // 短暂延迟模拟数据刷新，确保UI能够响应数据变化
  setTimeout(() => {
    // filteredOrders计算属性会自动重新计算
    if (process.env.NODE_ENV === 'development') {
      console.log('搜索完成，过滤结果:', filteredOrders.value.length, '/', orderStore.orders.length);
    }
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

  // 显示账单确认对话框
  checkInOrder_ref.value = order;
  showCheckInConfirmDialog.value = true;
}

// 确认办理入住（从对话框回调）
async function handleCheckInConfirm(order) {
  showCheckInConfirmDialog.value = false;
  await performCheckIn(order);
}

// 执行入住操作
async function performCheckIn(order) {
  loadingOrders.value = true;
  try {
    // 1. 等待核心入住操作完成
    await orderStore.checkIn(order.orderNumber);

    $q.notify({
      type: 'positive',
      message: '办理入住成功'
    });

  } catch (error) {
    console.error('办理入住操作失败:', error);
    const errorMessage = error.message || '未知错误';
    $q.notify({
      type: 'negative',
      message: `办理入住失败: ${errorMessage}`,
      position: 'top',
      multiLine: true
    });
  } finally {
    // 2. 无论成功失败，都先解除UI锁定
    loadingOrders.value = false;
  }

  // 3. 在UI响应后，于后台触发房间列表的刷新，确保房间管理页面数据能更新
  //    这样做即使变慢也不会阻塞当前页面
  roomStore.fetchAllRooms().catch(err => {
    console.error("后台刷新房间列表失败，但这不应阻塞UI:", err);
  });
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

      // 刷新订单列表，确保房间更换信息实时更新
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
      const data = error.response.data;
      const code = data.code;
      console.error('后端错误详情:', data);
      const codeMap = {
        MISSING_PARAMS: '参数缺失，请刷新后重试',
        SAME_ROOM: '新房间与当前房间相同，无需更换',
        ORDER_STATUS_INVALID: '订单状态不允许更换房间，仅待入住/已入住可更换',
        NEW_ROOM_NOT_FOUND: '目标房间不存在',
        NEW_ROOM_CLOSED: '目标房间已关闭',
        NEW_ROOM_REPAIR: '目标房间正在维修中',
        NEW_ROOM_NOT_AVAILABLE: '目标房间当前不可用',
        NEW_ROOM_CONFLICT: '目标房间在该日期范围内已有冲突订单',
        ROOM_TYPE_MISMATCH: '目标房间的房型与订单房型不一致',
        ROOM_CHANGE_VALIDATION: '请求参数校验失败',
        ROOM_CHANGE_SERVER: '服务器内部错误，请稍后再试'
      };
      if (code && codeMap[code]) {
        errorMessage = codeMap[code];
      } else {
        errorMessage = data.message || errorMessage;
      }
    } else {
      errorMessage = error.message || errorMessage;
    }

    $q.notify({ type: 'negative', message: errorMessage, position: 'top', multiLine: true });
  }
}

// 打开更换房间对话框时获取可用房间（只获取相同房型的房间）
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
    const roomType = currentOrder.value.roomType; // 获取当前房型
    console.log('Raw dates from order:', { rawCheckInDate, rawCheckOutDate, roomType });

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

    if (!roomType) {
      console.error('Room type is missing from current order.');
      $q.notify({
        type: 'negative',
        message: '无法获取订单的房型信息',
        position: 'top'
      });
      return;
    }

    // 调用 roomStore 中的方法获取可用房间，并传入房型参数
    console.log('Calling roomStore.getAvailableRoomsByDate with roomType:', roomType);
    const rooms = await roomStore.getAvailableRoomsByDate(startDate, endDate, roomType);
    console.log('Rooms received from API (same type only):', rooms); // 打印从API获取的房间

    // 更新可用房间选项（排除当前房间）
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
 * @param {string|Date} dateStr - 日期字符串或Date对象
 * @returns {string} 格式化后的日期，格式为 YYYY-MM-DD
 */
function formatDate(dateStr) {
  if (!dateStr) return '';

  try {
    // 如果已经是YYYY-MM-DD格式（Quasar日期选择器通常返回这种格式）
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // 如果是ISO格式的时间戳 (包含T)
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }

    // 处理其他格式，转换为Date对象
    const dateObj = new Date(dateStr);

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
  } catch (error) {
    console.error('日期格式化错误:', error, dateStr);
    return dateStr; // 出错时返回原始值
  }
}

// 处理入住成功
async function handleCheckInCompleted(checkInData) {
  try {
    // 1.添加账单
    const response = await billStore.addBill(checkInData);

    if (!response || !response.success) {
      console.log('添加账单失败', response);
      $q.notify({
        type: 'negative',
        message: '添加账单失败，入住操作中止',
        position: 'top',
        multiLine: true,
      })
      return;
    } else {
      $q.notify({
        type: 'positive',
        message: '账单已添加，订单状态修改成功',
        position: 'top',
        multiLine: true,
      })
    }

    // 2.修改订单状态为以入住
    const updatedOrderFromApi = await orderStore.updateOrderStatusViaApi(checkInData.order_id, 'checked-in');
    if (updatedOrderFromApi.status !== 'checked-in') {
      console.log('修改订单状态失败', updatedOrderFromApi);
      $q.notify({
        type: 'warning',
        message: '账单已添加，订单状态修改失败',
        position: 'top',
        multiLine: true,
      })
    } else {
      $q.notify({
        type: 'positive',
        message: '订单状态更新为已入住',
        position: 'top'
      })
    }

    // 3. 更新房间状态为 'occupied'
    const room = roomStore.getRoomByNumber(checkInData.room_number);
    const updatedRoomFromApi = await roomStore.updateRoomStatus(room.room_id, 'occupied');
    if (!updatedRoomFromApi) {
      console.log('更新房间状态失败',updatedRoomFromApi)
      $q.notify({
        type: 'error',
        message: '订单已入住，但更新房间状态为占用失败，请检查房间状态！',
        position: 'top',
        multiLine: true,
      })
    } else {
      console.log('房间更新成功')
    }

    // 4. 刷新订单和房间列表
    await orderStore.fetchAllOrders();
    await roomStore.fetchAllRooms();

    $q.notify({
      type: 'positive',
      message: '入住成功',
      position: 'top'
    })

  } catch (error) {
    console.error('处理入住成功事件失败:', error);
    $q.notify({
      type: 'negative',
      message: `处理入住失败: ${error.message || '请刷新页面重试'}`,
      position: 'top',
      multiLine: true,
    });
  } finally {
    loadingOrders.value = false;
  }
}

// 5.打开续住对话框
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

    // 为续住订单的客人姓名添加唯一标识符，避免数据库约束冲突
    // 使用时间戳的后4位作为唯一标识
    const timestamp = Date.now();
    const uniqueId = String(timestamp).slice(-4);
    const extendStayGuestName = `${extendStayData.guestName}[续${uniqueId}]`;

    // 创建新订单数据，使用 addOrder 期望的格式
    const newOrderData = {
      orderNumber: newOrderNumber,
      guestName: extendStayGuestName, // 使用带唯一标识的客人姓名
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
      remarks: `续住订单，原客人：${extendStayData.guestName}，原订单号：${extendStayData.originalOrderNumber}。${extendStayData.notes || ''}`.trim(),
      source: 'extend_stay', // 标记为续住来源
      sourceNumber: extendStayData.originalOrderNumber || ''
    };

    console.log('📋 准备创建续住订单:', newOrderData);

    // 使用 addOrder 方法创建新订单
    const createdOrder = await orderStore.addOrder(newOrderData);

    if (createdOrder) {
      // 关闭对话框
      showExtendStayDialog.value = false;

      // 刷新订单列表，确保新创建的续住订单立即显示
      await fetchAllOrders();

      $q.notify({
        type: 'positive',
        message: `🎉 续住订单创建成功！
订单号：${newOrderNumber}`,
        position: 'top',
        multiLine: true,
        timeout: 5000,
        actions: [
          {
            label: '查看订单',
            color: 'white',
            handler: async () => {
              // 找到新创建的订单并查看详情
              const newOrder = await orderStore.getOrderByNumber(newOrderNumber);
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

const allowedRefundStatuses = ['checked-out'] // 仅已退房可退押；已取消不允许

// 判断是否可以退押金（同步，使用本地账单缓存，避免渲染期异步报错）
function canRefundDeposit(order) {
  try {
    if (!order) return false;

  // 同步读取缓存，默认隐藏直到计算完成
  const key = String(order.orderNumber);
  const cached = refundableMap.value[key];
  if (cached === undefined) return false;
  return cached === true;
  } catch (e) {
    console.warn('canRefundDeposit 计算失败，按不可退处理以避免误退:', e);
    return false;
  }
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
    const refund = await orderStore.refundDeposit(refundData)

    if (!refund) {
      console.log('退押金失败:', refundData)
      throw new Error('退押金失败')
    }

    // 更新当前正在查看的订单详情
    if (currentOrder.value && currentOrder.value.orderNumber === refundData.order_id) {
      const updatedOrder = await orderStore.getOrderByNumber(refundData.order_id);
      if (updatedOrder) {
        currentOrder.value = updatedOrder;
      }
    }

    // 关闭对话框
    showRefundDepositDialog.value = false

    // 刷新订单与账单数据（账单 refund_deposit 更新后隐藏按钮）
    await fetchAllOrders();
    await billStore.fetchAllBills();

    // 重新计算该订单的可退状态
    const order = await orderStore.getOrderByNumber(refundData.order_id);
    if (order) await computeRefundable(order);

    $q.notify({
      type: 'positive',
      message: `退押金成功！实际退款：¥${refundData.change_price}，已自动记录到交接班系统`,
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

// 打开更改订单对话框
async function openChangeOrderDialog() {
  if (!currentOrder.value) return;
  try {
    const startDate = formatDate(currentOrder.value.checkInDate)
    const endDate = formatDate(currentOrder.value.checkOutDate)
    if (!startDate || !endDate) {
      $q.notify({ type: 'negative', message: '订单日期无效，无法加载可用房间', position: 'top' })
      return
    }
    const rooms = await roomStore.getAvailableRoomsByDate(startDate, endDate)
    // 把当前房间也加入选项，方便保留不变
    const currentRoom = roomStore.getRoomByNumber(currentOrder.value.roomNumber)
    const merged = [...rooms]
    if (currentRoom) {
      const exists = merged.find(r => r.room_number === currentRoom.room_number)
      if (!exists) merged.unshift(currentRoom)
    }
    changeOrderRooms.value = merged
  } catch (e) {
    console.warn('加载更改订单可用房间失败:', e)
    changeOrderRooms.value = []
  } finally {
    showChangeOrderDialog.value = true
  }
}

// 处理订单更新 - 修复通知处理逻辑
async function handleOrderUpdated(updatedOrderData) {
  const dismiss = $q.notify({
    type: 'ongoing',
    message: '正在更新订单信息...',
    position: 'top',
    timeout: 0,
    progress: true
  });

  try {
    // 先关闭对话框
    showChangeOrderDialog.value = false;
    loadingOrders.value = true;
    fetchError.value = null;

    // 调用API更新订单
    await orderStore.updateOrder(updatedOrderData.orderNumber, updatedOrderData);

    // 更新成功，显示成功通知
    dismiss(); // 先关闭进行中的通知
    $q.notify({
      type: 'positive',
      message: '订单信息更新成功',
      position: 'top',
      timeout: 2000
    });


    // 如果正在查看该订单的详情，从 store 中更新详情数据
    if (currentOrder.value && currentOrder.value.orderNumber === updatedOrderData.orderNumber) {
      const updatedOrderFromStore = orderStore.orders.find(o => o.orderNumber === updatedOrderData.orderNumber);
      if (updatedOrderFromStore) {
        currentOrder.value = updatedOrderFromStore;
      }
    }

  } catch (error) {
    dismiss(); // 确保出错时也关闭通知
    console.error('更新订单失败:', error);

    $q.notify({
      type: 'negative',
      message: '更新订单失败: ' + (error.message || '未知错误'),
      position: 'top',
      timeout: 5000
    });

  } finally {
    loadingOrders.value = false;
    // 确保万无一失，再次检查并关闭
    if (typeof dismiss === 'function') {
      dismiss();
    }
  }
}

// 提取数据加载逻辑以便复用
async function loadInitialData() {
  try {
    await fetchAllOrders()
    // 加载账单数据以支持退押按钮显示逻辑
    try {
      if (!Array.isArray(billStore.bills) || billStore.bills.length === 0) {
        await billStore.fetchAllBills()
      }
    } catch (e) {
      console.warn('加载账单失败(不影响订单显示):', e.message)
    }

    // 计算所有候选订单的退押可见性
    const list = Array.isArray(orderStore.orders) ? orderStore.orders : [];
    const tasks = list
      .filter(o => allowedRefundStatuses.includes(o.status) && Number(o.deposit) > 0)
      .map(o => computeRefundable(o));
    if (tasks.length) await Promise.allSettled(tasks);
  } catch (error) {
    console.error('初始化数据失败:', error)
  }
}

onMounted(loadInitialData)

onActivated(loadInitialData)

// 监听订单退押状态变化
watch(() => orderStore.orders, (newOrders) => {
  if (Array.isArray(newOrders)) {
    // 重新计算所有候选订单的退押可见性
    const tasks = newOrders
      .filter(o => allowedRefundStatuses.includes(o.status) && Number(o.deposit) > 0)
      .map(o => computeRefundable(o));
    if (tasks.length) {
      Promise.allSettled(tasks).catch(e => {
        console.warn('重新计算退押可见性失败:', e.message);
      });
    }
  }
}, { deep: true });

// 监听订单是否修改
watch(() => currentOrder.value, async (newOrder, oldOrder) => {
  if (newOrder && oldOrder && newOrder.orderNumber !== oldOrder.orderNumber) {
    // 订单被修改，重新加载相关数据
    await orderStore.getOrderByNumber(newOrder.orderNumber);
  }
}, { deep: true });

</script>

<style scoped>
.view-orders {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
