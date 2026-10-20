<script setup lang="ts">
import { useActiveTemplate } from '@/composables/useTemplates'

useActiveTemplate()
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <KeepAlive :include="['TemplateStep', 'BrandSettings', 'DetailsStep', 'ReviewStep']">
      <component :is="Component" :key="route.name" />
    </KeepAlive>
  </RouterView>
</template>