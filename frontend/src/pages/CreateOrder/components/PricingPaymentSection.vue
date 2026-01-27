<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">支付信息</div>
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <div class="simple-pricing-container">
          <div class="row items-center q-mb-md" v-if="isMultiDay">
            <div class="col-auto">
              <span class="text-subtitle2 text-grey-8">每日房间价格设置 (共 {{ dateList.length }} 天)</span>
            </div>
            <div class="col-auto q-ml-sm">
              <q-btn flat dense color="orange" label="应用首日价格" @click="$emit('apply-first')" class="simple-btn" />
            </div>
          </div>

          <div class="row q-mb-md" v-if="isMultiDay">
            <div class="col-md-4 col-xs-12">
              <q-input v-model.number="internalTotalPrice" label="住宿总价" filled type="number" prefix="¥"
                hint="输入总价后自动平均分配" @update:model-value="$emit('distribute')" class="simple-input">
                <template v-slot:append><q-icon name="calculate" color="primary" /></template>
              </q-input>
            </div>
          </div>

          <div class="row q-col-gutter-md">
            <div v-for="date in dateList" :key="date"
              :class="dateList.length === 1 ? 'col-md-4 col-xs-12' : 'col-md-3 col-sm-4 col-xs-6'">
              <q-input v-model.number="dailyPrices[date]"
                :label="dateList.length === 1 ? (isRestRoom ? '休息房价格' : '住宿价格') : date" filled type="number"
                prefix="¥" :rules="[val => val > 0 || '价格>0']" class="simple-input"
                @update:model-value="$emit('update-total')" />
            </div>

            <div :class="dateList.length === 1 ? 'col-md-4 col-xs-12' : 'col-md-3 col-sm-4 col-xs-6'">
              <!-- 使用 emit-value/map-options 确保 v-model 保存字符串，避免出现 [object Object] -->
              <q-select
                v-model="orderData.paymentMethod"
                :options="paymentOptions"
                label="支付方式"
                option-label="label"
                option-value="value"
                emit-value
                map-options
                filled
                :rules="[val => !!val || '请选择']"
                class="simple-input"
              />
            </div>
          </div>

          <div class="row q-col-gutter-md q-mt-md">
            <div class="col-md-4 col-xs-12">
              <div class="text-body2 text-grey-7 q-mb-xs">当前是否收房费</div>
              <q-option-group v-model="orderData.isPrepaid" :options="prepayOptions" type="radio" inline
                color="primary" />
            </div>
            <div class="col-md-4 col-xs-12" v-if="orderData.isPrepaid">
              <q-input v-model.number="orderData.prepaidAmount" label="已收房费金额" filled type="number" prefix="¥"
                :rules="[val => val > 0 || '金额>0']" />
            </div>
          </div>

          <div class="row q-mt-md" v-if="isMultiDay">
            <div class="col-12">
              <div class="total-display">
                <span class="text-grey-7">住宿总价：</span>
                <span class="text-h6 text-primary q-ml-sm">¥{{ totalPrice.toFixed(2) }}</span>
                <span class="text-caption text-grey-6 q-ml-md">平均 ¥{{ averagePrice }}/天</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  orderData: Object,
  dailyPrices: Object,
  dateList: Array,
  isMultiDay: Boolean,
  isRestRoom: Boolean,
  totalPriceInput: Number, // Input from parent
  totalPrice: Number,      // Calculated total
  averagePrice: [Number, String],
  paymentOptions: Array,
  prepayOptions: Array
})

const emit = defineEmits(['update:totalPriceInput', 'distribute', 'update-total', 'apply-first'])

// 双向绑定总价输入框
const internalTotalPrice = computed({
  get: () => props.totalPriceInput,
  set: (val) => emit('update:totalPriceInput', val)
})
</script>

<style scoped>
.simple-pricing-container {
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
.total-display {
  padding: 12px 16px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
}
</style>
