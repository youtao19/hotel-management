<template>
  <div class="shift-handover-container">
    <!-- 支付表格组件 -->
    <ShiftHandoverPaymentTable 
      :read-only="readOnly"
      :payment-data="paymentData" 
    />
    
    <!-- 备忘录组件 -->
    <ShiftHandoverMemoList
      :read-only="readOnly"
      :task-list="taskList"
      :new-task-title="newTaskTitle"
      @update:new-task-title="$emit('update:newTaskTitle', $event)"
      @update-task-status="handleUpdateTaskStatus"
      @add-new-task="handleAddNewTask"
      @delete-task="handleDeleteTask"
      @edit-task="handleEditTask"
    />
    
    <!-- 特殊统计组件 -->
    <ShiftHandoverSpecialStats
      :read-only="readOnly"
      :total-rooms="totalRooms"
      :rest-rooms="restRooms"
      :vip-cards="vipCards"
      :cashier-name="cashierName"
      :notes="notes"
      :good-review="goodReview"
      @update:cashier-name="$emit('update:cashierName', $event)"
      @update:notes="$emit('update:notes', $event)"
      @update:total-rooms="$emit('update:totalRooms', $event)"
      @update:rest-rooms="$emit('update:restRooms', $event)"
      @update:vip-cards="$emit('update:vipCards', $event)"
      @update:good-review="$emit('update:goodReview', $event)"
    />
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import ShiftHandoverPaymentTable from './ShiftHandoverPaymentTable.vue'
import ShiftHandoverMemoList from './ShiftHandoverMemoList.vue'
import ShiftHandoverSpecialStats from './ShiftHandoverSpecialStats.vue'

// 定义属性
const props = defineProps({
  // 是否只读模式
  readOnly: {
    type: Boolean,
    default: false
  },
  // 支付数据
  paymentData: {
    type: Object,
    default: () => ({})
  },
  // 备忘录数据
  taskList: {
    type: Array,
    default: () => ([])
  },
  // 新任务标题
  newTaskTitle: {
    type: String,
    default: ''
  },
  // 开房数
  totalRooms: {
    type: Number,
    default: 0
  },
  // 休息房数
  restRooms: {
    type: Number,
    default: 0
  },
  // VIP卡数
  vipCards: {
    type: Number,
    default: 0
  },
  // 收银员姓名
  cashierName: {
    type: String,
    default: ''
  },
  // 备注
  notes: {
    type: String,
    default: ''
  },
  // 好评
  goodReview: {
    type: String,
    default: '邀1得1'
  }
})

// 定义事件
const emit = defineEmits([
  'update:paymentData',
  'update:taskList',
  'update:newTaskTitle',
  'update:totalRooms',
  'update:restRooms',
  'update:vipCards',
  'update:cashierName',
  'update:notes',
  'update:goodReview',
  'update-task-status',
  'add-new-task',
  'delete-task',
  'edit-task'
])

// 事件处理函数
function handleUpdateTaskStatus(taskId, completed) {
  emit('update-task-status', taskId, completed)
}

function handleAddNewTask() {
  emit('add-new-task')
}

function handleDeleteTask(index) {
  emit('delete-task', index)
}

function handleEditTask(index) {
  emit('edit-task', index)
}
</script>

<style scoped>
.shift-handover-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
</style>
