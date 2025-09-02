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
});

const emit = defineEmits([
  'update:modelValue',
  'order-updated'
]);

const editableOrder = ref(null);
const originalRoomNumber = ref(null);

// 监听订单变化
watch(() => props.order, (newOrder) => {
  if (newOrder) {
    const clonedOrder = JSON.parse(JSON.stringify(newOrder));

    // 确保 checkInDate 和 checkOutDate 是 YYYY-MM-DD 格式
    clonedOrder.checkInDate = clonedOrder.checkInDate ? clonedOrder.checkInDate.split('T')[0] : '';
    clonedOrder.checkOutDate = clonedOrder.checkOutDate ? clonedOrder.checkOutDate.split('T')[0] : '';

    // 如果 roomPrice 是数字，转换为对象格式以便统一处理
    if (typeof clonedOrder.roomPrice === 'number') {
      const price = clonedOrder.roomPrice;
      clonedOrder.roomPrice = {};
      // 对于单日订单，将价格赋给入住日期
      if (clonedOrder.checkInDate) {
        clonedOrder.roomPrice[clonedOrder.checkInDate] = price;
      }
    } else if (typeof clonedOrder.roomPrice !== 'object' || clonedOrder.roomPrice === null) {
      // 如果 roomPrice 既不是数字也不是对象，则初始化为空对象
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

// 判断是否为多日订单
const isMultiDayOrder = computed(() => {
  if (!editableOrder.value) return false;
  const checkIn = new Date(editableOrder.value.checkInDate);
  const checkOut = new Date(editableOrder.value.checkOutDate);
  // 比较日期部分，忽略时间
  return checkIn.toISOString().split('T')[0] !== checkOut.toISOString().split('T')[0];
});

// 处理房间选择变化
function handleRoomChange(newValue) {
  if (!editableOrder.value) return;
  const opt = roomOptions.value.find(o => o.value === newValue);
  if (opt) {
    // 选择新房间时，更新当前房间价格（仅影响当前选择的房间，不影响多日价格）
    // 如果是多日订单，这里不应该直接修改 roomPrice，而是让用户手动调整每日价格
    // 对于单日订单，可以更新 roomPrice
    if (!isMultiDayOrder.value && editableOrder.value.checkInDate) {
      editableOrder.value.roomPrice[editableOrder.value.checkInDate] = opt.price;
    }
  }
}

// 处理提交
function submitChange() {
  if (editableOrder.value) {
    const isRoomChanged = editableOrder.value.roomNumber !== originalRoomNumber.value;

    // 如果是单日订单，将 roomPrice 对象转换回数字
    if (!isMultiDayOrder.value) {
      const dates = Object.keys(editableOrder.value.roomPrice);
      if (dates.length === 1) {
        editableOrder.value.roomPrice = editableOrder.value.roomPrice[dates[0]];
      } else {
        // 如果单日订单的 roomPrice 对象有多个日期，这可能是个错误，或者需要更复杂的逻辑
        // 这里简单地取第一个日期的价格，或者根据业务逻辑处理
        editableOrder.value.roomPrice = dates.length > 0 ? editableOrder.value.roomPrice[dates[0]] : 0;
      }
    }

    emit('order-updated', { ...editableOrder.value, isRoomChanged });
    emit('update:modelValue', false);
  }
}
</script>
