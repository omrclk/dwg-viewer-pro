import { loadScript } from './loadScript'

type PickerResponse = {
  action: string
  docs?: Array<{ id: string; name: string; mimeType: string }>
}

declare global {
  interface Window {
    gapi?: {
      load: (name: string, callback: () => void) => void
    }
    google?: {
      picker: {
        Action: { PICKED: string }
        Response: { ACTION: string; DOCUMENTS: string }
        Document: { ID: string; NAME: string }
        ViewId: { DOCS: string }
        PickerBuilder: new () => {
          addView: (view: string) => unknown
          setOAuthToken: (token: string) => unknown
          setDeveloperKey: (key: string) => unknown
          setCallback: (cb: (data: PickerResponse) => void) => unknown
          build: () => { setVisible: (visible: boolean) => void }
        }
      }
    }
    googlePickerToken?: string
  }
}

function loadGoogleIdentity(): Promise<void> {
  return loadScript('https://accounts.google.com/gsi/client', 'google-gsi')
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    loadScript('https://apis.google.com/js/api.js', 'google-api')
      .then(() => {
        if (!window.gapi) {
          reject(new Error('Google API yüklenemedi'))
          return
        }
        window.gapi.load('picker', () => resolve())
      })
      .catch(reject)
  })
}

async function requestAccessToken(clientId: string): Promise<string> {
  await loadGoogleIdentity()

  return new Promise((resolve, reject) => {
    const googleAccounts = (window as unknown as { google?: { accounts?: { oauth2?: { initTokenClient: (config: {
      client_id: string
      scope: string
      callback: (response: { access_token?: string; error?: string }) => void
    }) => { requestAccessToken: () => void } } } } }).google?.accounts?.oauth2

    const tokenClient = googleAccounts?.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response) => {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error ?? 'Google oturumu açılamadı'))
      },
    })

    if (!tokenClient) {
      reject(new Error('Google Identity yüklenemedi'))
      return
    }

    tokenClient.requestAccessToken()
  })
}

async function downloadDriveFile(fileId: string, fileName: string, token: string, mimeType: string) {
  const exportMime =
    mimeType === 'application/vnd.google-apps.document'
      ? 'application/pdf'
      : mimeType === 'application/vnd.google-apps.spreadsheet'
        ? 'application/pdf'
        : null

  const url = exportMime
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error('Google Drive dosyası indirilemedi')
  }

  const blob = await response.blob()
  const resolvedName = exportMime && !fileName.toLowerCase().endsWith('.pdf') ? `${fileName}.pdf` : fileName
  return new File([blob], resolvedName, { type: blob.type || 'application/octet-stream' })
}

export function isGoogleDriveConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_API_KEY)
}

export async function pickGoogleDriveFile(): Promise<File> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY

  if (!clientId || !apiKey) {
    throw new Error('Google Drive için VITE_GOOGLE_CLIENT_ID ve VITE_GOOGLE_API_KEY tanimlayin (.env)')
  }

  const [token] = await Promise.all([requestAccessToken(clientId), loadPickerApi()])

  return new Promise((resolve, reject) => {
    if (!window.google?.picker) {
      reject(new Error('Google Picker kullanilamiyor'))
      return
    }

    const builder = new window.google.picker.PickerBuilder()
    builder.addView(window.google.picker.ViewId.DOCS)
    ;(builder as { setOAuthToken: (t: string) => typeof builder }).setOAuthToken(token)
    ;(builder as { setDeveloperKey: (k: string) => typeof builder }).setDeveloperKey(apiKey)
    ;(builder as { setCallback: (cb: (data: PickerResponse) => void) => { build: () => { setVisible: (v: boolean) => void } } }).setCallback(async (data) => {
      if (data.action !== window.google?.picker.Action.PICKED || !data.docs?.length) return

      try {
        const doc = data.docs[0]
        const file = await downloadDriveFile(doc.id, doc.name, token, doc.mimeType)
        resolve(file)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Google Drive dosyası alınamadı'))
      }
    })
    const picker = (builder as { build: () => { setVisible: (v: boolean) => void } }).build()
    picker.setVisible(true)
  })
}
