const pageBehavior = require('../../behaviors/page.js')
const api = require('../../services/api.js')
const session = require('../../services/session.js')
const theme = require('../../utils/theme.js')

Page({
  behaviors: [pageBehavior],
  data: {
    loading: true,
    pageError: '',
    joinError: '',
    inviteCode: '',
    isOwner: false,
    members: [],
    code: ''
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
    return this.prepare().then((data) => {
      this.setData({
        inviteCode: data.family.inviteCode,
        isOwner: data.family.isOwner,
        pageError: ''
      })
      return api.listMembers()
    }).then((res) => {
      this.loaded = true
      this.setData({
        members: (res && res.list) || [],
        loading: false,
        pageError: ''
      })
    }).catch((err) => {
      this.loaded = true
      this.setData({ loading: false, pageError: err.message || '云服务没有连上' })
    })
  },
  copy() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => this.ok('邀请码已复制')
    })
  },
  renew() {
    if (this.busy) return
    wx.showModal({
      title: '换一个邀请码？',
      content: '旧码会立刻失效，已经加入的家人不受影响。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.createInvite().then((data) => {
          session.apply(data)
          this.setData({ inviteCode: data.family.inviteCode })
          this.busy = false
          this.ok('已换新邀请码')
        }).catch((err) => {
          this.busy = false
          this.fail(err)
        })
      }
    })
  },
  onCode(e) {
    this.setData({ code: e.detail.value, joinError: '' })
  },
  join() {
    if (this.busy) return
    const code = String(this.data.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      this.setData({ joinError: '输入 6 位数字邀请码' })
      return
    }
    this.busy = true
    api.joinFamily({ inviteCode: code }).then((data) => {
      session.apply(data)
      this.busy = false
      this.ok('已加入')
      this.backAfter(600)
    }).catch((err) => {
      this.busy = false
      this.fail(err)
    })
  },
  leave() {
    if (this.busy) return
    wx.showModal({
      title: '退出这个家庭？',
      content: '退出后就看不到这个宝宝的记录了。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.leaveFamily().then((data) => {
          session.apply(data)
          wx.navigateBack()
        }).catch((err) => {
          this.busy = false
          this.fail(err)
        })
      }
    })
  },
  remove(e) {
    if (this.busy) return
    const id = e.currentTarget.dataset.id
    const label = e.currentTarget.dataset.label || '这位家人'
    wx.showModal({
      title: '把' + label + '移出家庭？',
      content: '移出后 TA 将看不到宝宝的记录。',
      confirmColor: theme.danger,
      success: (res) => {
        if (!res.confirm) return
        this.busy = true
        api.removeMember({ memberId: id }).then(() => api.listMembers()).then((res2) => {
          this.busy = false
          this.setData({ members: (res2 && res2.list) || [] })
          this.ok('已移出')
        }).catch((err) => {
          this.busy = false
          this.fail(err)
        })
      }
    })
  }
})
