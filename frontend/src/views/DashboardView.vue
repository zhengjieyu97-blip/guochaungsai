<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Activity, BarChart3, Clock3, Gauge, ShieldAlert, UsersRound } from 'lucide-vue-next'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { api, type DashboardSummary } from '@/services/api'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const summary = ref<DashboardSummary | null>(null)
const loading = ref(true)
const error = ref('')
const trendRef = ref<HTMLDivElement | null>(null)
const typesRef = ref<HTMLDivElement | null>(null)
let trendChart: echarts.ECharts | null = null
let typesChart: echarts.ECharts | null = null

const riskTotal = computed(() => {
  const counts = summary.value?.risk_counts ?? {}
  return (counts.P0 ?? 0) + (counts.P1 ?? 0) + (counts.P2 ?? 0)
})
const subjectTotal = computed(() => {
  const counts = summary.value?.subject_type_counts ?? {}
  return (counts.ELDER ?? 0) + (counts.CHILD ?? 0)
})
const riskRingStyle = computed(() => {
  const total = riskTotal.value || 1
  const p0 = ((summary.value?.risk_counts.P0 ?? 0) / total) * 100
  const p1 = p0 + ((summary.value?.risk_counts.P1 ?? 0) / total) * 100
  return { background: `conic-gradient(var(--coral) 0 ${p0}%, var(--amber) ${p0}% ${p1}%, var(--sky) ${p1}% 100%)` }
})

const typeLabels: Record<string, string> = { ELDER_MISSED_CHECKIN: '老人未签到', ELDER_HELP: '老人主动求助', ELDER_SUSPECTED_FALL: '疑似跌倒', CHILD_PICKUP_TIMEOUT: '儿童接送', CHILD_CARE_CHECKIN_ABNORMAL: '托管签到', CHILD_HELP: '儿童求助' }

