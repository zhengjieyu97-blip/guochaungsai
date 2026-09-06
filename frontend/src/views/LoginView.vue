<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  HeartHandshake,
  Sparkles,
  ShieldAlert,
  Activity,
  Radio,
  Layers,
  Home,
  Building2,
  UserCheck,
  LockKeyhole
} from 'lucide-vue-next'
import { roleDetails, roleLabels, useSessionStore } from '@/stores/session'
import type { Role } from '@/services/api'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const selected = ref<Role | null>(null)

const roles: Role[] = ['FAMILY', 'COMMUNITY_WORKER', 'RESPONDER', 'ADMIN']

const roleIcons: Record<Role, any> = {
  FAMILY: Home,
  COMMUNITY_WORKER: Building2,
  RESPONDER: UserCheck,
  ADMIN: LockKeyhole,
}

const roleGradients: Record<Role, string> = {
  FAMILY: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  COMMUNITY_WORKER: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
  RESPONDER: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  ADMIN: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
}

async function enter(role: Role) {
  selected.value = role
  const ok = await session.login(role)
  if (ok) {
    push(`欢迎进入 ${roleLabels[role]} 协同工作台`)
    router.push('/events')
  } else {
    push(session.error || '登录失败，请稍后重试', 'error')
  }
  selected.value = null
}
</script>

<template>
  <main class="login-page">
    <!-- Left Hero: Futuristic, sleek dark glowing canvas -->
    <section class="login-intro">
      <div class="intro-bg-glow glow-1"></div>
      <div class="intro-bg-glow glow-2"></div>
      <div class="intro-grid-pattern"></div>

      <div class="brand-lockup">
        <div class="brand-symbol">
          <HeartHandshake :size="24" stroke-width="2.2" />
        </div>
        <div class="brand-titles">
          <span class="brand-name">邻里智护</span>
        </div>
      </div>

      <div class="intro-copy">
        <div class="badge-live">
          <span class="pulse-indicator"></span>
          <span>智慧社区应急联动与看护系统</span>
        </div>
        <h1>
          守护一老一小<br />
          让每一次牵挂都有<em>回音</em>
        </h1>
        <p class="intro-subtitle">
          构建全天候分钟级预警闭环：异常主动感应、AI 风险动态分级、网格精准调度、多方协同处置。
        </p>

        <!-- Dynamic Live Stats Cards -->
        <div class="hero-feature-cards">
          <div class="feature-card">
            <div class="card-icon teal">
              <Activity :size="20" />
            </div>
            <div>
              <strong>全链路透明闭环</strong>
              <span>从发现到确认全程留痕</span>
            </div>
          </div>
          <div class="feature-card">
            <div class="card-icon amber">
              <ShieldAlert :size="20" />
            </div>
            <div>
              <strong>P0 - P2 动态分级</strong>
              <span>精准计算处置黄金时效</span>
            </div>
          </div>
        </div>
      </div>

      <div class="intro-footer-status">
        <div class="status-pill">
          <Radio :size="14" class="radio-pulse" />
          <span>春和里示范社区 · 实时运行中</span>
        </div>
      </div>
    </section>

    <!-- Right Login Form: Pristine, Elevated, Modern Cards -->
    <section class="login-panel">
      <div class="login-card-container">
        <div class="login-panel-head">
          <div>
            <span class="section-tag">身份快速访问</span>
            <h2>请选择工作台视角</h2>
            <p>免密一键切换，体验不同协同角色全功能视角</p>
          </div>
          <div class="spark-badge">
            <Sparkles :size="20" />
          </div>
        </div>

        <div class="role-list">
          <button
            v-for="role in roles"
            :key="role"
            class="role-card"
            :class="{ selected: selected === role }"
            :disabled="Boolean(selected)"
            @click="enter(role)"
          >
            <div class="role-icon-box" :style="{ background: roleGradients[role] }">
              <component :is="roleIcons[role]" :size="22" color="#ffffff" stroke-width="2" />
            </div>

            <div class="role-copy">
              <div class="role-title-row">
                <strong>{{ roleLabels[role] }}</strong>
                <span class="user-alias">{{ roleDetails[role].name }}</span>
              </div>
              <small>{{ roleDetails[role].desc }}</small>
            </div>

            <div class="role-arrow-circle">
              <ArrowRight :size="18" />
            </div>
          </button>
        </div>

        <div class="login-panel-footer">
          <div class="quick-tips">
            <Layers :size="16" />
            <span>登录后可随时在顶部导航栏切换不同角色视角体验完整闭环</span>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
