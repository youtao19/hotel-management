<template>
  <div class="form-section q-mb-md">
    <div class="text-subtitle1 q-mb-sm">入住时间</div>
    <div class="row q-col-gutter-md">
      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.checkInDate" label="入住日期" filled clearable placeholder="YYYY-MM-DD"
          :rules="[dateRule]" @blur="onNormalize('checkInDate')" @keyup.enter="onNormalize('checkInDate')">
          <template #append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="modelValue.checkInDate" :options="d => d >= minDate"
                  @update:model-value="onNormalize('checkInDate')" :locale="langZhCn.date">
                  <div class="row items-center justify-end q-pa-sm">
                    <q-btn label="确定" color="primary" flat v-close-popup />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-md-4 col-xs-12">
        <q-input v-model="modelValue.checkOutDate" label="离店日期" filled clearable placeholder="YYYY-MM-DD"
          :rules="[dateRule, checkoutRule]" @blur="onNormalize('checkOutDate')"
          @keyup.enter="onNormalize('checkOutDate')">
          <template #append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date v-model="modelValue.checkOutDate"
                  :options="d => !isValidFullDate(modelValue.checkInDate) || d >= modelValue.checkInDate"
                  @update:model-value="onNormalize('checkOutDate')" :locale="langZhCn.date">
                  <div class="row items-center justify-end q-pa-sm">
                    <q-btn label="确定" color="primary" flat v-close-popup />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-12 q-mt-md" v-if="modelValue.checkInDate && modelValue.checkOutDate">
        <div class="row items-center">
          <div class="col-auto">
            <q-chip :color="isRestRoom ? 'orange' : 'blue'" text-color="white"
              :icon="isRestRoom ? 'hotel' : 'calendar_month'" :label="isRestRoom ? '休息房' : '住宿'" />
          </div>
          <div class="col-auto q-ml-sm text-caption text-grey-6" v-if="isRestRoom">
            当日入住，当日离店
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, required: true },
  minDate: String,
  langZhCn: Object,
  dateRule: Function,
  checkoutRule: Function,
  isValidFullDate: Function,
  isRestRoom: Boolean
})

const emit = defineEmits(['normalize'])

function onNormalize(field) {
  emit('normalize', field)
}
</script>
