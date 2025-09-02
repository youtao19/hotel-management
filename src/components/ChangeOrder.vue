<template>
  <q-dialog v-model="localDialog" @hide="onDialogHide">
    <q-card style="min-width: 400px">
      <q-card-section>
        <div class="text-h6">修改订单</div>
      </q-card-section>

      <q-card-section>
        <q-input v-model="localOrder.guestName" label="客人姓名" />
        <q-input v-model="localOrder.phone" label="手机号" />
        <q-input v-model="localOrder.roomNumber" label="房间号" />
        <q-input v-model="localOrder.remarks" label="备注" type="textarea" />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="取消" color="primary" @click="closeDialog" />
        <q-btn flat label="保存" color="secondary" @click="saveOrder" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'

const props = defineProps({
  modelValue: Boolean, // 父组件传来的状态
  order: Object
})

const emit = defineEmits(['update:modelValue', 'change-order'])

const localDialog = ref(props.modelValue)
const localOrder = reactive({}) // 初始化为空对象

// 监听弹窗显示状态
watch(
  () => props.modelValue,
  (newValue) => {
    localDialog.value = newValue

    // 当对话框打开时，重新复制订单数据
    if (newValue && props.order) {
      copyOrderData(props.order)
    }
  }
)

// 监听订单数据变化，确保深拷贝并保留数据类型
watch(
  () => props.order,
  (newValue) => {
    if (newValue && localDialog.value) {
      copyOrderData(newValue)
    }
  },
  { immediate: true }
)

// 将订单数据复制到本地对象的函数
function copyOrderData(order) {
  // 先清空对象，然后复制所有属性，保持引用不变
  Object.keys(localOrder).forEach(key => delete localOrder[key])

  // 深度复制所有属性，特别处理特殊类型
  Object.keys(order).forEach(key => {
    if (key === 'roomPrice' && typeof order[key] === 'object') {
      // 确保房价对象是深拷贝
      localOrder[key] = JSON.parse(JSON.stringify(order[key]))
    } else {
      localOrder[key] = order[key]
    }
  })
}

// 监听本地对话框关闭
watch(
  () => localDialog.value,
  (newValue) => {
    if (!newValue) {
      emit('update:modelValue', false)
    }
  }
)

// 对话框隐藏时触发
function onDialogHide() {
  emit('update:modelValue', false)
}

function closeDialog() {
  localDialog.value = false
}

function saveOrder() {
  // 创建一个新对象以避免引用问题，确保特殊类型字段保持原样
  const updatedOrder = {}
  Object.keys(localOrder).forEach(key => {
    if (key === 'roomPrice' && typeof localOrder[key] === 'object') {
      updatedOrder[key] = JSON.parse(JSON.stringify(localOrder[key]))
    } else {
      updatedOrder[key] = localOrder[key]
    }
  })

  emit('change-order', updatedOrder)
  closeDialog()
}
</script>
