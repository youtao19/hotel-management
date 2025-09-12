<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card style="min-width: 400px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">更改订单信息</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="editableOrder">
        <q-form @submit.prevent="submitChange">
          <q-input v-model="editableOrder.guestName" label="客人姓名" dense class="q-mb-md" />
          <q-input v-model="editableOrder.phone" label="手机号" dense class="q-mb-md" />
          <q-input v-model="editableOrder.idNumber" label="身份证号" dense class="q-mb-md" />
          <q-select
            v-model="editableOrder.roomNumber"
            :options="roomOptions"
            label="房间号"
            dense
            emit-value
            map-options
            @update:model-value="handleRoomChange"
            class="q-mb-md"
          />
          <div class="q-mt-md">
            <div class="text-subtitle1">房费明细</div>
            <div v-if="isMultiDayOrder">
              <div v-for="(price, date) in editableOrder.roomPrice" :key="date" class="row q-col-gutter-sm q-mb-sm">
                <div class="col-6">
                  <q-input
                    :label="date"
                    v-model.number="editableOrder.roomPrice[date]"
                    type="number"
                    filled
                    dense
                  />
                </div>
                <div class="col-6 flex items-center">
                  <span class="text-grey-7">元/晚</span>
                </div>
              </div>
            </div>
            <div v-else>
              <q-input
                label="总房费"
                v-model.number="editableOrder.roomPrice[editableOrder.checkInDate]"
                type="number"
                filled
                dense
              />
            </div>
          </div>
          <q-input v-model.number="editableOrder.deposit" label="押金" type="number" dense class="q-mb-md" />
          <q-input
            v-model="editableOrder.checkInDate"
            label="入住日期"
            type="date"
            dense
            class="q-mb-md"
            stack-label
          />
          <q-input
            v-model="editableOrder.checkOutDate"
            label="离店日期"
            type="date"
            dense
            class="q-mb-md"
            stack-label
          />
          <q-input v-model="editableOrder.remarks" label="备注" type="textarea" dense autogrow />
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
  isMultiDayOrder: Boolean
});

const emit = defineEmits([
  'update:modelValue',
  'order-updated'
]);

const editableOrder = ref(null); // 可编辑的订单
const originalRoomNumber = ref(null);  // 原始房间号

// 监听订单变化
watch(() => props.order, (newOrder) => {
  if (newOrder) {
    const clonedOrder = JSON.parse(JSON.stringify(newOrder));

    // 确保 checkInDate 和 checkOutDate 是 YYYY-MM-DD 格式
    clonedOrder.checkInDate = clonedOrder.checkInDate ? clonedOrder.checkInDate.split('T')[0] : '';
    clonedOrder.checkOutDate = clonedOrder.checkOutDate ? clonedOrder.checkOutDate.split('T')[0] : '';

    // 统一：将 roomPrice 转为对象结构，键为入住/各日，值为价格
    if (typeof clonedOrder.roomPrice === 'number') {
      const price = Number(clonedOrder.roomPrice) || 0;
      clonedOrder.roomPrice = {};
      if (clonedOrder.checkInDate) {
        clonedOrder.roomPrice[clonedOrder.checkInDate] = price;
      }
    } else if (typeof clonedOrder.roomPrice !== 'object' || clonedOrder.roomPrice === null) {
      clonedOrder.roomPrice = {};
    }

    editableOrder.value = clonedOrder;
    originalRoomNumber.value = newOrder.roomNumber;
  } else {
    editableOrder.value = null;
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
  if (!editableOrder.value) return;
  const opt = roomOptions.value.find(o => o.value === newValue);
  if (opt) {
    // 选择新房间时，更新当前房间价格（仅影响当前选择的房间，不影响多日价格）
    // 如果是多日订单，这里不应该直接修改 roomPrice，而是让用户手动调整每日价格
    // 对于单日订单，可以更新 roomPrice
    if (!props.isMultiDayOrder && editableOrder.value.checkInDate) {
      editableOrder.value.roomPrice[editableOrder.value.checkInDate] = opt.price;
    }
  }
}

// 处理提交
function submitChange() {
  if (editableOrder.value) {
    const isRoomChanged = editableOrder.value.roomNumber !== originalRoomNumber.value;

    // 修复：始终以对象形式提交 roomPrice，保持 { 'YYYY-MM-DD': 价格 } 结构
    // 注意：props.isMultiDayOrder 是布尔值，不应访问 .value
    if (!props.isMultiDayOrder) {
      // 单日订单：确保以入住日期为唯一键的对象结构提交
      const inDate = editableOrder.value.checkInDate;
      const price = Number(editableOrder.value.roomPrice?.[inDate] || 0);
      editableOrder.value.roomPrice = inDate ? { [inDate]: price } : {};
    }

    emit('order-updated', { ...editableOrder.value, isRoomChanged });
    emit('update:modelValue', false); // 关闭对话框
  }
}
</script>
