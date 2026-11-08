const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')
const { dayKey, weightText } = require('../../utils/date.js')

Page({
  behaviors: [pageBehavior],
  data: {
    id: '',
    nickname: '',
    gender: '未填',
    genders: ['女', '男', '未填'],
    birthday: '',
    birthTime: '',
    today: '',
    delivery: '未填',
    deliveries: ['顺产', '剖宫产', '未填'],
    gestationalWeeks: 0,
    birthWeightG: 0,
    birthLengthCm: 0,
    birthHeadCm: 0,
    weightHint: '',
    allergies: '',
    notes: '',
    customSupplements: [],
    supInput: '',
    saving: false
  },
  onLoad(query) {
    this.fresh = query.fresh === '1'
    this.editId = query.id || ''
    this.setData({ today: dayKey(), id: this.fresh ? '' : this.editId })
  },
  onShow() {
    this.prepare().then((data) => {
      if (this.filled) return
      this.filled = true
      if (this.fresh) return
      const found = (data.babies || []).find((baby) => baby._id === this.editId)
      if (found) this.fill(found)
      else if (data.baby && !this.editId) this.fill(data.baby)
    }).catch((err) => this.fail(err))
  },
  fill(baby) {
    this.setData({
      id: baby._id,
      nickname: baby.nickname || '',
      gender: baby.gender || '未填',
      birthday: baby.birthday || '',
      birthTime: baby.birthTime || '',
      delivery: baby.delivery || '未填',
      gestationalWeeks: baby.gestationalWeeks || 0,
      birthWeightG: baby.birthWeightG || 0,
      birthLengthCm: baby.birthLengthCm || 0,
      birthHeadCm: baby.birthHeadCm || 0,
      weightHint: weightText(baby.birthWeightG),
      allergies: baby.allergies || '',
      notes: baby.notes || '',
      customSupplements: baby.customSupplements || []
    })
  },
  onInput(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.detail.value
    this.setData(patch)
  },
  onChip(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.currentTarget.dataset.value
    this.setData(patch)
  },
  onBirth(e) {
    this.setData({ birthday: e.detail.value })
  },
  onTime(e) {
    this.setData({ birthTime: e.detail.value })
  },
  onStep(e) {
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch[field] = e.detail.value
    if (field === 'birthWeightG') patch.weightHint = weightText(e.detail.value)
    this.setData(patch)
  },
  onSup(e) {
    this.setData({ supInput: e.detail.value })
  },
  addSup() {
    const name = (this.data.supInput || '').trim()
    if (!name) return
    this.setData({
      customSupplements: this.data.customSupplements.concat([name]).slice(0, 8),
      supInput: ''
    })
  },
  removeSup(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ customSupplements: this.data.customSupplements.filter((_, i) => i !== index) })
  },
  save() {
    if (this.data.saving) return
    this.setData({ saving: true })
    api.saveBaby({
      _id: this.data.id,
      nickname: this.data.nickname,
      gender: this.data.gender,
      birthday: this.data.birthday,
      birthTime: this.data.birthTime,
      delivery: this.data.delivery,
      gestationalWeeks: this.data.gestationalWeeks,
      birthWeightG: this.data.birthWeightG,
      birthLengthCm: this.data.birthLengthCm,
      birthHeadCm: this.data.birthHeadCm,
      allergies: this.data.allergies,
      notes: this.data.notes,
      customSupplements: this.data.customSupplements
    }).then((data) => {
      session.apply(data)
      wx.navigateBack()
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  },
  remove() {
    wx.showModal({
      title: '删除这个宝宝？',
      content: '喂养、用药、生长记录都会清掉，而且找不回来。',
      confirmColor: '#C4624E',
      success: (res) => {
        if (!res.confirm) return
        api.deleteBaby({ babyId: this.data.id }).then((data) => {
          session.apply(data)
          wx.navigateBack()
        }).catch((err) => this.fail(err))
      }
    })
  }
})
