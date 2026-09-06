<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Baby, BellRing, CircleAlert, Clock4, HandHeart, HeartPulse, RotateCcw, Siren, TimerReset, UserRound } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { api, type SubjectItem } from '@/services/api'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const people = ref<SubjectItem[]>([])
const running = ref('')
const canReset = computed(() => session.permissions.includes('reset_demo'))

const scenarios = [
  {
    key: 'missed',
    title: '老人 4 小时未签到',
    desc: '按签到计划生成一条 P1 高风险事件，先提醒家属关注，超时后进入社区网格员接单。',
    icon: Clock4,
    type: 'ELDER_MISSED_CHECKIN',
    subject: '李秀梅',
    level: 'P1 · 高风险',
    tone: 'amber'
  },
  {
    key: 'elderHelp',
    title: '老人主动求助',
    desc: '模拟助餐、助洁、就医陪同等现场服务需求，记录事实，不替代专业医疗诊断。',
    icon: HandHeart,
    type: 'ELDER_HELP',
    subject: '王建国',
    level: 'P1 · 高风险',
    tone: 'mint'
  },
  {
    key: 'fall',
    title: '疑似老人跌倒',
    desc: '以“疑似异常”规范措辞创建事件，触发紧急协同，提醒家属与网格员人工上门确认。',
    icon: CircleAlert,
    type: 'ELDER_SUSPECTED_FALL',
    subject: '李秀梅',
    level: 'P1 · 高风险',
    tone: 'coral'
  },
  {
    key: 'pickup',
    title: '儿童接送超时',
    desc: '约定接送时间后未收到到校/离校确认，自动通知监护人与托管机构工作人员协同。',
    icon: BellRing,
    type: 'CHILD_PICKUP_TIMEOUT',
    subject: '陈小雨',
    level: 'P1 · 高风险',
    tone: 'sky'
  },
  {
    key: 'childCheckin',
    title: '托管签到异常',
    desc: '儿童应到托管点但未完成打卡签到，复用同一套社区响应派单与确认闭环流程。',
    icon: Baby,
    type: 'CHILD_CARE_CHECKIN_ABNORMAL',
    subject: '周子涵',
    level: 'P1 · 高风险',
    tone: 'mint'
  },
  {
    key: 'childHelp',
    title: '儿童主动求助',
    desc: '最高优先级直升 P0，监护人、社区网格员与志愿者全员同步收到紧急通知。',
    icon: Siren,
    type: 'CHILD_HELP',
    subject: '陈小雨',
    level: 'P0 · 紧急',
    tone: 'coral'
  },
]

function findSubject(name: string) {
  return people.value.find((person) => person.name === name)
}

async function runScenario(scenario: typeof scenarios[number]) {
  const subject = findSubject(scenario.subject)
  if (!subject) return push('当前视角看不到该照护对象', 'error')
  running.value = scenario.key
  try {
    const event = await api.createEvent({
      subject_id: subject.id,
      event_type: scenario.type,
      source: 'SIMULATOR',
      description: `模拟：${scenario.desc}`,
      urgency: scenario.key === 'childHelp' ? 'URGENT' : 'NORMAL'
    })
    push(`已生成「${scenario.title}」事件`)
    router.push(`/events/${event.id}`)
  } catch (err) {
    push(err instanceof Error ? err.message : '模拟失败', 'error')
  } finally {
    running.value = ''
  }
}

async function runNoResponse() {
  const scenario = scenarios[0]
  const subject = findSubject(scenario.subject)
  if (!subject) return push('当前视角看不到李秀梅', 'error')
  running.value = 'noResponse'
  try {
    const event = await api.createEvent({
      subject_id: subject.id,
      event_type: scenario.type,
      source: 'SIMULATOR',
      description: '模拟：家属在首次响应时限内未回应，系统立即推进升级。',
      urgency: 'NORMAL'
    })
    const escalated = await api.timeout(event.id)
    push(`已生成升级记录 · ${escalated.event_no}`, 'warning')
    router.push(`/events/${escalated.id}`)
  } catch (err) {
    push(err instanceof Error ? err.message : '模拟升级失败', 'error')
  } finally {
    running.value = ''
  }
}

