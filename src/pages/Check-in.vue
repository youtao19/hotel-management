<template>
  <div class="check-in q-pa-md">
    <h1 class="text-h4 q-mb-md">办理入住</h1>
    
    <!-- 入住方式选择 -->
    <div class="check-in-type q-mb-lg">
      <q-tabs
        v-model="checkInType"
        class="text-primary"
        active-color="primary"
        indicator-color="primary"
        align="justify"
      >
        <q-tab name="reservation" label="预订入住" icon="event_available" />
        <q-tab name="walkIn" label="无预订入住" icon="person_add" />
      </q-tabs>
      
      <q-separator />
      
      <q-tab-panels v-model="checkInType" animated>
        <!-- 预订入住面板 -->
        <q-tab-panel name="reservation">
          <h2 class="text-h5 q-mb-md">查找预订</h2>
          <div class="search-form row q-col-gutter-md q-mb-md">
            <div class="col-md-8 col-xs-12">
              <q-input 
                v-model="searchQuery" 
                filled
                label="输入预订号、客人姓名或电话号码"
                clearable
                @clear="resetSearch"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </div>
            <div class="col-md-4 col-xs-12">
              <q-btn 
                color="primary" 
                icon="search" 
                label="搜索" 
                @click="searchReservation"
                class="full-width"
              />
            </div>
          </div>
          
          <!-- 预订列表 -->
          <q-card class="q-mb-md" v-if="!foundReservation">
            <q-card-section>
              <div class="text-h6">预订列表</div>
              <div class="text-subtitle2 q-mb-sm">共 {{ filteredReservations.length }} 条预订</div>
            </q-card-section>
            
            <q-separator />
            
            <q-card-section class="q-pa-none">
              <q-table
                :rows="filteredReservations"
                :columns="reservationColumns"
                row-key="id"
                :pagination="{ rowsPerPage: 5 }"
                :loading="loadingReservations"
                no-data-label="没有预订记录"
              >
                <template v-slot:loading>
                  <q-inner-loading showing color="primary" />
                </template>
                <template v-slot:body-cell-actions="props">
                  <q-td :props="props">
                    <q-btn
                      flat
                      round
                      dense
                      color="primary"
                      icon="check_circle"
                      @click="selectReservation(props.row)"
                    >
                      <q-tooltip>办理入住</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      round
                      dense
                      color="grey"
                      icon="info"
                      @click="viewReservationDetails(props.row)"
                    >
                      <q-tooltip>查看详情</q-tooltip>
                    </q-btn>
                  </q-td>
                </template>
              </q-table>
            </q-card-section>
          </q-card>
          
          <!-- 预订搜索结果 -->
          <q-card v-if="foundReservation" class="q-mt-md">
            <q-card-section>
              <div class="row justify-between items-center">
                <div class="text-h6">预订信息</div>
                <q-btn flat round icon="close" @click="foundReservation = null" />
              </div>
              <q-separator class="q-my-sm" />
              <div class="row q-col-gutter-md">
                <div class="col-md-6 col-xs-12">
                  <p><strong>预订号:</strong> {{ foundReservation.id }}</p>
                  <p><strong>客人姓名:</strong> {{ foundReservation.guestName }}</p>
                  <p><strong>联系电话:</strong> {{ foundReservation.phone }}</p>
                </div>
                <div class="col-md-6 col-xs-12">
                  <p><strong>房间类型:</strong> {{ foundReservation.roomType }}</p>
                  <p><strong>预订日期:</strong> {{ foundReservation.checkInDate }} 至 {{ foundReservation.checkOutDate }}</p>
                </div>
              </div>
            </q-card-section>
            <q-card-actions align="right">
              <q-btn color="primary" label="继续办理入住" @click="proceedToCheckIn" />
            </q-card-actions>
          </q-card>
        </q-tab-panel>
        
        <!-- 无预订入住面板 -->
        <q-tab-panel name="walkIn">
          <h2 class="text-h5 q-mb-md">无预订入住</h2>
          <q-form @submit="submitWalkInCheckIn" class="q-gutter-md">
            <!-- 客人信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">客人信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-input 
                    v-model="walkInData.guestName" 
                    label="姓名" 
                    filled 
                    :rules="[val => !!val || '请输入姓名']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <q-input 
                    v-model="walkInData.idNumber" 
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
                    v-model="walkInData.phone" 
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
                    v-model="walkInData.roomType"
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
                    v-model="walkInData.roomNumber"
                    :options="availableRoomOptions"
                    label="房间号"
                    filled
                    emit-value
                    map-options
                    :rules="[val => !!val || '请选择房间号']"
                    :disable="!walkInData.roomType"
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
                <div class="col-md-4 col-xs-12">
                  <q-select
                    v-model="walkInData.paymentMethod"
                    :options="[
                      {label: '现金支付', value: 'cash'},
                      {label: '微信支付', value: 'wechat'}
                    ]"
                    label="支付方式"
                    filled
                    :rules="[val => !!val || '请选择支付方式']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <q-input
                    v-model.number="walkInData.roomPrice"
                    label="房间金额"
                    filled
                    type="number"
                    prefix="¥"
                    :rules="[val => val > 0 || '房间金额必须大于0']"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <q-input
                    v-model.number="walkInData.deposit"
                    label="押金"
                    filled
                    type="number"
                    prefix="¥"
                    :rules="[val => val > 0 || '押金必须大于0']"
                  />
                </div>
              </div>
            </div>
            
            <!-- 入住信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">入住信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-12 col-xs-12">
                  <q-date
                    v-model="walkInData.dateRange"
                    range
                    filled
                    label="入住和离店日期"
                    today-btn
                    mask="YYYY-MM-DD"
                    color="primary"
                    :model-type="dateRangeModelType"
                    @update:model-value="onDateRangeChange"
                  >
                    <div class="row items-center justify-end q-gutter-sm">
                      <q-btn label="取消" color="primary" flat v-close-popup />
                      <q-btn label="确认" color="primary" flat v-close-popup />
                    </div>
                  </q-date>
                  <div class="text-caption q-mt-sm">
                    入住日期: {{ walkInData.checkInDate }} / 离店日期: {{ walkInData.checkOutDate }}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="row justify-end q-mt-md">
              <q-btn label="取消" flat class="q-mr-sm" />
              <q-btn label="确认入住" type="submit" color="primary" />
            </div>
          </q-form>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { date } from 'quasar'
