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

const typeLabels: Record<string, string> = {
  ELDER_MISSED_CHECKIN: '老人未签到',
  ELDER_HELP: '老人主动求助',
  ELDER_SUSPECTED_FALL: '疑似跌倒',
  CHILD_PICKUP_TIMEOUT: '儿童接送',
  CHILD_CARE_CHECKIN_ABNORMAL: '托管签到',
  CHILD_HELP: '儿童求助'
}

function renderCharts() {
  if (!summary.value || !trendRef.value || !typesRef.value) return
  trendChart?.dispose()
  typesChart?.dispose()
  trendChart = echarts.init(trendRef.value)
  typesChart = echarts.init(typesRef.value)

  trendChart.setOption({
    animationDuration: 750,
    grid: { left: 16, right: 24, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#334155',
      borderRadius: 8,
      padding: [10, 14],
      textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif' }
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: summary.value.close_trend.map((item) => item.label),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontSize: 12, fontFamily: 'Plus Jakarta Sans, sans-serif' }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }
    },
    series: [{
      name: '已关闭事件',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      data: summary.value.close_trend.map((item) => item.closed),
      lineStyle: { width: 3.5, color: '#0d9488' },
      itemStyle: { color: '#0d9488', borderColor: '#ffffff', borderWidth: 2.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(13, 148, 136, 0.28)' },
          { offset: 1, color: 'rgba(13, 148, 136, 0.02)' }
        ])
      }
    }]
  })

  const typeEntries = Object.entries(summary.value.event_type_counts).filter(([, value]) => value > 0)
  typesChart.setOption({
    animationDuration: 750,
    grid: { left: 16, right: 32, top: 16, bottom: 20, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#334155',
      borderRadius: 8,
      padding: [10, 14],
      textStyle: { color: '#f8fafc', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif' }
    },
    xAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f1f5f9' } },
      axisLabel: { color: '#94a3b8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }
    },
    yAxis: {
      type: 'category',
      data: typeEntries.map(([key]) => typeLabels[key] ?? key),
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#334155', fontSize: 13, fontWeight: 600, fontFamily: 'Plus Jakarta Sans, sans-serif' }
    },
    series: [{
      type: 'bar',
      barWidth: 16,
      data: typeEntries.map(([, value]) => value),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
          { offset: 0, color: '#14b8a6' },
          { offset: 1, color: '#0d9488' }
        ]),
        borderRadius: [0, 8, 8, 0]
      },
      label: {
        show: true,
        position: 'right',
        color: '#0f172a',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'JetBrains Mono, monospace'
      }
    }]
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    summary.value = await api.dashboard()
    loading.value = false
    await nextTick()
    renderCharts()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '读取看板失败'
    loading.value = false
  }
}

function resize() {
  trendChart?.resize()
  typesChart?.resize()
}

onMounted(() => {
  load()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  trendChart?.dispose()
  typesChart?.dispose()
})
</script>

