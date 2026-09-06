<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, Clock3, FileText, HandHelping, Info, MessageCircle, RotateCcw, ShieldAlert, TimerReset, UserRound, X } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { api, type EventItem, type ResourceItem } from '@/services/api'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const event = ref<EventItem | null>(null)
const resources = ref<ResourceItem[]>([])
const loading = ref(true)
const error = ref('')
const modal = ref<'action' | 'transfer' | 'close' | 'confirm' | 'cancel' | null>(null)
const submitting = ref(false)
const actionForm = reactive({ action_type: 'CALL', content: '', complete: false })
const transferForm = reactive({ assignee_id: '', reason: '' })
const closeReason = ref('')

const isClosed = computed(() => Boolean(event.value && ['CLOSED', 'CANCELLED'].includes(event.value.status)))
const canAccept = computed(() => session.permissions.includes('accept') && event.value?.status === 'ASSIGNED')
const canAction = computed(() => session.permissions.includes('record_action') && !isClosed.value)
const canTransfer = computed(() => (session.permissions.includes('transfer') || session.permissions.includes('request_transfer')) && !isClosed.value)
const canTimeout = computed(() => session.permissions.includes('simulate_timeout') && !isClosed.value)
const canFamilyConfirm = computed(() => session.permissions.includes('confirm_close') && !isClosed.value)
const canForceClose = computed(() => session.permissions.includes('force_close') && !isClosed.value)
const canCheckIn = computed(() => session.permissions.includes('check_in') && !isClosed.value)

function formatTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
function fullTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
function riskClass(level: string) { return level.toLowerCase() }
function timelineTone(item: EventItem['timeline'][number]) { return ['ESCALATED', 'CANCELLED'].includes(item.action_type) ? 'alert' : ['EVENT_CREATED', 'RISK_CLASSIFIED'].includes(item.action_type) ? 'muted' : '' }

async function load() {
  loading.value = true
  error.value = ''
  try { event.value = await api.event(String(route.params.id)); resources.value = (await api.resources()).items; if (!transferForm.assignee_id) transferForm.assignee_id = resources.value.find((item) => item.id !== event.value?.current_assignee_id)?.id || '' } catch (err) { error.value = err instanceof Error ? err.message : '读取事件详情失败' } finally { loading.value = false }
}

