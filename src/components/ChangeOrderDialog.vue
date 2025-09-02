<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card style="min-width: 400px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">更改订单信息</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="orderData">
        <q-form @submit.prevent="submitChange">
          <q-input v-model="orderData.guestName" label="客人姓名" dense class="q-mb-md" />
          <q-input v-model="orderData.phone" label="手机号" dense class="q-mb-md" />
          <q-input v-model="orderData.idNumber" label="身份证号" dense class="q-mb-md" />
          <q-select
            v-model="orderData.roomNumber"
            :options="roomOptions"
            label="房间号"
            dense
            emit-value
            map-options
            @update:model-value="handleRoomChange"
            class="q-mb-md"
          />
          <q-input v-model.number="displayRoomPrice" @update:model-value="updateDisplayRoomPrice" label="房间价格" type="number" dense class="q-mb-md" />
          <q-input v-model.number="orderData.deposit" label="押金" type="number" dense class="q-mb-md" />
          <q-input
            v-model="orderData.checkInDate"
            label="入住日期"
            type="date"
            dense
            class="q-mb-md"
            stack-label
          />
          <q-input
            v-model="orderData.checkOutDate"
            label="离店日期"
            type="date"
            dense
            class="q-mb-md"
            stack-label
          />
          <q-input v-model="orderData.remarks" label="备注" type="textarea" dense autogrow />
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" v-close-popup />
        <q-btn flat label="保存更改" color="primary" @click="submitChange" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  order: Object,
  availableRooms: Array,
  getRoomTypeName: Function,
});

const emit = defineEmits([
  'update:modelValue',
  'order-updated'
]);

const orderData = ref(null);
const originalRoomNumber = ref(null);

// 监听订单变化
watch(() => props.order, (newOrder) => {
  if (newOrder) {
    // 创建一个副本以避免直接修改 prop
    orderData.value = {
      ...newOrder,
      checkInDate: newOrder.checkInDate ? newOrder.checkInDate.split('T')[0] : '',
      checkOutDate: newOrder.checkOutDate ? newOrder.checkOutDate.split('T')[0] : ''
    };
    originalRoomNumber.value = newOrder.roomNumber;
  } else {
    orderData.value = null;
    originalRoomNumber.value = null;
  }
}, { immediate: true, deep: true });

// 监听房间变化
const roomOptions = computed(() => {
  if (!props.availableRooms) return [];
  return props.availableRooms.map(room => {
    const typeLabel = props.getRoomTypeName
      ? props.getRoomTypeName(room.type_code)
      : (room.type_code || '');
    return {
      label: `${room.room_number} (${typeLabel}) - ¥${room.price}`,
      value: room.room_number,
      price: Number(room.price) || 0
    };
  });
});

// 处理房间选择变化
function handleRoomChange(newValue) {
  if (!orderData.value) return;
  const opt = roomOptions.value.find(o => o.value === newValue);
  if (opt) {
    // 选择新房间时，联动更新展示价格
    displayRoomPrice.value = opt.price;
  }
}

// 展示/编辑用的房价：兼容 orders.room_price(jsonb 或 number)
const displayRoomPrice = computed({
  get() {
    const rp = orderData.value?.roomPrice;
    if (rp == null) return 0;
    if (typeof rp === 'number' || typeof rp === 'string') return Number(rp) || 0;
    if (typeof rp === 'object') {
      const keys = Object.keys(rp);
      if (keys.length === 0) return 0;
      // 优先用入住日期对应的价格
      const inDate = orderData.value?.checkInDate;
      if (inDate && rp[inDate] != null) return Number(rp[inDate]) || 0;
      // 否则取最早的一个键
      keys.sort();
      return Number(rp[keys[0]]) || 0;
    }
    return 0;
  },
  set(val) {
    if (!orderData.value) return;
    orderData.value.roomPrice = Number(val) || 0;
  }
});

// 处理房间选择变化
function updateDisplayRoomPrice(val) {
  displayRoomPrice.value = Number(val) || 0;
}

// 处理房间选择变化
function submitChange() {
  if (orderData.value) {
    const isRoomChanged = orderData.value.roomNumber !== originalRoomNumber.value;
    emit('order-updated', { ...orderData.value, isRoomChanged });
    emit('update:modelValue', false);
  }
}
</script>
