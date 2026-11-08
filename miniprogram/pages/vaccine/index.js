const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey } = require('../../utils/date.js')

Page({
  behaviors: [pageBehavior],
  data: { pending: [], doneList: [], customName: '', customDay: '' },
  onShow() {
    this.setData({ customDay: this.data.customDay || dayKey() })
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.babyId = session.baby._id
      this.today = dayKey()
      return this.load()
    }).catch((err) => this.fail(err))
  },
  load() {
    return api.listVaccines({ babyId: this.babyId }).then((data) => this.split(data.list || []))
  },
  split(list) {
    const today = this.today
    const pending = []
    const doneList = []
    list.forEach((item) => {
      if (item.status === 'pending') {
        pending.push(Object.assign({ dueText: item.dueDay <= today ? '到时间了，核对接种本' : '未到' }, item))
      } else doneList.push(item)
    })
    this.setData({ pending, doneList })
  },
  sync() {
    api.syncVaccines({ babyId: this.babyId }).then((data) => this.split(data.list || [])).catch((err) => this.fail(err))
  },
  done(e) {
    api.saveVaccine({ babyId: this.babyId, _id: e.currentTarget.dataset.id, status: 'done', doneDay: dayKey() }).then(() => this.load()).catch((err) => this.fail(err))
  },
  skip(e) {
    api.saveVaccine({ babyId: this.babyId, _id: e.currentTarget.dataset.id, status: 'skipped' }).then(() => this.load()).catch((err) => this.fail(err))
  },
  onName(e) { this.setData({ customName: e.detail.value }) },
  onCustomDay(e) { this.setData({ customDay: e.detail.value }) },
  addCustom() {
    api.saveVaccine({
      babyId: this.babyId,
      name: this.data.customName,
      dueDay: this.data.customDay,
      status: 'pending'
    }).then(() => {
      this.setData({ customName: '' })
      return this.load()
    }).catch((err) => this.fail(err))
  }
})
