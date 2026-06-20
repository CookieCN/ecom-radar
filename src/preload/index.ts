import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import type { ElectronAPI } from '../shared/ipc'

try {
  const api: ElectronAPI = {
    healthCheck: () => ipcRenderer.invoke(IPC_CHANNELS.HEALTH_CHECK),
    dbHealthCheck: () => ipcRenderer.invoke(IPC_CHANNELS.DB_HEALTH_CHECK),
    captureRun: (request) => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_RUN, request),
    competitorsList: () => ipcRenderer.invoke(IPC_CHANNELS.COMPETITORS_LIST),
    competitorsGet: (id) => ipcRenderer.invoke(IPC_CHANNELS.COMPETITORS_GET, id),
    competitorsDelete: (id) => ipcRenderer.invoke(IPC_CHANNELS.COMPETITORS_DELETE, id),
    competitorsToggleStatus: (id) => ipcRenderer.invoke(IPC_CHANNELS.COMPETITORS_TOGGLE_STATUS, id),
    competitorsUpdateInterval: (id, intervalMinutes) =>
      ipcRenderer.invoke(IPC_CHANNELS.COMPETITORS_UPDATE_INTERVAL, id, intervalMinutes),
    exportSingle: (competitorId) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_SINGLE, competitorId),
    exportAll: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_ALL),
    schedulerStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULER_STATUS),
    schedulerStart: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULER_START),
    schedulerStop: () => ipcRenderer.invoke(IPC_CHANNELS.SCHEDULER_STOP),
    alertsList: () => ipcRenderer.invoke(IPC_CHANNELS.ALERTS_LIST),
    alertsCountUnread: () => ipcRenderer.invoke(IPC_CHANNELS.ALERTS_COUNT_UNREAD),
    alertsMarkRead: (id) => ipcRenderer.invoke(IPC_CHANNELS.ALERTS_MARK_READ, id),
    alertsMarkAllRead: () => ipcRenderer.invoke(IPC_CHANNELS.ALERTS_MARK_ALL_READ),
    captureManualSave: (data) => ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_MANUAL_SAVE, data),
    deliveryProfilesList: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_DELIVERY_LIST),
    deliveryProfilesSave: (profiles) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_DELIVERY_SAVE, profiles),
    sellerStoresAdd: (url) => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_ADD, url),
    sellerStoresList: () => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_LIST),
    sellerStoresGet: (id) => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_GET, id),
    sellerStoresDelete: (id) => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_DELETE, id),
    sellerStoresToggle: (id) => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_TOGGLE, id),
    sellerStoresScan: (id) => ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORES_SCAN, id),
    sellerStoreProductWatch: (productId, watched) =>
      ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORE_PRODUCT_WATCH, productId, watched),
    sellerStoreProductPromote: (productId) =>
      ipcRenderer.invoke(IPC_CHANNELS.SELLER_STORE_PRODUCT_PROMOTE, productId),
    pageBudgetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PAGE_BUDGET_STATUS),
    pageBudgetSave: (limit) => ipcRenderer.invoke(IPC_CHANNELS.PAGE_BUDGET_SAVE, limit)
  }

  contextBridge.exposeInMainWorld('api', api)
  console.log('[preload] api exposed successfully')
} catch (err) {
  console.error('[preload] failed to expose api:', err)
}
