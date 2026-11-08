Component({
  properties: {
    name: { type: String, value: '' },
    size: { type: Number, value: 44 },
    elder: { type: Boolean, value: false }
  },
  data: {
    box: 44,
    failed: false
  },
  observers: {
    'size, elder': function (size, elder) {
      const base = Number(size) || 44
      this.setData({ box: elder ? Math.round(base * 1.16) : base })
    },
    name() {
      if (this.data.failed) this.setData({ failed: false })
    }
  },
  lifetimes: {
    attached() {
      const base = Number(this.data.size) || 44
      this.setData({ box: this.data.elder ? Math.round(base * 1.16) : base })
    }
  },
  methods: {
    onError() {
      this.setData({ failed: true })
    }
  }
})
