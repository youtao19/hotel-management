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
            {{ order.roomNumber }} · {{ order.guestName }} · 原计划退房 {{ formatDate(order.checkOutDate, true) }}
          </div>
        </div>

        <q-banner v-if="showNotEarlyWarning" dense rounded class="bg-orange-1 text-orange-10 q-mb-md">
          实际退房时间需要早于原退房时间，当前选择可能无法触发提前退房。
        </q-banner>

        <q-form @submit.prevent="handleSubmit" class="q-gutter-md">
          <q-input
            v-model="actualCheckoutTime"
            type="datetime-local"
            label="实际退房时间"
            outlined
            :rules="[
              val => !!val || '请选择实际退房时间',
              () => !showNotEarlyWarning || '必须早于原计划退房时间'
            ]"
          >
            <template #append>
              <q-btn
                dense
                flat
                icon="schedule"
                @click="setActualCheckoutToNow"
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
                ¥{{ recommendedRefund.toFixed(2) }}
                <q-spinner size="16px" class="q-ml-sm" v-if="loadingBills" />
              </div>
            </template>
            <template #message>
              按照剩余房费计算，共 {{ refundableNights.length }} 天可退
            </template>
          </q-field>

          <q-input
            v-model.number="refundAmount"
            type="number"
            label="实际退款金额"
            prefix="¥"
            outlined
            :rules="refundAmountRules"
            @update:model-value="manualAmountTouched = true"
          >
            <template #append>
              <q-btn
                dense
                flat
                label="使用建议"
                @click="useRecommendedAmount"
                :disable="recommendedRefund <= 0"
              />
            </template>
            <template #hint>
              与建议金额差额：{{ refundDiffText }}
            </template>
          </q-input>

          <q-select
            v-model="refundMethod"
            :options="paymentMethodOptions"
            label="退款方式"
            outlined
            emit-value
            map-options
            :rules="[val => !!val || '请选择退款方式']"
          />

          <q-input
            v-model="remarks"
            label="备注（可选）"
            type="textarea"
            autogrow
            outlined
            hint="例如客人提前离店原因或特殊说明"
          />

          <div v-if="refundableNights.length" class="q-mt-md">
            <div class="text-caption text-grey-7 q-mb-xs">预计退款日期</div>
            <div class="row q-col-gutter-sm">
              <div
                v-for="item in refundableNights"
                :key="item.stayDate"
                class="col-auto"
              >
                <q-chip dense color="yellow-3" text-color="orange-10">
                  {{ item.stayDate }} · ¥{{ item.amount }}
                </q-chip>
              </div>
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="grey" @click="closeDialog" />
        <q-btn
          color="warning"
          label="确认提前退房"
          icon="logout"
          :loading="submitting"
          :disable="!canSubmit"
          @click="handleSubmit"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useOrderStore } from 'src/stores/orderStore'
import { useBillStore } from 'src/stores/billStore'
import { useUserStore } from 'src/stores/userStore'
import { useViewStore } from 'src/stores/viewStore'

const props = defineProps({
  modelValue: Boolean,
  order: Object
})

const emit = defineEmits(['update:modelValue', 'success'])

const $q = useQuasar()
const orderStore = useOrderStore()
const billStore = useBillStore()
const userStore = useUserStore()
const viewStore = useViewStore()

const actualCheckoutTime = ref('')
const refundAmount = ref(0)
const refundMethod = ref('')
const remarks = ref('')
const manualAmountTouched = ref(false)
const submitting = ref(false)
const loadingBills = ref(false)
const orderBills = ref([])

const paymentMethodOptions = viewStore.paymentMethodOptions

const refundAmountRules = [
  val => val !== null && val !== undefined && val >= 0 || '退款金额必须大于或等于0',
  val => val <= recommendedRefund.value + 0.01 || `退款金额不能超过¥${recommendedRefund.value.toFixed(2)}`
]

const actualCheckoutDateYMD = computed(() => {
  if (!actualCheckoutTime.value) return null
  return actualCheckoutTime.value.slice(0, 10)
})

const recommendedBills = computed(() => {
  if (!props.order || !actualCheckoutDateYMD.value) return []
  const cutoff = actualCheckoutDateYMD.value
  return (orderBills.value || []).filter(b => {
    if (!b || b.change_type !== '房费') return false
    const stayDate = formatDateOnly(b.stay_date || b.stayDate)
    return stayDate && stayDate >= cutoff
  }).map(b => ({
    stayDate: formatDateOnly(b.stay_date || b.stayDate),
    amount: Number(b.change_price || b.room_fee || 0).toFixed(2)
  }))
})

