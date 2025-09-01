<template>
  <q-dialog v-model="localDialog" persistent>
    <q-card style="min-width: 500px; max-width: 95vw;">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">修改订单</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup @click="closeDialog" />
      </q-card-section>

      <q-separator class="q-mt-sm" />

      <q-form @submit="saveOrder" @reset="closeDialog" ref="orderForm">
        <q-card-section>
          <div class="row q-col-gutter-md">
            <!-- 基本信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-pb-sm text-weight-medium">基本信息</div>
            </div>

            <!-- 订单号 (只读) -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.orderNumber"
                label="订单号"
                filled
                readonly
                disable
              >
                <template v-slot:prepend>
                  <q-icon name="confirmation_number" />
                </template>
              </q-input>
            </div>

            <!-- 订单状态 (只读) -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="orderStatusText"
                label="订单状态"
                filled
                readonly
                disable
              >
                <template v-slot:prepend>
                  <q-icon name="flag" />
                </template>
              </q-input>
            </div>

            <!-- 客人信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-py-sm text-weight-medium">客人信息</div>
            </div>

            <!-- 客人姓名 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.guestName"
                label="客人姓名"
                filled
                :rules="[val => !!val || '请输入客人姓名']"
              >
                <template v-slot:prepend>
                  <q-icon name="person" />
                </template>
              </q-input>
            </div>

            <!-- 手机号 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.phone"
                label="手机号"
                filled
                :rules="[
                  val => !!val || '请输入手机号',
                  val => val.length === 11 || '手机号必须为11位'
                ]"
                mask="###########"
                unmasked-value
              >
                <template v-slot:prepend>
                  <q-icon name="phone" />
                </template>
              </q-input>
            </div>

            <!-- 身份证号 -->
            <div class="col-md-12 col-xs-12">
              <q-input
                v-model="localOrder.idNumber"
                label="身份证号"
                filled
                :rules="[
                  val => !!val || '请输入身份证号',
                  val => val.length === 18 || '身份证号必须为18位'
                ]"
              >
                <template v-slot:prepend>
                  <q-icon name="badge" />
                </template>
              </q-input>
            </div>

            <!-- 房间信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-py-sm text-weight-medium">房间信息</div>
            </div>

            <!-- 房型 -->
            <div class="col-md-6 col-xs-12">
              <q-select
                v-model="localOrder.roomType"
                :options="roomTypeOptions"
                label="房间类型"
                filled
                :rules="[val => !!val || '请选择房型']"
                :disable="isRoomChangeDisabled"
                emit-value
                map-options
              >
                <template v-slot:prepend>
                  <q-icon name="meeting_room" />
                </template>
                <template v-slot:append>
                  <q-tooltip v-if="isRoomChangeDisabled">
                    更改房型请使用专门的换房功能
                  </q-tooltip>
                </template>
              </q-select>
            </div>

            <!-- 房间号 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.roomNumber"
                label="房间号"
                filled
                :rules="[val => !!val || '请输入房间号']"
                :disable="isRoomChangeDisabled"
              >
                <template v-slot:prepend>
                  <q-icon name="hotel" />
                </template>
                <template v-slot:append>
                  <q-tooltip v-if="isRoomChangeDisabled">
                    更改房间号请使用专门的换房功能
                  </q-tooltip>
                </template>
              </q-input>
            </div>

            <!-- 入住日期 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.checkInDate"
                label="入住日期"
                filled
                :rules="[val => !!val || '请选择入住日期']"
                :disable="isDateChangeDisabled"
              >
                <template v-slot:prepend>
                  <q-icon name="event" />
                </template>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="localOrder.checkInDate"
                        mask="YYYY-MM-DD"
                        :disable="isDateChangeDisabled"
                        :options="dateOptions"
                      >
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="关闭" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- 退房日期 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.checkOutDate"
                label="退房日期"
                filled
                :rules="[
                  val => !!val || '请选择退房日期',
                  val => new Date(val) > new Date(localOrder.checkInDate) || '退房日期必须晚于入住日期'
                ]"
                :disable="isDateChangeDisabled"
              >
                <template v-slot:prepend>
                  <q-icon name="event" />
                </template>
                <template v-slot:append>
                  <q-icon name="event" class="cursor-pointer">
                    <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="localOrder.checkOutDate"
                        mask="YYYY-MM-DD"
                        :disable="isDateChangeDisabled"
                        :options="date => new Date(date) > new Date(localOrder.checkInDate)"
                      >
                        <div class="row items-center justify-end">
                          <q-btn v-close-popup label="关闭" color="primary" flat />
                        </div>
                      </q-date>
                    </q-popup-proxy>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- 价格信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-py-sm text-weight-medium">价格信息</div>
            </div>

            <!-- 房价 -->
            <div class="col-md-6 col-xs-12">
              <!-- 处理房价为对象的情况（多日订单） -->
              <template v-if="typeof localOrder.roomPrice === 'object' && localOrder.roomPrice !== null">
                <q-input
                  v-model="roomPriceDisplay"
                  label="房间价格（多日价格）"
                  filled
                  readonly
                  :rules="[val => true]"
                >
                  <template v-slot:prepend>
                    <q-icon name="paid" />
                  </template>
                  <template v-slot:after>
                    <q-btn
                      flat
                      round
                      color="primary"
                      icon="edit"
                      @click="showPriceEditDialog = true"
                    />
                  </template>
                </q-input>

                <!-- 多日房价编辑对话框 -->
                <q-dialog v-model="showPriceEditDialog">
                  <q-card style="min-width: 350px">
                    <q-card-section>
                      <div class="text-h6">编辑每日房价</div>
                    </q-card-section>
                    <q-card-section>
                      <div v-for="(price, date) in localOrder.roomPrice" :key="date" class="q-mb-sm">
                        <q-input
                          v-model.number="localOrder.roomPrice[date]"
                          :label="`${date} 的房价`"
                          filled
                          type="number"
                          :rules="[
                            val => val !== null && val !== undefined || '请输入房价',
                            val => val > 0 || '房价必须大于0'
                          ]"
                        >
                          <template v-slot:before>
                            <div class="text-subtitle2">￥</div>
                          </template>
                        </q-input>
                      </div>
                    </q-card-section>
                    <q-card-actions align="right">
                      <q-btn flat label="确定" color="primary" v-close-popup />
                    </q-card-actions>
                  </q-card>
                </q-dialog>
              </template>

              <!-- 处理房价为数字的情况（单日订单） -->
              <template v-else>
                <q-input
                  v-model.number="localOrder.roomPrice"
                  label="房间价格"
                  filled
                  type="number"
                  :rules="[
                    val => val !== null && val !== undefined || '请输入房价',
                    val => val > 0 || '房价必须大于0'
                  ]"
                >
                  <template v-slot:prepend>
                    <q-icon name="paid" />
                  </template>
                  <template v-slot:before>
                    <div class="text-subtitle2">￥</div>
                  </template>
                </q-input>
              </template>
            </div>

            <!-- 押金 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model.number="localOrder.deposit"
                label="押金"
                filled
                type="number"
                :rules="[val => val >= 0 || '押金不能为负数']"
              >
                <template v-slot:prepend>
                  <q-icon name="account_balance_wallet" />
                </template>
                <template v-slot:before>
                  <div class="text-subtitle2">￥</div>
                </template>
              </q-input>
            </div>

            <!-- 支付方式 -->
            <div class="col-md-6 col-xs-12">
              <q-select
                v-model="localOrder.paymentMethod"
                :options="paymentMethodOptions"
                label="支付方式"
                filled
                emit-value
                map-options
              >
                <template v-slot:prepend>
                  <q-icon name="payments" />
                </template>
              </q-select>
            </div>

            <!-- 来源信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-py-sm text-weight-medium">来源信息</div>
            </div>

            <!-- 订单来源 -->
            <div class="col-md-6 col-xs-12">
              <q-select
                v-model="localOrder.source"
                :options="orderSourceOptions"
                label="订单来源"
                filled
                emit-value
                map-options
              >
                <template v-slot:prepend>
                  <q-icon name="source" />
                </template>
              </q-select>
            </div>

            <!-- 来源编号 -->
            <div class="col-md-6 col-xs-12">
              <q-input
                v-model="localOrder.sourceNumber"
                label="来源编号"
                filled
              >
                <template v-slot:prepend>
                  <q-icon name="tag" />
                </template>
              </q-input>
            </div>

            <!-- 其他信息 -->
            <div class="col-12">
              <div class="text-subtitle1 q-py-sm text-weight-medium">其他信息</div>
            </div>

            <!-- 备注 -->
            <div class="col-12">
              <q-input
                v-model="localOrder.remarks"
                label="备注"
                type="textarea"
                filled
                autogrow
                rows="3"
              >
                <template v-slot:prepend>
                  <q-icon name="note" />
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            label="取消"
            color="grey-7"
            flat
            v-close-popup
            @click="closeDialog"
          />
          <q-btn
            label="保存"
            color="primary"
            type="submit"
            :loading="saving"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const orderForm = ref(null)

