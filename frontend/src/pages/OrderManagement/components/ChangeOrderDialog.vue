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
import { toRef } from 'vue'
import { useChangeOrderLogic } from '../composables/useChangeOrderLogic'

const props = defineProps({
  modelValue: Boolean,
  order: Object,           // 当前订单信息
  availableRooms: Array,   // 可用房间列表（由父组件传入）
  getRoomTypeName: { type: Function, default: () => '' }
})

const emit = defineEmits(['update:modelValue', 'order-updated'])

const {
  editableOrder,
  loading,
  paymentMethodOptions,
  roomOptions,
  totalRoomPrice,
  formatDay,
  handleRoomChange,
  submitChange
} = useChangeOrderLogic({
  modelValueRef: toRef(props, 'modelValue'),
  orderRef: toRef(props, 'order'),
  availableRoomsRef: toRef(props, 'availableRooms'),
  getRoomTypeName: props.getRoomTypeName,
  emit
})
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
