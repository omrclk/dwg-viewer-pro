import { loadScript } from './loadScript'

type OneDriveItem = {
  id: string
  name: string
  '@microsoft.graph.downloadUrl'?: string
  file?: { mimeType?: string }
}

type OneDrivePickerValue = Array<{
  driveId: string
  driveItem: OneDriveItem
}>

declare global {
  interface Window {
    OneDrive?: {
      open: (options: {
        clientId: string
        action: 'download' | 'share' | 'query'
        multiSelect: boolean
        advanced?: {
          filter?: string
          redirectUri?: string
        }
        success: (result: { value: OneDrivePickerValue }) => void
        cancel: () => void
        error: (error: { message?: string }) => void
      }) => void
    }
  }
}

export function isOneDriveConfigured() {
  return Boolean(import.meta.env.VITE_ONEDRIVE_CLIENT_ID)
}

export async function pickOneDriveFile(): Promise<File> {
  const clientId = import.meta.env.VITE_ONEDRIVE_CLIENT_ID
  if (!clientId) {
    throw new Error('OneDrive için VITE_ONEDRIVE_CLIENT_ID tanimlayin (.env)')
  }

  await loadScript('https://js.live.net/v7.2/OneDrive.js', 'onedrive-js')

  return new Promise((resolve, reject) => {
    if (!window.OneDrive) {
      reject(new Error('OneDrive seçici yüklenemedi'))
      return
    }

    window.OneDrive.open({
      clientId,
      action: 'download',
      multiSelect: false,
      advanced: {
        filter: '.dwg,.dxf,.dwf,.pdf',
        redirectUri: window.location.origin,
      },
      success: async (result) => {
        try {
          const item = result.value[0]?.driveItem
          const downloadUrl = item?.['@microsoft.graph.downloadUrl']
          if (!item?.name || !downloadUrl) {
            throw new Error('OneDrive dosya bilgisi eksik')
          }
          const response = await fetch(downloadUrl)
          if (!response.ok) throw new Error('OneDrive dosyası indirilemedi')
          const blob = await response.blob()
          resolve(
            new File([blob], item.name, {
              type: item.file?.mimeType || blob.type || 'application/octet-stream',
            }),
          )
        } catch (error) {
          reject(error instanceof Error ? error : new Error('OneDrive dosyası alınamadı'))
        }
      },
      cancel: () => reject(new Error('OneDrive seçimi iptal edildi')),
      error: (error) => reject(new Error(error.message ?? 'OneDrive hatasi')),
    })
  })
}