const props = defineProps({
  modelValue: Boolean, // 父组件传来的状态
  order: Object
})

const emit = defineEmits(['update:modelValue', 'change-order'])

const localDialog = ref(props.modelValue)
const localOrder = reactive({ ...props.order })
const originalOrder = ref({ ...props.order }) // 保存原始订单信息用于检测变更
const saving = ref(false)
const showPriceEditDialog = ref(false) // 控制房价编辑对话框的显示

// 计算属性：多日房价的显示文本
const roomPriceDisplay = computed(() => {
  if (typeof localOrder.roomPrice === 'object' && localOrder.roomPrice !== null) {
    // 计算平均房价
    const prices = Object.values(localOrder.roomPrice)
    const totalPrice = prices.reduce((sum, price) => sum + Number(price), 0)
    const avgPrice = prices.length > 0 ? (totalPrice / prices.length).toFixed(2) : '0'

    return `多日房价 (平均: ¥${avgPrice})`
  }
  return localOrder.roomPrice || ''
})

// 判断是否禁用房间号修改 (已入住或已退房的订单不应直接修改房间号)
const isRoomChangeDisabled = computed(() => {
  const status = props.order?.status
  return status === 'checked-in' || status === 'checked-out'
})

// 判断是否禁用日期修改
const isDateChangeDisabled = computed(() => {
  const status = props.order?.status
  return status === 'checked-in' || status === 'checked-out'
})

