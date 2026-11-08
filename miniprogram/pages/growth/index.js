const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, weightText, prettyDay } = require('../../utils/date.js')
const theme = require('../../utils/theme.js')

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
  data: {
    loading: true,
    pageError: '',
    formError: '',
    saving: false,
    day: '',
    weightG: 0,
    heightCm: 0,
    headCm: 0,
    weightHint: '',
    list: []
  },
  onShow() {
    this.setData({ day: this.data.day || dayKey() })
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
        wx.navigateBack()
        return null
      }
      this.babyId = session.baby._id
      return this.load()
    }).then(() => {
      this.loaded = true
      this.setData({ loading: false, pageError: '' })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  load() {
    return api.listGrowth({ babyId: this.babyId }).then((data) => {
      this.setData({
        list: (data.list || []).map((item) => Object.assign({
          text: line(item),
          pretty: item.day ? prettyDay(item.day) : ''
        }, item))
      })
    })
  },
  onDay(e) {
    this.setData({ day: e.detail.value, formError: '' })
  },
  onWeight(e) {
    this.setData({ weightG: e.detail.value, weightHint: weightText(e.detail.value), formError: '' })
  },
  onHeight(e) {
    this.setData({ heightCm: e.detail.value, formError: '' })
  },
  onHead(e) {
    this.setData({ headCm: e.detail.value, formError: '' })
  },
  save() {
    if (this.data.saving) return
    if (!(this.data.weightG > 0 || this.data.heightCm > 0 || this.data.headCm > 0)) {
      this.setData({ formError: '体重、身长、头围至少填一项' })
      return
    }
    this.setData({ saving: true, formError: '' })
    api.saveGrowth({
      babyId: this.babyId,
      day: this.data.day,
      weightG: this.data.weightG,
      heightCm: this.data.heightCm,
      headCm: this.data.headCm
    }).then(() => {
      this.setData({ weightG: 0, heightCm: 0, headCm: 0, weightHint: '', saving: false })
      return this.load()
    }).then(() => {
      this.ok('已记下')
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  },
  remove(e) {
    if (this.busy) return
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这次测量？',
      content: '删除后历史里就看不到这一次了。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.deleteGrowth({ babyId: this.babyId, _id: id }).then(() => this.load()).then(() => {
          this.busy = false
          this.ok('已删除')
        }).catch((err) => {
          this.busy = false
          this.fail(err)
        })
      }
    })
  }
})
