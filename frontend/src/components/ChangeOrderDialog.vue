<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card style="min-width: 500px; max-width: 650px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">修改订单信息</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="editableOrder">
        <q-form @submit.prevent="submitChange">
          <!-- 客人信息 -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">客人信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model="editableOrder.guestName"
                  label="客人姓名"
                  filled
                  dense
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model="editableOrder.phone"
                  label="手机号"
                  filled
                  dense
                  mask="###-####-####"
                  unmasked-value
                />
              </div>
            </div>
          </div>

          <!-- 房间信息 -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">房间信息</div>
            <q-select
              v-model="editableOrder.roomNumber"
              :options="roomOptions"
              label="房间号"
              filled
              dense
              emit-value
              map-options
              @update:model-value="handleRoomChange"
            />
          </div>

          <!-- 入住时间（只读） -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">入住时间</div>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model="editableOrder.checkInDate"
                  label="入住日期"
                  type="date"
                  filled
                  dense
                  readonly
                />
              </div>
              <div class="col-6">
                <q-input
                  v-model="editableOrder.checkOutDate"
                  label="离店日期"
                  type="date"
                  filled
                  dense
                  readonly
                />
              </div>
            </div>
          </div>

          <!-- 房费明细 -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">房费明细</div>
            <div v-if="Object.keys(editableOrder.roomPrice || {}).length > 0">
              <q-markup-table flat bordered dense>
                <tbody>
                  <tr v-for="(price, date) in editableOrder.roomPrice" :key="date">
                    <td class="text-caption" style="width:100px">{{ formatDay(date) }}</td>
                    <td>
                      <q-input
                        v-model.number="editableOrder.roomPrice[date]"
                        type="number"
                        filled
                        dense
                        prefix="¥"
                      />
                    </td>
                  </tr>
                </tbody>
              </q-markup-table>
              <!-- 总房费 -->
              <div class="q-mt-sm q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0;">
                <div class="row items-center">
                  <div class="col text-body2">房费总计</div>
                  <div class="col-auto text-subtitle1 text-primary">¥{{ totalRoomPrice }}</div>
                </div>
              </div>
            </div>
            <div v-else class="q-pa-sm" style="border: 1px solid #e0e0e0; border-radius: 4px;">
              <p class="text-grey-7 q-ma-none">未找到房费记录</p>
            </div>
          </div>

          <!-- 押金和支付方式 -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">支付信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-6">
                <q-input
                  v-model.number="editableOrder.deposit"
                  label="押金"
                  type="number"
                  filled
                  dense
                  prefix="¥"
                />
              </div>
              <div class="col-6">
                <q-select
                  v-model="editableOrder.paymentMethod"
                  :options="paymentMethodOptions"
                  label="支付方式"
                  filled
                  dense
                  emit-value
                  map-options
                />
              </div>
            </div>
          </div>

          <!-- 备注 -->
          <div class="q-mb-md">
            <q-input
              v-model="editableOrder.remarks"
              label="备注(可选)"
              type="textarea"
              filled
              dense
              rows="2"
              autogrow
            />
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" v-close-popup :disable="loading" />
        <q-btn
          label="保存更改"
          color="primary"
          @click="submitChange"
          :loading="loading"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useQuasar } from 'quasar';
import { billApi, orderApi } from '../api';
import { useViewStore } from '../stores/viewStore';
import Decimal from 'decimal.js';

const $q = useQuasar();
const viewStore = useViewStore();
const toDecimal = (val) => {
  try { return new Decimal(val || 0); } catch { return new Decimal(0); }
};
const toAmountNumber = (val) => Number(toDecimal(val).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());

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

// 支付方式选项
const paymentMethodOptions = computed(() => viewStore.paymentMethodOptions);

// 计算总房费
const totalRoomPrice = computed(() => {
  if (!editableOrder.value || !editableOrder.value.roomPrice) return 0;
  const sum = Object.values(editableOrder.value.roomPrice).reduce((acc, price) => acc.plus(toDecimal(price)), new Decimal(0));
  return toAmountNumber(sum);
});

// 格式化日期显示
function formatDay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return dateStr;
  }
}

