const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')
const { dayKey, weightText } = require('../../utils/date.js')
const theme = require('../../utils/theme.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
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
    saving: false,
    errors: {},
    formError: '',
    theme
  },
  onLoad(query) {
    this.fresh = query.fresh === '1'
    this.editId = query.id || ''
    this.setData({ today: dayKey(), id: this.fresh ? '' : this.editId })
  },
  onShow() {
    this.reload()
  },
  retry() {
    this.filled = false
    this.setData({ pageError: '', loading: true })
    this.reload()
  },
  reload() {
    return this.prepare().then((data) => {
      if (this.filled) {
        this.setData({ loading: false, pageError: '' })
        return
      }
      this.filled = true
      if (this.fresh) {
        this.setData({ loading: false, pageError: '' })
        return
      }
      const found = (data.babies || []).find((baby) => baby._id === this.editId)
      if (found) this.fill(found)
      else if (data.baby && !this.editId) this.fill(data.baby)
      this.setData({ loading: false, pageError: '' })
    }).catch((err) => {
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
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
    const field = e.currentTarget.dataset.field
    const patch = {}
    patch[field] = e.detail.value
    if (field === 'nickname' && this.data.errors.nickname) {
      patch['errors.nickname'] = ''
      patch.formError = ''
    }
    this.setData(patch)
  },
  onChip(e) {
    const patch = {}
    patch[e.currentTarget.dataset.field] = e.currentTarget.dataset.value
    this.setData(patch)
  },
  onBirth(e) {
    this.setData({ birthday: e.detail.value, 'errors.birthday': '', formError: '' })
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
  validate() {
    const errors = {}
    const nickname = String(this.data.nickname || '').trim()
    if (!nickname) errors.nickname = '写一个称呼吧'
    else if (nickname.length > 20) errors.nickname = '称呼最多 20 个字'
    if (!this.data.birthday) errors.birthday = '选一下出生日'
    const first = Object.keys(errors)[0]
    this.setData({ errors, formError: first ? errors[first] : '' })
    if (first) wx.pageScrollTo({ scrollTop: 0, duration: 200 })
    return !first
  },
  save() {
    if (this.data.saving) return
    if (!this.validate()) return
    this.setData({ saving: true })
    api.saveBaby({
      _id: this.data.id,
      nickname: String(this.data.nickname || '').trim(),
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
      this.setData({ saving: false })
      this.ok('已保存')
      this.backAfter(450)
    }).catch((err) => {
      this.setData({ saving: false })
      this.fail(err)
    })
  },
  remove() {
    wx.showModal({
      title: '删除这个宝宝？',
      content: '喂养、用药、生长记录都会清掉，而且找不回来。',
      confirmColor: theme.danger,
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
