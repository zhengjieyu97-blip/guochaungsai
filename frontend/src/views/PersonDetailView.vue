<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, Check, ChevronRight, Clock3, HeartHandshake, MapPin, MessageCircle, ShieldCheck, UserRound } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { api, type EventItem, type SubjectItem } from '@/services/api'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const person = ref<SubjectItem | null>(null)
const events = ref<EventItem[]>([])
const loading = ref(true)
const error = ref('')
const canCheckIn = computed(() => session.permissions.includes('check_in'))
const canCreate = computed(() => session.permissions.includes('create_event'))

function formatTime(value: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '尚未记录' }
async function load() {
  loading.value = true
  error.value = ''
  try { person.value = await api.person(String(route.params.id)); events.value = (await api.events({ search: person.value.name })).items } catch (err) { error.value = err instanceof Error ? err.message : '读取档案失败' } finally { loading.value = false }
}
async function checkIn() {
  if (!person.value) return
  try { person.value = await api.checkIn(person.value.id); push('平安签到已记录'); await load() } catch (err) { push(err instanceof Error ? err.message : '签到失败', 'error') }
}
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <div v-if="loading" class="loading-state">正在打开对象档案…</div>
    <div v-else-if="error" class="empty-state"><UserRound :size="30" /><strong>档案暂时读不到</strong><p>{{ error }}</p><button class="button button-secondary" @click="load">重试</button></div>
    <template v-else-if="person">
      <header class="page-heading"><div><button class="text-button icon-text" @click="router.push('/people')"><ArrowLeft :size="15" />返回对象列表</button><p class="eyebrow" style="margin-top:18px"><span class="eyebrow-dot"></span>{{ person.subject_type_label }} / 对象档案</p><h1>{{ person.name }} <span class="detail-age">{{ person.age }} 岁</span></h1><p>{{ person.household_name }} · {{ person.building_text }} · 信息仅用于照护协同</p></div><div class="heading-actions"><button v-if="canCheckIn" class="button button-mint" @click="checkIn"><Check :size="15" />记录平安签到</button><button v-if="canCreate" class="button button-primary" @click="router.push(`/events?subject=${person.id}`)"><MessageCircle :size="15" />发起照护事件</button></div></header>
      <div class="detail-layout"><div class="detail-main"><section class="panel info-panel"><h3>基本信息</h3><dl class="info-list"><div class="info-row"><dt>照护对象编号</dt><dd>{{ person.id }}</dd></div><div class="info-row"><dt>性别 / 年龄</dt><dd>{{ person.gender }} · {{ person.age }} 岁</dd></div><div class="info-row"><dt>脱敏联系方式</dt><dd>{{ person.phone_masked || '按当前视角隐藏' }}</dd></div><div class="info-row"><dt>模糊位置</dt><dd class="icon-text"><MapPin :size="13" />{{ person.location_text }}</dd></div></dl></section><section class="panel info-panel"><h3>照护信息</h3><dl class="info-list"><div class="info-row"><dt>风险标签</dt><dd><span class="tag-list" style="justify-content:flex-end"><span v-for="tag in person.risk_tags" :key="tag" class="risk-tag">{{ tag }}</span><span v-if="!person.risk_tags.length" class="muted-text">暂无</span></span></dd></div><div class="info-row"><dt>家属 / 监护关系</dt><dd><span class="relation-list"><span v-for="relation in person.relationships" :key="`${relation.name}-${relation.relationship_type}`">{{ relation.name }} · {{ relation.role }}</span><span v-if="!person.relationships.length" class="muted-text">按当前视角隐藏</span></span></dd></div><div class="info-row"><dt>平安签到计划</dt><dd>{{ person.check_in_interval_hours ? `每 ${person.check_in_interval_hours} 小时` : '未配置' }}</dd></div><div class="info-row"><dt>最近平安签到</dt><dd>{{ formatTime(person.last_check_in_at) }}</dd></div><div v-if="person.pickup_plan_text" class="info-row"><dt>接送计划</dt><dd>{{ person.pickup_plan_text }}</dd></div></dl></section><section v-if="person.notes_safe" class="panel info-panel"><h3>安全备注</h3><p class="safe-note"><ShieldCheck :size="16" />{{ person.notes_safe }}</p></section></div><aside class="detail-side"><section class="panel info-panel"><h3>未关闭事件 <span class="side-count">{{ person.open_event_count }}</span></h3><div v-if="!events.length" class="empty-mini"><Check :size="18" />当前没有匹配事件</div><button v-for="event in events" :key="event.id" class="mini-event" @click="router.push(`/events/${event.id}`)"><span class="risk-badge" :class="event.risk_level.toLowerCase()">{{ event.risk_level }}</span><span><strong>{{ event.event_type_label }}</strong><small>{{ event.status_label }} · {{ formatTime(event.created_at) }}</small></span><ChevronRight :size="14" /></button></section><section class="panel info-panel"><h3>协同提醒</h3><p class="reminder-copy"><Clock3 :size="16" /> 每次签到、联系与处置都会写入事件时间线，关闭后仍保留只读记录。</p><button class="button button-secondary" style="width:100%" @click="router.push('/events')">打开事件中心 <ChevronRight :size="14" /></button></section></aside></div>
    </template>
  </div>
</template>
