const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, weightText } = require('../../utils/date.js')

function line(item) {
  const bits = []
  if (item.weightG) bits.push(weightText(item.weightG))
  if (item.heightCm) bits.push('身长 ' + item.heightCm + ' 厘米')
  if (item.headCm) bits.push('头围 ' + item.headCm + ' 厘米')
  if (item.note) bits.push(item.note)
  return bits.join('，')
}

Page({
  behaviors: [pageBehavior],
  data: { day: '', weightG: 0, heightCm: 0, headCm: 0, weightHint: '', list: [] },
  onShow() {
    this.setData({ day: this.data.day || dayKey() })
    this.prepare().then((session) => {
      if (!session.baby) {
        wx.navigateBack()
        return
      }
      this.babyId = session.baby._id
      return this.load()
    }).catch((err) => this.fail(err))
  },
  load() {
    return api.listGrowth({ babyId: this.babyId }).then((data) => {
      this.setData({ list: (data.list || []).map((item) => Object.assign({ text: line(item) }, item)) })
    })
  },
  onDay(e) { this.setData({ day: e.detail.value }) },
  onWeight(e) { this.setData({ weightG: e.detail.value, weightHint: weightText(e.detail.value) }) },
  onHeight(e) { this.setData({ heightCm: e.detail.value }) },
  onHead(e) { this.setData({ headCm: e.detail.value }) },
  save() {
    api.saveGrowth({
      babyId: this.babyId,
      day: this.data.day,
      weightG: this.data.weightG,
      heightCm: this.data.heightCm,
      headCm: this.data.headCm
    }).then(() => {
      this.setData({ weightG: 0, heightCm: 0, headCm: 0, weightHint: '' })
      return this.load()
    }).catch((err) => this.fail(err))
  },
  remove(e) {
    api.deleteGrowth({ babyId: this.babyId, _id: e.currentTarget.dataset.id }).then(() => this.load()).catch((err) => this.fail(err))
  }
})
