<template>
  <q-page class="other-income-page">

     <div class="q-pa-md">
      <!-- 页面标题 -->
      <h1 class="text-h4 q-mb-md">其他收入</h1>
      <div class="text-caption text-grey-7 q-mt-xs">
                录入租车或杂项收入
      </div>
     </div>

     <q-card>
       <q-card-section class="q-pa-lg">
         <q-form @submit.prevent="handleSubmit" class="column q-gutter-lg">
           <div class="row q-col-gutter-md">
             <div class="col-12 col-md-6">
               <q-input
                 v-model="form.guestName"
                 filled
                 standout="bg-white text-primary"
                 :input-style="inputStyle"
                 stack-label
                 label="客人姓名"
                 placeholder="例如：张三"
               />
             </div>
             <div class="col-12 col-md-6">
               <q-input
                 v-model.number="form.amount"
                 type="number"
                 filled
                 standout="bg-white text-primary"
                 :input-style="inputStyle"
                 stack-label
                 label="金额（正数收入，负数支出）"
                 prefix="￥"
                 @blur="formatAmount"
               />
             </div>
           </div>

           <div class="row q-col-gutter-md">
             <div class="col-12 col-md-6">
               <q-select
                 v-model="form.payWay"
                 :options="payWays"
                 filled
                 emit-value
                 map-options
                 standout="bg-white text-primary"
                 :input-style="inputStyle"
                 :popup-content-class="'rounded-popup'"
                 stack-label
                 label="支付方式"
                 clearable
               />
             </div>
             <div class="col-12 col-md-6">
               <q-input
                 v-model="form.incomeType"
                 filled
                 standout="bg-white text-primary"
                 :input-style="inputStyle"
                 stack-label
                 label="收入类型"
                 readonly
               />
             </div>
           </div>

           <div class="row q-col-gutter-md">
              <div class="col-12 col-md-6">
                <q-input
                  v-model="form.incomeDateDisplay"
                  filled
                  standout="bg-white text-primary"
                  :input-style="inputStyle"
                  stack-label
                  label="收入时间（含时分秒）"
                  readonly
                >
                  <template #append>
                    <q-icon name="event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale" @before-show="syncDateTimeFields">
                        <div class="q-pa-sm column q-gutter-sm" style="width: 320px">
                          <q-date v-model="datePart" mask="YYYY-MM-DD" minimal />
                          <q-time v-model="timePart" format24h with-seconds />
                          <div class="row items-center justify-end q-gutter-sm">
                            <q-btn flat color="primary" label="重置为现在" @click="resetToNow" />
                            <q-btn unelevated color="primary" label="确定" v-close-popup @click="applyDateTime" />
                          </div>
                        </div>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="col-12 col-md-6">
                <!-- 占位保持两列布局平衡，可用于未来扩展，如收款渠道备注 -->
                <div class="placeholder-box"></div>
              </div>
            </div>

           <q-input
             v-model="form.remarks"
             type="textarea"
             filled
             autogrow
             standout="bg-white text-primary"
             :input-style="inputStyle"
             stack-label
             label="备注"
             placeholder="补充说明，至少 3 行以内"
           />

           <div class="q-mt-md flex flex-center">
             <q-btn
               unelevated
               color="primary"
               label="提交"
               :loading="submitting"
               type="submit"
               class="submit-btn"
             />
           </div>
         </q-form>
       </q-card-section>
     </q-card>

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
const inputStyle = { borderRadius: '12px' }
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
  max-width: 90%;
  margin: 0 auto;
}


.form-wrapper {
  width: 100%;
  max-width: 980px;
}

.shadow-card {
  border-radius: 14px;
  box-shadow: 0 10px 24px rgba(33, 118, 255, 0.12);
}

.submit-btn {
  min-width: 200px;
  border-radius: 12px;
}

.rounded-popup {
  border-radius: 12px;
}

.placeholder-box {
  min-height: 42px;
}
</style>
