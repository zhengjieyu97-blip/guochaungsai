<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowUpRight, CheckCircle2, ChevronRight, Clock3, Filter, Plus, Search, Siren, SlidersHorizontal, TimerReset, X } from 'lucide-vue-next'
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
const filters = reactive({
  search: '',
  status: 'ALL',
  risk: 'ALL',
  subject_type: 'ALL',
  event_type: 'ALL',
  assignee: 'ALL'
})
const form = reactive({ subject_id: '', event_type: '', urgency: 'NORMAL', description: '' })

const statusOptions = [
  ['ALL', '全部状态'],
  ['PENDING', '待处理'],
  ['ASSIGNED', '已派单'],
  ['IN_PROGRESS', '处理中'],
  ['WAITING_CONFIRM', '待确认'],
  ['CLOSED', '已关闭'],
  ['CANCELLED', '已取消']
] as const

const riskOptions = [
  ['ALL', '全部风险'],
  ['P0', 'P0 紧急'],
  ['P1', 'P1 高风险'],
  ['P2', 'P2 常规']
] as const

const openEvents = computed(() => events.value.filter((event) => !['CLOSED', 'CANCELLED'].includes(event.status)))
const metrics = computed(() => ({
  pending: events.value.filter((event) => ['PENDING', 'ASSIGNED'].includes(event.status)).length,
  active: events.value.filter((event) => ['IN_PROGRESS', 'WAITING_CONFIRM'].includes(event.status)).length,
  overdue: events.value.filter((event) => event.timed_out).length,
  closed: events.value.filter((event) => event.status === 'CLOSED').length
}))
const canCreate = computed(() => session.permissions.includes('create_event'))
const canOperate = computed(() => session.permissions.includes('accept'))
const assigneeOptions = computed(() =>
  Array.from(
    new Map(
      events.value
        .filter((event) => event.current_assignee_id && event.current_assignee_name)
        .map((event) => [event.current_assignee_id, { id: event.current_assignee_id as string, name: event.current_assignee_name as string }])
    ).values()
  )
)

function formatTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function riskClass(level: string) {
  return level.toLowerCase()
}
function statusClass(status: string) {
  return status === 'IN_PROGRESS'
    ? 'in-progress'
    : status === 'WAITING_CONFIRM'
    ? 'waiting'
    : status === 'CLOSED'
    ? 'closed'
    : ''
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== 'ALL'))
    const [eventResult, subjectResult, typeResult] = await Promise.all([
      api.events(params),
      api.people(),
      api.eventTypes()
    ])
    events.value = eventResult.items
    subjects.value = subjectResult.items
    types.value = typeResult
    if (!form.subject_id && subjects.value.length) form.subject_id = subjects.value[0].id
    if (!form.event_type && types.value.length) form.event_type = types.value[0].value
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取事件失败'
  } finally {
    loading.value = false
  }
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
  } catch (err) {
    push(err instanceof Error ? err.message : '创建失败', 'error')
  } finally {
    submitting.value = false
  }
}

async function accept(event: EventItem) {
  try {
    await api.accept(event.id)
    push('已接单，事件进入处理中')
    await load()
  } catch (err) {
    push(err instanceof Error ? err.message : '接单失败', 'error')
  }
}

async function timeout(event: EventItem) {
  try {
    await api.timeout(event.id)
    push('已生成超时升级记录', 'warning')
    await load()
  } catch (err) {
    push(err instanceof Error ? err.message : '模拟超时失败', 'error')
  }
}

