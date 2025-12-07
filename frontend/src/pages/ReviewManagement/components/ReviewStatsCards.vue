<template>
  <div class="row q-gutter-md q-mb-md">
    <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
      <q-card-section class="text-center">
        <div class="text-h4 text-positive">{{ statistics.pendingInvitations }}</div>
        <div class="text-subtitle2">可邀请好评</div>
      </q-card-section>
    </q-card>

    <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
      <q-card-section class="text-center">
        <div class="text-h4 text-warning">{{ statistics.pendingReviews }}</div>
        <div class="text-subtitle2">待设置评价</div>
      </q-card-section>
    </q-card>

    <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
      <q-card-section class="text-center">
        <div class="text-h4 text-positive">{{ statistics.positiveReviews }}</div>
        <div class="text-subtitle2">好评数量</div>
      </q-card-section>
    </q-card>

    <q-card class="col-md-3 col-sm-6 col-xs-12" flat bordered>
      <q-card-section class="text-center">
        <div class="text-h4 text-primary">{{ statistics.reviewRate }}%</div>
        <div class="text-subtitle2">好评率</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
defineProps({
  statistics: {
    type: Object,
    required: true
  }
});
</script>
