const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, addDays, durationText, prettyDay } = require('../../utils/date.js')
const { milkView } = require('../../utils/view.js')
const { openDay } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    span: 7,
    days: [],
    totals: null,
    lines: [],
    sleepText: '',
    hasData: false
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
        totals.poopCount || totals.sleepMin || totals.medTotal
      )
      const milk = milkView(totals)
      const days = (range.days || []).map((day) => {
        const marked = !!(
          day.feedCount || day.formulaMl || day.bottleBreastMl || day.breastMin ||
          day.diaperCount || day.poopCount || day.sleepMin || day.medTotal
        )
        return { day: day.day, pretty: prettyDay(day.day), marked }
      }).reverse()
      this.setData({
        totals,
        lines: [
          { label: '喂奶', value: (Number(totals.feedCount) || 0) + ' 次' },
          { label: '奶量', value: milk.num === '0' ? '还没有' : milk.num },
          { label: '大便', value: (Number(totals.poopCount) || 0) + ' 次' },
          { label: '睡眠', value: durationText(totals.sleepMin) },
          { label: '用药', value: (Number(totals.medTaken) || 0) + ' / ' + (Number(totals.medTotal) || 0) }
        ],
        hasData,
        days,
        pageError: ''
      })
    })
  },
  onSpan(e) {
    const span = Number(e.currentTarget.dataset.span)
    if (span === this.data.span) return
    this.setData({ span })
    this.load().catch((err) => this.fail(err))
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
