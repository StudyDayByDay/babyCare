const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { requestMedSubscribe, templateReady } = require('../../services/subscribe.js')
const { dayKey, prettyDay } = require('../../utils/date.js')
const { groupDoses } = require('../../utils/view.js')
const theme = require('../../utils/theme.js')

const SHEET_PENDING = [
  { key: 'plan', label: '按计划时间补记', hint: '用这一顿安排的时间' },
  { key: 'amount', label: '数量不对，改数量' },
  { key: 'skip', label: '记成没吃', hint: '会算作未吃，之后可以改回来', tone: 'danger' }
]
const SHEET_TAKEN = [
  { key: 'amount', label: '数量不对，改数量' }
]
const SHEET_SKIPPED = [
  { key: 'taken', label: '改成吃了', hint: '按现在的时间记' },
  { key: 'amount', label: '改数量再记已吃' }
]

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    needBaby: false,
    templateReady,
    doseGroups: [],
    takenToday: 0,
    totalToday: 0,
    medPercent: 0,
    meds: [],
    editId: '',
    editAmount: 0,
    sheet: { show: false, title: '', items: [] },
    sheetDoseId: '',
    theme
  },
  onShow() {
    this.reload()
  },
  retry() {
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    if (!this.loaded) this.setData({ loading: true })
    return this.prepare().then((session) => {
      if (!session.baby) {
        this.loaded = true
        this.setData({ needBaby: true, loading: false, pageError: '' })
        return null
      }
      this.babyId = session.baby._id
      this.setData({ needBaby: false })
      return Promise.all([
        api.getDay({ babyId: this.babyId, day: dayKey() }),
        api.listMedications({ babyId: this.babyId })
      ]).then(([day, meds]) => {
        const grouped = groupDoses(day.doses)
        let taken = 0
        let total = 0
        const doseGroups = grouped.groups.map((group) => ({
          time: group.time,
          pending: group.pending,
          done: group.done,
          items: group.items.map((item) => {
            total += 1
            if (item.status === 'taken') taken += 1
            return Object.assign({
              statusClass: item.status === 'taken' ? 'done' : (item.status === 'skipped' ? 'skip' : 'pending')
            }, item)
          })
        }))
        this.setData({
          doseGroups,
          takenToday: taken,
          totalToday: total,
          medPercent: total ? Math.round(taken / total * 100) : 0,
          meds: (meds.list || []).map((med) => Object.assign({
            startPretty: med.startDay ? prettyDay(med.startDay) : '',
            endPretty: med.endDay ? prettyDay(med.endDay) : ''
          }, med)),
          editId: '',
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
  findDose(id) {
    const groups = this.data.doseGroups || []
    for (let i = 0; i < groups.length; i += 1) {
      const found = groups[i].items.find((item) => item._id === id)
      if (found) return found
    }
    return null
  },
  allowRemind() {
    requestMedSubscribe().then((ok) => {
      this.toast(ok ? '已允许，到点会发服务通知' : '这次没有允许')
    })
  },
  markTaken(e) {
    this.markTakenById(e.currentTarget.dataset.id, e.currentTarget.dataset.when || 'now')
  },
  markTakenById(id, when) {
    if (!id || this.busy) return
    this.busy = true
    api.markDose({
      babyId: this.babyId,
      _id: id,
      status: 'taken',
      when: when || 'now'
    }).then(() => this.reload()).then(() => {
      this.busy = false
      this.ok('已记下')
    }).catch((err) => {
      this.busy = false
      this.fail(err)
    })
  },
  openSheet(e) {
    const id = e.currentTarget.dataset.id
    const status = e.currentTarget.dataset.status
    const items = status === 'pending'
      ? SHEET_PENDING
      : (status === 'taken' ? SHEET_TAKEN : SHEET_SKIPPED)
    this.setData({
      sheet: { show: true, title: '这一顿', items },
      sheetDoseId: id,
      editId: ''
    })
  },
  closeSheet() {
    this.setData({ 'sheet.show': false })
  },
  onSheetSelect(e) {
    const key = e.detail && e.detail.item ? e.detail.item.key : ''
    const id = this.data.sheetDoseId
    this.setData({ 'sheet.show': false })
    if (!id) return
    if (key === 'plan') this.markTakenById(id, 'plan')
    else if (key === 'taken') this.markTakenById(id, 'now')
    else if (key === 'skip') this.skipDose(id)
    else if (key === 'amount') this.startEditById(id)
  },
  skipDose(id) {
    if (this.busy) return
    wx.showModal({
      title: '记成没吃？',
      content: '今天这顿会算作未吃，之后仍可以改回来。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.markDose({
          babyId: this.babyId,
          _id: id,
          status: 'skipped'
        }).then(() => this.reload()).then(() => {
          this.busy = false
          this.ok('已记下')
        }).catch((err) => {
          this.busy = false
          this.fail(err)
        })
      }
    })
  },
  startEditById(id) {
    const dose = this.findDose(id)
    this.setData({
      editId: id,
      editAmount: dose ? Number(dose.doseAmount) || 0 : 0
    })
  },
  onEditAmount(e) {
    this.setData({ editAmount: e.detail.value })
  },
  cancelEdit() {
    this.setData({ editId: '' })
  },
  confirmAmount() {
    const amount = Number(this.data.editAmount)
    if (this.busy) return
    if (!(amount > 0)) {
      this.toast('数量要大于 0')
      return
    }
    this.busy = true
    api.markDose({
      babyId: this.babyId,
      _id: this.data.editId,
      status: 'taken',
      when: 'now',
      actualAmount: amount
    }).then(() => this.reload()).then(() => {
      this.busy = false
      this.setData({ editId: '' })
      this.ok('已记下')
    }).catch((err) => {
      this.busy = false
      this.fail(err)
    })
  },
  takeNow(e) {
    if (this.busy) return
    this.busy = true
    api.addAsNeededDose({ babyId: this.babyId, medicationId: e.currentTarget.dataset.id })
      .then(() => this.reload())
      .then(() => {
        this.busy = false
        this.ok('已记下')
      })
      .catch((err) => {
        this.busy = false
        this.fail(err)
      })
  },
  edit(e) {
    wx.navigateTo({ url: '/pages/med-edit/index?id=' + e.currentTarget.dataset.id })
  },
  create() {
    wx.navigateTo({ url: '/pages/med-edit/index' })
  },
  stop(e) {
    if (this.busy) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '结束这个疗程？',
      content: '还没到的提醒会停掉。已经吃过的记录还在。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.stopMedication({ babyId: this.babyId, _id: id })
          .then(() => this.reload())
          .then(() => {
            this.busy = false
            this.ok('已结束')
          })
          .catch((err) => {
            this.busy = false
            this.fail(err)
          })
      }
    })
  },
  goBaby() {
    wx.navigateTo({ url: '/pages/baby-edit/index' })
  }
})
