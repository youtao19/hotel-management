import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { roomApi } from 'src/api'
import { useRoomStore } from 'src/stores/roomStore'

export function useRoomTypeData() {
  const $q = useQuasar()
  const roomStore = useRoomStore()

  const roomTypes = ref([])
  const loading = ref(false)
  const showRoomTypeDialog = ref(false)
  const currentRoomType = ref(null)

  const fetchRoomTypes = async () => {
    loading.value = true
    try {
      const res = await roomApi.getRoomTypes()
      roomTypes.value = res.data || []
    } catch (e) {
      console.error(e)
      $q.notify({ type: 'negative', message: '获取房型列表失败' })
    } finally {
      loading.value = false
    }
  }

  const openRoomTypeDialog = (type = null) => {
    currentRoomType.value = type
    showRoomTypeDialog.value = true
  }

  const handleSaveRoomType = async (formData) => {
    try {
      const payload = {
        ...formData,
        base_price: Number(formData.base_price)
      }

      if (currentRoomType.value) {
        await roomApi.updateRoomType(payload.type_code, payload)
        $q.notify({ type: 'positive', message: '房型更新成功' })
      } else {
        await roomApi.addRoomType(payload)
        $q.notify({ type: 'positive', message: '房型添加成功' })
      }
      showRoomTypeDialog.value = false
      await fetchRoomTypes()
      await roomStore.fetchRoomTypes() // 同步全局 Store
    } catch (error) {
      console.error(error)
      $q.notify({ type: 'negative', message: error.response?.data?.message || '保存失败' })
    }
  }

  const handleDeleteRoomType = (type) => {
    $q.dialog({
      title: '删除房型确认',
      message: `您即将删除房型 "${type.type_name}"`,
      html: true,
      cancel: { label: '取消', color: 'grey-7', flat: true },
      ok: { label: '确认删除', color: 'negative', icon: 'delete' },
      persistent: true,
      class: 'custom-delete-dialog'
    }).onOk(async () => {
      try {
        await roomApi.deleteRoomType(type.type_code)
        $q.notify({ type: 'positive', message: '房型删除成功' })
        await fetchRoomTypes()
        await roomStore.fetchRoomTypes()
      } catch (error) {
        console.error(error)
        $q.notify({ type: 'negative', message: error.response?.data?.message || '删除失败' })
      }
    })
  }

  return {
    roomTypes,
    loading,
    showRoomTypeDialog,
    currentRoomType,
    fetchRoomTypes,
    openRoomTypeDialog,
    handleSaveRoomType,
    handleDeleteRoomType
  }
}
