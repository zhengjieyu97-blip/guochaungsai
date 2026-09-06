<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles, UsersRound } from 'lucide-vue-next'
import { roleDetails, roleLabels, useSessionStore } from '@/stores/session'
import type { Role } from '@/services/api'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const selected = ref<Role | null>(null)

const roles: Role[] = ['FAMILY', 'COMMUNITY_WORKER', 'RESPONDER', 'ADMIN']

async function enter(role: Role) {
  selected.value = role
  const ok = await session.login(role)
  if (ok) {
    push(`已进入 ${roleLabels[role]} 视角`)
    router.push('/events')
  } else {
    push(session.error || '登录失败，请稍后重试', 'error')
  }
  selected.value = null
}
</script>

<template>
  <main class="login-page">
    <section class="login-intro">
      <div class="brand-lockup">
        <div class="brand-symbol">
          <HeartHandshake :size="24" stroke-width="2" />
        </div>
        <span>邻里智护</span>
      </div>

      <div class="intro-copy">
        <p class="eyebrow">
          <span class="eyebrow-dot"></span>
          社区一老一小照护协同台 · 第一阶段
        </p>
        <h1>让每一次<br /><em>关心</em>都有回应。</h1>
        <p class="intro-subtitle">
          把异常发现、风险分级、责任派单、现场处置和家属确认，收进同一条可追踪的照护时间线。
        </p>
      </div>

      <div class="intro-signal">
        <div class="signal-line">
          <span class="signal-pulse"></span>
          <span>演示环境已就绪</span>
          <span class="signal-time">LOCAL / 0 外部依赖</span>
        </div>
        <div class="signal-steps">
          <span>异常发现</span><i></i>
          <span>可解释分级</span><i></i>
          <span>责任派单</span><i></i>
          <span>闭环确认</span>
        </div>
      </div>

      <div class="intro-footnote">
        <ShieldCheck :size="16" />
        <span>所有人员姓名、联系方式与地理位置均已脱敏</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-panel-head">
        <div>
          <p class="eyebrow muted">选择演示视角</p>
          <h2>从谁的工作台开始？</h2>
        </div>
        <Sparkles :size="22" class="head-spark" />
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
          <span class="role-mark">{{ roleDetails[role].mark }}</span>
          <span class="role-copy">
            <strong>{{ roleLabels[role] }}</strong>
            <small>{{ roleDetails[role].desc }}</small>
          </span>
          <ArrowRight :size="20" class="role-arrow" />
        </button>
      </div>

      <div class="login-note">
        <UsersRound :size="18" />
        <span>点击角色即可一键登录进入对应工作台，顶部导航可随时切换视角。</span>
      </div>

      <div class="login-metrics">
        <div>
          <strong>06</strong>
          <span>预置固定事件类型</span>
        </div>
        <div>
          <strong>P0–P2</strong>
          <span>可解释风险分级</span>
        </div>
        <div>
          <strong>1 条线</strong>
          <span>全流程闭环可追溯</span>
        </div>
      </div>
    </section>
  </main>
</template>