import { useRoute } from 'vue-router'

// 获取当前路由
const route = useRoute()

// 入住类型选择（有预订/无预订）
const checkInType = ref('reservation')

// 预订搜索相关
const searchQuery = ref('')
const foundReservation = ref(null)
const loadingReservations = ref(false)

// 预订列表数据
const allReservations = ref([])
const filteredReservations = computed(() => {
  if (!searchQuery.value) {
    return allReservations.value
  }
  
  const query = searchQuery.value.toLowerCase()
  return allReservations.value.filter(reservation => 
    reservation.id.toLowerCase().includes(query) ||
    reservation.guestName.toLowerCase().includes(query) ||
    reservation.phone.includes(query)
  )
})

// 预订列表列定义
const reservationColumns = [
  { name: 'id', label: '预订号', field: 'id', align: 'left', sortable: true },
  { name: 'guestName', label: '客人姓名', field: 'guestName', align: 'left', sortable: true },
  { name: 'phone', label: '联系电话', field: 'phone', align: 'left' },
  { name: 'roomType', label: '房间类型', field: 'roomType', align: 'left', sortable: true },
  { name: 'checkInDate', label: '入住日期', field: 'checkInDate', align: 'left', sortable: true },
  { name: 'checkOutDate', label: '离店日期', field: 'checkOutDate', align: 'left', sortable: true },
  { name: 'status', label: '状态', field: 'status', align: 'left', 
    format: val => val === 'confirmed' ? '已确认' : val === 'pending' ? '待确认' : '已取消' 
  },
  { name: 'actions', label: '操作', field: 'actions', align: 'center' }
]

// 无预订入住表单数据
const walkInData = ref({
  guestName: '',
  idNumber: '',
  phone: '',
  roomType: null,
  roomNumber: null,
  dateRange: {
    from: date.formatDate(new Date(), 'YYYY-MM-DD'),
    to: date.formatDate(date.addToDate(new Date(), { days: 1 }), 'YYYY-MM-DD')
  },
  checkInDate: date.formatDate(new Date(), 'YYYY-MM-DD'),
  checkOutDate: date.formatDate(date.addToDate(new Date(), { days: 1 }), 'YYYY-MM-DD'),
  deposit: 100,
  paymentMethod: null,
  roomPrice: 0
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
  if (!walkInData.value.roomType) return []
  
  console.log('当前选择的房型:', walkInData.value.roomType)
  console.log('可用房间数据:', availableRooms.value)
  
  const filtered = availableRooms.value
    .filter(room => room.type === walkInData.value.roomType && room.status === 'available')
  
  console.log('过滤后的房间:', filtered)
  
  return filtered.map(room => ({
    label: `${room.number} (${room.type === 'standard' ? '标准间' : room.type === 'deluxe' ? '豪华间' : '套房'})`,
    value: room.number
  }))
})

