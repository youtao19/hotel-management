<template>
  <!-- 主容器，使用 Quasar 的 q-page 组件 -->
  <q-page class="room-status">
    <div class="q-pa-md">
      <!-- 页面标题 -->
      <!-- <h1 class="text-h4 q-mb-md">房间状态</h1> -->

    <!-- 房型统计卡片部分 -->
    <div class="room-type-summary q-mb-md">
      <div class="row q-col-gutter-sm">
        <!-- 房型数据加载中的占位符 -->
        <div v-if="loading || availableRoomTypeOptions.length === 0" class="col-12">
          <q-card class="text-center">
            <q-card-section class="q-py-md">
              <div v-if="loading" class="text-subtitle1 text-grey-7">
                <q-spinner color="primary" size="2em" class="q-mr-sm" />
                正在加载房型数据...
              </div>
              <div v-else class="text-subtitle1 text-grey-7">
                暂无可用房型
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- 动态生成房型统计卡片 -->
        <div
          v-for="(roomType, index) in availableRoomTypeOptions"
          :key="roomType.value"
          class="col-lg-2 col-md-3 col-sm-4 col-xs-6"
        >
          <q-card
            :class="getRoomTypeCardClass(roomType.value, index)"
            class="text-center cursor-pointer"
            @click="setTypeFilter(roomType.value)"
          >
            <q-card-section class="q-py-sm">
              <div class="text-caption text-weight-bold">{{ roomType.label }}</div>
              <div class="text-h6 text-weight-bold">剩余：{{ roomStore.getAvailableRoomCountByType(roomType.value) }}</div>
              <!-- 如果有描述信息，可以显示为tooltip -->
              <q-tooltip v-if="roomType.description" anchor="bottom middle" self="top middle">
                {{ roomType.description }}
              </q-tooltip>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- 筛选器部分 -->
    <div class="filters q-mb-md">
      <div class="row q-col-gutter-md">
        <!-- 房间类型筛选下拉框 -->
        <div class="col-md-3 col-sm-6 col-xs-12">
          <q-select
            v-model="filterType"
            :options="roomTypeOptions"
            label="房间类型"
            outlined
            emit-value
            map-options
            clearable
            clear-icon="close"
          />
        </div>

        <!-- 房间状态筛选下拉框 -->
        <div class="col-md-3 col-sm-6 col-xs-12">
          <q-select
            v-model="filterStatus"
            :options="statusOptions"
            label="房间状态"
            outlined
            emit-value
            map-options
            clearable
            clear-icon="close"
          />
        </div>

        <!-- 日期范围选择器 -->
        <div class="col-md-4 col-sm-6 col-xs-12">
          <q-input
            outlined
            label="可用日期范围"
            readonly
            :model-value="formattedDateRange || '请选择日期范围'"
            placeholder="YYYY-MM-DD 至 YYYY-MM-DD"
            class="date-range-input"
            clearable
            clear-icon="close"
            @clear="clearDateRange"
          >
            <template v-slot:append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date
                    v-model="dateRange"
                    range
                    default-view="Calendar"
                    today-btn
                  >
                    <div class="row items-center justify-end q-pa-sm">
                      <q-btn v-close-popup label="确定" color="primary" flat/>
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>

        <!-- 筛选操作按钮 -->
        <div class="col-md-2 col-sm-6 col-xs-12 flex items-center">
          <q-btn
            color="primary"
            icon="filter_alt"
            label="应用筛选"
            @click="applyFilters"
            class="q-mr-sm"
          />
          <q-btn
            outline
            color="grey"
            icon="restart_alt"
            label="重置"
            @click="resetFilters"
          />
        </div>
      </div>
    </div>

    <!-- 房间网格视图部分 -->
    <div class="room-grid">
      <div class="row q-col-gutter-md">
        <!-- 遍历过滤后的房间列表 -->
        <div
          v-for="room in filteredRooms"
          :key="room.room_id"
          class="col-lg-3 col-md-4 col-sm-6 col-xs-12"
        >
          <!-- 房间卡片，根据状态设置不同背景色 -->
          <q-card
            :class="roomStore.getRoomStatusClass(room)"
          >
            <q-card-section class="room-header">
              <!-- 房间号 -->
              <div class="text-h5 text-center">{{ room.room_number }}</div>
              <q-chip
                :color="roomStore.getRoomStatusColor(room)"
                text-color="white"
                class="status-chip"
              >
                {{ roomStore.getRoomStatusText(room) }}
              </q-chip>
            </q-card-section>

            <q-separator />

            <q-card-section class="room-info">
              <!-- 房间类型信息 -->
              <div class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">类型:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ getRoomTypeName(room.type_code) }}</div>
                </div>
              </div>

              <!-- 房间价格信息 -->
              <div class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">价格:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold text-primary">¥{{ room.price }}/晚</div>
                </div>
              </div>

              <!-- 已入住房间显示客人信息 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">客人:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">{{ room.currentGuest || room.guest_name || '未知客人' }}</div>
                </div>
              </div>

              <!-- 已入住房间显示退房日期 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">退房日期:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2 text-weight-bold">
                    <q-tooltip>将在此日期退房</q-tooltip>
                    {{ viewStore.formatDate(room.checkOutDate || room.check_out_date) || '未设置' }}
                  </div>
                </div>
              </div>

              <!-- 已入住房间显示订单号 -->
              <div v-if="roomStore.getRoomDisplayStatus(room) === 'occupied' && (room.order_id)" class="row q-mb-sm">
                <div class="col-5">
                  <div class="text-subtitle2 text-grey-7">订单号:</div>
                </div>
                <div class="col-7">
                  <div class="text-subtitle2">
                    <span class="text-weight-bold">{{ room.order_id }}</span>
                  </div>
                </div>
              </div>
            </q-card-section>

            <q-space />

            <!-- 房间操作按钮 -->
            <q-card-actions align="center" class="q-pa-sm">
              <q-btn-group flat>
                <!-- 空闲房间可预订 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'available'"
                  color="primary"
                  icon="book_online"
                  label="预订"
                  size="sm"
                  @click="bookRoom(room.room_id)"
                />
                <!-- 已入住房间可退房 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'occupied'"
                  color="negative"
                  icon="logout"
                  label="退房"
                  size="sm"
                  @click="checkOut(room.room_id)"
                />
                <!-- 所有非清洁中和非维修中的房间都可以设置为清理状态 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.CLEANING && roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.REPAIR"
                  color="warning"
                  icon="cleaning_services"
                  label="清理"
                  size="sm"
                  @click="setRoomCleaning(room.room_id)"
                />
                <!-- 非维修中房间可设为维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) !== ROOM_STATES.REPAIR"
                  color="grey"
                  icon="build"
                  label="维修"
                  size="sm"
                  @click="setMaintenance(room.room_id)"
                />
                <!-- 维修中房间可完成维修 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === ROOM_STATES.REPAIR"
                  color="green"
                  icon="check"
                  label="完成维修"
                  size="sm"
                  @click="clearMaintenance(room.room_id)"
                />
                <!-- 清扫中房间可完成清洁 -->
                <q-btn
                  v-if="roomStore.getRoomDisplayStatus(room) === 'cleaning'"
                  color="green"
                  icon="check"
                  label="完成清洁"
                  size="sm"
                  @click="clearCleaning(room.room_id)"
                />
              </q-btn-group>
            </q-card-actions>
          </q-card>
        </div>
      </div>
    </div>

    <!-- 无结果提示 - 当筛选后没有房间时显示 -->
    <div v-if="filteredRooms.length === 0" class="text-center q-pa-lg">
      <q-icon name="search_off" size="5rem" color="grey-5" />
      <div class="text-h6 text-grey-7 q-mt-md">没有找到符合条件的房间</div>
      <q-btn color="primary" label="重置筛选" @click="resetFilters" class="q-mt-md" />
    </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '../stores/roomStore'