async function reset() {
  if (!confirm('确定要重置并恢复初始演示数据吗？')) return
  try {
    await api.reset()
    push('演示数据已恢复')
    await load()
  } catch (err) {
    push(err instanceof Error ? err.message : '重置失败', 'error')
  }
}

async function load() {
  people.value = (await api.people()).items
}

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <header class="page-heading">
      <div>
        <div class="page-title-row">
          <h1>模拟演练控制台</h1>
          <span class="page-status-tag">闭环仿真沙盒</span>
        </div>
        <p>一键模拟典型照护异常事件触发，实时观察事件生成、风险评估、智能派单与升级流转</p>
      </div>
      <div class="heading-actions">
        <button v-if="canReset" class="button button-secondary" @click="reset">
          <RotateCcw :size="16" />恢复初始演示数据
        </button>
      </div>
    </header>

    <div class="simulator-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>快捷仿真场景</h2>
            <p>包含六类典型事件触发与超时升级测试</p>
          </div>
          <span class="icon-text muted-text">
            <TimerReset :size="16" />即时写入时间线
          </span>
        </div>

        <div class="scenario-grid">
          <button
            v-for="scenario in scenarios"
            :key="scenario.key"
            class="scenario-card"
            :disabled="Boolean(running)"
            @click="runScenario(scenario)"
          >
            <span class="scenario-icon" :class="scenario.tone">
              <component :is="scenario.icon" :size="20" />
            </span>
            <strong>{{ scenario.title }}</strong>
            <p>{{ scenario.desc }}</p>
            <span class="scenario-meta">
              <span>{{ scenario.level }}</span>
              <span>{{ running === scenario.key ? '生成中…' : '点击生成 →' }}</span>
            </span>
          </button>

          <button
            class="scenario-card escalation-card"
            :disabled="Boolean(running)"
            @click="runNoResponse"
          >
            <span class="scenario-icon coral">
              <TimerReset :size="20" />
            </span>
            <strong>家属未响应并立即升级</strong>
            <p>直接调用超时升级用例，演示升级次数递增、责任人流转变更和系统站内通知。</p>
            <span class="scenario-meta">
              <span>P1 → 自动升级</span>
              <span>{{ running === 'noResponse' ? '升级中…' : '点击演示 →' }}</span>
            </span>
          </button>
        </div>
      </section>

      <aside class="simulator-aside">
        <section class="playbook">
          <p class="eyebrow" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: #2dd4bf;">
            全流程业务闭环路径
          </p>
          <h3>三步完成闭环协同</h3>
          <p>选择一个场景后，沿着详情页右侧操作区完成一次真实业务闭环。</p>
          <div class="playbook-steps">
            <span class="playbook-step"><b>01</b> 异常感应 + 风险分级</span>
            <span class="playbook-step"><b>02</b> 接单上门 + 处置记录</span>
            <span class="playbook-step"><b>03</b> 家属/监护人 确认关闭</span>
          </div>
        </section>

        <section class="simulator-note">
          <strong><HeartPulse :size="18" style="color: var(--primary);" /> 仿真沙盒机制</strong>
          <p>无需外部硬件依赖，直接调用服务端真实事件引擎与状态机，验证核心业务逻辑与数据流转的一致性。</p>
        </section>

        <section class="simulator-note">
          <strong><UserRound :size="18" style="color: var(--primary);" /> 当前视角可见对象</strong>
          <p>{{ people.map((person) => `${person.name}（${person.subject_type_label}）`).join(' · ') || '正在读取…' }}</p>
        </section>
      </aside>
    </div>
  </div>
</template>
