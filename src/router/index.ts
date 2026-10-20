import { createRouter, createWebHistory } from 'vue-router'

import { BRAND_PATH, STEPS, useWizardStore } from '@/stores/wizard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: STEPS[0].path },
    {
      path: STEPS[0].path,
      name: 'template',
      component: () => import('@/views/NewDocument/TemplateStep.vue'),
    },
    {
      path: BRAND_PATH,
      name: 'brand',
      component: () => import('@/views/Settings/BrandSettings.vue'),
    },
    {
      path: STEPS[1].path,
      name: 'details',
      component: () => import('@/views/NewDocument/DetailsStep.vue'),
    },
    {
      path: STEPS[2].path,
      name: 'review',
      component: () => import('@/views/NewDocument/ReviewStep.vue'),
    },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('@/views/Documents/DocumentsList.vue'),
    },
    {
      path: '/documents/:id',
      name: 'document',
      component: () => import('@/views/Documents/DocumentDetail.vue'),
    },
    {
      path: '/documents/:id/send',
      name: 'send',
      component: () => import('@/views/Documents/SendForSignature.vue'),
    },
    {
      path: '/s/:id/:token',
      name: 'sign',
      component: () => import('@/views/Signing/ClientSign.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: STEPS[0].path },
  ],
})

router.beforeEach((to) => {
  const wizard = useWizardStore()

  if (['brand', 'documents', 'document', 'send', 'sign'].includes(String(to.name))) return true
  if (to.name !== 'template' && !wizard.templateId) return STEPS[0].path
  if (to.name === 'review' && !wizard.document) return STEPS[1].path
  return true
})

export default router