<template>
  <div class="page-wrap">
    <header class="page-heading">
      <div>
        <div class="page-title-row">
          <h1>社区运行看板</h1>
          <span class="page-status-tag">实时决策数据</span>
        </div>
        <p>汇聚全区照护事件、响应时效、风险分布及闭环处置统计数据</p>
      </div>
      <div class="heading-actions">
        <span class="icon-text muted-text">
          <Activity :size="16" />
          {{ summary ? '数据已同步' : '正在同步' }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="loading-state">正在汇总社区指标…</div>
    <div v-else-if="error" class="empty-state">
      <Gauge :size="32" />
      <strong>看板读取失败</strong>
      <p>{{ error }}</p>
      <button class="button button-secondary" @click="load">重试</button>
    </div>
    <template v-else-if="summary">
      <section class="metric-grid" aria-label="核心指标">
        <div class="metric-card accent-ink">
          <div class="metric-label">
            <span>今日总事件</span>
            <Activity :size="16" />
          </div>
          <strong class="metric-value">{{ summary.today_total }}</strong>
          <small class="metric-note">社区全部来源事件数</small>
        </div>

        <div class="metric-card accent-coral">
          <div class="metric-label">
            <span>开放处理中</span>
            <ShieldAlert :size="16" />
          </div>
          <strong class="metric-value">{{ summary.open_total }}</strong>
          <small class="metric-note">{{ summary.overdue_total }} 条已超时升级</small>
        </div>

        <div class="metric-card accent-amber">
          <div class="metric-label">
            <span>平均响应时长</span>
            <Clock3 :size="16" />
          </div>
          <strong class="metric-value">{{ summary.average_first_response_minutes }}<span style="font-size: 16px; font-weight: 500; margin-left: 4px;">分钟</span></strong>
          <small class="metric-note">已接单任务平均首次响应</small>
        </div>

        <div class="metric-card accent-mint">
          <div class="metric-label">
            <span>超时升级率</span>
            <Gauge :size="16" />
          </div>
          <strong class="metric-value">{{ Math.round(summary.overdue_rate * 100) }}<span style="font-size: 16px; font-weight: 500; margin-left: 2px;">%</span></strong>
          <small class="metric-note">开放事件中超时升级比例</small>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="panel chart-panel">
          <div class="panel-head">
            <div>
              <h2>最近七天关闭趋势</h2>
              <p>每日完成确认闭环的事件数量统计</p>
            </div>
            <span class="icon-text muted-text">
              <BarChart3 :size="16" />
              今日关闭 {{ summary.closed_today }} 条
            </span>
          </div>
          <div ref="trendRef" class="chart"></div>
        </section>

        <section class="panel chart-panel">
          <div class="panel-head">
            <div>
              <h2>风险结构</h2>
              <p>当前可见事件的风险分级构成</p>
            </div>
            <span class="icon-text muted-text">
              <UsersRound :size="16" />
              老人 + 儿童
            </span>
          </div>
          <div class="ring-layout">
            <div class="ring" :style="riskRingStyle">
              <div class="ring-center">
                <strong>{{ riskTotal }}</strong>
                <small>当前事件</small>
              </div>
            </div>
            <div class="legend-list">
              <div class="legend-row">
                <span class="legend-label"><i class="legend-dot p0"></i>P0 紧急</span>
                <strong>{{ summary.risk_counts.P0 || 0 }}</strong>
              </div>
              <div class="legend-row">
                <span class="legend-label"><i class="legend-dot p1"></i>P1 高风险</span>
                <strong>{{ summary.risk_counts.P1 || 0 }}</strong>
              </div>
              <div class="legend-row">
                <span class="legend-label"><i class="legend-dot p2"></i>P2 常规</span>
                <strong>{{ summary.risk_counts.P2 || 0 }}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="split-panels">
        <section class="panel chart-panel">
          <div class="panel-head">
            <div>
              <h2>事件类型分布</h2>
              <p>按业务场景分布统计</p>
            </div>
          </div>
          <div ref="typesRef" class="chart"></div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <h2>照护对象结构</h2>
              <p>老人与儿童照护事件分类占比</p>
            </div>
          </div>
          <div class="type-list">
            <div class="type-row">
              <span>老人事件</span>
              <span class="type-bar">
                <i :style="{ width: `${subjectTotal ? (summary.subject_type_counts.ELDER / subjectTotal) * 100 : 0}%` }"></i>
              </span>
              <strong>{{ summary.subject_type_counts.ELDER || 0 }}</strong>
            </div>
            <div class="type-row">
              <span>儿童事件</span>
              <span class="type-bar">
                <i :style="{ width: `${subjectTotal ? (summary.subject_type_counts.CHILD / subjectTotal) * 100 : 0}%`, background: '#3b82f6' }"></i>
              </span>
              <strong>{{ summary.subject_type_counts.CHILD || 0 }}</strong>
            </div>
            <p class="dashboard-footnote">
              风险等级由基准分与已知标签动态计算生成，供网格员与家属协同参考。
            </p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
