<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">房间信息</div>
    <div class="row q-col-gutter-md">
      <div class="col-md-4 col-xs-12">
        <q-select v-model="modelValue.roomType" :options="typeOptions" label="房间类型" filled emit-value map-options
          @update:model-value="val => $emit('update-type', val)" :rules="[val => !!val || '请选择房间类型']"
          :hint="modelValue.roomType ? `剩余 ${availableCount} 间可用` : ''">
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge :color="getRoomCountColor(scope.opt.availableCount)" :label="scope.opt.availableCount + '间'" />
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>

      <div class="col-md-4 col-xs-12">
        <q-select v-model="modelValue.roomNumber" :options="roomOptions" label="房间号" filled emit-value map-options
          :rules="[val => !!val || '请选择房间号']" :disable="!modelValue.roomType">
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
              <q-item-section side v-if="scope.opt.status === 'cleaning'">
                <q-chip size="sm" color="orange" text-color="white" icon="cleaning_services">清扫中</q-chip>
              </q-item-section>
            </q-item>
          </template>
          <template v-slot:no-option>
            <q-item>
              <q-item-section class="text-negative">
                <q-icon name="warning" color="negative" />
                当前没有可用的房间
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoomStore } from 'src/stores/roomStore'
const roomStore = useRoomStore()

defineProps({
  modelValue: { type: Object, required: true },
  typeOptions: Array,
  roomOptions: Array,
  availableCount: Number
})

defineEmits(['update-type'])

// 使用 store 中的辅助函数
const getRoomCountColor = roomStore.getRoomCountColor
</script>