// 日期选择器选项 - 不允许选择过去的日期
const dateOptions = date => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(date) >= today
}

// 订单状态文本
const orderStatusText = computed(() => {
  const statusMap = {
    'pending': '待入住',
    'checked-in': '已入住',
    'checked-out': '已退房',
    'cancelled': '已取消'
  }
  return statusMap[props.order?.status] || props.order?.status || '-'
})

// 房型选项
const roomTypeOptions = [
  { label: '标准间', value: '标准间' },
  { label: '大床房', value: '大床房' },
  { label: '豪华套房', value: '豪华套房' },
  { label: '家庭套房', value: '家庭套房' },
  { label: '商务套房', value: '商务套房' }
]

// 支付方式选项
const paymentMethodOptions = [
  { label: '现金', value: 'cash' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '银行卡', value: 'card' },
  { label: '其他', value: 'other' }
]

// 订单来源选项
const orderSourceOptions = [
  { label: '前台录入', value: 'front_desk' },
  { label: '电话预订', value: 'phone' },
  { label: '线上平台', value: 'online' },
  { label: '美团', value: 'meituan' },
  { label: '携程', value: 'ctrip' },
  { label: '飞猪', value: 'fliggy' },
  { label: '其他', value: 'other' }
]

// 监听对话框状态
watch(
  () => props.modelValue,
  (newValue) => {
    localDialog.value = newValue

    // 当对话框打开时，重新初始化表单
    if (newValue && props.order) {
      resetForm()
    }
  }
)

