const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { requestMedSubscribe, templateReady } = require('../../services/subscribe.js')
const { dayKey } = require('../../utils/date.js')
const { groupDoses } = require('../../utils/view.js')

Page({
  behaviors: [pageBehavior],
  data: {
    needBaby: false,
    templateReady,
    doses: [],
    meds: [],
    editId: '',
    editAmount: 0
  },
  onShow() {
    this.reload()
  },
  reload() {
    return this.prepare().then((session) => {
      if (!session.baby) {
        this.setData({ needBaby: true })
        return null
      }
      this.babyId = session.baby._id
      this.setData({ needBaby: false })
      return Promise.all([
        api.getDay({ babyId: this.babyId, day: dayKey() }),
        api.listMedications({ babyId: this.babyId })
      ]).then(([day, meds]) => {
        const grouped = groupDoses(day.doses)
        const doses = []
        grouped.groups.forEach((group) => {
          group.items.forEach((item) => doses.push(item))
        })
        this.setData({ doses, meds: meds.list || [], editId: '' })
      })
    }).catch((err) => this.fail(err))
  },
  allowRemind() {
    requestMedSubscribe().then((ok) => {
      this.toast(ok ? '已允许，到点会发服务通知' : '这次没有允许')
    })
  },
  markTaken(e) {
    api.markDose({
      babyId: this.babyId,
      _id: e.currentTarget.dataset.id,
      status: 'taken',
      when: e.currentTarget.dataset.when
    }).then(() => this.reload()).catch((err) => this.fail(err))
  },
  markSkip(e) {
    api.markDose({
      babyId: this.babyId,
      _id: e.currentTarget.dataset.id,
      status: 'skipped'
    }).then(() => this.reload()).catch((err) => this.fail(err))
  },
  startEdit(e) {
    this.setData({ editId: e.currentTarget.dataset.id, editAmount: Number(e.currentTarget.dataset.amount) || 0 })
  },
  onEditAmount(e) {
    this.setData({ editAmount: e.detail.value })
  },
  confirmAmount(e) {
    api.markDose({
      babyId: this.babyId,
      _id: e.currentTarget.dataset.id,
      status: 'taken',
      when: 'now',
      actualAmount: this.data.editAmount
    }).then(() => this.reload()).catch((err) => this.fail(err))
  },
  takeNow(e) {
    api.addAsNeededDose({ babyId: this.babyId, medicationId: e.currentTarget.dataset.id }).then(() => this.reload()).catch((err) => this.fail(err))
  },
  edit(e) {
    wx.navigateTo({ url: '/pages/med-edit/index?id=' + e.currentTarget.dataset.id })
  },
  create() {
    wx.navigateTo({ url: '/pages/med-edit/index' })
  },
  stop(e) {
    wx.showModal({
      title: '结束这个疗程？',
      content: '还没到的提醒会停掉。已经吃过的记录还在。',
      confirmColor: '#C4624E',
      success: (res) => {
        if (!res.confirm) return
        api.stopMedication({ babyId: this.babyId, _id: e.currentTarget.dataset.id }).then(() => this.reload()).catch((err) => this.fail(err))
      }
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
