<template>
  <q-page class="other-income-page">
    <div class="q-pa-md other-income-header">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-xs">其他收入</h1>
      <div class="text-caption text-grey-7">
        录入租车或杂项收入
      </div>
    </div>

    <div class="other-income-container q-pa-md">
      <q-card class="other-income-card">
        <q-card-section class="q-pa-xl">
          <q-form @submit.prevent="handleSubmit" class="column q-gutter-lg">
            <!-- 第一行：客人姓名 + 金额 -->
            <div class="row q-col-gutter-lg">
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">客人姓名</div>
                <q-input
                  v-model="form.guestName"
                  outlined
                  dense
                  color="primary"
                  placeholder="例如：张三"
                  bg-color="white"
                >
                  <template #prepend>
                    <q-icon name="person" class="text-grey-5" />
                  </template>
                </q-input>
              </div>
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">
                  金额
                  <span class="text-caption text-grey-5 text-weight-regular">
                    （正数收入，负数支出）
                  </span>
                </div>
                <q-input
                  v-model.number="form.amount"
                  type="number"
                  outlined
                  dense
                  color="primary"
                  placeholder="0.00"
                  bg-color="white"
                  @blur="formatAmount"
                >
                  <template #prepend>
                    <span class="text-weight-bold text-grey-7">¥</span>
                  </template>
                </q-input>
              </div>
            </div>

            <!-- 第二行：支付方式 + 收入类型 -->
            <div class="row q-col-gutter-lg">
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">支付方式</div>
                <q-select
                  v-model="form.payWay"
                  :options="payWays"
                  outlined
                  dense
                  color="primary"
                  emit-value
                  map-options
                  :popup-content-class="'rounded-popup'"
                  clearable
                  bg-color="white"
                >
                  <template #prepend>
                    <q-icon name="credit_card" class="text-grey-5" />
                  </template>
                </q-select>
              </div>
              <div class="col-12 col-md-6">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">收入类型</div>
                <q-input
                  v-model="form.incomeType"
                  outlined
                  dense
                  color="primary"
                  bg-color="white"
                  readonly
                >
                  <template #prepend>
                    <q-icon name="account_balance_wallet" class="text-grey-5" />
                  </template>
                </q-input>
              </div>
            </div>

            <!-- 第三行：收入时间 -->
            <div class="row q-col-gutter-lg">
              <div class="col-12">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">收入时间</div>
                <q-input
                  v-model="form.incomeDateDisplay"
                  outlined
                  dense
                  color="primary"
                  bg-color="white"
                  readonly
                >
                  <template #prepend>
                    <q-icon name="event" class="cursor-pointer text-grey-5" />
                  </template>
                  <template #append>
                    <q-btn
                      round
                      dense
                      flat
                      icon="access_time"
                      color="grey-7"
                      class="date-icon-btn"
                    >
                      <q-popup-proxy
                        cover
                        transition-show="scale"
                        transition-hide="scale"
                        @before-show="syncDateTimeFields"
                      >
                        <div class="q-pa-sm column q-gutter-sm" style="width: 320px">
                          <q-date v-model="datePart" mask="YYYY-MM-DD" minimal />
                          <q-time v-model="timePart" format24h with-seconds />
                          <div class="row items-center justify-end q-gutter-sm">
                            <q-btn flat color="primary" label="重置为现在" @click="resetToNow" />
                            <q-btn unelevated color="primary" label="确定" v-close-popup @click="applyDateTime" />
                          </div>
                        </div>
                      </q-popup-proxy>
                    </q-btn>
                  </template>
                </q-input>
              </div>
            </div>

            <!-- 备注 -->
            <div class="row q-col-gutter-lg">
              <div class="col-12">
                <div class="text-subtitle2 text-grey-8 q-mb-xs">备注</div>
                <q-input
                  v-model="form.remarks"
                  type="textarea"
                  outlined
                  :rows="4"
                  color="primary"
                  placeholder="补充说明，至少 3 行以内..."
                  bg-color="white"
                  counter
                  :maxlength="200"
                />
              </div>
            </div>

            <!-- 底部按钮 -->
            <div class="q-mt-lg q-pt-md row justify-end items-center q-gutter-sm border-top-grey">
              <q-btn
                flat
                color="grey-7"
                label="重置"
                @click="resetForm"
                class="q-px-md text-weight-regular"
                no-caps
              />
              <q-btn
                unelevated
                color="primary"
                label="提交录入"
                :loading="submitting"
                type="submit"
                class="submit-btn q-px-lg"
                icon="check"
                no-caps
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar, date as quasarDate } from 'quasar'
import { billApi } from 'src/api'

const $q = useQuasar()

const payWays = [
  { label: '现金', value: '现金' },
  { label: '微信', value: '微信' },
  { label: '微邮付', value: '微邮付' }
]

