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
  { key: 'missed', title: '老人 4 小时未签到', desc: '按签到计划生成一条 P1 事件，先通知家属，再进入社区响应链。', icon: Clock4, type: 'ELDER_MISSED_CHECKIN', subject: '李秀梅', level: 'P1 · 高风险', tone: 'coral' },
  { key: 'elderHelp', title: '老人主动求助', desc: '模拟助餐、助洁、陪同等服务需求，记录事实，不做医疗判断。', icon: HandHeart, type: 'ELDER_HELP', subject: '王建国', level: 'P1 · 高风险', tone: 'mint' },
  { key: 'fall', title: '疑似老人跌倒', desc: '用“疑似异常”措辞创建事件，提醒家属与社区人工确认。', icon: CircleAlert, type: 'ELDER_SUSPECTED_FALL', subject: '李秀梅', level: 'P1 · 高风险', tone: 'amber' },
  { key: 'pickup', title: '儿童接送超时', desc: '约定时间后没有收到确认，通知监护人与托管工作人员。', icon: BellRing, type: 'CHILD_PICKUP_TIMEOUT', subject: '陈小雨', level: 'P1 · 高风险', tone: 'sky' },
  { key: 'childCheckin', title: '托管签到异常', desc: '儿童应到托管点但未完成签到，复用同一套派单与确认闭环。', icon: Baby, type: 'CHILD_CARE_CHECKIN_ABNORMAL', subject: '周子涵', level: 'P1 · 高风险', tone: 'mint' },
  { key: 'childHelp', title: '儿童主动求助', desc: '直接生成 P0，监护人与社区工作人员同时收到站内通知。', icon: Siren, type: 'CHILD_HELP', subject: '陈小雨', level: 'P0 · 紧急', tone: 'coral' },
]

function findSubject(name: string) { return people.value.find((person) => person.name === name) }
async function runScenario(scenario: typeof scenarios[number]) {
  const subject = findSubject(scenario.subject)
  if (!subject) return push('当前视角看不到该照护对象', 'error')
  running.value = scenario.key
  try {
    const event = await api.createEvent({ subject_id: subject.id, event_type: scenario.type, source: 'SIMULATOR', description: `模拟：${scenario.desc}`, urgency: scenario.key === 'childHelp' ? 'URGENT' : 'NORMAL' })
    push(`已生成「${scenario.title}」事件`)
    router.push(`/events/${event.id}`)
  } catch (err) { push(err instanceof Error ? err.message : '模拟失败', 'error') } finally { running.value = '' }
}

async function runNoResponse() {
  const scenario = scenarios[0]
  const subject = findSubject(scenario.subject)
  if (!subject) return push('当前视角看不到李秀梅', 'error')
  running.value = 'noResponse'
  try {
    const event = await api.createEvent({ subject_id: subject.id, event_type: scenario.type, source: 'SIMULATOR', description: '模拟：家属在首次响应时限内未回应，系统立即推进升级。', urgency: 'NORMAL' })
    const escalated = await api.timeout(event.id)
    push(`已生成升级记录 · ${escalated.event_no}`, 'warning')
    router.push(`/events/${escalated.id}`)
  } catch (err) { push(err instanceof Error ? err.message : '模拟升级失败', 'error') } finally { running.value = '' }
}

async function reset() {
  if (!confirm('确定要恢复初始演示数据吗？')) return
  try { await api.reset(); push('演示数据已恢复'); await load() } catch (err) { push(err instanceof Error ? err.message : '重置失败', 'error') }
}
async function load() { people.value = (await api.people()).items }
onMounted(load)
</script>

<template>
  <div class="page-wrap"><header class="page-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span>模拟事件台 / 无硬件演示</p><h1>把三分钟的闭环，按下播放。</h1><p>每个按钮都会调用真实后端用例：创建事件、计算风险、建立任务、生成通知，然后跳到可继续操作的详情页。</p></div><div class="heading-actions"><button v-if="canReset" class="button button-secondary" @click="reset"><RotateCcw :size="15" />恢复演示数据</button></div></header>
    <div class="simulator-grid"><section class="panel"><div class="panel-head"><div><h2>快捷场景</h2><p>六类固定事件 + 一键超时升级</p></div><span class="icon-text muted-text"><TimerReset :size="15" />即时写入时间线</span></div><div class="scenario-grid"><button v-for="scenario in scenarios" :key="scenario.key" class="scenario-card" :disabled="Boolean(running)" @click="runScenario(scenario)"><span class="scenario-icon" :class="scenario.tone"><component :is="scenario.icon" :size="17" /></span><strong>{{ scenario.title }}</strong><p>{{ scenario.desc }}</p><span class="scenario-meta"><span>{{ scenario.level }}</span><span>{{ running === scenario.key ? '生成中…' : '点击生成 →' }}</span></span></button><button class="scenario-card escalation-card" :disabled="Boolean(running)" @click="runNoResponse"><span class="scenario-icon coral"><TimerReset :size="17" /></span><strong>家属未响应并立即升级</strong><p>直接调用超时升级用例，生成升级次数、责任人变化和站内通知。</p><span class="scenario-meta"><span>P1 → 升级</span><span>{{ running === 'noResponse' ? '升级中…' : '点击演示 →' }}</span></span></button></div></section><aside class="simulator-aside"><section class="playbook"><p class="eyebrow">三分钟演示路径</p><h3>从发现到确认</h3><p>选择一个场景后，沿着详情页右侧操作区完成一次真实闭环。</p><div class="playbook-steps"><span class="playbook-step"><b>01</b>创建 + 风险分级</span><span class="playbook-step"><b>02</b>接单 + 处置反馈</span><span class="playbook-step"><b>03</b>家属确认关闭</span></div></section><section class="simulator-note"><strong><HeartPulse :size="18" /> 为什么要有模拟台？</strong><p>第一阶段不接摄像头、手环、定位器或外部消息服务。模拟事件用同一套后端事件引擎，证明核心闭环可以在本地独立运行。</p></section><section class="simulator-note"><strong><UserRound :size="18" /> 当前可见对象</strong><p>{{ people.map((person) => `${person.name}（${person.subject_type_label}）`).join(' · ') || '正在读取…' }}</p></section></aside></div>
  </div>
</template>
