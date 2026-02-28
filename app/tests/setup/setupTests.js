import { vi } from 'vitest'

function Row(props = {}, children = []) {
  return {
    tagType: props.tagType || 'div',
    class: props.class || '',
    attributes: props.attributes || {},
    events: props.events || {},
    delegator: props.delegator,
    children: Array.isArray(children) ? children : [children]
  }
}

class MockSharedStateManager {}

class MockViewModel {
  constructor() {
    this.__state = {}
  }

  setState(key, value) {
    this.__state[key] = value
  }

  updateState(key, value) {
    this.__state[key] = value
  }

  getState(key) {
    return this.__state[key]
  }
}

globalThis.Liteframe = {
  Row,
  ViewModel: MockViewModel,
  SharedStateManager: MockSharedStateManager
}

if (!globalThis.window) globalThis.window = globalThis
if (!window.ipcRenderer) {
  window.ipcRenderer = {
    invoke: vi.fn()
  }
}
