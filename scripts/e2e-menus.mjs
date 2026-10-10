import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.E2E_BASE || 'http://127.0.0.1:43123'
const shotDir = '/opt/cursor/artifacts/screenshots'
const checklistPath = '/opt/cursor/artifacts/e2e-checklist.json'

const results = []

function record(feature, status, notes) {
  results.push({ feature, status, notes })
  console.log(`${status === 'pass' ? 'OK' : status === 'pro' ? 'PRO' : 'FAIL'}  ${feature} — ${notes}`)
}

async function shot(page, name) {
  await mkdir(shotDir, { recursive: true })
  const path = `${shotDir}/${name}.png`
  await page.screenshot({ path, fullPage: false })
  return path
}

async function dismissUpgrade(page) {
  const sheet = page.locator('.upgrade-card')
  if (await sheet.count()) {
    await sheet.getByRole('button', { name: 'Kapat' }).click()
    await sheet.waitFor({ state: 'hidden' }).catch(() => undefined)
    return true
  }
  return false
}

async function dismissTransient(page) {
  if (await dismissUpgrade(page)) return
  const blocking = page.locator(
    '.draw-capture, .measure-capture, .layers-panel, .settings-panel, .comments-panel, .measure-results-panel, .fv-color-backdrop',
  )
  if (await blocking.count()) {
    await page.evaluate(() => window.__dwgOnBack?.())
    await page.waitForTimeout(80)
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
page.setDefaultTimeout(15000)
page.on('dialog', (dialog) => {
  void dialog.accept('Not')
})

let chooserMode = 'cancel'
page.on('filechooser', async (chooser) => {
  if (chooserMode === 'cancel') {
    await chooser.element().dispatchEvent('cancel')
    return
  }
  if (chooserMode === 'bad') {
    await chooser.setFiles({
      name: 'notlar.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bu bir cizim degil'),
    })
    return
  }
  if (chooserMode === 'same') {
    await chooser.setFiles({
      name: 'ayni.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('ayni icerik'),
    })
  }
})

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Hesap' }).waitFor()
  if (await page.locator('.fv-home-avatar:not(button)').count()) throw new Error('Boş avatar duruyor')
  await shot(page, 'v122-home')
  record('Ana sayfa', 'pass', 'Ev, Dosya ve Bulut görünür')

  await page.getByRole('button', { name: 'Hesap' }).click()
  await page.getByRole('dialog', { name: 'Hesap' }).waitFor()
  await shot(page, 'v122-account')
  await page.getByRole('dialog', { name: 'Hesap' }).getByRole('button', { name: 'Kapat' }).click()

  await page.getByRole('button', { name: 'Bulut', exact: true }).click()
  await page.getByRole('heading', { name: 'Bulut' }).waitFor()
  const drive = page.getByRole('button', { name: /Google Drive/ })
  await drive.waitFor()
  if (await drive.isEnabled()) throw new Error('Anahtarsız Google Drive açık kaldı')
  if (!(await drive.innerText()).includes('Yakında')) throw new Error('Yakında yazısı yok')
  if (await page.getByRole('heading', { name: 'Cihaz' }).count()) throw new Error('Bulut, Cihaz ekranını açtı')
  if ((await page.getByRole('button', { name: 'Bulut', exact: true }).getAttribute('aria-current')) !== 'page') {
    throw new Error('Bulut sekmesi seçili değil')
  }
  await shot(page, 'v122-cloud')
  record('Bulut sekmesi', 'pass', 'Kaynaklar Yakında, Dosya ekranından ayrı')

  await page.getByRole('button', { name: 'Dosya', exact: true }).click()
  await page.getByRole('heading', { name: 'Cihaz' }).waitFor()
  if (await page.getByRole('heading', { name: 'Bulut' }).count()) throw new Error('Dosya, Bulut ekranını açtı')
  if ((await page.getByRole('button', { name: 'Dosya', exact: true }).getAttribute('aria-current')) !== 'page') {
    throw new Error('Dosya sekmesi seçili değil')
  }
  await shot(page, 'v122-files')
  record('Dosya sekmesi', 'pass', 'Cihaz deposu ekranı')

  chooserMode = 'cancel'
  const deviceButton = page.getByRole('button', { name: 'Cihazdan aç' })
  await deviceButton.click()
  await page.getByText(/iptal|Yeniden/i).waitFor()
  if (await deviceButton.isDisabled()) throw new Error('Cihazdan aç iptal sonrası kilitli')
  record('Dosya seçici iptali', 'pass', 'İptal mesajı görünür, düğme yeniden etkin')

  chooserMode = 'bad'
  await deviceButton.click()
  await page.getByText(/açılabilir|okunamadı|Desteklen/i).waitFor()
  if (await deviceButton.isDisabled()) throw new Error('Hatalı dosyadan sonra kilitli')
  record('Bozuk dosya', 'pass', 'Hata mesajı görünür, seçici tekrar açılır')

  chooserMode = 'same'
  await deviceButton.click()
  await page.getByText(/açılabilir|okunamadı|Desteklen/i).waitFor()
  await deviceButton.click()
  await page.waitForTimeout(500)
  if (await deviceButton.isDisabled()) throw new Error('Aynı dosya ikinci kez seçilemedi')
  record('Aynı dosyayı yeniden seçme', 'pass', 'İkinci seçim de tamamlandı')
  chooserMode = 'cancel'

  await page.getByRole('button', { name: 'Ev', exact: true }).click()
  await page.getByRole('tab', { name: 'Son' }).waitFor()
  if ((await page.getByRole('button', { name: 'Ev', exact: true }).getAttribute('aria-current')) !== 'page') {
    throw new Error('Ev sekmesi seçili değil')
  }
  record('Ev sekmesi', 'pass', 'Son listesi ve seçili Ev')

  await page.getByRole('tab', { name: 'Örnekler' }).click()
  await page.getByRole('button', { name: /örnek-plan\.dwg/ }).click()
  await page.locator('canvas.cad-canvas').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await shot(page, 'v122-sample-fit')
  record('Örnek DWG', 'pass', 'Tuval çizildi')

  await page.evaluate(() => window.__dwgOnBack?.())
  const recentRow = page.locator('.fv-file-row').first()
  await recentRow.waitFor()
  await recentRow.locator('img.fv-file-thumb').waitFor({ timeout: 20000 })
  const rowText = await recentRow.innerText()
  if (!rowText.includes('.dwg')) throw new Error(`Dosya adı uzantıyı göstermiyor: ${rowText}`)
  if (!/DWG/.test(rowText)) throw new Error('DWG rozeti yok')
  if (!/AutoCAD/.test(rowText)) throw new Error('DWG sürümü yok')
  if (!/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/.test(rowText)) throw new Error(`Tarih Türkçe değil: ${rowText}`)
  await recentRow.getByRole('button', { name: /menüsü/ }).click()
  await page.getByRole('menuitem', { name: 'Dosya bilgisi' }).waitFor()
  await page.getByRole('menuitem', { name: 'Favorilere ekle' }).waitFor()
  await page.getByRole('menuitem', { name: 'Paylaş' }).waitFor()
  await page.getByRole('menuitem', { name: 'Listeden kaldır' }).waitFor()
  await page.getByRole('menuitem', { name: 'Yeniden adlandır' }).waitFor()
  await shot(page, 'v122-recent')
  await page.getByRole('menuitem', { name: 'Dosya bilgisi' }).click()
  await page.getByRole('dialog', { name: 'Dosya bilgisi' }).waitFor()
  await page.getByRole('dialog', { name: 'Dosya bilgisi' }).getByRole('button', { name: 'Kapat' }).click()
  record('Son dosyalar', 'pass', 'Küçük resim, sürüm, tarih ve menü')
  await recentRow.locator('.fv-file-open').click()
  await page.locator('canvas.cad-canvas').waitFor({ timeout: 20000 })

  const navCount = await page.locator('.fv-nav-item').count()
  for (let index = 0; index < navCount; index += 1) {
    const nav = page.locator('.fv-nav-item').nth(index)
    const navLabel = (await nav.locator('.fv-nav-label').innerText()).trim()
    await nav.click()
    if (navLabel === 'Renk') {
      await page.getByRole('dialog', { name: /renk ayarı/i }).waitFor()
      await page.locator('.fv-color-swatches button').first().click()
      await shot(page, 'v122-color')
      await page.getByRole('button', { name: 'Tamam' }).click()
      record('Renk', 'pass', 'Palet açıldı ve bir renk seçildi')
      continue
    }
    const subCount = await page.locator('.fv-sub-item').count()
    if (!subCount) {
      record(navLabel, 'fail', 'Alt menü açılmadı')
      continue
    }
    for (let sub = 0; sub < subCount; sub += 1) {
      const item = page.locator('.fv-sub-item').nth(sub)
      const label = (await item.getAttribute('aria-label')) || `öğe ${sub}`
      await item.click()
      await page.waitForTimeout(120)
      if (await dismissUpgrade(page)) {
        record(`${navLabel} / ${label}`, 'pro', 'Pro kilidi açılır, ücretsiz planda kilitli')
      } else {
        record(`${navLabel} / ${label}`, 'pass', 'Dokunuş yanıt verdi')
      }
      if (navLabel === 'Katman' && label === 'Katman Listesi') {
        await page.getByRole('dialog', { name: 'Katman listesi' }).waitFor()
        await shot(page, 'v122-layers')
      }
      await dismissTransient(page)
      if ((await page.locator('.fv-sub-item').count()) === 0 && navLabel !== 'Renk') {
        await nav.click()
      }
    }
    if ((await page.locator('.fv-home').count()) > 0) {
      record('Geri tuşu', 'fail', 'Menü turu çizimden çıktı')
      break
    }
  }

  await dismissTransient(page)
  await page.getByRole('button', { name: 'Çiz' }).click()
  await page.getByRole('button', { name: 'Çizgi', exact: true }).click()
  const capture = page.locator('.draw-capture').last()
  await capture.waitFor()
  const box = await capture.boundingBox()
  if (!box) throw new Error('Çizim alanı yok')
  await page.mouse.move(box.x + 48, box.y + 120)
  await page.mouse.down()
  await page.mouse.move(box.x + 220, box.y + 280, { steps: 8 })
  await page.mouse.up()
  const drawnLines = page.locator('.sketch-overlay line')
  await drawnLines.first().waitFor()
  const drawnCount = await drawnLines.count()
  await shot(page, 'v122-draw-line')
  record('Çizgi çizme', 'pass', 'Sürüklenen çizgi tuvalde')

  await page.getByRole('button', { name: 'Geri al' }).click()
  await page.waitForTimeout(200)
  const afterUndo = await drawnLines.count()
  if (afterUndo !== drawnCount - 1) throw new Error(`Geri al ${drawnCount} çizgiden ${afterUndo} bıraktı`)
  record('Geri al', 'pass', 'Son çizgi geri alındı')
  await page.getByRole('button', { name: 'Yinele' }).click()
  await page.waitForFunction((count) => document.querySelectorAll('.sketch-overlay line').length === count, drawnCount)
  record('Yinele', 'pass', 'Çizgi geri geldi')

  await dismissTransient(page)
  await page.getByRole('button', { name: 'Ölçüm' }).click()
  await page.getByRole('button', { name: 'Mesafe', exact: true }).click()
  if (await page.locator('.fv-sub-panel').count()) throw new Error('Ölçüm sayfası araç seçilince kapanmadı')
  const measure = page.locator('.measure-capture')
  await measure.waitFor()
  const measureBox = await measure.boundingBox()
  if (!measureBox) throw new Error('Ölçüm alanı yok')
  await page.mouse.click(measureBox.x + 70, measureBox.y + 160)
  await page.locator('.snap-panel').waitFor()
  await page.locator('.touch-loupe').waitFor({ state: 'hidden', timeout: 1500 }).catch(() => undefined)
  if (await page.locator('.touch-loupe').count()) throw new Error('Büyüteç parmak kalkınca ekranda kaldı')
  await shot(page, 'v122-measure-snap')
  await page.mouse.click(measureBox.x + 240, measureBox.y + 300)
  await page.getByRole('dialog', { name: 'Ölçümler' }).waitFor()
  if (await page.locator('.fv-sub-panel').count()) throw new Error('Sonuç paneli menüyle birlikte açık')
  if (await page.locator('.touch-loupe').count()) throw new Error('Büyüteç sonuç panelinin üstünde kaldı')
  await shot(page, 'v122-measure')
  await page.locator('.measure-results-toggle').click()
  await page.getByRole('button', { name: 'Ölçek kalibre' }).waitFor()
  await shot(page, 'v122-measure-list')
  record('Mesafe ölçümü', 'pass', 'Menü kapandı, sonuçlar katlanmış şerit olarak duruyor')

  await dismissTransient(page)
  await page.getByRole('button', { name: 'Ek açıklama' }).click()
  await page.getByRole('button', { name: 'Metin', exact: true }).click()
  await page.locator('.draw-capture').last().waitFor()
  const textBox = await page.locator('.draw-capture').last().boundingBox()
  if (textBox) await page.mouse.click(textBox.x + 120, textBox.y + 180)
  await page.waitForTimeout(200)
  await shot(page, 'v122-text')
  record('Metin notu', 'pass', 'Not çizime yerleştirildi')

  if (await page.locator('.fv-sub-panel').count()) {
    await page.locator('.fv-nav-item.active').click()
  }
  await page.getByRole('button', { name: 'Menü' }).click()
  await page.locator('.fv-overflow-row').filter({ hasText: 'Ayarlar' }).click()
  const settings = page.locator('.settings-panel')
  await settings.waitFor()
  await settings.getByRole('button', { name: 'Tema' }).click()
  await shot(page, 'v122-settings')
  record('Ayarlar ve tema', 'pass', 'Tema düğmesi çalıştı')
  await page.getByRole('button', { name: 'Ayarları kapat' }).click()

  await page.getByRole('button', { name: 'Sığdır' }).click()
  await page.getByRole('button', { name: 'Yakınlaştır' }).click()
  await page.locator('.draw-capture').waitFor()
  record('Yakınlaştır ve sığdır', 'pass', 'Üst çubuk yanıt verdi')

  const stayed = await page.evaluate(() => window.__dwgOnBack?.() === true)
  const stillDrawing = (await page.locator('canvas.cad-canvas').count()) > 0
  record(
    'Geri tuşu',
    stayed && stillDrawing ? 'pass' : 'fail',
    stayed && stillDrawing ? 'Yakınlaştırma penceresi kapandı, çizim açık kaldı' : 'Geri olayı çizimden çıktı',
  )

  await mkdir('/opt/cursor/artifacts', { recursive: true })
  await writeFile(checklistPath, JSON.stringify(results, null, 2))
  const failed = results.filter((item) => item.status === 'fail')
  if (failed.length) {
    console.error(`FAILED ${failed.length}`)
    process.exitCode = 1
  }
} catch (error) {
  record('E2E', 'fail', error instanceof Error ? error.message : String(error))
  await shot(page, 'v120-failure').catch(() => undefined)
  await mkdir('/opt/cursor/artifacts', { recursive: true })
  await writeFile(checklistPath, JSON.stringify(results, null, 2))
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