import { useViewStore } from '../stores/viewStore'
import { useOrderStore } from '../stores/orderStore'
import { useQuasar } from 'quasar'

// 获取房间store和视图store
const roomStore = useRoomStore()
const viewStore = useViewStore()
const orderStore = useOrderStore()
const $q = useQuasar()

// 获取当前路由和路由器
const route = useRoute()
const router = useRouter()

// 导入房间状态常量
const ROOM_STATES = roomStore.ROOM_STATES

// 筛选条件状态变量
const filterType = ref(null)    // 房间类型筛选，初始为null表示不筛选
const filterStatus = ref(null)  // 房间状态筛选，初始为null表示不筛选
const dateRange = ref(null)     // 日期范围筛选，初始为null表示不筛选
const loading = ref(false)      // 加载状态
const error = ref(null)         // 错误信息

/**
 * 格式化日期范围显示
 */
const formattedDateRange = computed(() => {
  if (!dateRange.value) return ''

  const { from, to } = dateRange.value

  if (from && to) {
    return `${from} 至 ${to}`
  }
})

/**
 * 监听路由查询参数变化，用于同步URL参数和组件状态
 * 当URL中的status参数变化时，更新filterStatus状态
 * 支持从外部页面（例如仪表盘）跳转到此页面并应用筛选
 */
