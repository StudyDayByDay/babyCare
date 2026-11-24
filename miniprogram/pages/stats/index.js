const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText, prettyDay } = require('../../utils/date.js')
const { openDay } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    span: 7,
    markedDays: [],
    hasData: false,
    chartMetric: 'feed',
    chart: [],
    chartAvg: '0 次',
    chartTotal: '0 次',
    chartMax: '0 次',
    chartUnit: '次',
    chartRange: '',
    milkBottle: 0,
    milkFormula: 0,
    breastMin: 0,
    peeCount: 0,
    poopCount: 0
  },
  onShow() {
    this.reload()
  },
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      this.syncTab(2, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, loading: false, pageError: '' })
        return null
      }
      this.baby = session.baby
      return this.load()
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load() {
    const endDay = dayKey()
    const startDay = addDays(endDay, -(this.data.span - 1))
    return api.getRange({ babyId: this.baby._id, startDay, endDay }).then((range) => {
      const totals = range.totals || {}
      const hasData = !!(
        totals.feedCount || totals.formulaMl || totals.bottleBreastMl || totals.breastMin ||
        totals.diaperCount || totals.peeCount || totals.poopCount || totals.sleepMin || totals.medTotal
      )
      this.rangeDays = range.days || []
      const days = this.rangeDays.map((day) => {
        const marked = !!(
          day.feedCount || day.formulaMl || day.bottleBreastMl || day.breastMin ||
          day.diaperCount || day.poopCount || day.sleepMin || day.medTotal
        )
        return { day: day.day, pretty: prettyDay(day.day), marked }
      }).reverse()
      this.setData({
        hasData,
        markedDays: days.filter((day) => day.marked),
        chartRange: prettyDay(startDay).slice(0, -3) + ' – ' + prettyDay(endDay).slice(0, -3),
        milkBottle: Number(totals.bottleBreastMl) || 0,
        milkFormula: Number(totals.formulaMl) || 0,
        breastMin: Number(totals.breastMin) || 0,
        peeCount: Number(totals.peeCount) || 0,
        poopCount: Number(totals.poopCount) || 0,
        pageError: ''
      })
      this.buildChart()
    })
  },
  buildChart() {
    const metric = this.data.chartMetric
    const days = this.rangeDays || []
    const valueOf = (day) => {
      if (metric === 'feed') return Number(day.feedCount) || 0
      if (metric === 'pee') return Number(day.peeCount) || 0
      if (metric === 'poop') return Number(day.poopCount) || 0
      return Number(day.sleepMin) || 0
    }
    const raw = days.map(valueOf)
    const max = Math.max.apply(null, raw.concat([1]))
    const compact = days.length > 7
    const today = dayKey()
    const chart = days.map((day, index) => {
      const value = raw[index]
      const display = metric === 'sleep'
        ? String(Math.round(value / 6) / 10)
        : String(value)
      return {
        day: day.day,
        label: compact ? '' : prettyDay(day.day).slice(-2),
        value: compact ? '' : display,
        percent: value > 0 ? Math.max(4, Math.round(value / max * 100)) : 0,
        isToday: day.day === today
      }
    })
    const total = raw.reduce((sum, value) => sum + value, 0)
    const avg = days.length ? total / days.length : 0
    const maxValue = Math.max.apply(null, raw.concat([0]))
    const unit = metric === 'sleep' ? '小时' : '次'
    const fmt = (value) => metric === 'sleep'
      ? (Math.round(value / 6) / 10) + ' 小时'
      : value + ' 次'
    this.setData({
      chart,
      chartUnit: unit,
      chartTotal: fmt(total),
      chartAvg: fmt(Math.round(avg * 10) / 10),
      chartMax: fmt(maxValue)
    })
  },
  onChartMetric(e) {
    const metric = e.currentTarget.dataset.metric
    if (metric === this.data.chartMetric) return
    this.setData({ chartMetric: metric }, () => this.buildChart())
  },
  onSpan(e) {
    const span = Number(e.currentTarget.dataset.span)
    if (span === this.data.span) return
    this.setData({ span })
    this.load().catch((err) => this.fail(err))
  },
  openChartDay(e) {
    const day = e.currentTarget.dataset.day
    if (day) openDay(day)
  },
  openDay(e) {
    openDay(e.currentTarget.dataset.day)
  },
  goExport() {
    wx.navigateTo({ url: '/pages/export/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
