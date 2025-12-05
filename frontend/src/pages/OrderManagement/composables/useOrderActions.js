// src/pages/OrderManagement/composables/useOrderActions.js
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { orderApi } from 'src/api'

export function useOrderActions(orderStore, roomStore, fetchAllOrders) {
  const $q = useQuasar()
  const loading = ref(false)

  // 取消订单
  const handleCancelOrder = async (order) => {
    if (!order?.orderNumber) return

    $q.dialog({
      title: '确认取消',
      message: `确定要取消订单 ${order.orderNumber} 吗？`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      loading.value = true
      try {
        const res = await orderStore.updateOrderStatusViaApi(order.orderNumber, 'cancelled')
        if (res) {
          $q.notify({ type: 'positive', message: '订单已取消' })
          await fetchAllOrders() // 刷新列表
        } else {
          throw new Error('API未返回更新数据')
        }
      } catch (error) {
        $q.notify({ type: 'negative', message: `取消失败: ${error.message}` })
      } finally {
        loading.value = false
      }
    })
  }

  // 办理退房
  const handleCheckoutOrder = async (order) => {
    if (!order?.orderNumber) return

    $q.dialog({
      title: '确认退房',
      message: `确定要为订单 ${order.orderNumber} (房间: ${order.roomNumber}) 办理退房吗？\n退房后房间将变为清洁中。`,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      loading.value = true
      try {
        const res = await orderApi.checkOut(order.orderNumber)
        if (res.success) {
          $q.notify({ type: 'positive', message: '退房成功' })
          await fetchAllOrders()
        } else {
          throw new Error(res.message)
        }
      } catch (error) {
        $q.notify({ type: 'negative', message: `退房失败: ${error.message}` })
      } finally {
        loading.value = false
      }
    })
  }

  // 其他复杂逻辑如 CheckIn, Refund 依然需要 Dialog 配合
  // 这里主要处理不需要复杂 UI 交互的直接操作，或者作为 Dialog 的回调逻辑

  return {
    loading,
    handleCancelOrder,
    handleCheckoutOrder
  }
}