watch(() => route.query, (newQuery) => {
  console.log('路由参数变化:', newQuery)
  // 仅当新的查询参数中的status与当前filterStatus不同时才更新，避免无限循环
  if (newQuery.status !== filterStatus.value) {
    if (newQuery.status) {
      // 确保状态值是有效的
      const statusValue = newQuery.status
      console.log('尝试应用状态筛选:', statusValue)

      // 验证状态值是否有效，防止非法值导致的筛选问题
      const validStatus = ['available', 'occupied', 'pending', 'cleaning', 'repair'].includes(statusValue)

      if (validStatus) {
        console.log('状态值有效，设置筛选:', statusValue)
        filterStatus.value = statusValue  // 更新内部状态
      } else {
        console.log('无效的状态值:', statusValue)
        filterStatus.value = null  // 无效值时重置筛选
      }
    } else {
      // 如果URL中没有状态参数，重置筛选
      console.log('URL中无状态参数，重置筛选')
      filterStatus.value = null
    }
  }

  // 同样处理type参数
  if (newQuery.type !== filterType.value) {
    filterType.value = newQuery.type || null
  }

  // 处理日期参数
  if (newQuery.dateRange && newQuery.dateRange !== dateRange.value) {
    dateRange.value = newQuery.dateRange
  }
}, { immediate: true, deep: true })  // immediate确保组件初始化时立即执行一次，deep确保深度监听对象变化

// 监听日期范围变化
// watch(dateRange, (newValue) => {
//   console.log('日期范围变化:', newValue)
// }, { deep: true })

/**
 * 添加对筛选条件变化的监听，用于调试
 */
// watch(filterStatus, (newValue) => {
//   console.log('筛选状态变化为:', newValue)
// }, { immediate: true })

/**
 * 计算属性：根据筛选条件过滤房间列表
 * 同时考虑URL参数和本地筛选状态
 * URL参数优先级高于本地状态，确保从其他页面跳转时筛选正常工作
 * 增加了日期范围筛选功能
 * @returns {Array} 过滤后的房间数组
 */
const filteredRooms = computed(() => {
  // 获取URL中的状态参数，优先于filterStatus变量
  const urlStatus = route.query.status;
  const urlType = route.query.type;
  const urlDateRange = route.query.dateRange;

  // 使用roomStore的filterRooms方法替代本地过滤逻辑
  const filters = {};

  // 设置房型筛选
  if (urlType) {
    filters.type = urlType;
  } else if (filterType.value) {
    filters.type = filterType.value;
  }

  // 设置状态筛选，优先使用URL中的状态
  if (urlStatus) {
    filters.status = urlStatus;
  } else if (filterStatus.value) {
    filters.status = filterStatus.value;
  }

  // 设置日期范围筛选
  if (urlDateRange) {
    filters.dateRange = urlDateRange;
    console.log('已经设置日期范围')
  } else if (dateRange.value) {
    filters.dateRange = dateRange.value;
  }

  // 如果没有任何筛选条件 (仅指房型和状态)，并且 roomStore.rooms 本身可能已经是按日期筛选过的
  // 或者包含了所有房间。roomStore.filterRooms 现在只处理 type 和 status。
  if (!filters.type && !filters.status) {
    console.log('没有房型或状态筛选条件，直接返回 roomStore.rooms:', roomStore.rooms.length);
    return roomStore.rooms; // roomStore.rooms 可能已按日期筛选或为全部房间
  }

  // 获取基本过滤结果 - roomStore.filterRooms 现在只按房型和状态筛选
  let result = roomStore.filterRooms(filters);

  return result;
})

/**
 * 应用筛选按钮点击处理函数
 * 将筛选条件更新到URL参数并执行筛选
 * @param {Object} filters - 筛选条件对象 {type, status, dateRange}
 * @param {string} filters.type - 房型代码
 * @param {string} filters.status - 房间状态
 * @param {string} filters.dateRange - 日期范围，格式为 "YYYY-MM-DD to YYYY-MM-DD"
 * @returns {Array} 筛选后的房间数组
 */
