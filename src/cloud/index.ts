import { pickDropboxFile, isDropboxConfigured } from './dropbox'
import { pickGoogleDriveFile, isGoogleDriveConfigured } from './googleDrive'
import { pickOneDriveFile, isOneDriveConfigured } from './oneDrive'
import type { FileSource } from '../fileTypes'
import { pickDeviceFile } from '../fileOpenService'

export type CloudProvider = Exclude<FileSource, 'device'>

export function cloudProviderStatus() {
  return {
    googleDrive: isGoogleDriveConfigured(),
    oneDrive: isOneDriveConfigured(),
    dropbox: isDropboxConfigured(),
  }
}

export async function pickFileFromSource(source: FileSource): Promise<File> {
  if (source === 'device') {
    const file = await pickDeviceFile()
    if (!file) throw new Error('Dosya secilmedi')
    return file
  }

  if (source === 'google-drive') return pickGoogleDriveFile()
  if (source === 'onedrive') return pickOneDriveFile()
  return pickDropboxFile()
}
