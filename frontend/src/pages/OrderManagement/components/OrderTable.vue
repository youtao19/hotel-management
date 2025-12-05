<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">订单列表</div>
        <div class="text-caption">
          显示 {{ rows.length }} / {{ totalOrders }} 条订单
        </div>
      </div>

      <q-table
        :rows="rows"
        :columns="columns"
        row-key="orderNumber"
        :pagination="{ rowsPerPage: 10 }"
        :loading="loading"
        no-data-label="没有找到订单"
      >
        <template v-slot:loading>
          <q-inner-loading showing color="primary" />
        </template>

        <template v-slot:body-cell-orderType="props">
          <q-td :props="props">
            <q-chip v-if="isRestRoom(props.row)" color="orange" text-color="white" icon="access_time" size="sm">
              休息房
            </q-chip>
            <span v-else class="text-grey-6">住宿</span>
          </q-td>
        </template>

        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge :color="viewStore.getStatusColor(props.row.status)" :label="viewStore.getOrderStatusText(props.row.status)" />
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn-group flat>
              <q-btn flat round dense color="primary" icon="visibility" @click="$emit('view', props.row)">
                <q-tooltip>查看详情</q-tooltip>
              </q-btn>

              <q-btn v-if="props.row.status === 'pending'" flat round dense color="info" icon="hotel" @click="$emit('check-in', props.row)">
                <q-tooltip>办理入住</q-tooltip>
              </q-btn>

              <q-btn v-if="['checked-in', 'pending'].includes(props.row.status)" flat round dense color="negative" icon="cancel" @click="$emit('cancel', props.row)">
                <q-tooltip>取消订单</q-tooltip>
              </q-btn>

              <q-btn v-if="props.row.status === 'checked-in'" flat round dense color="positive" icon="check_circle" @click="$emit('checkout', props.row)">
                <q-tooltip>办理退房</q-tooltip>
              </q-btn>

              <q-btn v-if="props.row.status === 'checked-in'" flat round dense color="warning" icon="logout" @click="$emit('early-checkout', props.row)">
                <q-tooltip>提前退房</q-tooltip>
              </q-btn>

              <q-btn v-if="['checked-out', 'checked-in'].includes(props.row.status)" flat round dense color="orange" icon="hotel_class" @click="$emit('extend-stay', props.row)">
                <q-tooltip>续住</q-tooltip>
              </q-btn>

              <q-btn v-if="canRefundDeposit(props.row)" flat round dense color="purple" icon="account_balance_wallet" @click="$emit('refund', props.row)">
                <q-tooltip>退押金</q-tooltip>
              </q-btn>
            </q-btn-group>
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'
import { useViewStore } from 'src/stores/viewStore'

const props = defineProps(['rows', 'loading', 'totalOrders', 'canRefundDeposit'])
const emit = defineEmits(['view', 'check-in', 'cancel', 'checkout', 'early-checkout', 'extend-stay', 'refund'])

const viewStore = useViewStore()

// 判断休息房
const isRestRoom = (order) => {
  if (!order.checkInDate || !order.checkOutDate) return false
  const checkIn = new Date(order.checkInDate).toISOString().split('T')[0]
  const checkOut = new Date(order.checkOutDate).toISOString().split('T')[0]
  return checkIn === checkOut
}

// 辅助函数：格式化日期
const formatDate = (val) => {
  if (!val) return ''
  return typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val
}

// 表格列定义
const columns = [
  { name: 'orderNumber', align: 'left', label: '订单号', field: 'orderNumber', sortable: true },
  { name: 'guestName', align: 'left', label: '客人姓名', field: 'guestName', sortable: true },
  { name: 'phone', align: 'left', label: '手机号', field: 'phone' },
  { name: 'roomNumber', align: 'left', label: '房间号', field: 'roomNumber', sortable: true },
  { name: 'roomType', align: 'left', label: '房间类型', field: 'roomType', format: val => viewStore.getRoomTypeName(val) },
  { name: 'checkInDate', align: 'left', label: '入住日期', field: 'checkInDate', sortable: true, format: formatDate },
  { name: 'checkOutDate', align: 'left', label: '离店日期', field: 'checkOutDate', sortable: true, format: formatDate },
  { name: 'orderType', align: 'center', label: '类型', field: 'orderType' },
  { name: 'status', align: 'left', label: '状态', field: 'status', sortable: true }, // Format handled in template
  { name: 'actions', align: 'center', label: '操作', field: 'actions' }
]
</script>