async function applyFilters() {
  try {
    loading.value = true;
    error.value = null;

    // 构建查询参数对象
    const query = {};

    if (filterType.value) {
      query.type = filterType.value;
    }

    if (filterStatus.value) {
      query.status = filterStatus.value;
    }

    // 处理日期范围
    if (dateRange.value) {
      let startDate, endDate;

      // 如果是对象格式，转换为字符串
      if (typeof dateRange.value === 'object') {
        console.log('日期范围是对象格式', dateRange.value);
        const { from, to } = dateRange.value;
        if (from && to) {
          // 将 YYYY/MM/DD 转换为 YYYY-MM-DD
          startDate = from.replace(/\//g, '-');
          endDate = to.replace(/\//g, '-');
          query.dateRange = `${from} to ${to}`; // query.dateRange 保持 YYYY/MM/DD to YYYY/MM/DD 用于URL
        }
      } else if (typeof dateRange.value === 'string' && dateRange.value.includes(' to ')) {
        const [rawStartDate, rawEndDate] = dateRange.value.split(' to ');
        // 假设原始字符串也是 YYYY/MM/DD，如果不是，也需要相应转换
        startDate = rawStartDate.replace(/\//g, '-');
        endDate = rawEndDate.replace(/\//g, '-');
        query.dateRange = dateRange.value;
      }

      // 如果有有效的日期范围，查询可用房间并更新 store
      if (startDate && endDate) {
        try {
          // roomStore.getAvailableRoomsByDate 会直接更新 store 中的 rooms.value
          console.log('查询可用房间:', startDate, endDate, filterType.value);
          await roomStore.getAvailableRoomsByDate(
            startDate,
            endDate,
            filterType.value
          );
          // 此处无需再对返回值进行操作，filteredRooms 会自动更新
        } catch (err) {
          console.error('查询可用房间失败:', err);
          error.value = '查询可用房间失败: ' + err.message;
          // 即使查询失败，也尝试刷新所有房间以确保数据一致性
          await roomStore.fetchAllRooms();
        }
      }
    } else {
      // 如果没有日期范围，刷新所有房间数据
      await roomStore.fetchAllRooms();
    }

    // 更新URL
    router.replace({
      path: route.path,
      query
    });
  } catch (err) {
    console.error('应用筛选失败:', err);
    error.value = '应用筛选失败: ' + err.message;
    // 确保出错时也刷新数据
    try {
      await roomStore.fetchAllRooms();
    } catch (refreshErr) {
      console.error('刷新房间数据失败:', refreshErr);
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 重置筛选条件
 */
async function resetFilters() {
  try {
    loading.value = true;
    error.value = null;

    // 重置组件状态变量
    filterType.value = null;
    filterStatus.value = null;
    dateRange.value = null;

    await roomStore.fetchAllRooms();
    // 更新URL，移除所有筛选参数
    router.replace({
      path: route.path,
      query: {}
    });
  } catch (err) {
    console.error('重置筛选失败:', err);
    error.value = '重置筛选失败: ' + err.message;

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `重置失败: ${err.message || '未知错误'}`,
          position: 'top'
        });
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 预订房间
 * @param {number} roomId - 房间ID
 */
async function bookRoom(roomId) {
  try {
    // 获取要预订的房间信息
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      throw new Error('找不到房间信息');
    }

    // 确认是否预订房间
    if (!confirm(`确定预订房间 ${room.room_number} (${getRoomTypeName(room.type_code)}) 吗？将跳转到订单创建页面。`)) {
      return;
    }

    // 导航到创建订单页面，并传递房间信息
    router.push({
      path: '/CreateOrder',
      query: {
        roomId: roomId,
        roomType: room.type_code,
        roomNumber: room.room_number,
        status: 'pending' // 默认设置为"待入住"状态
      }
    });
  } catch (error) {
    console.error('预订房间操作失败:', error);

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `预订失败: ${error.message || '未知错误'}`,
          position: 'top'
        });
      } else {
        alert(`预订失败: ${error.message || '未知错误'}`);
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
      alert(`预订失败: ${error.message || '未知错误'}`);
    }
  }
}

/**
 * 办理退房
 * @param {number} roomId - 房间ID
 */
async function checkOut(roomId) {
  try {
    // 获取房间信息
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      throw new Error('找不到房间信息');
    }

    // 获取关联的订单信息
    if (!room.room_number) {
      throw new Error('房间号信息不完整');
    }

    const order = orderStore.getActiveOrderByRoomNumber(room.room_number);
    if (!order) {
      throw new Error('找不到该房间的入住订单');
    }

    // 确认是否办理退房
    if (!confirm(`确定为房间 ${room.room_number} 的客人 ${order.guestName || '未知'} 办理退房吗？退房后房间将自动设置为"清扫中"状态。`)) {
      return;
    }

    // 显示加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.show === 'function') {
        $q.loading.show({
          message: '正在处理退房...'
        });
      } else {
        console.log('$q.loading.show 不可用，使用备用方法');
      }
    } catch (loadingError) {
      console.warn('显示加载提示失败:', loadingError);
    }

    // 调用orderStore的方法更新订单状态
    try {
      await orderStore.updateOrderStatusViaApi(order.orderNumber, 'checked-out');
    } catch (orderError) {
      console.error('更新订单状态失败:', orderError);
      throw new Error('更新订单状态失败: ' + (orderError.message || '未知错误'));
    }

    // 调用API更新房间状态为清扫中
    try {
      const roomUpdateSuccess = await roomStore.checkOutRoom(roomId);

      if (!roomUpdateSuccess) {
        throw new Error('房间状态更新失败');
      }

    } catch (roomUpdateError) {
      console.error('更新房间状态失败:', roomUpdateError);
      // 这里不抛出错误，因为订单已经更新，房间状态更新失败不应影响整个流程
      // 但需要警告用户
      try {
        if ($q && $q.notify && typeof $q.notify === 'function') {
          $q.notify({
            type: 'warning',
            message: '订单已退房，但更新房间状态失败，请手动检查房间状态',
            position: 'top',
            timeout: 5000
          });
        }
      } catch (notifyError) {
        console.warn('显示警告提示失败:', notifyError);
      }
    }

    // 刷新房间列表
    try {
      console.log('刷新房间列表...');
      await roomStore.fetchAllRooms();
      console.log('房间列表已刷新');
    } catch (refreshError) {
      console.error('刷新房间列表失败:', refreshError);
    }

    // 显示成功提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'positive',
          message: '退房成功',
          position: 'top'
        });
      } else {
        alert('退房成功');
      }
    } catch (notifyError) {
      console.warn('显示成功提示失败:', notifyError);
      alert('退房成功');
    }

  } catch (error) {
    console.error('退房操作失败:', error);

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `退房失败: ${error.message || '未知错误'}`,
          position: 'top'
        });
      } else {
        alert(`退房失败: ${error.message || '未知错误'}`);
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
      alert(`退房失败: ${error.message || '未知错误'}`);
    }
  } finally {
    // 隐藏加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.hide === 'function') {
        $q.loading.hide();
      }
    } catch (hideError) {
      console.warn('隐藏加载提示失败:', hideError);
    }
  }
}

 /**
 * 设置房间为维修状态
 * @param {number} roomId - 房间ID
 */
