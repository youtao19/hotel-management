<template>
  <div class="task-management-container">
    <div class="task-management-header">
      <q-icon name="edit_note" size="24px" class="q-mr-sm" />
      <span class="text-h6 text-weight-bold">备忘录</span>
    </div>
    <div class="task-management-content">
      <div class="task-list-horizontal">
        <div v-for="(task, index) in taskList" :key="task.id" class="task-card" :class="{
          'task-completed': task.completed,
          'admin-memo': task.type === 'admin',
          'order-memo': task.type === 'order'
        }">
          <q-checkbox
            v-model="task.completed"
            class="task-checkbox"
            @click.prevent.stop="readOnly && $event && $event.preventDefault()"
            @update:model-value="updateTaskStatus(task.id, $event)"
          />
          <div class="task-content" @click="onEditTask(index)">
            <div class="task-title" :class="{ 'completed': task.completed }">
              <q-icon
                v-if="task.type === 'admin'"
                name="admin_panel_settings"
                size="16px"
                class="q-mr-xs text-orange-6"
                title="管理员备忘录"
              />
              <q-icon
                v-else-if="task.type === 'order'"
                name="room_service"
                size="16px"
                class="q-mr-xs text-blue-6"
                title="订单备注"
              />
              {{ task.title }}
            </div>
            <div class="task-time" v-if="task.time">
              <q-icon name="schedule" size="14px" class="q-mr-xs" />
              {{ task.time }}
            </div>
          </div>
          <q-btn v-if="!readOnly" flat round dense size="sm" icon="close" class="task-delete" @click="deleteTask(index)" />
        </div>
        <!-- 添加新任务卡片 -->
        <div class="add-task-card" v-if="!readOnly">
          <q-input v-model="localNewTaskTitle" placeholder="添加新备忘录..." dense borderless class="add-task-input" @keyup.enter="addNewTask">
            <template #prepend>
              <q-icon name="add" />
            </template>
            <template #append>
              <q-btn flat round dense size="sm" icon="add" color="primary" @click="addNewTask" :disable="!localNewTaskTitle.trim()" />
            </template>
          </q-input>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  taskList: { type: Array, required: true },
  newTaskTitle: { type: String, required: true },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:newTaskTitle',
  'update-task-status',
  'add-new-task',
  'delete-task',
  'edit-task'
])

const localNewTaskTitle = ref(props.newTaskTitle)

watch(() => props.newTaskTitle, v => { localNewTaskTitle.value = v })
watch(localNewTaskTitle, v => emit('update:newTaskTitle', v))

function updateTaskStatus(taskId, completed) {
  emit('update-task-status', taskId, completed)
}

function addNewTask() {
  emit('add-new-task')
}

function deleteTask(index) {
  if (!props.readOnly) emit('delete-task', index)
}

function onEditTask(index) {
  if (!props.readOnly) emit('edit-task', index)
}
</script>

<style scoped>
.task-management-container {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.task-management-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: #2c3e50;
  background-color: #e8f5e8;
  border-bottom: 2px solid #a5d6a7;
  padding: 12px;
  border-radius: 8px 8px 0 0;
}

.task-management-content {
  min-height: 100px;
}

.task-list-horizontal {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.task-card {
  display: flex;
  align-items: center;
  background: #f1f8e9;
  border: 1px solid #81c784;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
  position: relative;
}

.task-card:hover {
  background: #e8f5e8;
  border-color: #66bb6a;
  box-shadow: 0 2px 8px rgba(102, 187, 106, 0.2);
}

.task-card.task-completed {
  opacity: 0.7;
  background: #f5f5f5;
  border-color: #ccc;
}

.task-card.task-completed:hover {
  background: #eeeeee;
}

.task-checkbox {
  margin-right: 10px;
  align-self: flex-start;
  margin-top: 2px;
}

.task-content {
  flex: 1;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 4px;
  font-weight: 500;
  word-wrap: break-word;
}

.task-title.completed {
  text-decoration: line-through;
  color: #999;
}

.task-time {
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
}

.task-delete {
  opacity: 0;
  transition: opacity 0.2s;
  color: #f44336;
  margin-left: 8px;
  align-self: flex-start;
}

.task-card:hover .task-delete {
  opacity: 1;
}

/* 管理员备忘录样式 */
.admin-memo {
  background: #fff3e0 !important;
  border-color: #ff9800 !important;
}

.admin-memo:hover {
  background: #ffe0b2 !important;
  border-color: #f57c00 !important;
}

/* 订单备注样式 */
.order-memo {
  background: #e3f2fd !important;
  border-color: #2196f3 !important;
}

.order-memo:hover {
  background: #bbdefb !important;
  border-color: #1976d2 !important;
}

.add-task-card {
  display: flex;
  align-items: center;
  background: #f3f9f3;
  border: 2px dashed #a5d6a7;
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  max-width: 300px;
  transition: all 0.3s ease;
}

.add-task-card:hover {
  background: #e8f5e8;
  border-color: #81c784;
}

.add-task-input {
  font-size: 14px;
  width: 100%;
  text-align: center;
}

.add-task-input :deep(.q-field__control) {
  background: transparent;
}

.add-task-input :deep(.q-field__native) {
  text-align: center;
  color: #388e3c;
  font-weight: 500;
}

.add-task-input :deep(.q-field__native::placeholder) {
  color: #66bb6a;
  opacity: 0.8;
}
</style>
