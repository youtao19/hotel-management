import { ref, computed } from 'vue'

export function useRoomFilters(roomsRef) {
  const filters = ref({
    type: null,
    status: null,
    search: ''
  })

  const statusOptions = [
    { label: '可用', value: 'available' },
    { label: '已入住', value: 'occupied' },
    { label: '清洁中', value: 'cleaning' },
    { label: '维修中', value: 'repair' }
  ]

  const filteredRooms = computed(() => {
    let result = roomsRef.value || []

    if (filters.value.type) {
      result = result.filter(room => room.type_code === filters.value.type)
    }

    if (filters.value.status) {
      result = result.filter(room => room.status === filters.value.status)
    }

    if (filters.value.search) {
      const keyword = filters.value.search.toLowerCase()
      result = result.filter(room =>
        String(room.room_number).toLowerCase().includes(keyword)
      )
    }

    return result
  })

  const resetFilters = () => {
    filters.value = { type: null, status: null, search: '' }
  }

  return {
    filters,
    statusOptions,
    filteredRooms,
    resetFilters
  }
}
