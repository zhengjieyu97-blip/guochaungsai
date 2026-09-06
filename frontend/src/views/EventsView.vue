<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowUpRight, ChevronRight, Clock3, Filter, Plus, Search, Siren, SlidersHorizontal, TimerReset, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { api, type EventItem, type EventTypeMeta, type SubjectItem } from '@/services/api'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const events = ref<EventItem[]>([])
const subjects = ref<SubjectItem[]>([])
const types = ref<EventTypeMeta[]>([])
const loading = ref(true)
const showCreate = ref(false)
const submitting = ref(false)
const error = ref('')
const filters = reactive({ search: '', status: 'ALL', risk: 'ALL', subject_type: 'ALL', event_type: 'ALL', assignee: 'ALL' })
const form = reactive({ subject_id: '', event_type: '', urgency: 'NORMAL', description: '' })

const statusOptions = [['ALL', '全部状态'], ['PENDING', '待处理'], ['ASSIGNED', '已派单'], ['IN_PROGRESS', '处理中'], ['WAITING_CONFIRM', '待确认'], ['CLOSED', '已关闭'], ['CANCELLED', '已取消']] as const
const riskOptions = [['ALL', '全部风险'], ['P0', 'P0 紧急'], ['P1', 'P1 高风险'], ['P2', 'P2 常规']] as const

const openEvents = computed(() => events.value.filter((event) => !['CLOSED', 'CANCELLED'].includes(event.status)))
const metrics = computed(() => ({ pending: events.value.filter((event) => ['PENDING', 'ASSIGNED'].includes(event.status)).length, active: events.value.filter((event) => ['IN_PROGRESS', 'WAITING_CONFIRM'].includes(event.status)).length, overdue: events.value.filter((event) => event.timed_out).length, closed: events.value.filter((event) => event.status === 'CLOSED').length }))
const canCreate = computed(() => session.permissions.includes('create_event'))
const canOperate = computed(() => session.permissions.includes('accept'))
const assigneeOptions = computed(() => Array.from(new Map(events.value.filter((event) => event.current_assignee_id && event.current_assignee_name).map((event) => [event.current_assignee_id, { id: event.current_assignee_id as string, name: event.current_assignee_name as string }])).values()))

function formatTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function relativeTime(value: string) {
  const diff = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${diff} 分钟前`
  if (diff < 1440) return `${Math.round(diff / 60)} 小时前`
  return `${Math.round(diff / 1440)} 天前`
}
function riskClass(level: string) { return level.toLowerCase() }
function statusClass(status: string) { return status === 'IN_PROGRESS' ? 'in-progress' : status === 'WAITING_CONFIRM' ? 'waiting' : status === 'CLOSED' ? 'closed' : '' }

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== 'ALL'))
    const [eventResult, subjectResult, typeResult] = await Promise.all([api.events(params), api.people(), api.eventTypes()])
    events.value = eventResult.items
    subjects.value = subjectResult.items
    types.value = typeResult
    if (!form.subject_id && subjects.value.length) form.subject_id = subjects.value[0].id
    if (!form.event_type && types.value.length) form.event_type = types.value[0].value
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取事件失败'
  } finally { loading.value = false }
}

function openCreate() {
  if (!subjects.value.length) return
  form.subject_id = form.subject_id || subjects.value[0].id
  form.event_type = form.event_type || types.value[0]?.value || ''
  form.description = ''
  form.urgency = 'NORMAL'
  showCreate.value = true
}

async function create() {
  if (!form.subject_id || !form.event_type || !form.description.trim()) return
  submitting.value = true
  try {
    const event = await api.createEvent({ ...form, source: 'MANUAL', description: form.description.trim() })
    showCreate.value = false
    push('事件已创建，正在打开详情')
    router.push(`/events/${event.id}`)
  } catch (err) { push(err instanceof Error ? err.message : '创建失败', 'error') } finally { submitting.value = false }
}

async function accept(event: EventItem) {
  try { await api.accept(event.id); push('已接单，事件进入处理中'); await load() } catch (err) { push(err instanceof Error ? err.message : '接单失败', 'error') }
}
async function timeout(event: EventItem) {
  try { await api.timeout(event.id); push('已生成超时升级记录', 'warning'); await load() } catch (err) { push(err instanceof Error ? err.message : '模拟超时失败', 'error') }
}

watch(filters, load, { deep: true })
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <header class="page-heading">
      <div><p class="eyebrow"><span class="eyebrow-dot"></span>社区事件中心 / 实时工作流</p><h1>今天，先把最要紧的事接住。</h1><p>所有照护事件都沿着同一条时间线推进。风险等级、当前责任人和下一步动作，在这里保持可见。</p></div>
      <div class="heading-actions"><RouterLink class="button button-secondary" to="/simulator"><TimerReset :size="15" />模拟事件台</RouterLink><button v-if="canCreate" class="button button-primary" @click="openCreate"><Plus :size="16" />新建照护事件</button></div>
    </header>

    <section class="metric-grid" aria-label="事件概览">
      <div class="metric-card accent-coral"><div class="metric-label"><span>待处理</span><Siren :size="15" /></div><strong class="metric-value">{{ metrics.pending }}</strong><small class="metric-note">需要形成责任人</small></div>
      <div class="metric-card accent-amber"><div class="metric-label"><span>处理中</span><Clock3 :size="15" /></div><strong class="metric-value">{{ metrics.active }}</strong><small class="metric-note">含待确认事件</small></div>
      <div class="metric-card accent-coral"><div class="metric-label"><span>已超时</span><TimerReset :size="15" /></div><strong class="metric-value">{{ metrics.overdue }}</strong><small class="metric-note">已生成升级记录</small></div>
      <div class="metric-card accent-mint"><div class="metric-label"><span>当前列表</span><Filter :size="15" /></div><strong class="metric-value">{{ events.length }}</strong><small class="metric-note">{{ openEvents.length }} 条仍在闭环中</small></div>
    </section>

    <section class="panel">
      <div class="panel-head"><div><h2>照护事件队列</h2><p>按创建时间倒序 · {{ events.length }} 条记录</p></div><div class="icon-text muted-text"><SlidersHorizontal :size="15" /><span>筛选条件即时生效</span></div></div>
      <div class="filters">
        <label class="search-field"><Search :size="15" /><input v-model="filters.search" placeholder="搜索姓名、编号或说明" /></label>
        <label class="select-field"><select v-model="filters.status"><option v-for="option in statusOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></label>
        <label class="select-field"><select v-model="filters.risk"><option v-for="option in riskOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></label>
        <label class="select-field"><select v-model="filters.subject_type"><option value="ALL">老人 / 儿童</option><option value="ELDER">老人</option><option value="CHILD">儿童</option></select></label>
        <label class="select-field"><select v-model="filters.event_type"><option value="ALL">全部事件类型</option><option v-for="type in types" :key="type.value" :value="type.value">{{ type.label }}</option></select></label>
        <label v-if="assigneeOptions.length" class="select-field"><select v-model="filters.assignee"><option value="ALL">全部责任人</option><option v-for="assignee in assigneeOptions" :key="assignee.id" :value="assignee.id">{{ assignee.name }}</option></select></label>
      </div>
      <div v-if="error" class="empty-state"><Siren :size="30" /><strong>事件暂时读不到</strong><p>{{ error }}</p><button class="button button-secondary" @click="load">重试</button></div>
      <div v-else-if="loading" class="loading-state">正在读取社区事件…</div>
      <div v-else-if="events.length === 0" class="empty-state"><Filter :size="30" /><strong>这组条件下很安静</strong><p>没有匹配的照护事件。可以清空筛选，或从模拟事件台生成一条新的演示记录。</p><button class="button button-secondary" @click="Object.assign(filters, { search: '', status: 'ALL', risk: 'ALL', subject_type: 'ALL', event_type: 'ALL', assignee: 'ALL' })">清空筛选</button></div>
      <div v-else class="table-scroll">
        <table class="event-table"><thead><tr><th>事件</th><th>照护对象</th><th>风险</th><th>状态</th><th>当前责任人</th><th>时间 / 时限</th><th></th></tr></thead>
          <tbody><tr v-for="event in events" :key="event.id" class="event-row" @click="router.push(`/events/${event.id}`)">
            <td><div class="event-name"><span class="event-id">{{ event.event_no }}</span><strong>{{ event.event_type_label }}</strong><small>{{ event.source === 'SIMULATOR' ? '模拟生成' : event.source === 'SCHEDULED_CHECKIN' ? '签到计划' : '人工创建' }}</small></div></td>
            <td><div class="event-name"><strong>{{ event.subject_name }}</strong><small><span class="type-chip" :class="event.subject_type.toLowerCase()">{{ event.subject_type_label }}</span> · {{ event.subject_age }} 岁</small></div></td>
            <td><span class="risk-badge" :class="riskClass(event.risk_level)">{{ event.risk_level }} · {{ event.risk_score }}</span></td>
            <td><span class="status-badge" :class="statusClass(event.status)">{{ event.status_label }}</span><span v-if="event.timed_out" class="overdue-tag"><TimerReset :size="11" />已超时 ×{{ event.escalation_level }}</span></td>
            <td><div v-if="event.current_assignee_name" class="assignee"><span class="assignee-avatar">{{ event.current_assignee_name.slice(0, 1) }}</span><span>{{ event.current_assignee_name }}</span></div><span v-else class="muted-text">待分配</span></td>
            <td><div class="time-cell"><strong>{{ formatTime(event.created_at) }}</strong><small>{{ event.timed_out ? '已超过响应时限' : relativeTime(event.created_at) }}</small></div></td>
            <td><div class="row-action-group"><button v-if="canOperate && event.status === 'ASSIGNED'" class="row-action" title="接单" @click.stop="accept(event)"><ArrowUpRight :size="15" /></button><button v-if="session.permissions.includes('simulate_timeout') && !['CLOSED', 'CANCELLED'].includes(event.status)" class="row-action" title="模拟超时" @click.stop="timeout(event)"><TimerReset :size="15" /></button><button class="row-action" title="查看详情" @click.stop="router.push(`/events/${event.id}`)"><ChevronRight :size="16" /></button></div></td>
          </tr></tbody>
        </table>
      </div>
    </section>
  </div>

  <Teleport to="body"><div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false"><form class="modal" @submit.prevent="create"><header class="modal-head"><div><h2>新建照护事件</h2><p>提交后由后端计算风险、建立任务并生成通知。</p></div><button type="button" class="icon-button" aria-label="关闭" @click="showCreate = false"><X :size="17" /></button></header><div class="modal-body"><label class="field"><span class="field-label">照护对象</span><select v-model="form.subject_id" class="field-select" required><option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.name }} · {{ subject.subject_type_label }} · {{ subject.age }} 岁</option></select></label><label class="field"><span class="field-label">事件类型</span><select v-model="form.event_type" class="field-select" required><option v-for="type in types" :key="type.value" :value="type.value">{{ type.label }}</option></select></label><label class="field"><span class="field-label">紧急程度</span><select v-model="form.urgency" class="field-select"><option value="NORMAL">普通</option><option value="URGENT">紧急（仅主动求助适用）</option></select></label><label class="field"><span class="field-label">事实说明</span><textarea v-model="form.description" class="field-textarea" placeholder="写下需要被跟踪处理的事实，不填写诊断结论。" required></textarea></label><p v-if="form.event_type === 'ELDER_SUSPECTED_FALL'" class="form-hint">提示：页面使用“疑似异常”措辞，后续仍需人工确认。</p></div><footer class="modal-foot"><button type="button" class="button button-secondary" @click="showCreate = false">取消</button><button class="button button-primary" :disabled="submitting" type="submit"><Plus :size="15" />{{ submitting ? '正在创建…' : '创建并查看' }}</button></footer></form></div></Teleport>
</template>
