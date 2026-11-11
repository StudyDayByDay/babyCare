const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const { dayKey, prettyDay } = require('../../utils/date.js')
const theme = require('../../utils/theme.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    pageError: '',
    syncing: false,
    customError: '',
    showDone: true,
    pending: [],
    doneList: [],
    customName: '',
    customDay: '',
    editingId: '',
    editName: '',
    editStatus: 'pending',
    editDay: '',
    editError: ''
  },
  onShow() {
    this.setData({ customDay: this.data.customDay || dayKey() })
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
      this.today = dayKey()
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
    return api.listVaccines({ babyId: this.babyId }).then((data) => this.split(data.list || []))
  },
  split(list) {
    const today = this.today
    const pending = []
    const doneList = []
    list.forEach((item) => {
      const duePretty = item.dueDay ? prettyDay(item.dueDay) : ''
      const donePretty = item.doneDay ? prettyDay(item.doneDay) : ''
      if (item.status === 'pending') {
        pending.push(Object.assign({
          duePretty,
          overdue: item.dueDay <= today,
          dueText: item.dueDay <= today ? '到时间了，核对接种本' : '还没到时间'
        }, item))
      } else {
        doneList.push(Object.assign({ duePretty, donePretty }, item))
      }
    })
    pending.sort((a, b) => String(a.dueDay).localeCompare(String(b.dueDay)))
    this.setData({ pending, doneList })
  },
  sync() {
    if (this.data.syncing) return
    this.setData({ syncing: true })
    api.syncVaccines({ babyId: this.babyId }).then((data) => {
      this.split(data.list || [])
      this.setData({ syncing: false })
      this.ok('已生成待办')
    }).catch((err) => {
      this.setData({ syncing: false })
      this.fail(err)
    })
  },
  done(e) {
    if (this.busy) return
    this.busy = true
    api.saveVaccine({ babyId: this.babyId, _id: e.currentTarget.dataset.id, status: 'done', doneDay: dayKey() })
      .then(() => this.load())
      .then(() => {
        this.busy = false
        this.ok('已记下')
      })
      .catch((err) => {
        this.busy = false
        this.fail(err)
      })
  },
  skip(e) {
    if (this.busy) return
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '这一项'
    wx.showModal({
      title: '这次先不做？',
      content: name + ' 会移到已记录，以后仍可以核对接种本。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.saveVaccine({ babyId: this.babyId, _id: id, status: 'skipped' })
          .then(() => this.load())
          .then(() => {
            this.busy = false
            this.ok('已记下')
          })
          .catch((err) => {
            this.busy = false
            this.fail(err)
          })
      }
    })
  },
  onName(e) {
    this.setData({ customName: e.detail.value, customError: '' })
  },
  onCustomDay(e) {
    this.setData({ customDay: e.detail.value })
  },
  addCustom() {
    if (this.busy) return
    const name = String(this.data.customName || '').trim()
    if (!name) {
      this.setData({ customError: '写一下疫苗名称' })
      return
    }
    this.busy = true
    api.saveVaccine({
      babyId: this.babyId,
      name,
      dueDay: this.data.customDay,
      status: 'pending'
    }).then(() => {
      this.setData({ customName: '', customError: '' })
      return this.load()
    }).then(() => {
      this.busy = false
      this.ok('已加上')
    }).catch((err) => {
      this.busy = false
      this.fail(err)
    })
  },
  toggleDone() {
    this.setData({ showDone: !this.data.showDone })
  },
  startEdit(e) {
    const d = e.currentTarget.dataset
    const status = d.status || 'pending'
    this.setData({
      editingId: d.id,
      editName: d.name || '',
      editStatus: status,
      editDay: status === 'done' ? (d.done || d.due || this.today) : (d.due || this.today),
      editError: ''
    })
  },
  cancelEdit() {
    this.setData({ editingId: '', editError: '' })
  },
  onEditName(e) {
    this.setData({ editName: e.detail.value, editError: '' })
  },
  onEditStatus(e) {
    this.setData({ editStatus: e.currentTarget.dataset.status })
  },
  onEditDay(e) {
    this.setData({ editDay: e.detail.value })
  },
  saveEdit(e) {
    if (this.busy) return
    const name = String(this.data.editName || '').trim()
    if (!name) {
      this.setData({ editError: '写一下疫苗名称' })
      return
    }
    const status = this.data.editStatus
    const payload = {
      babyId: this.babyId,
      _id: e.currentTarget.dataset.id,
      name,
      status
    }
    if (status === 'done') payload.doneDay = this.data.editDay
    if (status === 'pending') payload.dueDay = this.data.editDay
    this.busy = true
    api.saveVaccine(payload).then(() => {
      this.setData({ editingId: '', editError: '' })
      return this.load()
    }).then(() => {
      this.busy = false
      this.ok('已改好')
    }).catch((err) => {
      this.busy = false
      this.fail(err)
    })
  },
  remove(e) {
    if (this.busy) return
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '这一项'
    wx.showModal({
      title: '删除这项？',
      content: name + ' 会从清单里去掉。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.deleteVaccine({ babyId: this.babyId, _id: id }).then(() => {
          if (this.data.editingId === id) this.setData({ editingId: '' })
          return this.load()
        }).then(() => {
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
