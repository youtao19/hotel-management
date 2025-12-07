<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 450px; max-width: 600px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">续住办理</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <!-- 原订单信息显示 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">原订单信息</div>
          <div class="q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0;">
            <div class="row q-col-gutter-sm text-body2">
              <div class="col-6">订单号: {{ currentOrder?.orderNumber }}</div>
              <div class="col-6">客人: {{ currentOrder?.guestName }}</div>
              <div class="col-6">房间: {{ currentOrder?.roomNumber }}</div>
              <div class="col-6">房型: {{ getRoomTypeName(currentOrder?.roomType) }}</div>
            </div>
          </div>
        </div>

        <!-- 续住房间选择 -->
        <div class="q-mb-md">
          <div class="row items-center q-mb-sm">
            <div class="col">
              <div class="text-subtitle2">续住房间</div>
            </div>
            <div class="col-auto" v-if="originalRoomAvailable">
              <q-btn
                size="sm"
                outline
                color="primary"
                label="继续住原房间"
                @click="selectOriginalRoom"
                :loading="loadingRooms"
              />
            </div>
          </div>

          <q-select
            v-model="selectedRoom"
            :options="availableRoomOptions"
            label="选择房间"
            filled
            emit-value
            map-options
            :loading="loadingRooms"
            :hint="`可用房间: ${availableRoomOptions.length} 间`"
          >
            <template v-slot:no-option>
              <q-item>
                <q-item-section class="text-grey">
                  没有可用房间
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </div>

        <!-- 续住时间选择 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">续住时间</div>
          <div class="row q-col-gutter-md">
            <div class="col">
              <q-input
                v-model="extendStartDate"
                label="入住日期"
                filled
                type="date"
                :min="today"
              />
            </div>
            <div class="col">
              <q-input
                v-model="extendEndDate"
                label="离店日期"
                filled
                type="date"
                :min="extendStartDate || today"
              />
            </div>
          </div>
        </div>

        <!-- 新订单号设置 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">新订单号</div>
          <div class="row q-col-gutter-sm items-end">
            <div class="col">
              <q-input
                v-model="newOrderNumber"
                label="订单号"
                filled
                dense
                :rules="[
                  val => !!val?.trim() || '请输入订单号',
                  val => val?.length >= 5 || '订单号至少5位字符',
                  val => val?.length <= 20 || '订单号不能超过20位字符',
                  val => !/\s/.test(val) || '订单号不能包含空格'
                ]"
              />
            </div>
            <div class="col-auto">
              <q-btn
                color="primary"
                icon="refresh"
                @click="generateNewOrderNumber"
                flat
                dense
              >
                <q-tooltip>重新生成</q-tooltip>
              </q-btn>
            </div>
          </div>
        </div>

        <!-- 客人信息 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">客人信息</div>
          <div class="row q-col-gutter-md">
            <div class="col">
              <q-input
                v-model="guestName"
                label="客人姓名"
                filled
                dense
                :rules="[val => !!val?.trim() || '请输入客人姓名']"
              />
            </div>
            <div class="col">
              <q-input
                v-model="guestPhone"
                label="手机号(可选)"
                filled
                dense
                mask="###-####-####"
                unmasked-value
                :rules="[
                  val => !val || val.length === 11 || '手机号必须为11位数字'
                ]"
              />
            </div>
          </div>
        </div>

        <!-- 支付方式 -->
        <div class="q-mb-md">
          <div class="text-subtitle2 q-mb-sm">支付方式</div>
          <q-select
            v-model="paymentMethod"
            :options="paymentMethodOptions"
            label="选择支付方式"
            filled
            dense
            emit-value
            map-options
            :rules="[val => !!val || '请选择支付方式']"
          />
        </div>

        <!-- 价格信息 -->
        <div class="q-mb-md" v-if="selectedRoomInfo">
          <div class="text-subtitle2 q-mb-sm">价格信息 (续住天数: {{ stayDays }}天)</div>

          <!-- 单日续住 -->
          <div v-if="stayDays === 1">
            <q-input
              v-model.number="customUnitPrice"
              type="number"
              label="续住单价"
              dense
              filled
              :rules="singlePriceRules"
              prefix="¥"
              @update:model-value="userModifiedPrice = true"
            />
          </div>

          <!-- 多日续住 -->
          <div v-else>
            <q-markup-table flat bordered dense>
              <tbody>
                <tr v-for="d in stayDateList" :key="d">
                  <td class="text-caption" style="width:100px">{{ formatDay(d) }}</td>
                  <td>
                    <q-input
                      v-model.number="dailyPrices[d]"
                      type="number"
                      dense
                      filled
                      :rules="[v => v !== undefined && v !== null && v !== '' || '必填', v => parseFloat(v) > 0 || '需>0']"
                      prefix="¥"
                      @update:model-value="recalcTotal"
                    />
                  </td>
                </tr>
              </tbody>
            </q-markup-table>
          </div>

          <!-- 总价 -->
          <div class="q-mt-sm q-pa-sm rounded-borders" style="border: 1px solid #e0e0e0;">
            <div class="row items-center">
              <div class="col text-body2">总价</div>
              <div class="col-auto text-h6 text-primary">¥{{ totalPrice }}</div>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div class="q-mb-md">
          <q-input
            v-model="notes"
            label="备注(可选)"
            filled
            dense
            type="textarea"
            rows="2"
          />
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" v-close-popup />
        <q-btn
          label="确认续住"
          color="primary"
          @click="confirmExtendStay"
          :disable="!canConfirm"
          :loading="submitting"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { toRef } from 'vue'
import { useExtendStayLogic } from '../composables/useExtendStayLogic'

const props = defineProps({
  modelValue: Boolean,
  currentOrder: Object,
  availableRoomOptions: { type: Array, default: () => [] },
  getRoomTypeName: { type: Function, default: (v) => v },
  loadingRooms: Boolean
})

const emit = defineEmits(['update:modelValue', 'extend-stay', 'refresh-rooms'])

const {
  selectedRoom,
  extendStartDate,
  extendEndDate,
  guestName,
  guestPhone,
  notes,
  submitting,
  newOrderNumber,
  paymentMethod,
  customUnitPrice,
  userModifiedPrice,
  dailyPrices,
  paymentMethodOptions,
  today,
  selectedRoomInfo,
  stayDays,
  totalPrice,
  canConfirm,
  originalRoomAvailable,
  stayDateList,
  singlePriceRules,
  generateNewOrderNumber,
  selectOriginalRoom,
  recalcTotal,
  formatDay,
  confirmExtendStay
} = useExtendStayLogic({
  modelValueRef: toRef(props, 'modelValue'),
  currentOrderRef: toRef(props, 'currentOrder'),
  availableRoomOptionsRef: toRef(props, 'availableRoomOptions'),
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
