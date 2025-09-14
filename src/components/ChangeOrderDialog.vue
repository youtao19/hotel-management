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
            <div v-if="Object.keys(editableOrder.roomPrice || {}).length > 0">
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
                <p class="text-grey-7 q-pa-sm">未找到房费记录，请手动添加或检查订单。</p>
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
            readonly
          />
          <q-input
            v-model="editableOrder.checkOutDate"
            label="离店日期"
            type="date"
            dense
            class="q-mb-md"
            stack-label
            readonly
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
import { useQuasar } from 'quasar';
import { billApi, orderApi } from '../api';

const $q = useQuasar();

// 通用日期格式化函数，避免时区问题
function formatDateFromDB(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const formattedDate = date.getFullYear() + '-' +
         String(date.getMonth() + 1).padStart(2, '0') + '-' +
         String(date.getDate()).padStart(2, '0');
  console.log(`🕐 日期转换: ${dateString} -> ${formattedDate} (UTC: ${date.toISOString()}, Local: ${date.toLocaleDateString()})`);
  return formattedDate;
}

const props = defineProps({
  modelValue: Boolean,
  order: Object,
  availableRooms: Array,
  getRoomTypeName: Function
});

const emit = defineEmits([
  'update:modelValue',
  'order-updated'
]);

const editableOrder = ref(null);
const originalRoomNumber = ref(null);
const loading = ref(false);
const billData = ref([]);

watch(() => props.order, async (newOrder) => {
  if (newOrder && newOrder.orderNumber) {
    const clonedOrder = JSON.parse(JSON.stringify(newOrder));

    clonedOrder.checkInDate = clonedOrder.checkInDate ? clonedOrder.checkInDate.split('T')[0] : '';
    clonedOrder.checkOutDate = clonedOrder.checkOutDate ? clonedOrder.checkOutDate.split('T')[0] : '';

    // Initialize roomPrice from order's total_price as a fallback
    const price = Number(clonedOrder.total_price) || 0;
    clonedOrder.roomPrice = {};
    if (clonedOrder.checkInDate) {
      clonedOrder.roomPrice[clonedOrder.checkInDate] = price;
    }

    editableOrder.value = clonedOrder;
    originalRoomNumber.value = newOrder.roomNumber;

    // Fetch bill details to overwrite the initial roomPrice
    try {
      const response = await billApi.getOrderBillDetails(newOrder.orderNumber);
      if (response.success && response.data.length > 0) {
        billData.value = response.data; // 存储账单数据
        const newRoomPrice = {};
        let totalDeposit = 0;
        response.data.forEach(bill => {
          // 使用通用日期格式化函数
          const stayDate = formatDateFromDB(bill.stay_date);
          if (stayDate) {
            newRoomPrice[stayDate] = Number(bill.room_fee) || 0;
            console.log(`📅 账单日期处理: ${bill.stay_date} -> ${stayDate}, 房费: ${bill.room_fee}`);
          }
          totalDeposit += Number(bill.deposit) || 0;
        });

        if (editableOrder.value) {
          editableOrder.value.roomPrice = newRoomPrice;
          editableOrder.value.deposit = totalDeposit;
        }
      } else {
        billData.value = []; // 没有账单数据
      }
    } catch (error) {
      console.error('获取账单详情错误:', error);
      billData.value = []; // 错误时清空账单数据
      $q.notify({ type: 'negative', message: '获取账单详情时发生错误' });
    }

  } else {
    editableOrder.value = null;
    originalRoomNumber.value = null;
    billData.value = [];
  }
}, { immediate: true, deep: true });

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

function handleRoomChange(newValue) {
  // When room changes, let user manually update the price.
  // No automatic price change to avoid unexpected behavior.
}

async function submitChange() {
  if (!editableOrder.value) return;

  loading.value = true;
  try {
    const isRoomChanged = editableOrder.value.roomNumber !== originalRoomNumber.value;

    // 计算总房费
    const totalPrice = Object.values(editableOrder.value.roomPrice || {}).reduce((sum, price) => sum + Number(price || 0), 0);

    // 准备订单更新数据
    const orderData = {
      guest_name: editableOrder.value.guestName,
      phone: editableOrder.value.phone,
      id_number: editableOrder.value.idNumber,
      room_number: editableOrder.value.roomNumber,
      remarks: editableOrder.value.remarks,
      deposit: editableOrder.value.deposit,
      total_price: totalPrice
    };

    // 准备账单更新数据
    const billUpdates = {};

    // 获取原始账单数据，用于比较变化
    const originalBillsByDate = {};
    billData.value.forEach(bill => {
      // 使用通用日期格式化函数
      const date = formatDateFromDB(bill.stay_date);
      if (date) {
        originalBillsByDate[date] = bill;
      }
    });

    // 检查每个日期的房费是否有变化
    Object.keys(editableOrder.value.roomPrice || {}).forEach(date => {
      const newRoomFee = parseFloat(editableOrder.value.roomPrice[date]) || 0;
      const originalBill = originalBillsByDate[date];

      if (originalBill) {
        const originalRoomFee = parseFloat(originalBill.room_fee) || 0;
        if (Math.abs(newRoomFee - originalRoomFee) > 0.01) { // 避免浮点数精度问题
          billUpdates[date] = { room_fee: newRoomFee };
          console.log(`📝 检测到${date}房费变化: ${originalRoomFee} -> ${newRoomFee}`);
        }
      } else {
        console.warn(`⚠️ 未找到日期 ${date} 的原始账单数据`);
      }
    });

    // 检查押金是否有变化
    const originalDepositBill = billData.value.find(bill => {
      const changeType = bill.change_type;
      const isOrderBill = changeType === '订单账单' || changeType === null || changeType === '';
      return isOrderBill && bill.deposit !== null && bill.deposit !== undefined && parseFloat(bill.deposit) > 0;
    });

    if (originalDepositBill) {
      const originalDeposit = parseFloat(originalDepositBill.deposit) || 0;
      const newDeposit = parseFloat(editableOrder.value.deposit) || 0;

      if (Math.abs(newDeposit - originalDeposit) > 0.01) {
        // 使用通用日期格式化函数
        const billDate = formatDateFromDB(originalDepositBill.stay_date);
        if (billDate) {
          if (!billUpdates[billDate]) {
            billUpdates[billDate] = {};
          }
          billUpdates[billDate].deposit = newDeposit;
          console.log(`📝 检测到押金变化: ${originalDeposit} -> ${newDeposit}`);
        }
      }
    }

    console.log('📤 发送联合更新请求:', {
      orderNumber: editableOrder.value.orderNumber,
      orderData,
      billUpdates,
      isRoomChanged
    });

    // 调用联合更新API
    const response = await orderApi.updateOrderWithBills(
      editableOrder.value.orderNumber,
      orderData,
      billUpdates,
      'user'
    );

    console.log('✅ 联合更新成功:', response);

    // 发出更新事件，通知父组件
    const updateEventData = {
      orderNumber: editableOrder.value.orderNumber,
      guestName: editableOrder.value.guestName,
      phone: editableOrder.value.phone,
      idNumber: editableOrder.value.idNumber,
      roomNumber: editableOrder.value.roomNumber,
      remarks: editableOrder.value.remarks,
      isRoomChanged,
      billsUpdated: Object.keys(billUpdates).length > 0
    };

    emit('order-updated', updateEventData);
    emit('update:modelValue', false);

  } catch (error) {
    console.error('💥 联合更新订单失败:', error);
    // 这里可以添加错误提示
  } finally {
    loading.value = false;
  }
}
</script>
