<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">更改房间</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <div class="q-mb-md">
          <div class="text-subtitle2">当前房间:</div>
          <div class="text-bold">
            {{ currentOrder ? currentOrder.roomNumber + ' (' + getRoomTypeName(currentOrder.roomType) + ')' : '' }}
          </div>
        </div>

        <div class="row items-center">
          <div class="col">
            <q-select
              v-model="selectedRoom"
              :options="availableRoomOptions"
              label="选择新房间"
              filled
              emit-value
              map-options
            >
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
        <q-btn flat label="确认更改" color="positive" @click="emitChangeRoom" :disable="!selectedRoom" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
  availableRoomOptions: {
    type: Array,
    default: () => []
  },
  getRoomTypeName: {
    type: Function,
    default: () => () => ''
  },
  value: String // 选中的房间号（可选，便于父组件控制）
});

const emit = defineEmits(['update:modelValue', 'change-room']);

const selectedRoom = ref('');

watch(
  () => props.modelValue,
  (val) => {
    if (!val) selectedRoom.value = '';
  }
);

function emitChangeRoom() {
  emit('change-room', selectedRoom.value);
}
</script> 