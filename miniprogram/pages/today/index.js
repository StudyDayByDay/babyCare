const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, ageText, durationText, stageOf, timeKey, dayNumber, addDays } = require('../../utils/date.js')
const { stageLabel, recordActions, iconFor, toneFor } = require('../../utils/stage.js')
const { groupDoses, sinceList, ledgerRows } = require('../../utils/view.js')
const { openAction, openDay } = require('../../utils/nav.js')
const { describeDaily } = require('./dailyText.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    baby: null,
    nicknameInitial: '宝',
    heroMeta: '',
    pretty: '',
    summary: {},
    sleepText: '0分钟',
    records: [],
    shownLedger: [],
    since: [],
    night: false,
    nextGroup: null,
    taking: false,
    medPercent: 0,
    dailyText: '',
    nums: {
      day: 0,
      feed: 0,
      diaper: 0,
      sleepMin: 0,
      milk: 0,
      breastMl: 0,
      formulaMl: 0,
      breastMin: 0,
      poop: 0,
      medTaken: 0
    },
    animSleepText: '0分钟',
    sleepHours: '0',
    chartMetric: 'feed',
    chart: [],
    chartAvg: '0 次',
    chartUnit: '次',
    quick: [
      { key: 'feed', title: '喂奶', hint: '母乳和配方', tone: 'feed', icon: 'feed' },
      { key: 'diaper', title: '尿布', hint: '尿和便', tone: 'diaper', icon: 'diaper' },
      { key: 'sleep', title: '睡眠', hint: '现在记下', tone: 'sleep', icon: 'sleep' },
      { key: 'daily', title: '护理', hint: '补剂和清洁', tone: 'care', icon: 'care' }
    ]
  },
  onShow() {
    this.reload()
  },
  onPullDownRefresh() {
    this.reload().finally(() => wx.stopPullDownRefresh())
  },
  retry() {
    const session = require('../../services/session.js')
    this.setData({ pageError: '', loading: true })
    session.refresh().then(() => this.reload()).catch((err) => {
      this.setData({ loading: false })
      this.fail(err)
    })
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      this.syncTab(0, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, baby: null, loading: false, pageError: '' })
        return null
      }
      const today = dayKey()
      const stage = stageOf(session.baby.birthday, today)
      const age = ageText(session.baby.birthday, today)
      const stageText = stageLabel(stage)
      const hour = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours()
      this.setData({
        needBaby: false,
        pageError: '',
        baby: session.baby,
        nicknameInitial: (session.baby.nickname || '宝').slice(0, 1),
        heroMeta: age.indexOf('第') === 0 ? stageText : age + ' · ' + stageText,
        pretty: prettyDay(today),
        quick: recordActions(stage).slice(0, 4),
        night: hour >= 21 || hour < 6
      })
      return this.load(session.baby._id, today)
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load(babyId, day) {
    const startDay = addDays(day, -6)
    const rangePromise = api.getRange({ babyId, startDay, endDay: day }).catch(() => null)
    return Promise.all([api.getDay({ babyId, day }), rangePromise]).then(([data, range]) => {
      const grouped = groupDoses(data.doses)
      const records = (data.records || []).map((item) => Object.assign({
        timeText: timeKey(item.happenedAt),
        icon: iconFor(item.type),
        tone: toneFor(item.type)
      }, item))
      const total = Number(data.summary.medTotal) || 0
      const taken = Number(data.summary.medTaken) || 0
      const formulaMl = Number(data.summary.formulaMl) || 0
      const breastMl = Number(data.summary.bottleBreastMl) || 0
      const sleepMin = Number(data.summary.sleepMin) || 0
      this.weekDays = (range && range.days) || []
      this.setData({
        summary: data.summary,
        sleepText: durationText(data.summary.sleepMin),
        sleepHours: String(Math.round(sleepMin / 6) / 10),
        records,
        shownLedger: ledgerRows(data.records, data.doses).slice(0, 8),
        since: sinceList(data.records, Date.now()),
        nextGroup: grouped.nextGroup,
        medPercent: total > 0 ? Math.round(taken / total * 100) : 0,
        dailyText: describeDaily(data.daily),
        pageError: '',
        nums: {
          day: Math.max(0, dayNumber(this.data.baby.birthday, day)),
          feed: Number(data.summary.feedCount) || 0,
          diaper: Number(data.summary.diaperCount) || 0,
          sleepMin,
          milk: formulaMl + breastMl,
          breastMl,
          formulaMl,
          breastMin: Number(data.summary.breastMin) || 0,
          poop: Number(data.summary.poopCount) || 0,
          medTaken: taken
        },
        animSleepText: durationText(sleepMin)
      })
      this.buildChart()
    })
  },
  buildChart() {
    const metric = this.data.chartMetric
    const days = this.weekDays || []
    const today = dayKey()
    const valueOf = (day) => {
      if (metric === 'feed') return Number(day.feedCount) || 0
      if (metric === 'diaper') return Number(day.diaperCount) || 0
      return Number(day.sleepMin) || 0
    }
    const raw = days.map(valueOf)
    const max = Math.max.apply(null, raw.concat([1]))
    const chart = days.map((day, index) => {
      const value = raw[index]
      const display = metric === 'sleep'
        ? String(Math.round(value / 6) / 10)
        : String(value)
      return {
        day: day.day,
        label: prettyDay(day.day).slice(-2),
        value: display,
        percent: value > 0 ? Math.max(8, Math.round(value / max * 100)) : 0,
        isToday: day.day === today
      }
    })
    const total = raw.reduce((sum, value) => sum + value, 0)
    const avg = days.length ? total / days.length : 0
    const avgText = metric === 'sleep'
      ? (Math.round(avg / 6) / 10) + ' 小时'
      : (Math.round(avg * 10) / 10) + ' 次'
    this.setData({
      chart,
      chartAvg: avgText,
      chartUnit: metric === 'sleep' ? '小时' : '次'
    })
  },
  onChartMetric(e) {
    const metric = e.currentTarget.dataset.metric
    if (metric === this.data.chartMetric) return
    this.setData({ chartMetric: metric }, () => this.buildChart())
  },
  onChartDay(e) {
    const day = e.currentTarget.dataset.day
    if (day) openDay(day)
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/index' })
  },
  goStats() {
    wx.switchTab({ url: '/pages/stats/index' })
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, dayKey())
  },
  openLine(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === 'dose') {
      wx.navigateTo({ url: '/pages/med-list/index?day=' + dayKey() })
      return
    }
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id
    })
  },
  repeatLast(e) {
    const type = e.currentTarget.dataset.type
    const id = e.currentTarget.dataset.id
    if (!type || !id) return
    wx.navigateTo({ url: '/pages/event-edit/index?type=' + type + '&copy=' + id })
  },
  takeNext() {
    const group = this.data.nextGroup
    const baby = this.data.baby
    if (!group || !baby || this.data.taking) return
    const pending = group.items.filter((item) => item.status === 'pending')
    if (!pending.length) return
    this.setData({ taking: true })
    let chain = Promise.resolve()
    pending.forEach((item) => {
      chain = chain.then(() => api.markDose({ babyId: baby._id, _id: item._id, status: 'taken', when: 'now' }))
    })
    chain.then(() => this.load(baby._id, dayKey())).then(() => {
      this.setData({ taking: false })
      this.ok('已记下')
    }).catch((err) => {
      this.setData({ taking: false })
      this.fail(err)
    })
  }
})