function getStayDates(checkIn, checkOut) {
  if (!checkIn) return [];

  const format = (dateObj) => {
    return (
      dateObj.getFullYear() + '-' +
      String(dateObj.getMonth() + 1).padStart(2, '0') + '-' +
      String(dateObj.getDate()).padStart(2, '0')
    );
  };

  const start = new Date(`${checkIn}T00:00:00`);
  const end = checkOut ? new Date(`${checkOut}T00:00:00`) : null;

  if (Number.isNaN(start.getTime())) return [];

  if (!end || Number.isNaN(end.getTime()) || end <= start) {
    return [format(start)];
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(format(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

watch(() => props.order, async (newOrder) => {
  if (newOrder && newOrder.orderNumber) {
    console.log('🔍 原始订单数据:', newOrder);
    const clonedOrder = JSON.parse(JSON.stringify(newOrder));

    clonedOrder.checkInDate = clonedOrder.checkInDate ? clonedOrder.checkInDate.split('T')[0] : '';
    clonedOrder.checkOutDate = clonedOrder.checkOutDate ? clonedOrder.checkOutDate.split('T')[0] : '';

    // Initialize roomPrice from order's roomPrice field (from orderStore)
    // 注意：orderStore 将 API 的 total_price 映射为 roomPrice
    const price = toDecimal(clonedOrder.roomPrice)
                  .plus(toDecimal(clonedOrder.total_price))
                  .toNumber();
    console.log('💰 订单总房价:', price);
    console.log('📅 入住日期:', clonedOrder.checkInDate, '离店日期:', clonedOrder.checkOutDate);

    clonedOrder.roomPrice = {};
    const stayDates = getStayDates(clonedOrder.checkInDate, clonedOrder.checkOutDate);
    console.log('📆 住宿日期列表:', stayDates);

    if (stayDates.length > 0) {
      const nights = stayDates.length;
      const priceDec = toDecimal(price);
      const average = nights > 0 ? priceDec.div(nights) : priceDec;
      let cumulated = new Decimal(0);

      stayDates.forEach((date, index) => {
        const baseValue = index === nights - 1
          ? priceDec.minus(cumulated)
          : average;
        const normalized = toAmountNumber(baseValue);
        clonedOrder.roomPrice[date] = normalized;
        cumulated = cumulated.plus(normalized);
      });
      console.log('📊 初始房费分配:', clonedOrder.roomPrice);
    } else {
      console.warn('⚠️ 没有住宿日期！');
    }

    // 初始化支付方式
    clonedOrder.paymentMethod = clonedOrder.paymentMethod || viewStore.paymentMethodOptions[0]?.value || '';

    editableOrder.value = clonedOrder;
    originalRoomNumber.value = newOrder.roomNumber;

    // Fetch bill details to overwrite the initial roomPrice
    try {
      const response = await billApi.getOrderBillDetails(newOrder.orderNumber);
      if (response.success && response.data.length > 0) {
        billData.value = response.data; // 存储账单数据
        const newRoomPrice = {};
        let totalDeposit = new Decimal(0);
        let hasValidRoomFee = false; // 标记是否有有效的房费数据

        response.data.forEach(bill => {
          // 使用通用日期格式化函数
          const stayDate = formatDateFromDB(bill.stay_date);
          if (stayDate) {
            const roomFee = toDecimal(bill.room_fee);
            newRoomPrice[stayDate] = toAmountNumber(roomFee);
            if (roomFee.gt(0)) {
              hasValidRoomFee = true; // 有非零房费
            }
            console.log(`📅 账单日期处理: ${bill.stay_date} -> ${stayDate}, 房费: ${bill.room_fee}`);
          }
          totalDeposit = totalDeposit.plus(toDecimal(bill.deposit));
        });

        if (editableOrder.value) {
          // 只有当账单中有有效的房费数据时，才用账单数据覆盖
          // 否则保留从订单总房价计算的平均值（适用于待入住订单）
          if (hasValidRoomFee && Object.keys(newRoomPrice).length > 0) {
            editableOrder.value.roomPrice = newRoomPrice;
            console.log('✅ 使用账单中的房费数据');
          } else {
            console.log('ℹ️ 账单中无有效房费，保留订单总房价的平均分配');
          }

          // 押金总是使用账单中的数据
          if (totalDeposit.gt(0)) {
            editableOrder.value.deposit = toAmountNumber(totalDeposit);
          }
        }
      } else {
        billData.value = []; // 没有账单数据
        console.log('ℹ️ 无账单数据，使用订单总房价的平均分配');
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
    const totalPrice = toAmountNumber(Object.values(editableOrder.value.roomPrice || {}).reduce((sum, price) => sum.plus(toDecimal(price || 0)), new Decimal(0)));

    // 准备订单更新数据
    const orderData = {
      guest_name: editableOrder.value.guestName,
      phone: editableOrder.value.phone,
      id_number: editableOrder.value.idNumber,
      room_number: editableOrder.value.roomNumber,
      remarks: editableOrder.value.remarks,
      deposit: toAmountNumber(editableOrder.value.deposit),
      total_price: totalPrice,
      payment_method: editableOrder.value.paymentMethod
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
      const newRoomFee = toDecimal(editableOrder.value.roomPrice[date]);
      const originalBill = originalBillsByDate[date];

      if (originalBill) {
        const originalRoomFee = toDecimal(originalBill.room_fee);
        if (!newRoomFee.equals(originalRoomFee)) { // 避免浮点数精度问题
          billUpdates[date] = { room_fee: toAmountNumber(newRoomFee) };
          console.log(`📝 检测到${date}房费变化: ${originalRoomFee.toString()} -> ${newRoomFee.toString()}`);
        }
      } else {
        console.warn(`⚠️ 未找到日期 ${date} 的原始账单数据`);
      }
    });

    // 检查押金是否有变化
    const originalDepositBill = billData.value.find(bill => {
      const changeType = bill.change_type;
      const isOrderBill = changeType === '订单账单' || changeType === null || changeType === '';
      return isOrderBill && bill.deposit !== null && bill.deposit !== undefined && toDecimal(bill.deposit).gt(0);
    });

    if (originalDepositBill) {
      const originalDeposit = toDecimal(originalDepositBill.deposit);
      const newDeposit = toDecimal(editableOrder.value.deposit);

      if (!newDeposit.equals(originalDeposit)) {
        // 使用通用日期格式化函数
        const billDate = formatDateFromDB(originalDepositBill.stay_date);
        if (billDate) {
          if (!billUpdates[billDate]) {
            billUpdates[billDate] = {};
          }
          billUpdates[billDate].deposit = toAmountNumber(newDeposit);
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

<style scoped>
.rounded-borders {
  border-radius: 4px;
}

.q-markup-table {
  background: transparent;
}

.q-markup-table td {
  padding: 8px;
}
</style>