const recommendedRefund = computed(() => {
  return recommendedBills.value.reduce((sum, item) => sum + Number(item.amount), 0)
})

const refundableNights = computed(() => recommendedBills.value)

const refundDiffText = computed(() => {
  const diff = Number(refundAmount.value || 0) - recommendedRefund.value
  if (Math.abs(diff) < 0.01) return '与建议金额一致'
  return diff > 0
    ? `多退 ¥${diff.toFixed(2)}`
    : `少退 ¥${Math.abs(diff).toFixed(2)}`
})

const showNotEarlyWarning = computed(() => {
  if (!props.order?.checkOutDate || !actualCheckoutTime.value) return false
  return new Date(actualCheckoutTime.value) >= new Date(props.order.checkOutDate)
})

const canSubmit = computed(() => {
  if (!props.order) return false
  if (!actualCheckoutTime.value || showNotEarlyWarning.value) return false
  if (refundAmount.value === null || refundAmount.value === undefined) return false
  if (refundAmount.value < 0) return false
  if (refundAmount.value - recommendedRefund.value > 0.01) return false
  if (!refundMethod.value) return false
  return true
})

function formatDateOnly(input) {
  if (!input) return null
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(dateInput, includeTime = false) {
  if (!dateInput) return '--'
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return dateInput
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  let formatted = `${y}-${m}-${d}`
  if (includeTime) {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    formatted += ` ${hh}:${mm}`
  }
  return formatted
}

function formatForInput(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return ''
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  const hh = String(dateObj.getHours()).padStart(2, '0')
  const mm = String(dateObj.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

function setActualCheckoutToNow() {
  actualCheckoutTime.value = formatForInput(new Date())
}

function useRecommendedAmount() {
  refundAmount.value = Number(recommendedRefund.value.toFixed(2))
  manualAmountTouched.value = false
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function loadBills() {
  if (!props.order?.orderNumber) {
    orderBills.value = []
    return
  }
  try {
    loadingBills.value = true
    const bills = await billStore.getBillsByOrderId(props.order.orderNumber)
    orderBills.value = bills || []
  } catch (error) {
    orderBills.value = []
    console.warn('加载订单账单失败:', error.message || error)
  } finally {
    loadingBills.value = false
  }
}

function initializeForm() {
  if (!props.order) return
  const now = new Date()
  const planned = props.order.checkOutDate ? new Date(props.order.checkOutDate) : null
  let base = now
  if (planned && now >= planned) {
    base = new Date(planned.getTime() - 60 * 60 * 1000)
  }
  actualCheckoutTime.value = formatForInput(base)
  refundMethod.value = props.order.paymentMethod || viewStore.paymentMethodOptions?.[0]?.value || '现金'
  remarks.value = ''
  manualAmountTouched.value = false
}

async function handleSubmit() {
  if (!canSubmit.value || !props.order) return
  try {
    submitting.value = true
    const isoTime = new Date(actualCheckoutTime.value)
    if (Number.isNaN(isoTime.getTime())) {
      $q.notify({ type: 'negative', message: '请选择有效的退房时间' })
      return
    }

    const payload = {
      actualCheckoutTime: isoTime.toISOString(),
      refundAmount: Number(refundAmount.value || 0),
      refundMethod: refundMethod.value,
      operator: userStore.user?.username || 'system',
      remarks: remarks.value
    }

    const result = await orderStore.earlyCheckout(props.order.orderNumber, payload)
    $q.notify({ type: 'positive', message: '提前退房已完成' })
    emit('success', result)
    closeDialog()
  } catch (error) {
    const message = error.response?.data?.message || error.message || '提前退房失败'
    $q.notify({ type: 'negative', message, multiLine: true })
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      initializeForm()
      await loadBills()
      refundAmount.value = Number(recommendedRefund.value.toFixed(2))
    } else {
      orderBills.value = []
    }
  }
)

watch(
  () => recommendedRefund.value,
  (val) => {
    if (!manualAmountTouched.value) {
      refundAmount.value = Number(val.toFixed(2))
    }
  }
)
</script>
