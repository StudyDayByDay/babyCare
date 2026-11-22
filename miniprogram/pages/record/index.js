const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, stageOf, addDays, durationText } = require('../../utils/date.js')
const { recordActions, hiddenCareActions } = require('../../utils/stage.js')
const { ledgerRows } = require('../../utils/view.js')
const { openAction } = require('../../utils/nav.js')

function latestOf(records, type) {
  let found = null
  ;(records || []).forEach((rec) => {
    if (rec.type !== type) return
    if (!found || rec.happenedAt > found.happenedAt) found = rec
  })
  return found
}

function measureTile(records, type) {
  const list = (records || []).filter((rec) => rec.type === type)
  const latest = latestOf(records, type)
  if (!latest) return { count: 0, text: '' }
  const payload = latest.payload || {}
  if (type === 'temp') return { count: list.length, text: payload.celsius + '℃' }
  return { count: list.length, text: (payload.value || '') + (payload.unit || '') }
}

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
    totalMlText: '0毫升',
    breastMlText: '0毫升',
    formulaText: '0毫升',
    breastText: '0分钟',
    poopText: '0次',
    diaperText: '0次',
    sleepText: '0分钟',
    medText: '0/0',
    tempCount: 0,
    tempText: '',
    jaundiceCount: 0,
    jaundiceText: '',
    ledger: []
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
        const formulaMl = Number(summary.formulaMl) || 0
        const breastMl = Number(summary.bottleBreastMl) || 0
        const records = data.records || []
        const temp = measureTile(records, 'temp')
        const jaundice = measureTile(records, 'jaundice')
        const ledger = ledgerRows(records, data.doses)
        this.setData({
          records,
          ledger,
          tempCount: temp.count,
          tempText: temp.text,
          jaundiceCount: jaundice.count,
          jaundiceText: jaundice.text,
          totalMlText: (formulaMl + breastMl) + '毫升',
          breastMlText: breastMl + '毫升',
          formulaText: formulaMl + '毫升',
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
  openLine(e) {
    const kind = e.currentTarget.dataset.kind
    if (kind === 'dose') {
      wx.navigateTo({ url: '/pages/med-list/index?day=' + this.data.day })
      return
    }
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id + '&day=' + this.data.day
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
