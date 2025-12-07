<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="val => emit('update:modelValue', val)"
    persistent
  >
    <q-card style="min-width: 500px; max-width: 90vw;">
      <q-card-section class="row items-center">
        <div class="text-h6">修改订单</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section v-if="order">
        <q-form @submit="logic.submit" class="q-gutter-md">

          <div class="row q-col-gutter-md">
            <div class="col-6">
              <q-input
                filled
                v-model="logic.formData.checkInDate"
                label="入住日期"
                type="date"
                hint="修改日期需确认是否有房"
              />
            </div>
            <div class="col-6">
              <q-input
                filled
                v-model="logic.formData.checkOutDate"
                label="离店日期"
                type="date"
              />
            </div>
          </div>

          <q-select
            filled
            v-model="logic.formData.room"
            :options="availableRooms"
            option-label="room_number"
            label="选择房间"
            hint="仅显示当前日期范围内可用的房间"
            :rules="[val => !!val || '请选择房间']"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.room_number }}</q-item-label>
                  <q-item-label caption>{{ getRoomTypeName(scope.opt.room_type_id) }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template v-slot:selected-item="scope">
              <span v-if="scope.opt">
                {{ scope.opt.room_number }} - {{ getRoomTypeName(scope.opt.room_type_id) }}
              </span>
            </template>
          </q-select>

          <q-input
            filled
            v-model.number="logic.formData.roomPrice"
            label="房价 (总价)"
            prefix="¥"
            type="number"
            :rules="[val => val >= 0 || '价格不能为负']"
          />

          <q-input
            filled
            v-model="logic.formData.remarks"
            label="备注"
            type="textarea"
            rows="2"
          />

          <div class="row justify-end q-mt-lg">
            <q-btn flat label="取消" color="primary" v-close-popup />
            <q-btn
              label="保存修改"
              type="submit"
              color="primary"
              :disable="!logic.isValid.value"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useChangeOrderLogic } from '../composables/useChangeOrderLogic'

const props = defineProps({
  modelValue: Boolean,
  order: Object,           // 当前订单信息
  availableRooms: Array,   // 可用房间列表（由父组件传入）
  getRoomTypeName: { type: Function, default: () => '' }
})

const emit = defineEmits(['update:modelValue', 'order-updated'])

// 使用 Composable，直接传入 props 和 emit
const logic = useChangeOrderLogic(props, emit)

</script>