// 当房型改变时，自动选择第一个可用房间
function onRoomTypeChange(value) {
  console.log('房型改变为:', value)
  walkInData.value.roomNumber = null
  
  // 强制计算属性更新
  nextTick(() => {
    console.log('nextTick中的可用房间选项:', availableRoomOptions.value)
    // 如果有可用房间，自动选择第一个
    if (availableRoomOptions.value.length > 0) {
      walkInData.value.roomNumber = availableRoomOptions.value[0].value
      console.log('已自动选择房间:', walkInData.value.roomNumber)
    }
  })
  
  // 根据房型设置房间金额
  switch(walkInData.value.roomType) {
    case 'standard':
      walkInData.value.roomPrice = 288;
      break;
    case 'deluxe':
      walkInData.value.roomPrice = 388;
      break;
    case 'suite':
      walkInData.value.roomPrice = 588;
      break;
    default:
      walkInData.value.roomPrice = 0;
  }
}

// 获取所有预订信息
function fetchAllReservations() {
  loadingReservations.value = true
  
  // 模拟API调用延迟
  setTimeout(() => {
    // 模拟预订数据
    allReservations.value = [
      {
        id: 'R20230001',
        guestName: '张三',
        phone: '13812345678',
        roomType: '标准间',
        checkInDate: '2023-06-10',
        checkOutDate: '2023-06-12',
        status: 'confirmed'
      },
      {
        id: 'R20230002',
        guestName: '李四',
        phone: '13987654321',
        roomType: '豪华间',
        checkInDate: '2023-06-15',
        checkOutDate: '2023-06-18',
        status: 'confirmed'
      },
      {
        id: 'R20230003',
        guestName: '王五',
        phone: '13711112222',
        roomType: '套房',
        checkInDate: '2023-06-20',
        checkOutDate: '2023-06-25',
        status: 'pending'
      },
      {
        id: 'R20230004',
        guestName: '赵六',
        phone: '13633334444',
        roomType: '标准间',
        checkInDate: '2023-06-22',
        checkOutDate: '2023-06-24',
        status: 'confirmed'
      },
      {
        id: 'R20230005',
        guestName: '吴友桃',
        phone: '19951339211',
        roomType: '豪华间',
        checkInDate: '2023-06-01',
        checkOutDate: '2023-06-03',
        status: 'confirmed'
      }
    ]
    
    loadingReservations.value = false
  }, 500)
}

// 选择预订
function selectReservation(reservation) {
  foundReservation.value = reservation
}

// 查看预订详情
function viewReservationDetails(reservation) {
  // 实现查看详情功能
  console.log('查看预订详情:', reservation)
}

// 重置搜索
function resetSearch() {
  foundReservation.value = null
  searchQuery.value = ''
}

// 搜索预订
function searchReservation() {
  // 如果搜索框为空，显示所有预订
  if (!searchQuery.value.trim()) {
    foundReservation.value = null
    return
  }
  
  // 模拟API调用
  console.log('搜索预订:', searchQuery.value)
  
  // 从预订列表中搜索
  const found = filteredReservations.value.find(reservation => 
    reservation.id.toLowerCase() === searchQuery.value.toLowerCase() ||
    reservation.phone === searchQuery.value ||
    reservation.guestName.toLowerCase() === searchQuery.value.toLowerCase()
  )
  
  if (found) {
    foundReservation.value = found
  } else {
    // 没有找到匹配的预订
    foundReservation.value = null
    // 这里可以添加提示信息
  }
}

// 继续办理预订入住
function proceedToCheckIn() {
  console.log('继续办理预订入住:', foundReservation.value)
  // 这里可以跳转到详细入住表单或直接处理入住
}

// 提交无预订入住
function submitWalkInCheckIn() {
  console.log('提交无预订入住:', walkInData.value)
  // 处理无预订入住逻辑
}

// 身份证号验证函数
function validateIdNumber() {
  // 移除非数字和X/x字符
  walkInData.value.idNumber = walkInData.value.idNumber.replace(/[^0-9X]/g, '');
  
  // 如果最后一位不是X/x，则确保只有数字
  if (walkInData.value.idNumber.length < 18) {
    walkInData.value.idNumber = walkInData.value.idNumber.replace(/[^0-9]/g, '');
  }
}

// 日期范围模型类型
const dateRangeModelType = 'object'

// 当日期范围改变时的处理函数
function onDateRangeChange(range) {
  if (range.from && range.to) {
    walkInData.value.checkInDate = range.from
    walkInData.value.checkOutDate = range.to
  }
}

// 监听路由参数变化
onMounted(() => {
  // 获取所有预订
  fetchAllReservations()
  
  // 检查是否有选项卡参数
  if (route.query.type === 'reservation') {
    checkInType.value = 'reservation'
    
    // 如果有房间ID，自动查询相关预订
    if (route.query.roomId) {
      // 模拟根据房间ID查询预订
      console.log('根据房间ID查询预订:', route.query.roomId)
      searchReservation()
    }
  } else if (route.query.type === 'walkIn') {
    checkInType.value = 'walkIn'
  }
})
</script>

<style scoped>
.check-in {
  max-width: 1200px;
  margin: 0 auto;
}
</style>