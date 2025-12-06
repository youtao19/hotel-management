import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import Decimal from 'decimal.js'

export function usePricingLogic(orderData, dateLogic) {
  const $q = useQuasar()
  const dailyPrices = ref({})
  const totalPriceInput = ref(0)

  Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

  function toDecimal(value) {
    if (Decimal.isDecimal(value)) return value
    if (value === undefined || value === null || value === '') return new Decimal(0)
    try { return new Decimal(value) } catch (e) { return new Decimal(0) }
  }

  function toAmountNumber(value) {
    const d = Decimal.isDecimal(value) ? value : toDecimal(value)
    return Number(d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
  }

  // 根据是否休息房调整单价
  function calculateAdjustedRoomPrice(rawPrice) {
    const base = toDecimal(rawPrice)
    if (!base.gt(0)) return 0
    const adjusted = dateLogic.isRestRoom.value ? base.div(2) : base
    return toAmountNumber(adjusted)
  }

  // 计算每日价格总和
  function sumDailyPricesDecimal() {
    if (!Array.isArray(dateLogic.dateList.value) || dateLogic.dateList.value.length === 0) return new Decimal(0)
    return dateLogic.dateList.value.reduce((sum, date) => {
      const p = dailyPrices.value[date]
      return p ? sum.plus(toDecimal(p)) : sum
    }, new Decimal(0))
  }

  const totalPrice = computed(() => {
    return Number(sumDailyPricesDecimal().toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
  })

  const averageDailyPrice = computed(() => {
    const days = dateLogic.dateList.value.length
    if (!days) return 0
    return Number(toDecimal(totalPrice.value).div(days).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString())
  })

  // 初始化每日价格
  function initializeDailyPrices(basePrice) {
    if (dateLogic.dateList.value.length === 0) {
      totalPriceInput.value = 0
      return
    }
    const normalized = toAmountNumber(basePrice)
    if (!(normalized > 0)) {
      totalPriceInput.value = 0
      return
    }
    dateLogic.dateList.value.forEach(date => {
      if (!dailyPrices.value[date]) {
        dailyPrices.value[date] = normalized
      }
    })
    updateTotalFromDaily()
  }

  // 从每日价格更新总价输入
  function updateTotalFromDaily() {
    if (!dateLogic.dateList.value.length) {
      totalPriceInput.value = 0
      return
    }
    totalPriceInput.value = toAmountNumber(sumDailyPricesDecimal())
  }

  // 分摊总价到每日
  function distributeTotalPrice() {
    if (dateLogic.dateList.value.length === 0) return
    const total = toDecimal(totalPriceInput.value)
    if (!total.gt(0)) return

    const days = dateLogic.dateList.value.length
    const totalCents = total.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    const baseCents = totalCents.div(days).floor()
    let remainder = totalCents.minus(baseCents.mul(days))

    dailyPrices.value = {} // Reset or update
    dateLogic.dateList.value.forEach(date => {
      let cents = baseCents
      if (remainder.gt(0)) {
        cents = cents.plus(1)
        remainder = remainder.minus(1)
      }
      dailyPrices.value[date] = cents.div(100).toNumber()
    })
    updateTotalFromDaily()
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
    calculateAdjustedRoomPrice,
    initializeDailyPrices,
    updateTotalFromDaily,
    distributeTotalPrice,
    applyFirstDayPriceToAll,
    toAmountNumber,
    toDecimal
  }
}
