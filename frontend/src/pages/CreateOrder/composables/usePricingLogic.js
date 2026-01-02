import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { orderApi } from 'src/api'

export function usePricingLogic(orderData, dateLogic) {
  const $q = useQuasar()
  const dailyPrices = ref({})
  const totalPriceInput = ref(0)

  function toAmountNumber(v) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.round(n * 100) / 100
  }

  const totalPrice = computed(() => {
    if (!Array.isArray(dateLogic.dateList.value) || dateLogic.dateList.value.length === 0) return 0
    const sum = dateLogic.dateList.value.reduce((acc, date) => {
      return acc + (Number(dailyPrices.value[date]) || 0)
    }, 0)
    return toAmountNumber(sum)
  })

  const averageDailyPrice = computed(() => {
    const days = dateLogic.dateList.value.length
    if (!days) return 0
    return toAmountNumber((Number(totalPrice.value) || 0) / days)
  })

  async function initializeDailyPrices(basePrice) {
    if (!dateLogic.dateList.value.length) {
      dailyPrices.value = {}
      totalPriceInput.value = 0
      return
    }
    const normalized = toAmountNumber(basePrice)
    if (!(normalized > 0)) {
      dailyPrices.value = {}
      totalPriceInput.value = 0
      return
    }

    try {
      const res = await orderApi.getPricingBreakdown({
        checkInDate: orderData.value.checkInDate,
        checkOutDate: orderData.value.checkOutDate,
        mode: 'from-room-price',
        basePrice: normalized
      })
      dailyPrices.value = res?.data?.daily_prices || {}
      updateTotalFromDaily()
    } catch (e) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message || e?.message || '初始化每日价格失败' })
    }
  }

  // 从每日价格更新总价输入
  function updateTotalFromDaily() {
    if (!dateLogic.dateList.value.length) {
      totalPriceInput.value = 0
      return
    }
    totalPriceInput.value = totalPrice.value
  }

  // 分摊总价到每日
  async function distributeTotalPrice() {
    if (!dateLogic.dateList.value.length) return
    const total = toAmountNumber(totalPriceInput.value)
    if (!(total > 0)) return

    try {
      const res = await orderApi.getPricingBreakdown({
        checkInDate: orderData.value.checkInDate,
        checkOutDate: orderData.value.checkOutDate,
        mode: 'distribute-total',
        totalPrice: total
      })
      dailyPrices.value = res?.data?.daily_prices || {}
      updateTotalFromDaily()
    } catch (e) {
      $q.notify({ type: 'negative', message: e?.response?.data?.message || e?.message || '分摊总价失败' })
    }
  }

  // 应用首日价格
  function applyFirstDayPriceToAll() {
    const firstDate = dateLogic.dateList.value[0]
    if (!firstDate) return
    const p = dailyPrices.value[firstDate]
    if (!p) {
        $q.notify({ type: 'warning', message: '首日价格无效' })
        return
    }
    dateLogic.dateList.value.forEach(d => { dailyPrices.value[d] = p })
    updateTotalFromDaily()
    $q.notify({ type: 'positive', message: '已应用首日价格' })
  }

  // Watchers
  watch(dateLogic.dateList, (newList) => {
    // 清理无用Key
    const set = new Set(newList)
    Object.keys(dailyPrices.value).forEach(k => { if (!set.has(k)) delete dailyPrices.value[k] })
    updateTotalFromDaily()
  })

  // 预付自动填入
  watch(() => orderData.value.isPrepaid, (val) => {
    orderData.value.prepaidAmount = val ? (totalPrice.value > 0 ? totalPrice.value : 0) : 0
  })

  return {
    dailyPrices,
    totalPriceInput,
    totalPrice,
    averageDailyPrice,
    initializeDailyPrices,
    updateTotalFromDaily,
    distributeTotalPrice,
    applyFirstDayPriceToAll,
    toAmountNumber
  }
}
