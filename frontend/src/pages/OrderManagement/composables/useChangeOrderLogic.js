// src/pages/OrderManagement/composables/useChangeOrderLogic.js
import { ref, computed, watch, reactive } from 'vue'

export function useChangeOrderLogic(props, emit) {
  // --- 表单状态 ---
  const formData = reactive({
    room: null,        // 选中的房间对象 (包含 roomNumber, roomType 等)
    checkInDate: '',
    checkOutDate: '',
    roomPrice: 0,
    remarks: ''
  })

  // --- 初始化逻辑 ---
  // 监听 order 变化，当对话框打开（order 有值）时，回填表单
  watch(() => props.order, (newOrder) => {
    if (newOrder) {
      initForm(newOrder)
    }
  }, { immediate: true })

  function initForm(order) {
    formData.checkInDate = formatDate(order.checkInDate)
    formData.checkOutDate = formatDate(order.checkOutDate)
    formData.roomPrice = Number(order.roomPrice) || 0
    formData.remarks = order.remarks || ''

    // 尝试在 availableRooms 中找到当前房间，以便 q-select 正确显示
    // 如果 props.availableRooms 还没加载完，可能需要由组件层面的 watch 再次触发，
    // 或者简单处理：仅当 order 存在时设置初始值
    if (props.availableRooms && props.availableRooms.length) {
      const current = props.availableRooms.find(r => r.room_number === order.roomNumber)
      formData.room = current || null
    }
  }

  // 监听 availableRooms 变化，防止 props 更新滞后导致 room 回填失败
  watch(() => props.availableRooms, (rooms) => {
    if (props.order && rooms.length && !formData.room) {
       const current = rooms.find(r => r.room_number === props.order.roomNumber)
       if (current) formData.room = current
    }
  })

  // --- 验证逻辑 ---
  const isValid = computed(() => {
    return (
      !!formData.room &&
      !!formData.checkInDate &&
      !!formData.checkOutDate &&
      formData.roomPrice >= 0
    )
  })

  // --- 辅助函数 ---
  function formatDate(val) {
    if (!val) return ''
    return typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val
  }

  // --- 提交逻辑 ---
  function submit() {
    if (!isValid.value) return

    // 构造更新后的数据对象
    const updateData = {
      orderNumber: props.order.orderNumber,
      roomNumber: formData.room.room_number, // 假设房间对象字段为 room_number
      roomType: formData.room.room_type_id,  // 假设房间对象字段
      checkInDate: formData.checkInDate,
      checkOutDate: formData.checkOutDate,
      roomPrice: Number(formData.roomPrice),
      remarks: formData.remarks
    }

    emit('order-updated', updateData)
  }

  return {
    formData,
    isValid,
    submit,
    // 导出工具函数供模板使用（可选）
    formatDate
  }
}