async function setMaintenance(roomId) {
  console.log('设为维修:', roomId);
  try {
    // 获取房间信息
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      throw new Error('找不到房间信息');
    }

    // 检查房间当前状态
    const roomStatus = roomStore.getRoomDisplayStatus(room);

    // 确认是否将房间设为维修状态
    let confirmMessage = `确定将房间 ${room.room_number} 设置为维修状态吗？`;

    // 如果房间有预订或入住，需要特别提醒
    if (roomStatus === 'reserved') {
      const order = orderStore.getActiveOrderByRoomNumber(room.room_number);
      if (order) {
        confirmMessage = `房间 ${room.room_number} 目前有预订订单(${order.orderNumber})，将订单取消并设置房间为维修状态？`;
      }
    } else if (roomStatus === 'occupied') {
      const order = orderStore.getActiveOrderByRoomNumber(room.room_number);
      if (order) {
        confirmMessage = `房间 ${room.room_number} 目前有客人入住(${order.guestName})，将订单设为退房并设置房间为维修状态？`;
      }
    }

    if (!confirm(confirmMessage)) {
      return;
    }

    // 显示加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.show === 'function') {
        $q.loading.show({
          message: '正在处理...'
        });
      } else {
        console.log('$q.loading.show 不可用，使用备用方法');
      }
    } catch (loadingError) {
      console.warn('显示加载提示失败:', loadingError);
    }

    // 处理订单状态
    if (roomStatus === 'reserved' || roomStatus === 'occupied') {
      try {
        // 检查房间号是否存在
        if (!room.room_number) {
          console.warn('房间号不存在，无法处理相关订单');
        } else {
          const order = orderStore.getActiveOrderByRoomNumber(room.room_number);

          if (order) {
            console.log(`找到房间 ${room.room_number} 的活跃订单:`, order);

            let newStatus = 'cancelled';
            let updateData = {};

            if (roomStatus === 'occupied') {
              newStatus = 'checked-out';
              updateData = {};
            }

            // 更新订单状态
            console.log(`准备更新订单 ${order.orderNumber} 状态为 ${newStatus}`, updateData);
            await orderStore.updateOrderStatusViaApi(order.orderNumber, newStatus, updateData);
            console.log(`订单 ${order.orderNumber} 状态已更新为 ${newStatus}`);
          } else {
            console.log(`房间 ${room.room_number} 没有找到活跃订单`);
          }
        }
      } catch (orderError) {
        console.error('处理订单状态时出错:', orderError);
        // 继续执行，尽管订单处理失败，我们仍然尝试更新房间状态
      }
    }

    // 调用API更新房间状态为维修中
    try {
      console.log(`准备将房间 ${roomId} 状态更新为 repair`);
      const roomUpdateSuccess = await roomStore.setMaintenance(roomId);

      if (!roomUpdateSuccess) {
        throw new Error('房间状态更新失败');
      }

      console.log(`房间 ${roomId} 状态已更新为 repair`);
    } catch (roomUpdateError) {
      console.error('更新房间状态失败:', roomUpdateError);
      throw roomUpdateError; // 重新抛出错误以便外层catch捕获
    }

    // 刷新房间列表
    try {
      console.log('刷新房间列表...');
      await roomStore.fetchAllRooms();
      console.log('房间列表已刷新');
    } catch (refreshError) {
      console.error('刷新房间列表失败:', refreshError);
      // 继续执行，即使刷新失败也不影响主流程
    }

    // 显示成功提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'positive',
          message: '房间已设置为维修状态',
          position: 'top'
        });
      } else {
        alert('房间已设置为维修状态');
      }
    } catch (notifyError) {
      console.warn('显示成功提示失败:', notifyError);
      alert('房间已设置为维修状态');
    }

  } catch (error) {
    console.error('设置房间维修状态失败:', error);

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `操作失败: ${error.message || '未知错误'}`,
          position: 'top'
        });
      } else {
        alert(`操作失败: ${error.message || '未知错误'}`);
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
      alert(`操作失败: ${error.message || '未知错误'}`);
    }
  } finally {
    // 隐藏加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.hide === 'function') {
        $q.loading.hide();
      }
    } catch (hideError) {
      console.warn('隐藏加载提示失败:', hideError);
    }
  }
}

