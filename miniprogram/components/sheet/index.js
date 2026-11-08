Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    items: { type: Array, value: [] },
    elder: { type: Boolean, value: false }
  },
  methods: {
    close() {
      this.triggerEvent('close')
    },
    noop() {},
    tapItem(e) {
      const index = Number(e.currentTarget.dataset.index)
      this.triggerEvent('select', { item: this.data.items[index] })
    }
  }
})
