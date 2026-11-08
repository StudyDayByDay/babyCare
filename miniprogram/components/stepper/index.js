Component({
  properties: {
    value: { type: Number, value: 0 },
    min: { type: Number, value: 0 },
    max: { type: Number, value: 999 },
    step: { type: Number, value: 1 },
    unit: { type: String, value: '' },
    elder: { type: Boolean, value: false }
  },
  data: {
    text: '0',
    decimal: false
  },
  observers: {
    value(value) {
      if (this.editing) return
      this.setData({ text: this.format(value) })
    },
    step(step) {
      this.setData({ decimal: Number(step) < 1 })
    }
  },
  lifetimes: {
    attached() {
      this.setData({
        text: this.format(this.data.value),
        decimal: Number(this.data.step) < 1
      })
    }
  },
  methods: {
    format(value) {
      const n = Math.round(Number(value) * 100) / 100
      if (!isFinite(n)) return '0'
      return String(n)
    },
    change(e) {
      const dir = Number(e.currentTarget.dataset.dir)
      const step = Number(this.data.step) || 1
      let next = Number(this.data.value) + dir * step
      this.commit(next)
    },
    onInput(e) {
      this.editing = true
      this.setData({ text: e.detail.value })
    },
    onBlur(e) {
      this.editing = false
      const raw = String(e.detail.value == null ? '' : e.detail.value).trim()
      if (!raw) {
        this.commit(Number(this.data.min) || 0)
        return
      }
      const n = Number(raw)
      this.commit(isFinite(n) ? n : this.data.value)
    },
    commit(next) {
      const min = Number(this.data.min)
      const max = Number(this.data.max)
      let n = Math.round(Number(next) * 100) / 100
      if (!isFinite(n)) n = min
      if (n < min) n = min
      if (n > max) n = max
      if (Number(this.data.step) >= 1) n = Math.round(n)
      this.setData({ text: this.format(n) })
      this.triggerEvent('change', { value: n })
    }
  }
})
