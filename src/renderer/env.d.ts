/// <reference types="vite/client" />

import { ElectronAPI } from '../shared/ipc'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
