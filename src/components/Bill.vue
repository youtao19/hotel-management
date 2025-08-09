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
            <tr>
              <td class="bill-label">房费</td>
              <td>
                <q-input v-model="billData.room_fee" type="number" dense outlined class="bill-input"
                  style="max-width: 120px;" />
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
import { ref, watch, computed } from 'vue'
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

const billData = ref({
  order_id: props.currentOrder?.orderNumber || '', // orderNumber 对应数据库的 order_id
  room_number: props.currentOrder?.roomNumber || '',
  guest_name: props.currentOrder?.guestName || '',
  deposit: props.currentOrder?.deposit || 0,
  refund_deposit: 'no', // 固定为不退押金，因为已经收取了房费+押金
  room_fee: props.currentOrder?.roomPrice || 0,
  total_income: 0,
  pay_way: { value: selectedPaymentMethod.value }, // 后端期望的格式
  remarks: props.currentOrder?.remarks || ''
})

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

    console.log("准备发送的账单数据：", billDataToSend)

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
    })

    // 发射账单创建成功事件
    emit('bill-created')

    // 关闭对话框
    emit('update:modelValue', false)
  } catch (error) {
    console.error('创建账单失败:', error)
    console.error('错误详情:', error.response?.data || error.message)

    let errorMessage = '创建账单失败'
    if (error.response?.data?.errors) {
      // 处理验证错误
      errorMessage = error.response.data.errors.map(err => err.msg).join('; ')
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    $q.notify({
      type: 'negative',
      message: errorMessage,
      position: 'top',
      timeout: 5000
    })
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
