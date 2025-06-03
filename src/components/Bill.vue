<template>
  <q-dialog :model-value="modelValue" @update:model-value="val => emit('update:modelValue', val)" persistent>
    <q-card v-if="currentOrder" class="bill-card">
      <q-card-section>
        <div class="text-h5 text-center q-mb-lg">账单</div>
        <q-markup-table flat bordered class="bill-table q-mb-lg">
          <tbody>
            <tr>
              <td class="bill-label">押金</td>
              <td class="bill-value text-primary text-bold">{{ currentOrder.deposit }}</td>
            </tr>
            <tr>
              <td class="bill-label">是否退押金</td>
              <td>
                <q-radio v-model="billData.refund_deposit" val='yes' label="退押金" color="primary" />
                <q-radio v-model="billData.refund_deposit" val='no' label="不退押金" color="negative" class="q-ml-xl" />
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
              <td class="bill-label bill-pay-way">支付方式</td>
              <td class="bill-label select-way">
                <q-select filled v-model="way" :options="way_options" label="选择支付方式" />
              </td>
            </tr>
            <tr>
              <td class="bill-label bill-total-label">总收入</td>
              <td class="bill-total-value">
                <span class="text-deep-orange-6">{{ totalIncome.toFixed(2) }}</span> 元
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

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
})
const emit = defineEmits(['update:modelValue'])

const billStore = useBillStore()

let way = ref('')

const billData = ref({
  order_id: props.currentOrder?.orderNumber || '',
  room_number: props.currentOrder?.roomNumber || '',
  guest_name: props.currentOrder?.guestName || '',
  deposit: props.currentOrder?.deposit || 0,
  refund_deposit: 'yes',
  room_fee: props.currentOrder?.roomPrice || 0,
  total_income: 0,
  pay_way: '',
  remarks: props.currentOrder?.remarks || ''
})


const way_options = ref([
  {
    label: '微信',
    value: 'wechat'
  },
  {
    label: '支付宝',
    value: 'alipay'
  },
  {
    label: '转账',
    value: 'transfer'
  },
  {
    label: '现金',
    value: 'cash'
  },
  {
    label: '平台',
    value: 'platform'
  }
])

async function createBill() {
  try {
    // 在发送之前计算并设置 total_income
    const roomFee = parseFloat(billData.value.room_fee) || 0
    const deposit = parseFloat(billData.value.deposit) || 0
    const calculatedTotalIncome = billData.value.refund_deposit === 'yes' ? roomFee : roomFee + deposit

    // 确保所有数字字段都有有效值
    const billDataToSend = {
      ...billData.value,
      total_income: calculatedTotalIncome,
      room_fee: roomFee,
      deposit: deposit
    }

    console.log("账单数据：",billDataToSend)
    await billStore.addBill(billDataToSend)
  } catch (error) {
    console.error('创建账单失败:', error)
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
      billData.value.pay_way = way
    }
  },
  { immediate: true }
)

const totalIncome = computed(() => {
  const roomFee = parseFloat(billData.value.room_fee) || 0
  const deposit = parseFloat(props.currentOrder?.deposit) || 0
  return billData.value.refund_deposit === 'yes'
    ? roomFee
    : roomFee + deposit
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
}

.bill-value {
  font-size: 1.3em;
  text-align: left;
  padding-left: 18px;
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
