<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card v-if="currentOrder" class="bill-card">
      <q-card-section>
        <div class="text-h5 text-center q-mb-lg">账单</div>
        <q-markup-table flat bordered class="bill-table q-mb-lg">
          <tbody>
            <tr>
              <td class="bill-label">订单号</td>
              <td class="bill-value">{{ currentOrder.orderNumber }}</td>
            </tr>
            <tr>
              <td class="bill-label">客人姓名</td>
              <td class="bill-value">{{ currentOrder.guestName }}</td>
            </tr>
            <tr>
              <td class="bill-label">房间号</td>
              <td class="bill-value">{{ currentOrder.roomNumber }}</td>
            </tr>
            <tr>
              <td class="bill-label">押金</td>
              <td>
                <q-input v-model="billData.deposit" type="number" dense outlined class="bill-input"
                  style="max-width: 120px;" />
              </td>
            </tr>
            <tr v-if="!isMultiDayOrder">
              <td class="bill-label">房费</td>
              <td>
                <q-input v-model="safeRoomFeeValue" type="number" dense outlined class="bill-input"
                  style="max-width: 120px;" @update:model-value="updateRoomFee" />
                <div class="text-caption text-blue-8 q-mt-xs">
                  单日房费
                </div>
              </td>
            </tr>
            <!-- 多日订单的每日房费编辑 -->
            <tr v-if="isMultiDayOrder">
              <td class="bill-label">每日房费</td>
              <td>
                <div class="text-subtitle2 text-orange-8 q-mb-sm">
                  多日订单 ({{ roomPriceDetails?.totalDays || 0 }}天) - 可编辑每日价格
                </div>
                <div v-for="(price, date) in editableDailyPrices" :key="date" class="row items-center q-mb-xs">
                  <div class="col-4 text-body2">
                    {{ formatDisplayDate(date) }}日:
                  </div>
                  <div class="col-6">
                    <q-input
                      v-model.number="editableDailyPrices[date]"
                      type="number"
                      dense
                      outlined
                      class="bill-input"
                      style="max-width: 100px;"
                      @update:model-value="updateDailyPrice(date, $event)"
                    />
                  </div>
                  <div class="col-2 text-caption text-grey-6">
                    元
                  </div>
                </div>
                <div class="text-body2 text-weight-bold text-orange-8 q-mt-sm">
                  总房费: ¥{{ totalRoomFee }}
                </div>
              </td>
            </tr>
            <tr>
              <td class="bill-label">支付方式</td>
              <td>
                <q-select
                  v-model="selectedPaymentMethod"
                  :options="paymentMethodOptions"
                  dense
                  outlined
                  emit-value
                  map-options
                  class="bill-input"
                  style="max-width: 150px;"
                />
              </td>
            </tr>
            <tr>
              <td class="bill-label bill-total-label">总金额</td>
              <td class="bill-total-value">
                <span class="text-deep-orange-6">{{ totalAmount.toFixed(2) }}</span> 元
              </td>
            </tr>
          </tbody>
        </q-markup-table>
        <div class="row justify-center q-gutter-xl q-mt-lg">
          <q-btn label="确认" color="primary" unelevated rounded size="lg" class="bill-btn" @click="createBill" />
          <q-btn label="取消" color="negative" unelevated rounded size="lg" class="bill-btn" v-close-popup />
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import useBillStore from '../stores/billStore'
import { useQuasar } from 'quasar'
import { useViewStore } from '../stores/viewStore'

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
})
const emit = defineEmits(['update:modelValue', 'bill-created'])

const billStore = useBillStore()
const viewStore = useViewStore()
const $q = useQuasar()

// 从 pinia store 获取支付方式选项
const paymentMethodOptions = viewStore.paymentMethodOptions

// 支付方式选择
const selectedPaymentMethod = ref(props.currentOrder?.paymentMethod || 'cash')

