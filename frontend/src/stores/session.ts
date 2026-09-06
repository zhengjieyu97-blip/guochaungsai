import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, type Role, type Session } from '@/services/api'

export const roleLabels: Record<Role, string> = {
  FAMILY: '家属 / 监护人',
  COMMUNITY_WORKER: '社区工作人员',
  RESPONDER: '社区响应人',
  ADMIN: '社区管理员',
}

export const roleDetails: Record<Role, { name: string; mark: string; desc: string }> = {
  FAMILY: { name: '李晨', mark: '家', desc: '查看授权家庭，确认平安与关闭事件' },
  COMMUNITY_WORKER: { name: '赵敏', mark: '社', desc: '统筹社区事件，派单、升级与闭环' },
  RESPONDER: { name: '张师傅', mark: '响', desc: '处理分配给自己的照护任务' },
  ADMIN: { name: '社区管理员', mark: '管', desc: '查看全量演示数据与统计看板' },
}

export const useSessionStore = defineStore('session', () => {
  const session = ref<Session | null>(null)
  const loading = ref(true)
  const error = ref('')
  const user = computed(() => session.value?.user ?? null)
  const role = computed(() => user.value?.role ?? null)
  const isLoggedIn = computed(() => Boolean(user.value))
  const permissions = computed(() => session.value?.permissions ?? [])

  async function restore() {
    loading.value = true
    try {
      session.value = await api.me()
    } catch {
      session.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(nextRole: Role) {
    loading.value = true
    error.value = ''
    try {
      session.value = await api.login(nextRole)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined)
    session.value = null
  }

  async function switchRole(nextRole: Role) {
    if (nextRole === role.value) return true
    return login(nextRole)
  }

  return { session, user, role, roleLabels, roleDetails, permissions, isLoggedIn, loading, error, restore, login, logout, switchRole }
})