// 将日期对象格式化为本地时间的 RFC3339（带时区偏移）字符串，满足后端 AJV date-time 校验
function formatWithOffset(dateObj) {
  const pad = (n) => String(Math.abs(n)).padStart(2, '0')
  const year = dateObj.getFullYear()
  const month = pad(dateObj.getMonth() + 1)
  const day = pad(dateObj.getDate())
  const hours = pad(dateObj.getHours())
  const minutes = pad(dateObj.getMinutes())
  const seconds = pad(dateObj.getSeconds())
  const offsetMinutes = dateObj.getTimezoneOffset()
  const sign = offsetMinutes > 0 ? '-' : '+'
  const absMinutes = Math.abs(offsetMinutes)
  const offsetH = pad(Math.floor(absMinutes / 60))
  const offsetM = pad(absMinutes % 60)
  const offset = `${sign}${offsetH}:${offsetM}`
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`
}

function getNowDateTime() {
  const current = new Date()
  return {
    display: quasarDate.formatDate(current, 'YYYY-MM-DD HH:mm:ss'),
    iso: formatWithOffset(current),
    datePart: quasarDate.formatDate(current, 'YYYY-MM-DD'),
    timePart: quasarDate.formatDate(current, 'HH:mm:ss')
  }
}

const { display: nowDisplay, iso: nowIso, datePart: nowDatePart, timePart: nowTimePart } = getNowDateTime()

const form = ref({
  guestName: '',
  amount: null,
  payWay: '',
  incomeType: '租车收入',
  incomeDateDisplay: nowDisplay,
  incomeDate: nowIso,
  remarks: ''
})

const submitting = ref(false)
const datePart = ref(quasarDate.formatDate(new Date(), 'YYYY-MM-DD'))
const timePart = ref(quasarDate.formatDate(new Date(), 'HH:mm:ss'))

function resetForm() {
  const current = getNowDateTime()
  form.value = {
    guestName: '',
    amount: null,
    payWay: '',
    incomeType: '租车收入',
    incomeDateDisplay: current.display,
    incomeDate: current.iso,
    remarks: ''
  }
  datePart.value = current.datePart
  timePart.value = current.timePart
}

function formatAmount() {
  if (form.value.amount === null || form.value.amount === undefined || form.value.amount === '') return
  const num = Number(form.value.amount)
  if (Number.isFinite(num)) {
    form.value.amount = Number(num.toFixed(2))
  }
}

function validateForm() {
  const amountNum = Number(form.value.amount)
  if (!Number.isFinite(amountNum) || amountNum === 0) {
    $q.notify({ type: 'negative', message: '金额必须非零，可为正数或负数' })
    return false
  }
  if (!form.value.payWay) {
    $q.notify({ type: 'negative', message: '请选择支付方式' })
    return false
  }
  if (!form.value.incomeDate) {
    $q.notify({ type: 'negative', message: '请选择收入时间' })
    return false
  }
  return true
}

function applyDateTime() {
  const combinedDisplay = `${datePart.value} ${timePart.value}`
  form.value.incomeDateDisplay = combinedDisplay
  const combinedIso = formatWithOffset(new Date(`${datePart.value}T${timePart.value}`))
  form.value.incomeDate = combinedIso
}

function resetToNow() {
  const now = new Date()
  datePart.value = quasarDate.formatDate(now, 'YYYY-MM-DD')
  timePart.value = quasarDate.formatDate(now, 'HH:mm:ss')
  form.value.incomeDateDisplay = quasarDate.formatDate(now, 'YYYY-MM-DD HH:mm:ss')
  form.value.incomeDate = formatWithOffset(now)
}

function syncDateTimeFields() {
  const val = form.value.incomeDateDisplay || ''
  if (val.includes(' ')) {
    const [d, t] = val.split(' ')
    if (d) datePart.value = d
    if (t) timePart.value = t
  } else if (val) {
    datePart.value = val
  }
}

async function handleSubmit() {
  if (!validateForm()) return
  submitting.value = true
  try {
    await billApi.createOtherIncome({
      guest_name: form.value.guestName ? form.value.guestName.trim() : undefined,
      amount: Number(form.value.amount),
      pay_way: form.value.payWay,
      income_type: form.value.incomeType,
      income_date: form.value.incomeDate,
      remarks: form.value.remarks ? form.value.remarks.trim() : undefined
    })
    $q.notify({ type: 'positive', message: '其他收入已创建' })
    resetForm()
  } catch (error) {
    const msg = error.response?.data?.message || '创建其他收入失败'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.other-income-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.other-income-header {
  max-width: 1120px;
  margin: 0 auto;
}

.other-income-container {
  max-width: 1120px;
  margin: 0 auto 32px;
}

.other-income-card {
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: none;
  background-color: #ffffff;
}

.submit-btn {
  min-width: 200px;
  border-radius: 12px;
}

.rounded-popup {
  border-radius: 12px;
}

.border-top-grey {
  border-top: 1px solid #f0f0f0;
}
</style>
