<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-vue-next'
import { useSessionStore } from './stores/session'
import { useToast } from './composables/useToast'

const session = useSessionStore()
const route = useRoute()
const router = useRouter()
const { toasts, dismiss } = useToast()

onMounted(async () => {
  await session.restore()
  if (!session.isLoggedIn && route.path !== '/login') router.replace('/login')
})

watch(() => session.isLoggedIn, (loggedIn) => {
  if (!loggedIn && route.path !== '/login') router.replace('/login')
  if (loggedIn && route.path === '/login') router.replace('/events')
})
</script>

<template>
  <div class="app-root">
    <RouterView />
    <div class="toast-stack" aria-live="polite">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.tone}`">
          <CheckCircle2 v-if="toast.tone === 'success'" :size="18" />
          <TriangleAlert v-else-if="toast.tone === 'warning'" :size="18" />
          <AlertCircle v-else-if="toast.tone === 'error'" :size="18" />
          <Info v-else :size="18" />
          <span>{{ toast.message }}</span>
          <button class="icon-button toast-close" aria-label="关闭提示" @click="dismiss(toast.id)"><X :size="14" /></button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
