<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 480px; max-width: 640px;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">
          <q-icon name="logout" class="q-mr-sm" />
          提前退房
        </div>
        <q-space />
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section v-if="order">
        <div class="q-mb-md">
          <div class="text-subtitle2">订单信息</div>
          <div class="text-body2 text-grey-7">
            {{ order.roomNumber }} · {{ order.guestName }} · 原计划退房 {{ logic.formatDate(order.checkOutDate, true) }}
          </div>
        </div>

        <q-banner v-if="logic.showNotEarlyWarning" dense rounded class="bg-orange-1 text-orange-10 q-mb-md">
          实际退房时间需要早于原退房时间，当前选择可能无法触发提前退房。
        </q-banner>

        <q-form @submit.prevent="logic.handleSubmit" class="q-gutter-md">
          <q-option-group
            v-model="logic.hasStayed"
            type="radio"
            color="primary"
            :options="[
              { label: '是，客人已入住', value: true },
              { label: '否，未入住直接退房', value: false }
            ]"
            inline
            label="是否入住"
          />

          <q-input
            v-model="logic.actualCheckoutTime"
            type="datetime-local"
            label="实际退房时间"
            outlined
            :rules="[
              val => !!val || '请选择实际退房时间',
              () => !logic.showNotEarlyWarning || '必须早于原计划退房时间'
            ]"
          >
            <template #append>
              <q-btn
                dense
                flat
                icon="schedule"
                @click="logic.setActualCheckoutToNow"
              >
                <q-tooltip>设置为现在</q-tooltip>
              </q-btn>
            </template>
          </q-input>

          <q-field
            outlined
            label="系统建议退款"
            stack-label
          >
            <template #control>
              <div class="text-subtitle1">
                ¥{{ logic.recommendedRefundRounded.toFixed(2) }}
                <q-spinner size="16px" class="q-ml-sm" v-if="logic.loadingOrderDetails" />
              </div>
            </template>
            <template #message>
              {{ logic.hasStayed ? `按照剩余房费计算，共 ${logic.refundableNights.length} 天可退` : '未入住按已收金额退款（押金/房费）' }}
            </template>
          </q-field>

          <q-input
            v-model.number="logic.refundAmount"
            type="number"
            label="实际退款金额"
            prefix="¥"
            outlined
            :rules="logic.refundAmountRules"
            @update:model-value="logic.manualAmountTouched = true"
          >
            <template #append>
              <q-btn
                dense
                flat
                label="使用建议"
                @click="logic.useRecommendedAmount"
                :disable="logic.recommendedRefundRounded <= 0"
              />
            </template>
            <template #hint>
              与建议金额差额：{{ logic.refundDiffText }}
            </template>
          </q-input>

          <q-select
            v-model="logic.refundMethod"
            :options="logic.paymentMethodOptions"
            label="退款方式"
            outlined
            emit-value
            map-options
            :rules="[val => !!val || '请选择退款方式']"
          />

          <q-input
            v-model="logic.remarks"
            label="备注（可选）"
            type="textarea"
            autogrow
            outlined
            hint="例如客人提前离店原因或特殊说明"
          />

          <div v-if="logic.refundableNights.length" class="q-mt-md">
            <div class="text-caption text-grey-7 q-mb-xs">预计退款日期</div>
            <div class="row q-col-gutter-sm">
              <div
                v-for="item in logic.refundableNights"
                :key="item.stayDate"
                class="col-auto"
              >
                <q-chip dense color="yellow-3" text-color="orange-10">
                  {{ item.stayDate }} · ¥{{ Number(item.roomPrice).toFixed(2) }}
                </q-chip>
              </div>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" @click="logic.closeDialog" />
        <q-btn
          color="warning"
          label="确认提前退房"
          icon="logout"
          :loading="logic.submitting"
          :disable="!logic.canSubmit"
          @click="logic.handleSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useEarlyCheckoutLogic } from '../composables/useEarlyCheckoutLogic'

const props = defineProps({
  modelValue: Boolean,
  order: Object
})

const emit = defineEmits(['update:modelValue', 'success'])

const logic = reactive(useEarlyCheckoutLogic(props, emit))
</script>