// 计算房费显示值
function calculateRoomFeeDisplay(roomPrice) {
  if (!roomPrice) {
    return 0;
  }

  // 如果是数字，直接返回
  if (typeof roomPrice === 'number') {
    return Number(roomPrice);
  }

  // 如果是字符串，尝试转换为数字
  if (typeof roomPrice === 'string') {
    const numericPrice = parseFloat(roomPrice);
    if (!isNaN(numericPrice)) {
      return numericPrice;
    }
  }

  // 如果是对象（JSONB格式），计算总价格
  if (typeof roomPrice === 'object' && roomPrice !== null) {
    const prices = Object.values(roomPrice);

    if (prices.length === 0) {
      return 0;
    }

    if (prices.length === 1) {
      // 单日价格，返回唯一值
      const singlePrice = parseFloat(prices[0]) || 0;
      console.log('📅 单日房费计算：', singlePrice);
      return singlePrice;
    } else {
      // 多日价格，返回总和
      const totalPrice = prices.reduce((sum, price) => sum + (parseFloat(price) || 0), 0);
      console.log('🗓️ 多日房费计算（总计）：', totalPrice);
      return totalPrice;
    }
  }

  return 0;
}

// 初始化可编辑的每日价格数据
function initializeEditablePrices() {
  const roomPriceData = props.currentOrder?.roomPrice || props.currentOrder?.room_price;
  if (roomPriceData && typeof roomPriceData === 'object') {
    // 深拷贝价格数据，避免直接修改 props
    return { ...roomPriceData };
  }
  return {};
}

const editableDailyPrices = ref(initializeEditablePrices());

// 初始化账单数据
const initialRoomPriceData = props.currentOrder?.roomPrice || props.currentOrder?.room_price;
const initialRoomFee = calculateRoomFeeDisplay(initialRoomPriceData);
const safeInitialRoomFee = typeof initialRoomFee === 'number' ? initialRoomFee : parseFloat(initialRoomFee) || 0;

const billData = ref({
  order_id: props.currentOrder?.orderNumber || '', // orderNumber 对应数据库的 order_id
  room_number: props.currentOrder?.roomNumber || '',
  guest_name: props.currentOrder?.guestName || '',
  deposit: props.currentOrder?.deposit || 0,
  refund_deposit: 'no', // 固定为不退押金，因为已经收取了房费+押金
  room_fee: safeInitialRoomFee,
  total_income: 0,
  pay_way: { value: selectedPaymentMethod.value }, // 后端期望的格式
  remarks: props.currentOrder?.remarks || ''
})

console.log('💰 账单房费初始化：', safeInitialRoomFee, typeof safeInitialRoomFee);

// 监听订单变化，更新账单数据和可编辑价格
watch(() => props.currentOrder, (newOrder) => {
  if (newOrder) {
    // 更新可编辑的每日价格
    const roomPriceData = newOrder.roomPrice || newOrder.room_price;
    if (roomPriceData && typeof roomPriceData === 'object') {
      editableDailyPrices.value = { ...roomPriceData };
    }

    const newRoomFee = calculateRoomFeeDisplay(roomPriceData);
    // 确保房费是数字类型
    const safeRoomFee = typeof newRoomFee === 'number' ? newRoomFee : parseFloat(newRoomFee) || 0;

    // 使用 nextTick 确保更新在下一个 tick 中执行
    nextTick(() => {
      billData.value.order_id = newOrder.orderNumber || '';
      billData.value.room_number = newOrder.roomNumber || '';
      billData.value.guest_name = newOrder.guestName || '';
      billData.value.deposit = newOrder.deposit || 0;
      billData.value.room_fee = safeRoomFee;
      billData.value.remarks = newOrder.remarks || '';

      console.log('💰 账单房费已同步：', billData.value.room_fee, typeof billData.value.room_fee);
    });

    // 同步支付方式
    if (newOrder.paymentMethod) {
      selectedPaymentMethod.value = newOrder.paymentMethod;
    }
  }
}, { deep: true, immediate: true });

// 计算多日订单的总房费
const totalRoomFee = computed(() => {
  if (!isMultiDayOrder.value) {
    return billData.value.room_fee || 0;
  }

  const prices = Object.values(editableDailyPrices.value);
  return prices.reduce((sum, price) => sum + (parseFloat(price) || 0), 0);
});

// 更新单日价格
function updateDailyPrice(date, newPrice) {
  const numericPrice = parseFloat(newPrice) || 0;
  editableDailyPrices.value[date] = numericPrice;
  console.log(`📅 更新 ${date} 价格为：`, numericPrice);

  // 更新总房费到 billData 中（用于总金额计算）
  billData.value.room_fee = totalRoomFee.value;
}

// 判断是否为多日订单
const isMultiDayOrder = computed(() => {
  const roomPriceData = props.currentOrder?.roomPrice || props.currentOrder?.room_price;
  if (!roomPriceData) return false;

  if (typeof roomPriceData === 'object') {
    const priceDates = Object.keys(roomPriceData);
    return priceDates.length > 1;
  }

  return false;
});

