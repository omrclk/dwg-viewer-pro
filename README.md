# DWG Viewer Pro

Android uygulaması: DWG ve DXF çizimlerini açar, katmanları kapatır, mesafe / alan / açı ölçer, işaretleme ekler ve PDF veya görsel olarak paylaşır. Paket adı `com.dwgviewer.pro`.

Web arayüzü React 18, TypeScript, Vite ve Tailwind ile yazıldı. Android kabuğu Capacitor 7.

## Ne açılır

- DWG: `@node-projects/acad-ts` (MIT). Sürümler AC1014–AC1032 (R14’ten AutoCAD 2018’e). Ticari kapalı kaynak dağıtım bu lisansla uyumludur. LibreDWG (GPL-3) ve ücretli ODA SDK kullanılmaz.
- DXF: aynı kütüphane, ASCII DXF okunamazsa projedeki ayrıştırıcıya düşer.
- PDF: yerleşik önizleme.
- DWF: bu sürümde açılmaz. Çizimi DWG veya DXF olarak kaydedin.

Ortak nesneler: çizgi, polyline / lwpolyline (bulge ve sabit genişlik dahil), yay, daire, elips, spline, yazı / mtext (hizalama, genişlik faktörü, eğiklik, Türkçe karakterler), ölçü, tarama, blok ve iç içe insert, katman rengi ve çizgi tipi, model ve kağıt düzenleri.

Çizgiler varsayılan olarak bir cihaz pikseli kalınlığındadır (saç teli). Ayarlardaki **Çizgi kalınlıklarını göster** açılınca gerçek çizgi kalınlığı yakınlaştırmayla ölçeklenir. Kaydırma ve sıkıştırma sırasında görüntü yalnızca hareket boyunca kayar; parmak kalkınca çizim o ölçekte yeniden çizilir.

WhatsApp veya BiP’te bir DWG/DXF’e dokununca DWG Viewer Pro, Birlikte aç listesinde görünür. Her zaman seçilirse aynı tür dosyalar doğrudan açılır. Dosya `application/octet-stream` gelse bile başlıktaki `AC10` imzasından DWG olduğu anlaşılır ve görünen ad `OpenableColumns` ile okunur. İzin kaybolmadan içerik önbelleğe kopyalanır. Uygulama `singleTask` olduğu için ikinci dokunuş yeni bir pencere yığmaz.

## Ücretsiz ve Pro

Tek seferlik Google Play ürünü: `com.dwgviewer.pro.unlock`.

Ücretsiz planda 8 ölçüm kaydı vardır. Dışa aktarılan PDF ve görsele küçük bir filigran eklenir. Gelişmiş menü araçları (VIP) Pro kilidindedir. Satın alma yalnızca Play Store’dan yüklenen Android sürümünde çalışır. Web önizlemesinde ödeme yoktur ve sahte satın alma yazılmaz.

## Geliştirme

Gerekenler: Node 20+, pnpm 11, JDK 21, Android SDK 35 ve build-tools 35.0.0.

```bash
pnpm install
pnpm test
pnpm dev --host 127.0.0.1 --port 43123
```

Üretim web paketi ve Android senkronu:

```bash
pnpm run android:sync
```

`android/local.properties` içine SDK yolunu yazın (bu dosya git’e girmez):

```
sdk.dir=/absolute/path/Android/sdk
```

Hata ayıklama APK:

```bash
cd android
./gradlew assembleDebug
```

Çıktı: `android/app/build/outputs/apk/debug/app-debug.apk`

İmzasız yayın paketi (AAB). Release derlemesi küçültme ve ProGuard kullanır:

```bash
cd android
./gradlew bundleRelease
```

AGP imzasız release paketini reddederse, kendi anahtarınızla imzalayın. Depoya anahtar koymayın.

## İmzalama

```bash
keytool -genkeypair -v -keystore dwg-viewer-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

`android/app/build.gradle` içinde `signingConfigs` tanımlayıp `release` build type’a bağlayın. Şifreleri ortam değişkeninden okuyun. Play App Signing açıksa yükleme anahtarı ile Play’in uygulama anahtarı ayrıdır. Anahtarı yedekleyin.

## Play Billing

1. Play Console’da uygulama `com.dwgviewer.pro` olsun.
2. Tek seferlik ürün oluşturun. Ürün kimliği tam olarak `com.dwgviewer.pro.unlock`.
3. Fiyatı seçin ve ürünü etkinleştirin.
4. Lisans testi hesabı ekleyin.
5. İmzasız veya dahili test kanalına imzalı AAB yükleyin. Satın alma yalnızca bu kurulumda tamamlanır.

Eklenti: `@capgo/native-purchases`. Satın alma otomatik onaylanır. “Satın almayı geri yükle” Play hesabındaki hakkı yeniden okur.

## Bulut

Google Drive, OneDrive ve Dropbox düğmeleri yalnızca ilgili anahtarlar varsa görünür. Anahtar yoksa düğme yoktur.

`.env` örneği:

```
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_API_KEY=
VITE_ONEDRIVE_CLIENT_ID=
VITE_DROPBOX_APP_KEY=
```

## Gizlilik

Mağaza gizlilik URL’si için `public/privacy.html` metnini kendi sitenize koyun. Uygulama içindeki Gizlilik düğmesi aynı özeti gösterir.

## Mağaza metni

Türkçe ve İngilizce taslak: `store/PLAY_LISTING.md`.

## Sınırlar

- Çok yeni DWG sürümleri (2018 sonrası) acad-ts tarafından okunmayabilir.
- DWF desteklenmez.
- Büyük dosyada ücretsiz performans modu ekrana çizilen nesne sayısını sınırlar. Ayarlardan kapatılır.
- Ölçü nesnesinin kendi bloğu boşsa düz bir ölçü çizgisi çizilir.
