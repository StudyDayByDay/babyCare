Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  properties: {
    icon: { type: String, value: 'baby' },
    tone: { type: String, value: 'sleep' },
    title: { type: String, value: '' },
    hint: { type: String, value: '' },
    actionText: { type: String, value: '' },
    compact: { type: Boolean, value: false },
    elder: { type: Boolean, value: false }
  },
  methods: {
    onAction() {
      this.triggerEvent('action')
    }
  }
})
