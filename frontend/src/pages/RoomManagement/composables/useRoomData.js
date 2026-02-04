import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { roomApi } from 'src/api'
import { useRoomStore } from 'src/stores/roomStore'

export function useRoomData() {
  const $q = useQuasar()
  const roomStore = useRoomStore()

  const rooms = ref([])
  const loading = ref(false)
  const showRoomDialog = ref(false)
  const currentRoom = ref(null) // 编辑时的当前房间对象

  // 获取列表
  const fetchRooms = async () => {
    loading.value = true
    try {
      const res = await roomApi.getAllRooms()
      rooms.value = res.data || []
    } catch (e) {
      console.error(e)
      $q.notify({ type: 'negative', message: '获取房间列表失败' })
    } finally {
      loading.value = false
    }
  }

  // 打开添加/编辑弹窗
  const openRoomDialog = (room = null) => {
    currentRoom.value = room
    showRoomDialog.value = true
  }

  // 提交保存（添加或更新）
  const handleSaveRoom = async (formData) => {
    try {
      // 仅提交后端允许的字段，避免额外字段触发校验失败
      const payload = {
        room_number: formData.room_number,
        type_code: formData.type_code,
        status: formData.status,
        price: Number(formData.price)
      }

      if (currentRoom.value) {
        // 编辑模式
        await roomApi.updateRoom(payload.room_number, payload)
        $q.notify({ type: 'positive', message: '房间更新成功' })
      } else {
        // 添加模式
        await roomApi.addRoom(payload)
        $q.notify({ type: 'positive', message: '房间添加成功' })
      }
      showRoomDialog.value = false
      await fetchRooms()
      await roomStore.refreshData() // 同步全局 Store
    } catch (error) {
      console.error(error)
      const msg = error.response?.data?.message || (currentRoom.value ? '更新失败' : '添加失败')
      $q.notify({ type: 'negative', message: msg })
    }
  }

  // 设为维修
  const handleSetMaintenance = async (room) => {
    try {
      await roomStore.updateRoomStatus(room.room_number, 'repair')
      $q.notify({ type: 'positive', message: `房间${room.room_number}已设为维修状态` })
      await fetchRooms()
    } catch (e) {
      console.error(e)
      $q.notify({ type: 'negative', message: '设置维修状态失败' })
    }
  }

  // 删除房间
  const handleDeleteRoom = (room) => {
    $q.dialog({
      title: '删除房间确认',
      message: `您即将删除房间 "${room.room_number}"`,
      html: true,
      cancel: { label: '取消', color: 'grey-7', flat: true },
      ok: { label: '确认删除', color: 'negative', icon: 'delete' },
      persistent: true,
      class: 'custom-delete-dialog'
    }).onOk(async () => {
      try {
        await roomApi.deleteRoom(room.room_number)
        $q.notify({ type: 'positive', message: '房间删除成功' })
        await fetchRooms()
        await roomStore.refreshData()
      } catch (error) {
        console.error(error)
        $q.notify({ type: 'negative', message: error.response?.data?.message || '删除失败' })
      }
    })
  }

  return {
    rooms,
    loading,
    showRoomDialog,
    currentRoom,
    fetchRooms,
    openRoomDialog,
    handleSaveRoom,
    handleSetMaintenance,
    handleDeleteRoom
  }
}
