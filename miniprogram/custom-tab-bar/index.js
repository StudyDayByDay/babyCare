Component({
  data: {
    selected: 0,
    elder: false,
    list: [
      { pagePath: '/pages/today/index', text: '今天', icon: 'today', iconOn: 'today-on' },
      { pagePath: '/pages/record/index', text: '记录', icon: 'record', iconOn: 'record-on' },
      { pagePath: '/pages/stats/index', text: '统计', icon: 'stats', iconOn: 'stats-on' },
      { pagePath: '/pages/mine/index', text: '我的', icon: 'mine', iconOn: 'mine-on' }
    ]
  },
  methods: {
    onSwitch(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      wx.switchTab({ url: item.pagePath })
    }
  }
})
