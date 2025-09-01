<template>
  <q-dialog v-model="localDialog" persistent>
    <q-card style="min-width: 720px; max-width: 90vw;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">修改订单</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup @click="closeDialog" />
      </q-card-section>

      <q-card-section>
        <q-form ref="formRef" @submit.prevent="onSubmit">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-6">
              <q-input v-model.trim="form.guestName" label="客人姓名" filled :rules="[v => !!v || '请输入客人姓名']" />
            </div>
            <div class="col-12 col-md-6">
              <q-input v-model.trim="form.phone" label="手机号" filled :rules="[v => /^1[3-9]\d{9}$/.test(v) || '手机号格式不正确']" />
            </div>

            <div class="col-12 col-md-6">
              <q-input v-model.trim="form.idNumber" label="证件号码" filled />
            </div>
            <div class="col-12 col-md-6">
              <q-select v-model="form.status" :options="statusOptions" label="订单状态" emit-value map-options filled :rules="[v => !!v || '请选择订单状态']"/>
            </div>

            <div class="col-12 col-md-6">
              <q-select v-model="form.roomType" :options="roomTypeOptions" label="房型" emit-value map-options filled :rules="[v => !!v || '请选择房型']"/>
            </div>
            <div class="col-8 col-md-4">
              <q-input v-model.trim="form.roomNumber" label="房间号" filled :rules="[v => !!v || '请输入房间号']" />
            </div>
            <div class="col-4 col-md-2 flex items-center">
              <q-btn class="q-mt-md" color="primary" outline dense label="选择空房" @click="emit('pick-room')" />
            </div>

            <div class="col-12 col-md-6">
              <q-input filled v-model="form.checkInDate" label="入住日期" readonly :rules="[v => !!v || '请选择入住日期']">
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.checkInDate" mask="YYYY-MM-DD" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="col-12 col-md-6">
              <q-input filled v-model="form.checkOutDate" label="退房日期" readonly :rules="[v => !!v || '请选择退房日期']">
                <template #append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy transition-show="scale" transition-hide="scale">
                      <q-date v-model="form.checkOutDate" mask="YYYY-MM-DD" />
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <div class="col-12 col-md-6">
              <q-select v-model="form.paymentMethod" :options="paymentOptions" label="支付方式" emit-value map-options filled />
            </div>

            <!-- 房价编辑（去除 JSON，提供直观的“单价/按日设置”） -->
            <div class="col-12">
              <div v-if="nightsCount <= 1">
                <q-input
                  v-model.number="form.roomPrice"
                  type="number"
                  label="当日房价(¥)"
                  filled
                  :rules="[v => v>0 || '请输入大于0的价格']"
                />
              </div>
              <div v-else>
                <q-banner v-if="todayPrice != null" dense class="bg-grey-2 q-pa-sm q-mb-sm">
                  入住当日房价：¥{{ todayPrice }}
                </q-banner>
                <div class="row items-center q-col-gutter-sm q-mb-sm">
                  <div class="col-12 col-md-4">
                    <q-input v-model.number="uniformPrice" type="number" label="统一价格(可选)" dense filled/>
                  </div>
                  <div class="col-12 col-md-auto">
                    <q-btn color="primary" outline label="应用到全部日期" @click="applyUniformPrice" :disable="!uniformPrice || uniformPrice<=0"/>
                  </div>
                </div>
                <q-markup-table flat bordered class="q-mt-sm">
                  <thead>
                    <tr>
                      <th class="text-left" style="width: 180px;">日期</th>
                      <th class="text-left">当日房价(¥)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="d in stayDates" :key="d">
                      <td class="text-left">{{ d }}</td>
                      <td>
                        <q-input
                          dense
                          filled
                          type="number"
                          v-model.number="perDayPrices[d]"
                          :rules="[v => v>0 || '请输入大于0的价格']"
                          :placeholder="uniformPrice ? `建议价：${uniformPrice}` : '请输入价格'"
                        />
                      </td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </div>
            </div>

            <div class="col-12 col-md-6">
              <q-input v-model.number="form.deposit" type="number" label="押金(¥)" filled :rules="[v => (v===0 || !!v) && v>=0 || '押金不能为负']"/>
            </div>

            <div class="col-12">
              <q-input v-model="form.remarks" label="备注" type="textarea" autogrow filled />
            </div>
          </div>
        </q-form>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" @click="closeDialog" />
        <q-btn unelevated label="保存" color="secondary" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'

const props = defineProps({
  modelValue: Boolean, // 父组件传来的状态
  order: Object,
  roomTypeOptions: { type: Array, default: () => [] },
  statusOptions: { type: Array, default: () => [
    { label: '待入住', value: 'pending' },
    { label: '已入住', value: 'checked-in' },
    { label: '已退房', value: 'checked-out' },
    { label: '已取消', value: 'cancelled' },
  ]},
  paymentOptions: { type: Array, default: () => [
    { label: '现金', value: 'cash' },
    { label: '微信', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: '银行卡', value: 'card' },
  ]}
})

const emit = defineEmits(['update:modelValue', 'change-order', 'pick-room'])

const localDialog = ref(props.modelValue)
const formRef = ref(null)

