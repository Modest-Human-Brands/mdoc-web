import { createRouter, createWebHistory } from 'vue-router'

import { HOME_PATH, isConnected, loadAccess } from '@/domain/access'
import { BRAND_PATH, STEPS, useWizardStore } from '@/stores/wizard'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: HOME_PATH },
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
      path: '/documents/:id/edit',
      name: 'document-edit',
      component: () => import('@/views/Documents/EditDocument.vue'),
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
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/Terms/TermsList.vue'),
    },
    {
      path: '/terms/new',
      name: 'term-new',
      component: () => import('@/views/Terms/TermEditor.vue'),
    },
    {
      path: '/terms/:slug',
      name: 'term',
      component: () => import('@/views/Terms/TermEditor.vue'),
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/Setup/ConnectStep.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: HOME_PATH },
  ],
})

router.beforeEach((to) => {
  const wizard = useWizardStore()
  // Leaving the editor (other than to the brand screen and back) brings the new-document draft back.
  const open = wizard.editing?.id
  if (open && to.name !== 'brand' && !(to.name === 'document-edit' && to.params.id === open)) {
    wizard.stopEditing()
  }

  if (to.name === 'sign' || to.name === 'setup') return true
  // Setup is gated on details saved in this browser; runtime config and .env only pre-fill it.
  if (!isConnected(loadAccess())) return { name: 'setup', query: { next: to.fullPath } }
  // Not awaited: pages render at once, and the brand screen shows its own loading and error states.
  void wizard.ensureOrganization()
  if (
    [
      'brand',
      'documents',
      'document',
      'document-edit',
      'send',
      'sign',
      'terms',
      'term-new',
      'term',
    ].includes(String(to.name))
  )
    return true
  if (to.name !== 'template' && !wizard.templateId) return STEPS[0].path
  if (to.name === 'review' && !wizard.document) return STEPS[1].path
  return true
})

export default router