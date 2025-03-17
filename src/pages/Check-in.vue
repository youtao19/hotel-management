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
          
          <!-- 预订搜索结果 -->
          <q-card v-if="foundReservation" class="q-mt-md">
            <q-card-section>
              <div class="text-h6">预订信息</div>
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
                    :rules="[val => !!val || '请选择房间号']"
                    :disable="!walkInData.roomType"
                  />
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
              </div>
            </div>
            
            <!-- 入住信息 -->
            <div class="form-section q-mb-md">
              <div class="text-subtitle1 q-mb-sm">入住信息</div>
              <div class="row q-col-gutter-md">
                <div class="col-md-4 col-xs-12">
                  <q-date
                    v-model="walkInData.checkInDate"
                    filled
                    label="入住日期"
                    today-btn
                    mask="YYYY-MM-DD"
                  />
                </div>
                <div class="col-md-4 col-xs-12">
                  <q-date
                    v-model="walkInData.checkOutDate"
                    filled
                    label="预计离店日期"
                    today-btn
                    mask="YYYY-MM-DD"
                    :options="date => date >= walkInData.checkInDate"
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
import { ref, onMounted, computed } from 'vue'
import { date } from 'quasar'

// 入住类型选择（有预订/无预订）
const checkInType = ref('reservation')

// 预订搜索相关
const searchQuery = ref('')
const foundReservation = ref(null)

// 无预订入住表单数据
const walkInData = ref({
  guestName: '',
  idNumber: '',
  phone: '',
  roomType: null,
  roomNumber: null,
  checkInDate: date.formatDate(new Date(), 'YYYY-MM-DD'),
  checkOutDate: date.formatDate(date.addToDate(new Date(), { days: 1 }), 'YYYY-MM-DD'),
  deposit: 500,
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
  { id: 1, number: '101', type: 'standard', status: 'available' },
  { id: 2, number: '102', type: 'standard', status: 'available' },
  { id: 3, number: '201', type: 'deluxe', status: 'available' },
  { id: 4, number: '202', type: 'deluxe', status: 'available' },
  { id: 5, number: '301', type: 'suite', status: 'available' }
])

// 根据选择的房型过滤可用房间
const availableRoomOptions = computed(() => {
  if (!walkInData.value.roomType) return []
  
  return availableRooms.value
    .filter(room => room.type === walkInData.value.roomType && room.status === 'available')
    .map(room => ({
      label: `${room.number} (${room.type})`,
      value: room.number
    }))
})

// 当房型改变时，自动选择第一个可用房间
function onRoomTypeChange() {
  walkInData.value.roomNumber = null
  
  // 如果有可用房间，自动选择第一个
  if (availableRoomOptions.value.length > 0) {
    walkInData.value.roomNumber = availableRoomOptions.value[0].value
  }
  
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

// 搜索预订
function searchReservation() {
  // 模拟API调用
  console.log('搜索预订:', searchQuery.value)
  
  // 模拟找到预订
  foundReservation.value = {
    id: 'R20230001',
    guestName: '吴友桃',
    phone: '19951339211',
    roomType: '豪华间',
    checkInDate: '2023-06-01',
    checkOutDate: '2023-06-03'
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

// 组件挂载时初始化
onMounted(() => {
  // 可以在这里加载初始数据
})
</script>

<style scoped>
.check-in {
  max-width: 1200px;
  margin: 0 auto;
}
</style>