// 房间价格详情（用于显示多日订单的每日价格）
const roomPriceDetails = computed(() => {
  const roomPriceData = props.currentOrder?.roomPrice || props.currentOrder?.room_price;
  if (!roomPriceData || typeof roomPriceData !== 'object') {
    return null;
  }

  const dailyPrices = roomPriceData;
  const totalDays = Object.keys(dailyPrices).length;

  return {
    dailyPrices,
    totalDays
  };
});

// 格式化显示日期
function formatDisplayDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}-${date.getDate()}`;
  } catch (error) {
    return dateStr;
  }
}

// 安全的房费值（确保是数字类型）
const safeRoomFeeValue = computed({
  get() {
    const value = billData.value.room_fee;

    // 如果是数字，直接返回
    if (typeof value === 'number') {
      return value;
    }

    // 如果是字符串，尝试转换
    if (typeof value === 'string') {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        return numericValue;
      }
    }

    // 如果是对象（JSONB格式），重新计算
    if (typeof value === 'object' && value !== null) {
      console.log('⚠️ 计算属性中发现对象格式房费，重新计算：', value);
      const roomPriceData = props.currentOrder?.roomPrice || props.currentOrder?.room_price;
      const calculatedFee = calculateRoomFeeDisplay(roomPriceData);
      console.log('🔄 重新计算的房费：', calculatedFee);

      // 异步更新 billData，避免在计算属性中直接修改
      nextTick(() => {
        billData.value.room_fee = calculatedFee;
      });

      return calculatedFee;
    }

    console.warn('🚨 房费值类型异常，返回0：', value, typeof value);
    return 0;
  },
  set(newValue) {
    const numericValue = parseFloat(newValue) || 0;
    billData.value.room_fee = numericValue;
    console.log('✅ 手动设置房费：', numericValue);
  }
});

// 更新房费值的方法
function updateRoomFee(newValue) {
  const numericValue = parseFloat(newValue) || 0;
  billData.value.room_fee = numericValue;
}

async function createBill() {
  try {
    console.log('当前订单数据:', props.currentOrder)

    // 验证必要字段
    if (!props.currentOrder?.orderNumber) {
      throw new Error('订单号不能为空')
    }
    if (!props.currentOrder?.roomNumber) {
      throw new Error('房间号不能为空')
    }
    if (!props.currentOrder?.guestName) {
      throw new Error('客人姓名不能为空')
    }
    if (!selectedPaymentMethod.value) {
      throw new Error('支付方式不能为空')
    }

    if (isMultiDayOrder.value) {
      // 多日订单：创建多个账单
      await createMultiDayBills();
    } else {
      // 单日订单：创建单个账单
      await createSingleDayBill();
    }
  } catch (error) {
    console.error('创建账单失败:', error);
    $q.notify({
      type: 'negative',
      message: error.message || '账单创建失败',
      position: 'top'
    });
  }
}

// 创建单日账单
async function createSingleDayBill() {
  // 计算总金额（房费 + 押金）
  const roomFee = parseFloat(billData.value.room_fee) || 0
  const deposit = parseFloat(billData.value.deposit) || 0
  const calculatedTotalAmount = roomFee + deposit

  // 构建账单数据，确保格式符合后端要求
  const billDataToSend = {
    order_id: props.currentOrder.orderNumber, // 使用订单号作为 order_id
    room_number: props.currentOrder.roomNumber,
    guest_name: props.currentOrder.guestName,
    deposit: deposit, // 使用输入框中的押金值
    refund_deposit: 'no', // 固定为不退押金
    room_fee: roomFee, // 使用输入框中的房费值
    total_income: calculatedTotalAmount,
    pay_way: { value: selectedPaymentMethod.value }, // 后端期望的格式
    remarks: billData.value.remarks || ''
  }

  console.log("准备发送的单日账单数据：", billDataToSend)

  // 验证数据完整性
  if (!billDataToSend.order_id || !billDataToSend.room_number || !billDataToSend.guest_name) {
    throw new Error('关键信息缺失，无法创建账单')
  }

  await billStore.addBill(billDataToSend)

  // 显示成功提示
  $q.notify({
    type: 'positive',
    message: '账单创建成功',
    position: 'top'
  });

  // 触发账单创建完成事件
  emit('bill-created');
}

// 创建多日账单
async function createMultiDayBills() {
  const priceDates = Object.keys(editableDailyPrices.value).sort();
  const totalBills = priceDates.length;

  if (totalBills === 0) {
    throw new Error('没有找到有效的价格数据');
  }

  // 显示进度通知
  let progressNotify = $q.notify({
    type: 'ongoing',
    message: `正在创建多日账单：第1/${totalBills}个...`,
    position: 'top',
    timeout: 0,
    spinner: true
  });

  const createdBills = [];
  const deposit = parseFloat(billData.value.deposit) || 0;

  try {
    for (let i = 0; i < priceDates.length; i++) {
      const currentDate = priceDates[i];
      const currentPrice = parseFloat(editableDailyPrices.value[currentDate]) || 0;

      // 更新进度通知
      progressNotify({
        message: `正在创建多日账单：第${i + 1}/${totalBills}个...`,
        caption: `处理 ${formatDisplayDate(currentDate)} 的账单`
      });

      // 构建单日账单数据
      const billDataToSend = {
        order_id: props.currentOrder.orderNumber,
        room_number: props.currentOrder.roomNumber,
        guest_name: props.currentOrder.guestName,
        deposit: i === 0 ? deposit : 0, // 只在第一个账单记录押金
        refund_deposit: 'no',
        room_fee: currentPrice,
        total_income: currentPrice + (i === 0 ? deposit : 0),
        pay_way: { value: selectedPaymentMethod.value },
        remarks: `${formatDisplayDate(currentDate)} 住宿费用 (第${i + 1}/${totalBills}个账单)`
      };

      console.log(`创建第${i + 1}个账单:`, billDataToSend);

      // 调用账单API创建单日账单
      const createdBill = await billStore.createSingleBill(billDataToSend);
      createdBills.push(createdBill);

      // 短暂延迟，避免创建时间完全相同
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 关闭进度通知
    progressNotify();

    // 显示成功提示
    $q.notify({
      type: 'positive',
      message: `多日账单创建成功，共创建 ${totalBills} 个账单`,
      position: 'top'
    });

    console.log('多日账单创建成功，账单数量:', createdBills.length);

    // 触发账单创建完成事件
    emit('bill-created');

  } catch (error) {
    // 关闭进度通知
    progressNotify();
    throw error; // 重新抛出错误，让上层处理
  }
}

// 同步 currentOrder 的数据
watch(
  () => props.currentOrder,
  (order) => {
    if (order) {
      billData.value.order_id = order.orderNumber || ''
      billData.value.room_number = order.roomNumber || ''
      billData.value.guest_name = order.guestName || ''
      billData.value.deposit = order.deposit || 0
      billData.value.room_fee = order.roomPrice || 0
      billData.value.refund_deposit = 'no' // 固定为不退押金
      selectedPaymentMethod.value = order.paymentMethod || 'cash' // 更新支付方式选择
      billData.value.pay_way = { value: selectedPaymentMethod.value } // 后端期望的格式
    }
  },
  { immediate: true }
)

// 监听支付方式选择的变化
watch(
  () => selectedPaymentMethod.value,
  (newPaymentMethod) => {
    billData.value.pay_way = { value: newPaymentMethod }
  }
)

// 计算总金额（房费 + 押金）
const totalAmount = computed(() => {
  const roomFee = parseFloat(billData.value.room_fee) || 0
  const deposit = parseFloat(billData.value.deposit) || 0
  return roomFee + deposit
})
</script>

<style scoped>
.bill-card {
  min-width: 350px;
  max-width: 420px;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding-bottom: 12px;
}

.bill-table {
  background: #fafbfc;
  border-radius: 10px;
  font-size: 1.1em;
}

.bill-label {
  width: 90px;
  color: #666;
  font-weight: 500;
  text-align: right;
  background: #f5f7fa;
  border-right: 1px solid #e0e0e0;
  padding: 8px 12px;
}

.bill-value {
  font-size: 1.1em;
  text-align: left;
  padding-left: 18px;
  font-weight: 500;
}

.bill-input input {
  text-align: center;
  font-size: 1.1em;
  font-weight: bold;
}

.bill-btn {
  min-width: 100px;
}

.bill-total-label {
  font-weight: bold;
  color: #333;
  background: #fffbe6;
}

.bill-total-value {
  font-size: 1.3em;
  font-weight: bold;
  color: #d35400;
  background: #fffbe6;
  text-align: left;
  padding-left: 18px;
}
</style>
