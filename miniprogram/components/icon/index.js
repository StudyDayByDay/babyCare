Component({
  properties: {
    name: { type: String, value: '' },
    size: { type: Number, value: 48 },
    elder: { type: Boolean, value: false }
  },
  data: {
    box: 48
  },
  observers: {
    'size, elder': function (size, elder) {
      const base = Number(size) || 48
      this.setData({ box: elder ? Math.round(base * 1.16) : base })
    }
  },
  lifetimes: {
    attached() {
      const base = Number(this.data.size) || 48
      this.setData({ box: this.data.elder ? Math.round(base * 1.16) : base })
    }
  }
})
