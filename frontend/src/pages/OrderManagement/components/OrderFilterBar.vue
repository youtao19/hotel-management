<template>
  <div class="search-section q-mb-md">
    <div class="row q-col-gutter-md">
      <div class="col-md-4 col-xs-12">
        <q-input
          :model-value="searchQuery"
          @update:model-value="$emit('update:searchQuery', $event)"
          label="搜索订单" filled clearable
          @keyup.enter="$emit('search')"
          @clear="$emit('search')"
        >
          <template v-slot:append>
            <q-icon name="search" class="cursor-pointer" @click="$emit('search')" />
          </template>
          <template v-slot:hint>输入订单号、客人姓名、手机号或房间号</template>
        </q-input>
      </div>

      <div class="col-md-3 col-xs-12">
        <q-select
          :model-value="filterStatus"
          @update:model-value="(val) => { $emit('update:filterStatus', val); $emit('search'); }"
          :options="statusOptions"
          label="订单状态" filled clearable emit-value map-options
        />
      </div>

      <div class="col-md-3 col-xs-12">
        <q-input
          :model-value="filterDate"
          label="筛选日期" filled clearable readonly
          @update:model-value="(val) => { $emit('update:filterDate', val); $emit('search'); }"
        >
          <template v-slot:append>
            <q-icon name="event" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-date
                  :model-value="filterDate"
                  @update:model-value="(val) => { $emit('update:filterDate', val); $emit('search'); }"
                >
                  <div class="row items-center justify-end">
                    <q-btn v-close-popup label="确定" color="primary" flat />
                  </div>
                </q-date>
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <div class="col-md-1 col-xs-6">
        <q-btn color="primary" label="搜索" class="full-width" @click="$emit('search')" />
      </div>
      <div class="col-md-1 col-xs-6">
        <q-btn color="grey" label="清除" class="full-width" @click="$emit('clear')" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps(['searchQuery', 'filterStatus', 'filterDate', 'statusOptions'])
defineEmits(['update:searchQuery', 'update:filterStatus', 'update:filterDate', 'search', 'clear'])
</script>
