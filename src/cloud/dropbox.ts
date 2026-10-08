import { loadScript } from './loadScript'

type DropboxFile = {
  name: string
  link: string
  bytes: number
}

declare global {
  interface Window {
    Dropbox?: {
      choose: (options: {
        success: (files: DropboxFile[]) => void
        cancel?: () => void
        linkType: 'direct' | 'preview'
        multiselect: boolean
        extensions: string[]
      }) => void
    }
  }
}

export function isDropboxConfigured() {
  return Boolean(import.meta.env.VITE_DROPBOX_APP_KEY)
}

export async function pickDropboxFile(): Promise<File> {
  const appKey = import.meta.env.VITE_DROPBOX_APP_KEY
  if (!appKey) {
    throw new Error('Dropbox için VITE_DROPBOX_APP_KEY tanimlayin (.env)')
  }

  await loadScript('https://www.dropbox.com/static/api/2/dropins.js', 'dropbox-dropins')

  const script = document.getElementById('dropbox-dropins')
  if (script) script.setAttribute('data-app-key', appKey)

  return new Promise((resolve, reject) => {
    if (!window.Dropbox) {
      reject(new Error('Dropbox Chooser yüklenemedi'))
      return
    }

    window.Dropbox.choose({
      success: async (files) => {
        try {
          const picked = files[0]
          const response = await fetch(picked.link)
          if (!response.ok) throw new Error('Dropbox dosyası indirilemedi')
          const blob = await response.blob()
          resolve(new File([blob], picked.name, { type: blob.type || 'application/octet-stream' }))
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Dropbox dosyası alınamadı'))
        }
      },
      cancel: () => reject(new Error('Dropbox seçimi iptal edildi')),
      linkType: 'direct',
      multiselect: false,
      extensions: ['.dwg', '.dxf', '.dwf', '.pdf'],
    })
  })
}