/**
 * 完成房间维修，将状态改为可用
 * @param {number} roomId - 房间ID
 */
async function clearMaintenance(roomId) {
  console.log('完成维修:', roomId);

  try {
    // 获取房间信息
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      throw new Error('找不到房间信息');
    }

    // 确认是否完成维修
    if (!confirm(`确定将房间 ${room.room_number} 的维修标记为已完成吗？房间将恢复为可用状态。`)) {
      return;
    }

    // 显示加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.show === 'function') {
        $q.loading.show({
          message: '正在处理...'
        });
      } else {
        console.log('$q.loading.show 不可用，使用备用方法');
      }
    } catch (loadingError) {
      console.warn('显示加载提示失败:', loadingError);
    }

    // 调用API更新房间状态为可用
    try {
      console.log(`准备将房间 ${roomId} 状态从维修恢复为可用`);
      const roomUpdateSuccess = await roomStore.clearMaintenance(roomId);

      if (!roomUpdateSuccess) {
        throw new Error('房间状态更新失败');
      }

      console.log(`房间 ${roomId} 状态已更新为可用`);
    } catch (roomUpdateError) {
      console.error('更新房间状态失败:', roomUpdateError);
      throw roomUpdateError;
    }

    // 刷新房间列表
    try {
      console.log('刷新房间列表...');
      await roomStore.fetchAllRooms();
      console.log('房间列表已刷新');
    } catch (refreshError) {
      console.error('刷新房间列表失败:', refreshError);
    }

    // 显示成功提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'positive',
          message: '房间维修已完成，状态已更新为可用',
          position: 'top'
        });
      } else {
        alert('房间维修已完成，状态已更新为可用');
      }
    } catch (notifyError) {
      console.warn('显示成功提示失败:', notifyError);
      alert('房间维修已完成，状态已更新为可用');
    }

  } catch (error) {
    console.error('完成房间维修失败:', error);

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `操作失败: ${error.message || '未知错误'}`,
          position: 'top'
        });
      } else {
        alert(`操作失败: ${error.message || '未知错误'}`);
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
      alert(`操作失败: ${error.message || '未知错误'}`);
    }
  } finally {
    // 隐藏加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.hide === 'function') {
        $q.loading.hide();
      }
    } catch (hideError) {
      console.warn('隐藏加载提示失败:', hideError);
    }
  }
}

/**
 * 完成房间清洁，将状态改为可用
 * @param {number} roomId - 房间ID
 */
async function clearCleaning(roomId) {
  try {
    // 获取房间信息
    const room = await roomStore.getRoomById(roomId);
    if (!room) {
      throw new Error('找不到房间信息');
    }

    // 确认是否完成清洁
    if (!confirm(`确定将房间 ${room.room_number} 的清洁工作标记为已完成吗？房间将恢复为可用状态。`)) {
      return;
    }

    // 调用API更新房间状态为可用
    try {
      console.log(`准备将房间 ${roomId} 状态从清洁中恢复为可用`);
      const roomUpdateSuccess = await roomStore.clearCleaning(roomId);

      if (!roomUpdateSuccess) {
        throw new Error('房间状态更新失败');
      }

      console.log(`房间 ${roomId} 状态已更新为可用`);
    } catch (roomUpdateError) {
      console.error('更新房间状态失败:', roomUpdateError);
      throw roomUpdateError;
    }

    // 刷新房间列表
    try {
      await roomStore.fetchAllRooms();
    } catch (refreshError) {
      console.error('刷新房间列表失败:', refreshError);
    }

    // 显示成功提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'positive',
          message: '房间清洁已完成，状态已更新为可用',
          position: 'top'
        });
      } else {
        alert('房间清洁已完成，状态已更新为可用');
      }
    } catch (notifyError) {
      console.warn('显示成功提示失败:', notifyError);
      alert('房间清洁已完成，状态已更新为可用');
    }

  } catch (error) {
    console.error('完成房间清洁失败:', error);

    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `操作失败: ${error.message || '未知错误'}`,
          position: 'top'
        });
      } else {
        alert(`操作失败: ${error.message || '未知错误'}`);
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError);
      alert(`操作失败: ${error.message || '未知错误'}`);
    }
  } finally {
    // 隐藏加载提示
    try {
      if ($q && $q.loading && typeof $q.loading.hide === 'function') {
        $q.loading.hide();
      }
    } catch (hideError) {
      console.warn('隐藏加载提示失败:', hideError);
    }
  }
}

