<template>
  <q-card>
    <q-card-section>
      <div class="row items-center justify-between q-mb-md">
        <div class="text-h6">订单列表</div>
        <div class="text-caption">
          显示 {{ rows.length }} / {{ totalOrders }} 条订单
        </div>
      </div>

      <!-- 通过 class/table-class 约束样式作用范围：用于实现“操作”列固定（sticky），不改变当前布局 -->
      <q-table
        class="om-order-table"
        table-class="om-order-table__table"
        :rows="rows"
        :columns="tableConfig.columns"
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
            <q-chip
              v-if="tableConfig.isRestRoom(props.row)"
              color="orange" text-color="white" icon="access_time" size="sm"
            >
              休息房
            </q-chip>
            <span v-else class="text-grey-6">住宿</span>
          </q-td>
        </template>

        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-badge
              :color="tableConfig.viewStore.getStatusColor(props.row.status)"
              :label="tableConfig.viewStore.getOrderStatusText(props.row.status)"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <!-- 操作按钮保持单行显示；列固定由 useOrderTableConfig.js 中的 classes/headerClasses + 本组件样式实现 -->
            <div class="om-actions-btns">
              <q-btn-group flat>
                <q-btn
                  flat
                  round
                  dense
                  color="primary"
                  icon="visibility"
                  aria-label="查看详情"
                  @click="$emit('view', props.row)"
                  data-testid="orders-row-view"
                >
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
            </div>
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useOrderTableConfig } from '../composables/useOrderTableConfig'

const props = defineProps(['rows', 'loading', 'totalOrders', 'canRefundDeposit'])
const emit = defineEmits(['view', 'check-in', 'cancel', 'checkout', 'early-checkout', 'extend-stay', 'refund'])

// 使用 Composable 获取配置和工具
const tableConfig = useOrderTableConfig()

</script>

<style scoped>
/* 固定订单列表“操作”列：横向滚动表格时，操作按钮始终可见，无需拖动底部滚动条去找按钮 */
.om-order-table :deep(.om-actions-sticky--cell) {
  position: sticky;
  right: 0;
  z-index: 2;
  background: #fff;
  box-shadow: -8px 0 8px -8px rgba(0, 0, 0, 0.25);
}

/* 表头同样固定在最右侧，避免横向滚动后“操作”表头丢失 */
.om-order-table :deep(.om-actions-sticky--header) {
  position: sticky;
  right: 0;
  z-index: 3;
  background: #fff;
  box-shadow: -8px 0 8px -8px rgba(0, 0, 0, 0.25);
}

/* 操作按钮保持单行显示（不换行），以符合当前页面布局预期 */
.om-actions-btns {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
</style>