// 监听订单数据变化
watch(
  () => props.order,
  (newValue) => {
    if (newValue) {
      // 深拷贝订单数据，确保不会直接修改原始对象
      Object.assign(localOrder, JSON.parse(JSON.stringify(newValue)))
      originalOrder.value = JSON.parse(JSON.stringify(newValue))
    }
  },
  { deep: true }
)

// 重置表单到原始状态
function resetForm() {
  if (props.order) {
    Object.assign(localOrder, JSON.parse(JSON.stringify(props.order)))
  }

  if (orderForm.value) {
    orderForm.value.resetValidation()
  }
}

// 关闭对话框
function closeDialog() {
  // 检查是否有未保存的更改
  const hasChanges = checkForChanges()

  if (hasChanges) {
    // 确认是否放弃更改
    $q.dialog({
      title: '确认取消',
      message: '您有未保存的更改，确定要放弃吗？',
      cancel: true,
      persistent: true
    }).onOk(() => {
      // 用户确认放弃更改
      localDialog.value = false
      emit('update:modelValue', false)
    }).onCancel(() => {
      // 用户取消操作，保持对话框打开
    })
  } else {
    // 没有更改，直接关闭
    localDialog.value = false
    emit('update:modelValue', false)
  }
}

// 检查是否有未保存的更改
function checkForChanges() {
  const original = originalOrder.value

  // 比较所有可编辑字段是否有变化
  return (
    // 客人信息
    localOrder.guestName !== original.guestName ||
    localOrder.phone !== original.phone ||
    localOrder.idNumber !== original.idNumber ||

    // 房间信息（如果不禁用的话）
    (!isRoomChangeDisabled.value && (
      localOrder.roomType !== original.roomType ||
      localOrder.roomNumber !== original.roomNumber
    )) ||

    // 日期信息（如果不禁用的话）
    (!isDateChangeDisabled.value && (
      localOrder.checkInDate !== original.checkInDate ||
      localOrder.checkOutDate !== original.checkOutDate
    )) ||

    // 价格信息
    JSON.stringify(localOrder.roomPrice) !== JSON.stringify(original.roomPrice) ||
    String(localOrder.deposit) !== String(original.deposit) ||
    localOrder.paymentMethod !== original.paymentMethod ||

    // 来源信息
    localOrder.source !== original.source ||
    localOrder.sourceNumber !== original.sourceNumber ||

    // 其他信息
    localOrder.remarks !== original.remarks
  )
}

// 保存订单
async function saveOrder() {
  // 验证表单
  if (orderForm.value) {
    const isValid = await orderForm.value.validate()
    if (!isValid) {
      return
    }
  }

  // 检查是否有实际更改
  if (!checkForChanges()) {
    $q.notify({
      type: 'info',
      message: '未检测到任何更改',
      position: 'top'
    })
    closeDialog()
    return
  }

  // 显示保存状态
  saving.value = true

  try {
    // 使用解构创建一个新对象，避免响应式对象传递问题
    emit('change-order', { ...localOrder })

    // 成功通知会在父组件处理
    localDialog.value = false
    emit('update:modelValue', false)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: '保存失败，请重试',
      position: 'top'
    })
    console.error('保存订单失败:', error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
/* 添加一些样式美化 */
.q-card {
  border-radius: 8px;
}

.q-card-section {
  padding: 20px;
}

/* 表单输入样式 */
:deep(.q-field__control) {
  border-radius: 4px;
  background-color: #f5f5f5;
}

:deep(.q-field--filled.q-field--focused .q-field__control) {
  background-color: #eaf5fe;
}

.text-h6 {
  font-weight: 500;
  color: #3a3a3a;
}
</style>
