const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, stageOf, timeKey, addDays, durationText } = require('../../utils/date.js')
const { recordActions, hiddenCareActions, iconFor, toneFor } = require('../../utils/stage.js')
const { milkView } = require('../../utils/view.js')
const { openAction } = require('../../utils/nav.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    baby: null,
    day: '',
    pretty: '',
    isToday: true,
    actions: [],
    more: [],
    showMore: false,
    records: [],
    milkText: '0',
    breastText: '0分钟',
    poopText: '0次',
    diaperText: '0次',
    sleepText: '0分钟',
    medText: '0/0'
  },
  onShow() {
    const stored = wx.getStorageSync('ledgerDay')
    if (stored) {
      wx.removeStorageSync('ledgerDay')
      this.pickedDay = stored
    }
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
      this.syncTab(1, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, loading: false, pageError: '' })
        return null
      }
      const day = this.pickedDay || this.data.day || dayKey()
      this.pickedDay = ''
      const stage = stageOf(session.baby.birthday, day)
      this.setData({
        needBaby: false,
        pageError: '',
        baby: session.baby,
        day,
        pretty: prettyDay(day),
        isToday: day === dayKey(),
        actions: recordActions(stage),
        more: hiddenCareActions(stage)
      })
      return api.getDay({ babyId: session.baby._id, day }).then((data) => {
        const summary = data.summary || {}
        const milk = milkView(summary)
        this.setData({
          records: (data.records || []).map((item) => Object.assign({
            timeText: timeKey(item.happenedAt),
            icon: iconFor(item.type),
            tone: toneFor(item.type)
          }, item)).reverse(),
          milkText: milk.num,
          breastText: (Number(summary.breastMin) || 0) + '分钟',
          poopText: (Number(summary.poopCount) || 0) + '次',
          diaperText: (Number(summary.diaperCount) || 0) + '次',
          sleepText: durationText(summary.sleepMin),
          medText: (Number(summary.medTaken) || 0) + '/' + (Number(summary.medTotal) || 0),
          pageError: ''
        })
      })
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  shift(e) {
    const dir = Number(e.currentTarget.dataset.dir)
    this.pickedDay = addDays(this.data.day || dayKey(), dir)
    this.reload()
  },
  onDate(e) {
    this.pickedDay = e.detail.value
    this.reload()
  },
  goToday() {
    this.pickedDay = dayKey()
    this.reload()
  },
  toggleMore() {
    this.setData({ showMore: !this.data.showMore })
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, this.data.day)
  },
  openRecord(e) {
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id + '&day=' + this.data.day
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