async function run(command: () => Promise<EventItem>, message: string, tone: 'success' | 'warning' = 'success') {
  submitting.value = true
  try { event.value = await command(); modal.value = null; push(message, tone) } catch (err) { push(err instanceof Error ? err.message : '操作失败', 'error') } finally { submitting.value = false }
}
function accept() { if (event.value) run(() => api.accept(event.value!.id), '已接单，事件进入处理中') }
function timeout() { if (event.value) run(() => api.timeout(event.value!.id), '已生成超时升级记录', 'warning') }
function checkIn() { if (event.value) run(() => api.eventCheckIn(event.value!.id), '已记录平安签到，事件进入待确认') }
function submitAction() { if (event.value && actionForm.content.trim()) run(() => api.action(event.value!.id, { ...actionForm, content: actionForm.content.trim() }), actionForm.complete ? '处置已保存，事件进入待确认' : '处置记录已写入时间线') }
function submitTransfer() { if (event.value && transferForm.assignee_id && transferForm.reason.trim()) run(() => api.assign(event.value!.id, { assignee_id: transferForm.assignee_id, reason: transferForm.reason.trim() }), '已转派给新的责任人') }
function submitClose(family: boolean) { if (event.value && closeReason.value.trim()) run(() => family ? api.confirmClose(event.value!.id, closeReason.value.trim()) : api.close(event.value!.id, closeReason.value.trim()), family ? '家属确认已解决，事件关闭' : '事件已授权关闭') }
function submitCancel() { if (event.value && closeReason.value.trim()) run(() => api.cancel(event.value!.id, closeReason.value.trim()), '事件已取消', 'warning') }
function openAction() { actionForm.content = ''; actionForm.complete = false; modal.value = 'action' }
function openTransfer() { transferForm.reason = ''; modal.value = 'transfer' }
function openClose(kind: 'close' | 'confirm' | 'cancel') { closeReason.value = ''; modal.value = kind }

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <div v-if="loading" class="loading-state">正在展开事件时间线…</div>
    <div v-else-if="error" class="empty-state"><ShieldAlert :size="30" /><strong>事件详情暂时读不到</strong><p>{{ error }}</p><button class="button button-secondary" @click="load">重试</button></div>
    <template v-else-if="event">
      <div class="detail-back"><button class="text-button icon-text" @click="router.push('/events')"><ArrowLeft :size="15" />返回事件中心</button><span class="event-id">{{ event.event_no }}</span></div>
      <section class="detail-hero"><div><p class="eyebrow"><span class="eyebrow-dot"></span>{{ event.subject_type_label }} / {{ event.event_type_label }}</p><h1>{{ event.subject_name }} · {{ event.event_type_label }}</h1><p>{{ event.description }}</p></div><div class="detail-hero-meta"><span class="hero-id">{{ event.event_no }} · {{ event.source === 'SIMULATOR' ? '模拟生成' : '真实业务记录' }}</span><div class="hero-risk"><span class="risk-badge" :class="riskClass(event.risk_level)">{{ event.risk_level }} · {{ event.risk_level_label }}</span><strong class="hero-risk-score">{{ event.risk_score }}</strong></div><span v-if="event.timed_out" class="overdue-tag"><TimerReset :size="12" />已超时 · 升级 {{ event.escalation_level }} 次</span></div></section>
      <div class="detail-layout"><main class="detail-main"><section class="panel timeline-panel"><div class="section-title-row"><h2>照护时间线</h2><span class="status-badge" :class="{ closed: isClosed, waiting: event.status === 'WAITING_CONFIRM', 'in-progress': event.status === 'IN_PROGRESS' }">{{ event.status_label }}</span></div><div class="timeline"><div v-for="item in event.timeline" :key="item.id" class="timeline-item" :class="timelineTone(item)"><span class="timeline-marker"></span><div class="timeline-content"><div class="timeline-top"><strong>{{ item.action_label }}</strong><time>{{ fullTime(item.created_at) }}</time></div><p>{{ item.content }}</p><span class="timeline-actor">{{ item.actor_name }} · 服务端记录</span></div></div></div><div v-if="!event.timeline.length" class="empty-mini">还没有时间线记录</div></section><section class="panel assignment-panel"><div class="panel-head"><div><h2>任务流转</h2><p>同一事件同时只保留一个当前责任人，历史转派仍可追溯。</p></div></div><div class="assignment-history"><div v-for="assignment in event.assignments" :key="assignment.id" class="assignment-row"><span class="assignment-level">{{ assignment.assignment_level }}</span><span><strong>{{ assignment.assignee_name }}</strong><small>{{ assignment.status === 'TRANSFERRED' ? `已转派 · ${assignment.transfer_reason}` : assignment.accepted_at ? '已接单' : '等待接单' }}</small></span><span class="assignment-status">{{ formatTime(assignment.assigned_at) }}</span></div></div></section></main><aside class="detail-side"><section class="panel info-panel"><h3>事件信息</h3><dl class="info-list"><div class="info-row"><dt>照护对象</dt><dd>{{ event.subject_name }} · {{ event.subject_age }} 岁</dd></div><div class="info-row"><dt>当前责任人</dt><dd>{{ event.current_assignee_name || '待分配' }}</dd></div><div class="info-row"><dt>创建时间</dt><dd>{{ fullTime(event.created_at) }}</dd></div><div class="info-row"><dt>首次接单时限</dt><dd :class="{ 'danger-text': event.timed_out }">{{ fullTime(event.first_response_due_at) }}</dd></div><div class="info-row"><dt>升级等级</dt><dd>{{ event.escalation_level }} 级</dd></div></dl></section><section class="panel info-panel"><h3>风险为什么是 {{ event.risk_level }}？</h3><p class="risk-explain">分数由事件类型、照护标签与当前处理时效计算。它是协同优先级，不是医疗诊断。</p><div class="risk-reasons"><div v-for="reason in event.risk_reasons" :key="`${reason.label}-${reason.delta}`" class="risk-reason" :class="{ negative: reason.delta < 0 }"><span>{{ reason.label }}</span><span>{{ reason.delta > 0 ? '+' : '' }}{{ reason.delta }}</span></div></div></section><section class="panel action-panel"><h3>下一步动作</h3><div v-if="isClosed" class="closed-banner"><CheckCircle2 :size="17" /><span>事件已结束，时间线只读。</span></div><div v-else class="action-grid"><button v-if="canAccept" class="button button-primary" @click="accept"><ArrowUpRight :size="15" />接单</button><button v-if="canAction" class="button button-mint" @click="openAction"><FileText :size="15" />记录处置</button><button v-if="canTransfer" class="button button-secondary" @click="openTransfer"><ArrowUpRight :size="15" />{{ session.role === 'RESPONDER' ? '请求转派' : '转派任务' }}</button><button v-if="canTimeout" class="button button-secondary" @click="timeout"><TimerReset :size="15" />模拟超时</button><button v-if="canCheckIn" class="button button-secondary" @click="checkIn"><Check :size="15" />平安签到</button><button v-if="canFamilyConfirm && event.status === 'WAITING_CONFIRM'" class="button button-mint" @click="openClose('confirm')"><CheckCircle2 :size="15" />确认已解决</button><button v-if="canForceClose" class="button button-danger" @click="openClose('close')"><ShieldAlert :size="15" />授权关闭</button><button v-if="session.permissions.includes('cancel') && !isClosed" class="button button-quiet" @click="openClose('cancel')"><X :size="15" />标记误报 / 取消</button></div><p class="action-note"><Info :size="13" /> 关闭前必须至少有一条处置反馈；所有动作都会由服务端写入时间线。</p></section></aside></div>
    </template>
  </div>

  <Teleport to="body"><div v-if="modal" class="modal-backdrop" @click.self="modal = null"><form v-if="modal === 'action'" class="modal" @submit.prevent="submitAction"><header class="modal-head"><div><h2>记录处置反馈</h2><p>写下事实与动作，必要时勾选“本次处置已完成”。</p></div><button type="button" class="icon-button" aria-label="关闭" @click="modal = null"><X :size="17" /></button></header><div class="modal-body"><label class="field"><span class="field-label">处置类型</span><select v-model="actionForm.action_type" class="field-select"><option value="CALL">电话联系</option><option value="ARRIVE_CHECK">到场查看</option><option value="ASSIST_SERVICE">协助服务</option><option value="CONTACT_GUARDIAN">联系家属 / 监护人</option><option value="FALSE_REPORT">误报说明</option><option value="OTHER">其他</option></select></label><label class="field"><span class="field-label">事实说明</span><textarea v-model="actionForm.content" class="field-textarea" required placeholder="例如：已电话联系家属，确认老人正在休息。"></textarea></label><label class="checkbox-line"><input v-model="actionForm.complete" type="checkbox" />本次处置已完成，事件进入待确认</label></div><footer class="modal-foot"><button type="button" class="button button-secondary" @click="modal = null">取消</button><button class="button button-primary" :disabled="submitting || !actionForm.content.trim()" type="submit"><FileText :size="15" />保存处置</button></footer></form><form v-else-if="modal === 'transfer'" class="modal" @submit.prevent="submitTransfer"><header class="modal-head"><div><h2>转派照护任务</h2><p>新的责任人会收到站内通知，原任务历史会保留。</p></div><button type="button" class="icon-button" aria-label="关闭" @click="modal = null"><X :size="17" /></button></header><div class="modal-body"><label class="field"><span class="field-label">新的责任人</span><select v-model="transferForm.assignee_id" class="field-select" required><option v-for="resource in resources.filter((item) => item.id !== event?.current_assignee_id)" :key="resource.id" :value="resource.id">{{ resource.name }} · {{ resource.title }}</option></select></label><label class="field"><span class="field-label">转派原因</span><textarea v-model="transferForm.reason" class="field-textarea" required placeholder="请说明为什么需要新的响应人接手。"></textarea></label></div><footer class="modal-foot"><button type="button" class="button button-secondary" @click="modal = null">取消</button><button class="button button-primary" :disabled="submitting || !transferForm.assignee_id || !transferForm.reason.trim()" type="submit"><ArrowUpRight :size="15" />确认转派</button></footer></form><form v-else class="modal" @submit.prevent="modal === 'confirm' ? submitClose(true) : modal === 'close' ? submitClose(false) : submitCancel()"><header class="modal-head"><div><h2>{{ modal === 'confirm' ? '确认事件已解决' : modal === 'close' ? '授权关闭事件' : '取消 / 误报说明' }}</h2><p>{{ modal === 'confirm' ? '确认后事件进入只读状态。' : '请留下完整说明，便于后续复盘。' }}</p></div><button type="button" class="icon-button" aria-label="关闭" @click="modal = null"><X :size="17" /></button></header><div class="modal-body"><label class="field"><span class="field-label">说明</span><textarea v-model="closeReason" class="field-textarea" required :placeholder="modal === 'confirm' ? '例如：已确认老人当前平安，事件得到处理。' : '请填写关闭或取消原因。'"></textarea></label></div><footer class="modal-foot"><button type="button" class="button button-secondary" @click="modal = null">取消</button><button class="button" :class="modal === 'cancel' ? 'button-danger' : 'button-primary'" :disabled="submitting || !closeReason.trim()" type="submit">{{ modal === 'confirm' ? '确认关闭' : modal === 'close' ? '授权关闭' : '确认取消' }}</button></footer></form></div></Teleport>
</template>
