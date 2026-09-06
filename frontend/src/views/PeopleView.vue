<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowUpRight, Check, CircleUserRound, HeartPulse, Search, UserRound } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { api, type SubjectItem } from '@/services/api'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const session = useSessionStore()
const { push } = useToast()
const people = ref<SubjectItem[]>([])
const loading = ref(true)
const error = ref('')
const filters = reactive({ search: '', subject_type: 'ALL' })
const canCheckIn = computed(() => session.permissions.includes('check_in'))

function formatTime(value: string | null) {
  if (!value) return '尚未签到'
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function load() {
  loading.value = true
  error.value = ''
  try { people.value = (await api.people(Object.fromEntries(Object.entries(filters).filter(([, value]) => value && value !== 'ALL')))).items } catch (err) { error.value = err instanceof Error ? err.message : '读取对象失败' } finally { loading.value = false }
}

async function checkIn(subject: SubjectItem) {
  try { const updated = await api.checkIn(subject.id); Object.assign(subject, updated); push(`${subject.name} 的平安签到已记录`) } catch (err) { push(err instanceof Error ? err.message : '签到失败', 'error') }
}

watch(filters, load, { deep: true })
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <header class="page-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span>照护对象 / 我的社区</p><h1>先认识每一个需要被看见的人。</h1><p>这里展示和当前视角相关的老人、儿童与照护关系。位置保持模糊，信息只服务于本次照护。</p></div><div class="heading-actions"><span class="icon-text muted-text"><CircleUserRound :size="16" />{{ people.length }} 位可见对象</span></div></header>
    <section class="panel"><div class="panel-head"><div><h2>对象档案</h2><p>风险标签与最近一次平安签到</p></div><div class="filters" style="padding:0;background:transparent;border:0"><label class="search-field" style="min-width:220px"><Search :size="15" /><input v-model="filters.search" placeholder="搜索姓名或编号" /></label><label class="select-field"><select v-model="filters.subject_type"><option value="ALL">老人 / 儿童</option><option value="ELDER">老人</option><option value="CHILD">儿童</option></select></label></div></div>
      <div v-if="loading" class="loading-state">正在读取照护对象…</div><div v-else-if="error" class="empty-state"><HeartPulse :size="30" /><strong>对象档案暂时读不到</strong><p>{{ error }}</p><button class="button button-secondary" @click="load">重试</button></div><div v-else-if="!people.length" class="empty-state"><UserRound :size="30" /><strong>没有匹配对象</strong><p>换一个关键词或清空筛选条件试试看。</p></div>
      <div v-else class="people-grid" style="padding:16px"><button v-for="person in people" :key="person.id" class="person-card" @click="router.push(`/people/${person.id}`)"><span class="person-avatar" :class="{ child: person.subject_type === 'CHILD' }">{{ person.name.slice(0, 1) }}</span><span class="person-main"><strong>{{ person.name }}</strong><span class="person-subline"><span class="type-chip" :class="person.subject_type.toLowerCase()">{{ person.subject_type_label }}</span>{{ person.age }} 岁 · {{ person.building_text }}</span><span class="tag-list"><span v-for="tag in person.risk_tags" :key="tag" class="risk-tag">{{ tag }}</span><span v-if="!person.risk_tags.length" class="risk-tag empty">暂无风险标签</span></span></span><span class="person-meta"><span class="open-count" :class="{ zero: person.open_event_count === 0 }">{{ person.open_event_count }}</span><span class="open-label">未关闭事件</span><span class="icon-button"><ArrowUpRight :size="15" /></span></span></button></div>
    </section>
    <p v-if="canCheckIn" class="page-footnote"><Check :size="14" /> 可在对象详情里记录平安签到；签到会同步更新相关开放事件的风险原因。</p>
  </div>
</template>