function renderCharts() {
  if (!summary.value || !trendRef.value || !typesRef.value) return
  trendChart?.dispose(); typesChart?.dispose()
  trendChart = echarts.init(trendRef.value)
  typesChart = echarts.init(typesRef.value)
  trendChart.setOption({
    animationDuration: 650,
    grid: { left: 8, right: 18, top: 18, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis', backgroundColor: '#14272b', borderWidth: 0, textStyle: { color: '#fbfaf6', fontSize: 11 } },
    xAxis: { type: 'category', boundaryGap: false, data: summary.value.close_trend.map((item) => item.label), axisLine: { lineStyle: { color: '#d7d1c5' } }, axisTick: { show: false }, axisLabel: { color: '#8c958f', fontSize: 10 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#ece7de' } }, axisLabel: { color: '#a0a7a1', fontSize: 10 } },
    series: [{ name: '已关闭', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7, data: summary.value.close_trend.map((item) => item.closed), lineStyle: { width: 3, color: '#4b9d7a' }, itemStyle: { color: '#4b9d7a', borderColor: '#fbfaf6', borderWidth: 2 }, areaStyle: { color: 'rgba(136,201,173,.22)' } }],
  })
  const typeEntries = Object.entries(summary.value.event_type_counts).filter(([, value]) => value > 0)
  typesChart.setOption({
    animationDuration: 650,
    grid: { left: 8, right: 18, top: 10, bottom: 18, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#14272b', borderWidth: 0, textStyle: { color: '#fbfaf6', fontSize: 11 } },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#ece7de' } }, axisLabel: { color: '#a0a7a1', fontSize: 10 } },
    yAxis: { type: 'category', data: typeEntries.map(([key]) => typeLabels[key] ?? key), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#718078', fontSize: 10 } },
    series: [{ type: 'bar', barWidth: 12, data: typeEntries.map(([, value]) => value), itemStyle: { color: '#88c9ad', borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#14272b', fontSize: 10 } }],
  })
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    summary.value = await api.dashboard()
    // 先切换出 loading 分支，再等待图表容器挂载，否则 ECharts 会拿到空引用。
    loading.value = false
    await nextTick()
    renderCharts()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取看板失败'
    loading.value = false
  }
}
function resize() { trendChart?.resize(); typesChart?.resize() }
onMounted(() => { load(); window.addEventListener('resize', resize) })
onBeforeUnmount(() => { window.removeEventListener('resize', resize); trendChart?.dispose(); typesChart?.dispose() })
</script>

<template>
  <div class="page-wrap"><header class="page-heading"><div><p class="eyebrow"><span class="eyebrow-dot"></span>社区看板 / 只读决策指标</p><h1>让社区知道，哪里需要下一步。</h1><p>指标来自后端照护事件与处置记录，不在浏览器里二次猜测。数据会随着接单、升级和关闭实时更新。</p></div><div class="heading-actions"><span class="icon-text muted-text"><Activity :size="16" />{{ summary ? '数据已同步' : '正在同步' }}</span></div></header>
  <div v-if="loading" class="loading-state">正在汇总社区指标…</div><div v-else-if="error" class="empty-state"><Gauge :size="30" /><strong>看板暂时读不到</strong><p>{{ error }}</p><button class="button button-secondary" @click="load">重试</button></div><template v-else-if="summary"><section class="metric-grid"><div class="metric-card accent-ink"><div class="metric-label"><span>今日事件</span><Activity :size="15" /></div><strong class="metric-value">{{ summary.today_total }}</strong><small class="metric-note">当前社区全部来源</small></div><div class="metric-card accent-coral"><div class="metric-label"><span>开放事件</span><ShieldAlert :size="15" /></div><strong class="metric-value">{{ summary.open_total }}</strong><small class="metric-note">{{ summary.overdue_total }} 条已超时</small></div><div class="metric-card accent-amber"><div class="metric-label"><span>平均首次响应</span><Clock3 :size="15" /></div><strong class="metric-value">{{ summary.average_first_response_minutes }}<small style="font:13px 'Plus Jakarta Sans'"> 分钟</small></strong><small class="metric-note">基于已接单任务</small></div><div class="metric-card accent-mint"><div class="metric-label"><span>超时率</span><Gauge :size="15" /></div><strong class="metric-value">{{ Math.round(summary.overdue_rate * 100) }}<small style="font:13px 'Plus Jakarta Sans'">%</small></strong><small class="metric-note">开放事件中的超时占比</small></div></section><div class="dashboard-grid"><section class="panel chart-panel"><div class="panel-head"><div><h2>最近七天关闭趋势</h2><p>每日完成关闭确认的事件数量</p></div><span class="icon-text muted-text"><BarChart3 :size="15" />已关闭 {{ summary.closed_today }} 条</span></div><div ref="trendRef" class="chart"></div></section><section class="panel chart-panel"><div class="panel-head"><div><h2>风险结构</h2><p>当前可见事件的风险分级</p></div><span class="icon-text muted-text"><UsersRound :size="15" />老人 + 儿童</span></div><div class="ring-layout"><div class="ring" :style="riskRingStyle"><div class="ring-center"><strong>{{ riskTotal }}</strong><small>当前事件</small></div></div><div class="legend-list"><div class="legend-row"><span class="legend-label"><i class="legend-dot p0"></i>P0 紧急</span><strong>{{ summary.risk_counts.P0 || 0 }}</strong></div><div class="legend-row"><span class="legend-label"><i class="legend-dot p1"></i>P1 高风险</span><strong>{{ summary.risk_counts.P1 || 0 }}</strong></div><div class="legend-row"><span class="legend-label"><i class="legend-dot p2"></i>P2 常规</span><strong>{{ summary.risk_counts.P2 || 0 }}</strong></div></div></div></section></div><div class="split-panels"><section class="panel chart-panel"><div class="panel-head"><div><h2>事件类型分布</h2><p>帮助安排社区资源，不代表医疗结论</p></div></div><div ref="typesRef" class="chart"></div></section><section class="panel"><div class="panel-head"><div><h2>对象构成</h2><p>老人和儿童事件占比</p></div></div><div class="type-list"><div class="type-row"><span>老人事件</span><span class="type-bar"><i :style="{ width: `${subjectTotal ? (summary.subject_type_counts.ELDER / subjectTotal) * 100 : 0}%` }"></i></span><strong>{{ summary.subject_type_counts.ELDER || 0 }}</strong></div><div class="type-row"><span>儿童事件</span><span class="type-bar"><i :style="{ width: `${subjectTotal ? (summary.subject_type_counts.CHILD / subjectTotal) * 100 : 0}%`, background: '#6b9ec6' }"></i></span><strong>{{ summary.subject_type_counts.CHILD || 0 }}</strong></div><p class="dashboard-footnote">风险分级展示计算原因，页面文案统一使用“疑似异常 / 建议人工确认”。</p></div></section></div></template></div>
</template>
