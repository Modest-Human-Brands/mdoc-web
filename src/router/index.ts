import { createRouter, createWebHistory } from 'vue-router'

import { STEPS, useWizardStore } from '@/stores/wizard'

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
      path: STEPS[1].path,
      name: 'brand',
      component: () => import('@/views/NewDocument/BrandStep.vue'),
    },
    {
      path: STEPS[2].path,
      name: 'details',
      component: () => import('@/views/NewDocument/DetailsStep.vue'),
    },
    {
      path: STEPS[3].path,
      name: 'send',
      component: () => import('@/views/NewDocument/SendStep.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: STEPS[0].path },
  ],
})

/** Deep links must not skip ahead: no template → back to step 1, no document yet → back to details. */
router.beforeEach((to) => {
  const wizard = useWizardStore()

  if (to.name !== 'template' && !wizard.templateId) return STEPS[0].path
  if (to.name === 'send' && !wizard.document) return STEPS[2].path
  return true
})

export default router