/**
 * 清除日期范围
 */
function clearDateRange() {
  dateRange.value = null
}

/**
 * 组件挂载时的生命周期钩子
 */
onMounted(async () => {
  try {
    console.log('RoomStatus页面挂载，开始加载数据...')
    // 并行加载房间数据和房型数据
    const [roomsResult, roomTypesResult] = await Promise.allSettled([
      roomStore.fetchAllRooms(),
      roomStore.fetchRoomTypes()
    ])

    // 检查加载结果
    if (roomsResult.status === 'fulfilled') {
      console.log('房间数据加载成功，房间数量:', roomStore.rooms.length)
    } else {
      console.error('房间数据加载失败:', roomsResult.reason)
    }

    if (roomTypesResult.status === 'fulfilled') {
      console.log('房型数据加载成功，房型数量:', roomStore.roomTypes.length)
    } else {
      console.error('房型数据加载失败:', roomTypesResult.reason)
      // 房型数据加载失败时显示警告，但不影响页面使用
      try {
        if ($q && $q.notify && typeof $q.notify === 'function') {
          $q.notify({
            type: 'warning',
            message: '房型数据加载失败，将使用默认房型配置',
            position: 'top'
          })
        }
      } catch (notifyError) {
        console.warn('显示警告提示失败:', notifyError)
      }
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    // 显示错误提示
    try {
      if ($q && $q.notify && typeof $q.notify === 'function') {
        $q.notify({
          type: 'negative',
          message: `加载数据失败: ${error.message || '未知错误'}`,
          position: 'top'
        })
      }
    } catch (notifyError) {
      console.warn('显示错误提示失败:', notifyError)
    }
  }
})

// // 使用计算属性获取各种状态的房间数量
// const statusCounts = computed(() => roomStore.countByStatus)

// // 使用计算属性获取各种类型的可用房间数量
// const availableRoomsByType = computed(() => roomStore.availableByType)

// /**
//  * 获取特定状态的房间数量
//  * @param {string} status - 房间状态
//  * @returns {number} 该状态的房间数量
//  */
// function getStatusCount(status) {
//   return roomStore.filterRooms({ status }).length
// }

// /**
//  * 获取特定房型的空余房间数量
//  * @param {string} type - 房间类型
//  * @returns {number} 该类型的空余房间数量
//  */
// function getAvailableRoomCountByType(type) {
//   return roomStore.getAvailableRoomCountByType(type);
// }

/**
 * 获取房型的中文名称
 */
const getRoomTypeName = viewStore.getRoomTypeName

// /**
//  * 获取状态的中文文本
//  */
// const getStatusText = viewStore.getStatusText

// /**
//  * 获取状态的颜色
//  */
// const getStatusColor = viewStore.getStatusColor

// 房间类型和状态选项
const roomTypeOptions = viewStore.roomTypeOptions
const statusOptions = viewStore.statusOptions

// 获取数据库中的房型选项（基于实际的房型数据）
const availableRoomTypeOptions = computed(() => {
  // 从roomStore.roomTypes获取数据库中的房型数据
  const dbRoomTypes = roomStore.roomTypes || []
  console.log('数据库房型数据:', dbRoomTypes)

  if (dbRoomTypes.length > 0) {
    // 如果数据库房型数据已加载，使用数据库数据
    console.log('使用数据库房型数据创建房型卡片')
    const result = dbRoomTypes
      .filter(roomType => {
        // 检查该房型是否有房间存在
        const totalRoomCount = roomStore.rooms.filter(room => room.type_code === roomType.type_code).length
        console.log(`房型 ${roomType.type_code} (${roomType.type_name}) 有 ${totalRoomCount} 个房间`)
        return totalRoomCount > 0 // 只显示有房间的房型（不论是否可用）
      })
      .map(roomType => ({
        label: roomType.type_name || viewStore.getRoomTypeName(roomType.type_code),
        value: roomType.type_code,
        description: roomType.description || '',
        basePrice: roomType.base_price || 0  // 添加基础价格信息
      }))
      .sort((a, b) => a.label.localeCompare(b.label)) // 按名称排序
    console.log('最终房型卡片数据:', result)
    return result
  } else {
    // 如果数据库房型数据未加载，使用viewStore中的房型选项作为备用
    // 但只显示有房间的房型
    console.log('数据库房型数据未加载，使用备用房型选项')
    return roomTypeOptions.filter(option => {
      if (option.value === null) return false // 排除"所有房型"选项
      const totalRoomCount = roomStore.rooms.filter(room => room.type_code === option.value).length
      return totalRoomCount > 0
    })
  }
})

/**
 * 获取房型卡片的样式类
 * @param {string} roomType - 房型代码
 * @param {number} index - 卡片索引（用于颜色循环）
 * @returns {string} CSS类名
 */
function getRoomTypeCardClass(roomType, index) {
  // 定义颜色循环数组
  const colorClasses = [
    'bg-blue-1',      // 蓝色
    'bg-green-1',     // 绿色
    'bg-purple-1',    // 紫色
    'bg-orange-1',    // 橙色
    'bg-teal-1',      // 青色
    'bg-amber-1',     // 琥珀色
    'bg-pink-1',      // 粉色
    'bg-indigo-1',    // 靛蓝色
    'bg-cyan-1'       // 青蓝色
  ]

  // 根据索引循环选择颜色
  const colorIndex = index % colorClasses.length
  let baseClass = colorClasses[colorIndex]

  // 如果当前房型被选中，增加选中状态的样式
  if (isRoomTypeSelected(roomType)) {
    baseClass += ' room-type-selected'
  }

  return baseClass
}

/**
 * 检查房型是否被选中
 * @param {string} roomType - 房型代码
 * @returns {boolean} 是否被选中
 */
function isRoomTypeSelected(roomType) {
  // 检查URL参数中的type或组件状态中的filterType
  const urlType = route.query.type
  return urlType === roomType || filterType.value === roomType
}

/**
 * 设置房型筛选
 * 实现筛选切换功能：如果当前已经是选中房型，则清除筛选；否则应用新筛选
 * 同时更新URL参数，保持URL状态与组件状态同步
 * @param {string} type - 房间类型代码
 */
function setTypeFilter(type) {
  console.log('设置房型筛选:', type)

  // 如果当前已经是这个房型筛选，则清除筛选（切换行为）
  if (filterType.value === type) {
    // 清除组件状态
    filterType.value = null
    // 更新URL，移除type参数
    router.replace({
      path: route.path,
      query: { ...route.query, type: undefined }  // 保留其他查询参数
    })
  } else {
    // 否则设置为新的房型筛选
    filterType.value = type
    // 更新URL，添加type参数
    router.replace({
      path: route.path,
      query: { ...route.query, type: type }  // 保留其他查询参数，添加或更新type
    })
  }
}
</script>

<style scoped>
/* 设置页面最大宽度并居中 */
.room-status {
  /* max-width: 1400px; */
  max-width: 100;
  margin: 0 auto;
}

/* 日期范围选择器样式 */
.date-range-input {
  font-weight: 500;
}

.date-range-input :deep(.q-field__native) {
  color: #1976d2;
}

/* 房型统计卡片样式 */
.room-type-summary .q-card {
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 房型统计卡片悬停效果 */
.room-type-summary .q-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  background-color: rgba(0, 0, 0, 0.02);
}

/* 房型统计卡片选中状态 */
.room-type-summary .room-type-selected {
  border: 2px solid #1976d2 !important;
  box-shadow: 0 3px 10px rgba(25, 118, 210, 0.3) !important;
  transform: translateY(-2px);
}

/* 房型统计卡片选中状态悬停效果 */
.room-type-summary .room-type-selected:hover {
  border: 2px solid #1565c0 !important;
  box-shadow: 0 5px 15px rgba(25, 118, 210, 0.4) !important;
}

/* 房型统计卡片内容样式 */
.room-type-summary .q-card-section {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 房型名称样式 */
.room-type-summary .text-subtitle1 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

/* 房型空余数字样式 */
.room-type-summary .text-h6 {
  font-size: 1.2rem;
  margin: 0;
  color: #1976d2;
}

/* 状态统计卡片的悬停效果 */
.status-summary .q-card {
  transition: transform 0.3s, box-shadow 0.3s;  /* 添加过渡效果 */
  height: 100px;  /* 固定高度 */
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
}

/* 鼠标悬停时卡片上移效果 */
.status-summary .q-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

/* 房间卡片样式 */
.room-grid .q-card {
  height: 250px;  /* 固定高度 */
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  overflow: hidden;
}

/* 房间卡片悬停效果 */
.room-grid .q-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

/* 房间卡片头部样式 */
.room-header {
  position: relative;
  padding-bottom: 8px;
  padding-top: 8px;
}

/* 状态标签样式 */
.status-chip {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.8rem;
}

/* 房间卡片内容区域 */
.room-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: 12px;
  padding-bottom: 0;
}

/* 房间号样式 */
.room-grid .text-h5 {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0;
}

/* 分隔线样式 */
.room-grid .q-separator {
  margin: 0;
}

/* 按钮组样式 */
.room-grid .q-btn-group {
  width: 100%;
  justify-content: center;
}

/* 按钮样式 */
.room-grid .q-btn {
  font-size: 0.8rem;
}

/* 筛选器样式 */
.filters {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 状态统计卡片内容居中 */
.status-summary .q-card-section {
  padding: 8px;
  text-align: center;
}

/* 状态统计数字样式 */
.status-summary .text-h5 {
  font-weight: bold;
  margin-top: 4px;
  font-size: 1.8rem;
}
</style>
