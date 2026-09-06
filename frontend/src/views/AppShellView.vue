<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { Activity, Bell, BookOpenCheck, CalendarClock, ChevronDown, CircleHelp, Command, LayoutDashboard, LogOut, Menu, RotateCcw, Users, X } from 'lucide-vue-next'
import { api, type NotificationItem, type Role } from '@/services/api'
import { roleLabels, useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const notifications = ref<NotificationItem[]>([])
const notificationOpen = ref(false)
const mobileOpen = ref(false)
const loadingNotifications = ref(false)

const navItems = [
  { to: '/events', label: '事件中心', note: '实时闭环', icon: Activity },
  { to: '/people', label: '照护对象', note: '对象档案', icon: Users },
  { to: '/simulator', label: '模拟事件台', note: '演示入口', icon: CalendarClock },
  { to: '/dashboard', label: '社区看板', note: '决策指标', icon: LayoutDashboard },
]
const pageTitle = computed(() => {
  if (route.path.startsWith('/events/')) return '事件详情'
  if (route.path.startsWith('/people/')) return '对象档案'
  return navItems.find((item) => route.path.startsWith(item.to))?.label ?? '事件中心'
})
const unreadCount = computed(() => notifications.value.filter((item) => !item.read_at).length)

async function loadNotifications() {
  if (!session.isLoggedIn) return
  loadingNotifications.value = true
  try { notifications.value = (await api.notifications()).items } catch { notifications.value = [] } finally { loadingNotifications.value = false }
}

async function switchRole(event: Event) {
  const nextRole = (event.target as HTMLSelectElement).value as Role
  if (await session.switchRole(nextRole)) {
    push(`已切换到${roleLabels[nextRole]}视角`)
    await loadNotifications()
    router.push('/events')
  } else push('角色切换失败', 'error')
}

async function markRead(item: NotificationItem) {
  if (!item.read_at) {
    await api.readNotification(item.id).catch(() => undefined)
    item.read_at = new Date().toISOString()
  }
  notificationOpen.value = false
  if (item.event_id) router.push(`/events/${item.event_id}`)
}

async function markAllRead() {
  await api.readAllNotifications().catch(() => undefined)
  notifications.value.forEach((item) => { item.read_at = item.read_at || new Date().toISOString() })
  push('通知已全部标记为已读')
}

async function logout() {
  await session.logout()
  router.push('/login')
}

async function resetDemo() {
  if (!confirm('确定要恢复初始演示数据吗？当前演示操作会被清除。')) return
  try { await api.reset(); push('演示数据已恢复'); router.push('/events'); await loadNotifications() } catch (err) { push(err instanceof Error ? err.message : '重置失败', 'error') }
}

watch(() => route.fullPath, () => { mobileOpen.value = false })
onMounted(loadNotifications)
</script>

<template>
  <div class="shell">
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <div class="sidebar-brand"><div class="brand-symbol small"><BookOpenCheck :size="19" /></div><span>邻里智护</span><button class="icon-button sidebar-close" aria-label="关闭导航" @click="mobileOpen = false"><X :size="18" /></button></div>
      <div class="sidebar-context"><span class="context-kicker">当前工作区</span><strong>春和里社区</strong><span class="context-status"><i></i> 本地演示环境</span></div>
      <nav class="main-nav" aria-label="主导航">
        <span class="nav-section-label">工作台</span>
        <RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item" :class="{ active: route.path.startsWith(item.to) }">
          <component :is="item.icon" :size="18" /><span class="nav-label"><strong>{{ item.label }}</strong><small>{{ item.note }}</small></span>
          <span v-if="item.to === '/events' && unreadCount" class="nav-count">{{ unreadCount }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-footer"><button class="sidebar-action" @click="resetDemo"><RotateCcw :size="16" /><span>恢复演示数据</span></button><div class="sidebar-help"><CircleHelp :size="15" /><span>需要帮助？查看演示路径</span></div></div>
    </aside>
    <div v-if="mobileOpen" class="sidebar-backdrop" @click="mobileOpen = false"></div>

    <main class="main-shell">
      <header class="topbar">
        <button class="icon-button mobile-menu" aria-label="打开导航" @click="mobileOpen = true"><Menu :size="20" /></button>
        <div class="crumbs"><span>春和里社区</span><i>/</i><strong>{{ pageTitle }}</strong></div>
        <div class="topbar-actions">
          <span class="system-pulse"><i></i> 运行正常</span>
          <button class="icon-button notification-trigger" aria-label="打开通知" @click="notificationOpen = !notificationOpen"><Bell :size="19" /> <b v-if="unreadCount">{{ unreadCount }}</b></button>
          <div class="role-switch"><Command :size="15" /><select :value="session.role ?? ''" aria-label="当前视角" @change="switchRole"><option v-for="(label, key) in roleLabels" :key="key" :value="key">{{ label }}</option></select><ChevronDown :size="14" /></div>
          <button class="avatar" :title="session.user?.name">{{ session.user?.name?.slice(0, 1) }}</button>
          <button class="icon-button logout-button" aria-label="退出登录" title="退出登录" @click="logout"><LogOut :size="17" /></button>
        </div>
      </header>
      <div class="page-scroll"><RouterView /></div>
    </main>

    <Transition name="panel-fade">
      <section v-if="notificationOpen" class="notification-panel">
        <div class="notification-head"><div><span class="eyebrow muted">通知中心</span><h3>需要你留意的事</h3></div><button class="text-button" @click="markAllRead">全部已读</button></div>
        <div v-if="loadingNotifications" class="notification-empty">正在读取通知…</div>
        <div v-else-if="notifications.length === 0" class="notification-empty">暂时没有新的站内通知。</div>
        <button v-for="item in notifications" v-else :key="item.id" class="notification-item" :class="{ unread: !item.read_at }" @click="markRead(item)"><span class="notification-dot"></span><span><strong>{{ item.title }}</strong><small>{{ item.content }}</small><time>{{ new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</time></span></button>
      </section>
    </Transition>
  </div>
</template>
