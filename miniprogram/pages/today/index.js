const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay, ageText, durationText, stageOf, timeKey } = require('../../utils/date.js')
const { stageLabel, recordActions, iconFor } = require('../../utils/stage.js')
const { milkView, groupDoses } = require('../../utils/view.js')
const { openAction } = require('../../utils/nav.js')
const { describeDaily } = require('./dailyText.js')

Page({
  behaviors: [pageBehavior],
  data: {
    needBaby: false,
    baby: null,
    ageText: '',
    stageLabel: '',
    pretty: '',
    summary: {},
    milk: { num: '0', sub: '' },
    sleepText: '0分钟',
    records: [],
    nextGroup: null,
    dailyText: '',
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
    session.refresh().then(() => this.reload()).catch((err) => this.fail(err))
  },
  reload() {
    return this.prepare().then((session) => {
      this.syncTab(0, !!(session.member && session.member.elderMode))
      if (!session.baby) {
        this.setData({ needBaby: true, baby: null })
        return null
      }
      const today = dayKey()
      const stage = stageOf(session.baby.birthday, today)
      this.setData({
        needBaby: false,
        baby: session.baby,
        ageText: ageText(session.baby.birthday, today),
        stageLabel: stageLabel(stage),
        pretty: prettyDay(today),
        quick: recordActions(stage).slice(0, 4)
      })
      return this.load(session.baby._id, today)
    }).catch((err) => {
      this.setData({ ready: true, pageError: err.message || '云服务没有连上' })
    })
  },
  load(babyId, day) {
    return api.getDay({ babyId, day }).then((data) => {
      const grouped = groupDoses(data.doses)
      const records = (data.records || []).map((item) => Object.assign({
        timeText: timeKey(item.happenedAt),
        icon: iconFor(item.type)
      }, item))
      this.setData({
        summary: data.summary,
        milk: milkView(data.summary),
        sleepText: durationText(data.summary.sleepMin),
        records,
        nextGroup: grouped.nextGroup,
        dailyText: describeDaily(data.daily)
      })
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  },
  goMed() {
    wx.navigateTo({ url: '/pages/med-list/index' })
  },
  onAction(e) {
    openAction(e.currentTarget.dataset.key, dayKey())
  },
  openRecord(e) {
    wx.navigateTo({
      url: '/pages/event-edit/index?type=' + e.currentTarget.dataset.type + '&id=' + e.currentTarget.dataset.id
    })
  },
  takeNext() {
    const group = this.data.nextGroup
    const baby = this.data.baby
    if (!group || !baby) return
    const pending = group.items.filter((item) => item.status === 'pending')
    let chain = Promise.resolve()
    pending.forEach((item) => {
      chain = chain.then(() => api.markDose({ babyId: baby._id, _id: item._id, status: 'taken', when: 'now' }))
    })
    chain.then(() => this.load(baby._id, dayKey())).catch((err) => this.fail(err))
  }
})
