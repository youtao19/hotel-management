<template>
  <div class="special-stats-wrapper">
    <table class="special-stats-table">
      <tbody>
        <tr>
          <td class="stats-label">好评</td>
          <td colspan="2" class="stats-value">
            <q-input v-model="localGoodReview" dense borderless class="text-center" placeholder="邀0得0" readonly />
          </td>
          <td class="stats-label">开房</td>
          <td colspan="2" class="stats-number">
            <q-input v-model.number="localTotalRooms" dense borderless class="text-center" placeholder="0" readonly />
          </td>
          <td class="stats-label">收银员</td>
          <td class="cashier-name">
            <q-input v-model="localCashierName" dense borderless class="text-center" placeholder="张" :readonly="readOnly" />
          </td>
        </tr>
        <tr>
          <td class="stats-label">大美卡</td>
          <td colspan="2" class="stats-number">
            <q-input v-model.number="localVipCards" dense borderless class="text-center" placeholder="0" :readonly="readOnly" />
          </td>
          <td class="stats-label">休息房</td>
          <td colspan="2" class="stats-number">
            <q-input v-model.number="localRestRooms" dense borderless class="text-center" placeholder="0" readonly />
          </td>
          <td class="stats-label">备注</td>
          <td class="notes-cell">
            <q-input v-model="localNotes" dense borderless class="notes-input" placeholder="备注..." :readonly="readOnly" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  totalRooms: { type: Number, required: true },
  restRooms: { type: Number, required: true },
  vipCards: { type: Number, required: true },
  cashierName: { type: String, required: true },
  notes: { type: String, required: true },
  goodReview: { type: String, default: '邀1得1' },
  readOnly: { type: Boolean, default: false }
})

const emit = defineEmits([
  // 使用 kebab-case 事件名以匹配父组件监听（Vue3 事件名区分大小写）
  'update:cashier-name',
  'update:notes',
  'update:total-rooms',
  'update:rest-rooms',
  'update:vip-cards',
  'update:good-review'
])

const localCashierName = ref(props.cashierName)
const localNotes = ref(props.notes)
const localTotalRooms = ref(props.totalRooms)
const localRestRooms = ref(props.restRooms)
const localVipCards = ref(props.vipCards)
const localGoodReview = ref(props.goodReview)

watch(() => props.cashierName, v => { localCashierName.value = v })
watch(() => props.notes, v => { localNotes.value = v })
watch(() => props.totalRooms, v => { localTotalRooms.value = v })
watch(() => props.restRooms, v => { localRestRooms.value = v })
watch(() => props.vipCards, v => { localVipCards.value = v })
watch(() => props.goodReview, v => { localGoodReview.value = v })

watch(localCashierName, v => emit('update:cashier-name', v))
watch(localNotes, v => emit('update:notes', v))
watch(localTotalRooms, v => emit('update:total-rooms', v))
watch(localRestRooms, v => emit('update:rest-rooms', v))
watch(localVipCards, v => emit('update:vip-cards', v))
watch(localGoodReview, v => emit('update:good-review', v))
</script>

<style scoped>
.special-stats-wrapper {
  margin-top: 20px;
}

.special-stats-table {
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #333;
}

.special-stats-table td {
  border: 1px solid #333;
  padding: 8px;
  text-align: center;
  height: 35px;
}

.stats-label {
  background-color: #e3f2fd;
  font-weight: bold;
  width: 80px;
}

.stats-value {
  background-color: #f3e5f5;
  font-weight: bold;
  width: 60px;
}

.stats-number {
  background-color: #fff3e0;
  font-weight: bold;
  font-size: 16px;
  color: #f57c00;
  width: 80px;
}

.cashier-name {
  background-color: #e8f5e8;
  font-weight: bold;
  font-size: 18px;
  width: 100px;
}

.notes-cell {
  width: 180px;
}

@media (max-width: 768px) {
  .notes-cell { width: 120px; }
}
</style>
