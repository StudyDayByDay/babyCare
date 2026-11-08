Component({
  data: {
    selected: 0,
    elder: false,
    list: [
      { pagePath: '/pages/today/index', text: '今天', icon: 'today' },
      { pagePath: '/pages/record/index', text: '记录', icon: 'record' },
      { pagePath: '/pages/stats/index', text: '统计', icon: 'stats' },
      { pagePath: '/pages/mine/index', text: '我的', icon: 'mine' }
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