// 将传入订单映射为表单模型（驼峰属性）
const toForm = (o) => {
  const src = (o && typeof o === 'object') ? o : {}
  return {
    orderNumber: src.orderNumber || src.order_id || '',
    guestName: src.guestName || src.guest_name || '',
    phone: src.phone || '',
    idNumber: src.idNumber || src.id_number || '',
    roomType: src.roomType || src.room_type || '',
    roomNumber: src.roomNumber || src.room_number || '',
    checkInDate: src.checkInDate || src.check_in_date || '',
    checkOutDate: src.checkOutDate || src.check_out_date || '',
    status: src.status || 'pending',
    paymentMethod: src.paymentMethod || src.payment_method || 'cash',
    roomPrice: typeof src.roomPrice === 'number' ? src.roomPrice : (typeof src.room_price === 'number' ? src.room_price : 0),
    roomPriceMap: typeof src.roomPrice === 'object' ? src.roomPrice : (typeof src.room_price === 'object' ? src.room_price : {}),
    deposit: Number(src.deposit || 0),
    remarks: src.remarks || ''
  }
}

const form = reactive(toForm(props.order))

// 按日价格编辑所需状态
const perDayPrices = reactive({})
const uniformPrice = ref(null)

// 计算入住晚数与日期清单（入住至退房前一晚；休息房/单晚按1处理）
const nightsCount = computed(() => {
  const ci = form.checkInDate ? new Date(form.checkInDate) : null
  const co = form.checkOutDate ? new Date(form.checkOutDate) : null
  if (!ci || !co || isNaN(ci) || isNaN(co)) return 0
  const diff = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(diff, 1)
})

const stayDates = computed(() => {
  const out = []
  const ci = form.checkInDate ? new Date(form.checkInDate) : null
  const co = form.checkOutDate ? new Date(form.checkOutDate) : null
  if (!ci || !co || isNaN(ci) || isNaN(co)) return out
  const days = Math.ceil((co.getTime() - ci.getTime()) / (1000 * 60 * 60 * 24))
  // 0 表示休息房；至少返回入住当日
  const total = Math.max(days, 1)
  for (let i = 0; i < total; i++) {
    const d = new Date(ci)
    d.setDate(d.getDate() + i)
    out.push(d.toISOString().split('T')[0])
  }
  return out
})

// 首次初始化每日价格
resetPerDayPricesFromForm()
syncPerDayPriceKeys()

// 入住当日房价（首日）
const todayPrice = computed(() => {
  const first = stayDates.value[0]
  if (!first) return null
  if (nightsCount.value <= 1) {
    const v = Number(form.roomPrice)
    if (v > 0) return v
    const pv = perDayPrices[first]
    return pv != null && Number(pv) > 0 ? Number(pv) : null
  }
  const v = perDayPrices[first]
  return v != null && Number(v) > 0 ? Number(v) : null
})

watch(() => props.modelValue, v => { localDialog.value = v })
watch(() => props.order, (v) => {
  const next = toForm(v)
  Object.assign(form, next)
  // 初始化每日价格
  resetPerDayPricesFromForm()
})

// 在入住/退房日期变化时，同步 perDayPrices 的键集合，保留已有价格
watch(() => [form.checkInDate, form.checkOutDate], () => {
  syncPerDayPriceKeys()
})

function closeDialog() {
  localDialog.value = false
  emit('update:modelValue', false)
}

function resetPerDayPricesFromForm() {
  // 先清空
  for (const k in perDayPrices) delete perDayPrices[k]
  // 如果已有按日价格，直接带入
  const map = form.roomPriceMap || {}
  const keys = Object.keys(map)
  if (keys.length > 0) {
    // 仅为当前日期范围内的键赋值
    for (const d of stayDates.value) {
      if (map[d] != null) perDayPrices[d] = Number(map[d])
    }
    // 单晚：将首日价格回填到输入框
    if (nightsCount.value <= 1 && stayDates.value.length) {
      const first = stayDates.value[0]
      if (perDayPrices[first] != null) form.roomPrice = Number(perDayPrices[first])
    }
  } else if (form.roomPrice && form.checkInDate) {
    // 单价 -> 仅入住日
    perDayPrices[form.checkInDate] = Number(form.roomPrice)
  }
}

function syncPerDayPriceKeys() {
  const keep = { ...perDayPrices }
  // 清空并仅保留当前日期范围，尽量复用已有值
  for (const k in perDayPrices) delete perDayPrices[k]
  for (const d of stayDates.value) {
    perDayPrices[d] = keep[d] != null ? keep[d] : (uniformPrice.value || null)
  }
}

function applyUniformPrice() {
  if (!uniformPrice.value || uniformPrice.value <= 0) return
  for (const d of stayDates.value) perDayPrices[d] = Number(uniformPrice.value)
}

function buildPatchPayload() {
  const payload = {
    guestName: form.guestName,
    phone: form.phone,
    idNumber: form.idNumber,
    roomType: form.roomType,
    roomNumber: form.roomNumber,
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    status: form.status,
    paymentMethod: form.paymentMethod,
    deposit: form.deposit,
    remarks: form.remarks,
  }
  // 多晚：按日价格对象；单晚/休息：用单价
  if (nightsCount.value > 1) {
    const obj = {}
    for (const d of stayDates.value) obj[d] = Number(perDayPrices[d])
    payload.roomPrice = obj
  } else {
    payload.roomPrice = Number(form.roomPrice)
  }
  return payload
}

async function onSubmit() {
  const ok = await formRef.value?.validate()
  if (!ok) return
  // 额外校验：多晚时，确保每个日期都有有效价格
  if (nightsCount.value > 1) {
    for (const d of stayDates.value) {
      const v = Number(perDayPrices[d])
      if (!(v > 0)) return // 子输入会显示校验错误
    }
  }
  const patch = buildPatchPayload()
  emit('change-order', patch)
  closeDialog()
}
</script>

<style scoped>
</style>
