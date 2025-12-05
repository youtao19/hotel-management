import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { roomApi } from 'src/api'
import { useRoomStore } from 'src/stores/roomStore'
import { useViewStore } from 'src/stores/viewStore'

export function useChangeRoom(refreshAllData, formatDate) {
  const $q = useQuasar()
  const roomStore = useRoomStore()
  const viewStore = useViewStore()

  const showChangeRoomDialog = ref(false)
  const availableRoomOptions = ref([])
  const targetOrder = ref(null) // 保存当前操作的订单引用

  // 打开弹窗
  async function openChangeRoomDialog(order) {
    if (!order) return
    targetOrder.value = order // 保存引用

    try {
      const rawCheckInDate = order.checkInDate
      const rawCheckOutDate = order.checkOutDate
      const roomType = order.roomType

      const startDate = formatDate(rawCheckInDate)
      const endDate = formatDate(rawCheckOutDate)

      if (!startDate || !endDate || !roomType) {
        $q.notify({ type: 'negative', message: '无法获取订单的日期或房型信息', position: 'top' })
        return
      }

      const rooms = await roomStore.getAvailableRoomsByDate(startDate, endDate, roomType)

      availableRoomOptions.value = rooms
        .filter(room => room.room_number !== order.roomNumber)
        .map(room => ({
          label: `${room.room_number} - ${viewStore.getRoomTypeName(room.type_code)} (${room.price}元)`,
          value: room.room_number,
          type: room.type_code,
          price: room.price
        }))

      showChangeRoomDialog.value = true
    } catch (error) {
      console.error('获取可用房间失败:', error)
      $q.notify({ type: 'negative', message: '获取可用房间列表失败: ' + (error.message || '未知错误'), position: 'top' })
    }
  }

  // 提交换房
  async function changeRoom(newRoomNumber) {
    if (!targetOrder.value || !newRoomNumber) {
      $q.notify({ type: 'negative', message: '参数错误，无法更换房间', position: 'top' })
      return
    }

    try {
      const requestData = {
        orderNumber: targetOrder.value.orderNumber,
        oldRoomNumber: targetOrder.value.roomNumber,
        newRoomNumber: newRoomNumber
      }

      const response = await roomApi.changePendingRoom(requestData)

      if (response.success) {
        // 更新本地对象引用，让 UI 即时变化
        targetOrder.value.roomNumber = newRoomNumber
        if (response.newRoom) {
          targetOrder.value.roomType = response.newRoom.type_code
          targetOrder.value.roomPrice = response.newRoom.price
        }

        await refreshAllData() // 刷新全局数据
        $q.notify({ type: 'positive', message: '房间更换成功', position: 'top' })
        showChangeRoomDialog.value = false
      } else {
        $q.notify({ type: 'negative', message: response.message || '更换房间失败', position: 'top' })
      }
    } catch (error) {
      let errorMessage = '更换房间失败'
      // 错误码映射
      if (error.response?.data) {
        const data = error.response.data
        const code = data.code
        const codeMap = {
          MISSING_PARAMS: '参数缺失，请刷新后重试',
          SAME_ROOM: '新房间与当前房间相同，无需更换',
          ORDER_STATUS_INVALID: '订单状态不允许更换房间',
          NEW_ROOM_NOT_FOUND: '目标房间不存在',
          NEW_ROOM_CLOSED: '目标房间已关闭',
          NEW_ROOM_REPAIR: '目标房间正在维修中',
          NEW_ROOM_NOT_AVAILABLE: '目标房间当前不可用',
          NEW_ROOM_CONFLICT: '目标房间在该日期范围内已有冲突订单',
          ROOM_TYPE_MISMATCH: '目标房间的房型与订单房型不一致',
          ROOM_CHANGE_VALIDATION: '请求参数校验失败',
          ROOM_CHANGE_SERVER: '服务器内部错误'
        }
        if (code && codeMap[code]) errorMessage = codeMap[code]
        else errorMessage = data.message || errorMessage
      } else {
        errorMessage = error.message || errorMessage
      }
      $q.notify({ type: 'negative', message: errorMessage, position: 'top', multiLine: true })
    }
  }

  return {
    showChangeRoomDialog,
    availableRoomOptions,
    openChangeRoomDialog,
    changeRoom
  }
}
