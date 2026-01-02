import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar, date } from 'quasar'
import { orderApi } from 'src/api' // 假设路径
import { useRoomStore } from 'src/stores/roomStore'

export function useOrderSubmit(orderData, dailyPrices, dateList, totalPrice) {
  const router = useRouter()
  const $q = useQuasar()
  const roomStore = useRoomStore()

  const showCheckInDialog = ref(false)
  const pendingCheckInOrder = ref(null)

  function validate() {
    if (!orderData.value.roomNumber) {
      $q.notify({ type: 'negative', message: '请选择房间' })
      return false
    }
    const missingPrices = dateList.value.filter(d => !dailyPrices.value[d] || dailyPrices.value[d] <= 0)
    if (missingPrices.length > 0) {
      $q.notify({ type: 'negative', message: '请设置所有日期的价格' })
      return false
    }
    if (orderData.value.isPrepaid) {
      if (orderData.value.prepaidAmount <= 0) {
         $q.notify({ type: 'negative', message: '请输入预收金额' })
         return false
      }
      if (orderData.value.prepaidAmount > totalPrice.value) {
         $q.notify({ type: 'negative', message: '预收金额不能超过总价' })
         return false
      }
    }
    return true
  }

  async function submitOrder() {
    if (!validate()) return

    const submitData = {
      ...orderData.value,
      roomPrice: dailyPrices.value
    }

    if (orderData.value.status === 'checked-in') {
       $q.dialog({
        title: '确认立即入住',
        message: '将立即办理入住，是否继续？',
        cancel: true,
        persistent: true
      }).onOk(() => {
        pendingCheckInOrder.value = submitData
        showCheckInDialog.value = true
      })
      return
    }

    try {
      await orderApi.addOrder(submitData)
      $q.notify({ type: 'positive', message: '订单创建成功！' })
      await roomStore.refreshData()
      router.push('/ViewOrders')
    } catch (error) {
      console.error(error)
      $q.notify({ type: 'negative', message: error.message || '创建失败' })
    }
  }

  async function handleCheckInConfirm(orderWithDeposit) {
    try {
        // ... (原有的快速入住 payload 组装逻辑)
        const payload = {
            ...orderWithDeposit,
            // 确保格式正确，此处简化展示，请保留原有详细字段映射
            status: 'checked-in'
        }
        await orderApi.fastCheckIn(payload)
        $q.notify({ type: 'positive', message: '快速入住成功' })
        await roomStore.refreshData()
        showCheckInDialog.value = false
        router.push('/ViewOrders')
    } catch (error) {
        $q.notify({ type: 'negative', message: error.message || '入住失败' })
    }
  }

  return {
    submitOrder,
    handleCheckInConfirm,
    showCheckInDialog,
    pendingCheckInOrder
  }
}