watch(filters, load, { deep: true })
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <header class="page-heading">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span>社区事件中心 / 实时工作流</p>
        <h1>今天，先把最要紧的事接住。</h1>
        <p>所有照护事件都沿着同一条时间线推进。风险等级、当前责任人和下一步动作，在这里保持透明可见。</p>
      </div>
      <div class="heading-actions">
        <RouterLink class="button button-secondary" to="/simulator">
          <TimerReset :size="16" />模拟事件台
        </RouterLink>
        <button v-if="canCreate" class="button button-primary" @click="openCreate">
          <Plus :size="16" />新建照护事件
        </button>
      </div>
    </header>

    <section class="metric-grid" aria-label="事件概览">
      <div class="metric-card accent-coral">
        <div class="metric-label">
          <span>待处理</span>
          <Siren :size="16" />
        </div>
        <strong class="metric-value">{{ metrics.pending }}</strong>
        <small class="metric-note">需要尽快响应并派发责任人</small>
      </div>

      <div class="metric-card accent-amber">
        <div class="metric-label">
          <span>处理中 / 待确认</span>
          <Clock3 :size="16" />
        </div>
        <strong class="metric-value">{{ metrics.active }}</strong>
        <small class="metric-note">已接单正在上门或等待闭环确认</small>
      </div>

      <div class="metric-card accent-mint">
        <div class="metric-label">
          <span>已超时升级</span>
          <TimerReset :size="16" />
        </div>
        <strong class="metric-value">{{ metrics.overdue }}</strong>
        <small class="metric-note">已触发自动升级流转</small>
      </div>

      <div class="metric-card accent-ink">
        <div class="metric-label">
          <span>已闭环事件</span>
          <CheckCircle2 :size="16" />
        </div>
        <strong class="metric-value">{{ metrics.closed }}</strong>
        <small class="metric-note">家属或社区已确认解决</small>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>事件队列</h2>
          <p>当前视角下可见的全部照护事件</p>
        </div>
        <span class="icon-text muted-text">
          <Filter :size="15" />
          共 {{ events.length }} 条事件
        </span>
      </div>

      <div class="filters">
        <label class="search-field">
          <Search :size="16" />
          <input v-model="filters.search" placeholder="搜索姓名、编号或说明" />
        </label>

        <label class="select-field">
          <select v-model="filters.status">
            <option v-for="[value, label] in statusOptions" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>

        <label class="select-field">
          <select v-model="filters.risk">
            <option v-for="[value, label] in riskOptions" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>

        <label class="select-field">
          <select v-model="filters.subject_type">
            <option value="ALL">全部对象类型</option>
            <option value="ELDER">老人</option>
            <option value="CHILD">儿童</option>
          </select>
        </label>

        <label v-if="assigneeOptions.length" class="select-field">
          <select v-model="filters.assignee">
            <option value="ALL">全部责任人</option>
            <option v-for="person in assigneeOptions" :key="person.id" :value="person.id">
              {{ person.name }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="loading" class="loading-state">正在同步事件列表…</div>
      <div v-else-if="error" class="empty-state">
        <Siren :size="32" />
        <strong>事件列表读取失败</strong>
        <p>{{ error }}</p>
        <button class="button button-secondary" @click="load">重试</button>
      </div>
      <div v-else-if="!events.length" class="empty-state">
        <CheckCircle2 :size="32" />
        <strong>当前没有匹配的事件</strong>
        <p>可以尝试切换筛选条件，或者点击上方按钮模拟/新建事件。</p>
      </div>
      <div v-else class="table-scroll">
        <table class="event-table">
          <thead>
            <tr>
              <th>事件编号</th>
              <th>照护对象</th>
              <th>事件类型</th>
              <th>风险等级</th>
              <th>当前状态</th>
              <th>当前责任人</th>
              <th>发生时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="event in events"
              :key="event.id"
              class="event-row"
              @click="router.push(`/events/${event.id}`)"
            >
              <td>
                <span class="event-id">{{ event.event_no }}</span>
              </td>
              <td>
                <div class="event-name">
                  <strong>{{ event.subject_name }}</strong>
                  <small>{{ event.subject_age }} 岁 · {{ event.subject_type_label }}</small>
                </div>
              </td>
              <td>
                <span class="type-chip" :class="event.subject_type.toLowerCase()">
                  {{ event.event_type_label }}
                </span>
              </td>
              <td>
                <span class="risk-badge" :class="riskClass(event.risk_level)">
                  {{ event.risk_level }} · {{ event.risk_score }}
                </span>
              </td>
              <td>
                <span class="status-badge" :class="statusClass(event.status)">
                  {{ event.status_label }}
                </span>
                <span v-if="event.timed_out" class="overdue-tag">
                  <TimerReset :size="12" />超时
                </span>
              </td>
              <td>
                <div v-if="event.current_assignee_name" class="assignee">
                  <span class="assignee-avatar">{{ event.current_assignee_name.slice(0, 1) }}</span>
                  <span>{{ event.current_assignee_name }}</span>
                </div>
                <span v-else class="muted-text">待分配</span>
              </td>
              <td>
                <div class="time-cell">
                  <strong>{{ formatTime(event.created_at) }}</strong>
                  <small>{{ event.source === 'SIMULATOR' ? '模拟事件' : '系统生成' }}</small>
                </div>
              </td>
              <td @click.stop>
                <button
                  v-if="canOperate && event.status === 'ASSIGNED'"
                  class="button button-primary"
                  style="min-height: 34px; padding: 0 12px; font-size: 13px;"
                  @click="accept(event)"
                >
                  接单
                </button>
                <button
                  v-else
                  class="row-action"
                  title="查看详情"
                  @click="router.push(`/events/${event.id}`)"
                >
                  <ChevronRight :size="18" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create Event Modal -->
    <Teleport to="body">
      <div v-if="showCreate" class="modal-backdrop" @click.self="showCreate = false">
        <form class="modal" @submit.prevent="create">
          <header class="modal-head">
            <div>
              <h2>新建照护事件</h2>
              <p>人工录入社区现场发现的照护需求或异常</p>
            </div>
            <button type="button" class="icon-button" aria-label="关闭" @click="showCreate = false">
              <X :size="18" />
            </button>
          </header>

          <div class="modal-body">
            <label class="field">
              <span class="field-label">照护对象</span>
              <select v-model="form.subject_id" class="field-select" required>
                <option v-for="person in subjects" :key="person.id" :value="person.id">
                  {{ person.name }}（{{ person.subject_type_label }} · {{ person.building_text }}）
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">事件类型</span>
              <select v-model="form.event_type" class="field-select" required>
                <option v-for="item in types" :key="item.value" :value="item.value">
                  {{ item.label }}（{{ item.default_level }}）
                </option>
              </select>
            </label>

            <label class="field">
              <span class="field-label">情况说明</span>
              <textarea
                v-model="form.description"
                class="field-textarea"
                required
                placeholder="请详细描述现场情况、诉求及现场发现时间。"
              ></textarea>
            </label>
          </div>

          <footer class="modal-foot">
            <button type="button" class="button button-secondary" @click="showCreate = false">取消</button>
            <button
              class="button button-primary"
              :disabled="submitting || !form.description.trim()"
              type="submit"
            >
              <Plus :size="16" />立即创建
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </div>
</template>
