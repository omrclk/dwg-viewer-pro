import { type CSSProperties } from 'react'
import { FileText } from 'lucide-react'
import '../App.css'
import '../fastview/fastview.css'
import { OpenFilesPanel } from '../OpenFilesPanel'
import { listRecentFiles } from '../recentFiles'
import { applyCamera } from '../dxfTransform'
import { DRAW_LABELS } from '../drawTools'
import { SketchLayer } from '../SketchLayer'
import { EDIT_LABELS } from '../editTools'
import { MarkupLayer } from '../MarkupLayer'
import { SettingsPanel } from '../components/SettingsPanel'
import { MeasureOverlay } from '../MeasureOverlay'
import { MeasureResultsPanel } from '../MeasureResultsPanel'
import { SavedMeasuresLayer } from '../SavedMeasuresLayer'
import { SnapPanel } from '../components/SnapPanel'
import {
  FastViewBottomStack,
  FastViewColorModal,
  FastViewOverflowMenu,
  FastViewTopBar,
} from '../components/FastViewMenus'
import { FastViewHome } from '../components/FastViewHome'
import { CadCanvas } from '../components/CadCanvas'
import { DrawingViewport } from '../viewer/DrawingViewport'
import { ColorPalettePanel, CommentsPanel, LayerPanel } from '../viewer/ViewerPanels'
import { TouchLoupe } from '../components/TouchLoupe'
import { UpgradeSheet } from '../components/UpgradeSheet'
import { useCadController, type MenuAction } from '../app/useCadController'

export function CadShell() {
  const {
    menuItems,
    inputRef,
    viewportRef,
    fingerDown,
    loupe,
    setLoupe,
    moving,
    objectMenu,
    setObjectMenu,
    openedFile,
    openPanelOpen,
    setOpenPanelOpen,
    fileBusy,
    setFileBusy,
    openStatus,
    setOpenStatus,
    error,
    setError,
    layersPanelOpen,
    setLayersPanelOpen,
    menuOpen,
    screen,
    recentList,
    setRecentList,
    activeCategory,
    setActiveCategory,
    colorModalOpen,
    setColorModalOpen,
    colorMode,
    setColorMode,
    hiddenLayers,
    measurePanelOpen,
    setMeasurePanelOpen,
    resultsExpanded,
    setResultsExpanded,
    measureOverlaysHidden,
    imageInputRef,
    audioInputRef,
    videoInputRef,
    settingsPanelOpen,
    setSettingsPanelOpen,
    commentsPanelOpen,
    setCommentsPanelOpen,
    colorPanelOpen,
    setColorPanelOpen,
    drawModeOpen,
    activeDrawTool,
    activeMeasureMode,
    draftPoints,
    draftSketchShape,
    measureRecords,
    setMeasureRecords,
    sketchShapes,
    activeEditTool,
    markupPlaceMode,
    numberMarkers,
    mediaMarkers,
    comments,
    setComments,
    activeMarkupColor,
    setActiveMarkupColor,
    notice,
    setViewport,
    unitsPerDrawingUnit,
    unitLabel,
    contentRef,
    appSettings,
    snapPreview,
    pro,
    upgradeOpen,
    setUpgradeOpen,
    upgradeBusy,
    upgradeError,
    priceLabel,
    viewSize,
    zoomWindowMode,
    setZoomWindowMode,
    textNotes,
    pendingText,
    privacyOpen,
    setPrivacyOpen,
    mediaPreview,
    setMediaPreview,
    exportOpen,
    setExportOpen,
    zoomDrag,
    online,
    lowPerf,
    viewportResetKey,
    layerList,
    layerColors,
    entityCounts,
    coordMode,
    sceneBounds,
    dxfTransform,
    canvasEntities,
    measureHint,
    notify,
    viewerRef,
    updateSnapSettings,
    selectMeasureMode,
    fastViewActiveActionId,
    handleMeasurePointerDown,
    toggleLayer,
    showAllLayers,
    hideAllLayers,
    handleFastViewSubAction,
    handleCategorySelect,
    handleTopBarAction,
    shareDrawing,
    buyPro,
    handleRestorePro,
    openSample,
    enterViewer,
    exitViewer,
    chromeBottom,
    resultsLift,
    snapLift,
    handleFileChange,
    handlePickDevice,
    handlePickCloud,
    handleMeasurePointerMove,
    openObjectMenu,
    deleteMarkupHit,
    beginMove,
    handleDrawPointerDown,
    handleDrawPointerMove,
    handleDrawPointerEnd,
    handleMovePointerDown,
    handleMovePointerMove,
    handleMovePointerEnd,
    handleEditPointerDown,
    handleMarkupPointerDown,
    handleImagePick,
    handleAudioPick,
    handleVideoPick,
    placeTextNote,
    updateAppSettings,
    handleOpenRecent,
    addComment,
    handleMenuAction,
  } = useCadController()
  return (
    <main className={`dwg-shell theme-${appSettings.theme}${lowPerf ? ' perf-low' : ''}`} aria-label="DWG FastView">
      <input
        ref={imageInputRef}
        className="file-input"
        type="file"
        accept="image/*"
        onChange={handleImagePick}
      />
      <input ref={audioInputRef} className="file-input" type="file" accept="audio/*" onChange={handleAudioPick} />
      <input ref={videoInputRef} className="file-input" type="file" accept="video/*" onChange={handleVideoPick} />
      <input
        ref={inputRef}
        className="file-input"
        type="file"
        accept=".dwg,.dxf,.dwf,.pdf,application/pdf,application/acad,application/autocad_dwg,application/dwg,application/dxf,application/dwf,application/octet-stream,application/x-acad,application/x-autocad,application/x-dwg,application/x-dxf,application/x-dwf,image/vnd.dwg,image/vnd.dxf"
        onChange={handleFileChange}
      />

      {screen === 'home' ? (
        <>
          <FastViewHome
            recentFiles={recentList}
            fileBusy={fileBusy}
            statusMessage={openStatus || undefined}
            pro={pro}
            onPickDevice={(origin) => {
              void handlePickDevice(origin)
            }}
            onPickCloud={(provider) => {
              void handlePickCloud(provider)
            }}
            onOpenRecent={handleOpenRecent}
            onOpenSample={(format) => {
              void openSample(format)
            }}
            onEnterViewer={enterViewer}
            onRefresh={() => setRecentList(listRecentFiles())}
            onOpenPrivacy={() => setPrivacyOpen(true)}
            onUpgrade={() => setUpgradeOpen(true)}
          />
          {openPanelOpen && (
            <OpenFilesPanel
              busy={fileBusy}
              statusMessage={openStatus || undefined}
              onClose={() => {
                setOpenPanelOpen(false)
                setFileBusy(false)
                setOpenStatus('')
              }}
              onPickDevice={handlePickDevice}
              onPickCloud={handlePickCloud}
              onOpenRecent={handleOpenRecent}
            />
          )}
        </>
      ) : (
      <section
        ref={viewerRef}
        className="viewer fv-viewer mobile-viewer"
        style={
          {
            '--markup-color': activeMarkupColor,
            '--fv-chrome-bottom': chromeBottom,
            '--fv-top-chrome': '88px',
            '--results-lift': `${resultsLift}px`,
            '--snap-lift': `${snapLift}px`,
          } as CSSProperties
        }
      >

        <FastViewTopBar
          menuOpen={menuOpen}
          onClose={exitViewer}
          onAction={handleTopBarAction}
          onTextStyle={() => {
            setActiveCategory(null)
            setMeasurePanelOpen(false)
            setSettingsPanelOpen(true)
            notify('Metin yüksekliği ayarlardan değişir.')
          }}
        />

        {menuOpen && (
          <FastViewOverflowMenu
            items={menuItems.map(({ icon, label, action }) => ({ id: action, label, icon }))}
            onSelect={(id) => handleMenuAction(id as MenuAction)}
          />
        )}

        <div className="cad-stage">
          <DrawingViewport
            resetKey={viewportResetKey}
            actionsRef={viewportRef}
            panLocked={!!activeMeasureMode || drawModeOpen || !!activeEditTool || !!markupPlaceMode || moving}
            onIdlePress={openObjectMenu}
            onViewportChange={setViewport}
          >
            {(camera) => {
              const overlayTransform = dxfTransform ? applyCamera(dxfTransform, camera) : undefined
              return (
            <div className="viewport-content" ref={contentRef}>
              {openedFile?.format === 'pdf' && openedFile.url ? (
                <iframe className="pdf-frame" title={openedFile.name} src={openedFile.url} />
              ) : canvasEntities.length ? (
                <CadCanvas
                  entities={canvasEntities}
                  hiddenLayers={hiddenLayers}
                  theme={appSettings.theme}
                  viewWidth={viewSize.width}
                  viewHeight={viewSize.height}
                  bounds={sceneBounds}
                  camera={camera}
                  showLineweights={appSettings.showLineweights}
                />
              ) : (
                <div className="native-format-card">
                  <FileText size={36} />
                  <strong>{error ? 'Dosya açılamadı' : 'Çizim yok'}</strong>
                  <span>{error || 'Dosya açın veya Örnekler sekmesinden bir plan yükleyin.'}</span>
                </div>
              )}

              <SavedMeasuresLayer
                records={measureRecords}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                hidden={measureOverlaysHidden}
              />
              <MarkupLayer
                numbers={numberMarkers}
                media={mediaMarkers}
                texts={textNotes}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                onSelectMedia={setMediaPreview}
              />
              <SketchLayer
                shapes={sketchShapes}
                draftShape={draftSketchShape}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
              />
              <MeasureOverlay
                mode={activeMeasureMode}
                draftPoints={draftPoints}
                snapPreview={snapPreview}
                coordMode={coordMode}
                dxfTransform={overlayTransform}
                hint={measureHint}
              />
              {zoomWindowMode && (
                <div
                  className="draw-capture"
                  onPointerDown={(event) => {
                    zoomDrag.current = { x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY }
                  }}
                  onPointerUp={(event) => {
                    const start = zoomDrag.current
                    zoomDrag.current = null
                    const host = contentRef.current?.closest('.viewport-host')
                    if (!start || !(host instanceof HTMLElement)) return
                    const bounds = host.getBoundingClientRect()
                    viewportRef.current?.zoomToScreenRect({
                      x1: start.x1 - bounds.left,
                      y1: start.y1 - bounds.top,
                      x2: event.clientX - bounds.left,
                      y2: event.clientY - bounds.top,
                    })
                    setZoomWindowMode(false)
                  }}
                >
                  <span className="draw-hint">Pencere</span>
                </div>
              )}
              {pendingText && (
                <div className="draw-capture" onPointerDown={placeTextNote}>
                  <span className="draw-hint">Metin</span>
                </div>
              )}
              {activeMeasureMode && (
                <div
                  className="measure-capture"
                  onPointerDown={handleMeasurePointerDown}
                  onPointerMove={handleMeasurePointerMove}
                  onPointerUp={() => {
                    fingerDown.current = false
                    setLoupe(null)
                  }}
                  onPointerCancel={() => {
                    fingerDown.current = false
                    setLoupe(null)
                  }}
                  onPointerLeave={() => {
                    fingerDown.current = false
                    setLoupe(null)
                  }}
                />
              )}
              {activeEditTool && (
                <div className="draw-capture edit-capture" onPointerDown={handleEditPointerDown}>
                  <span className="draw-hint">{EDIT_LABELS[activeEditTool]}</span>
                </div>
              )}
              {markupPlaceMode && (
                <div className="draw-capture markup-capture" onPointerDown={handleMarkupPointerDown}>
                  <span className="draw-hint">
                    {markupPlaceMode === 'number'
                      ? 'Numara'
                      : markupPlaceMode === 'image'
                        ? 'Görüntü'
                        : markupPlaceMode === 'audio'
                          ? 'Ses'
                          : 'Video'}
                  </span>
                </div>
              )}
              {drawModeOpen && (
                <div
                  className="draw-capture"
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerEnd}
                  onPointerCancel={handleDrawPointerEnd}
                >
                  <span className="draw-hint">{DRAW_LABELS[activeDrawTool]}</span>
                </div>
              )}
              {moving && (
                <div
                  className="draw-capture"
                  onPointerDown={handleMovePointerDown}
                  onPointerMove={handleMovePointerMove}
                  onPointerUp={handleMovePointerEnd}
                  onPointerCancel={handleMovePointerEnd}
                >
                  <span className="draw-hint">Taşı</span>
                </div>
              )}
            </div>
              )
            }}
          </DrawingViewport>

          {error && (
            <div className="file-error">
              <span>{error}</span>
              <button type="button" aria-label="Hatayı kapat" onClick={() => setError('')}>
                Kapat
              </button>
            </div>
          )}
          <TouchLoupe x={loupe?.x ?? 0} y={loupe?.y ?? 0} visible={Boolean(loupe)} />
          {objectMenu && (
            <div className="object-menu" style={{ left: objectMenu.x, top: objectMenu.y }} role="menu" aria-label="Nesne menüsü">
              {objectMenu.hit ? (
                <>
                  <button type="button" onClick={() => deleteMarkupHit(objectMenu.hit!)}>
                    Sil
                  </button>
                  <button type="button" onClick={() => beginMove(objectMenu.hit!)}>
                    Taşı
                  </button>
                </>
              ) : (
                <p className="object-menu-empty">Nesne yok</p>
              )}
              <button type="button" onClick={() => setObjectMenu(null)}>
                Kapat
              </button>
            </div>
          )}

          {measurePanelOpen && (
            <MeasureResultsPanel
              records={measureRecords}
              unitLabel={unitLabel}
              unitsPerDrawingUnit={unitsPerDrawingUnit}
              expanded={resultsExpanded}
              onToggle={() => setResultsExpanded((open) => !open)}
              onDelete={(id) => setMeasureRecords((current) => current.filter((record) => record.id !== id))}
              onClear={() => setMeasureRecords([])}
              onClose={() => {
                setMeasurePanelOpen(false)
                setResultsExpanded(false)
              }}
              onCalibrate={() => {
                setMeasurePanelOpen(false)
                setResultsExpanded(false)
                selectMeasureMode('calibration')
              }}
            />
          )}

          {settingsPanelOpen && (
            <SettingsPanel
              settings={appSettings}
              pro={pro}
              onChange={updateAppSettings}
              onClose={() => setSettingsPanelOpen(false)}
              onUpgrade={() => setUpgradeOpen(true)}
              onPrivacy={() => setPrivacyOpen(true)}
            />
          )}

          {layersPanelOpen && (
            <LayerPanel
              layers={layerList}
              hiddenLayers={hiddenLayers}
              entityCounts={entityCounts}
              layerColors={layerColors}
              onToggle={toggleLayer}
              onShowAll={showAllLayers}
              onHideAll={hideAllLayers}
              onClose={() => setLayersPanelOpen(false)}
            />
          )}

          {commentsPanelOpen && (
            <CommentsPanel
              comments={comments}
              color={activeMarkupColor}
              onAdd={addComment}
              onDelete={(id) => setComments((current) => current.filter((comment) => comment.id !== id))}
              onClose={() => setCommentsPanelOpen(false)}
            />
          )}

          {colorModalOpen && (
            <FastViewColorModal
              color={activeMarkupColor}
              colorMode={colorMode}
              onSelectColor={(color) => {
                setActiveMarkupColor(color)
                setColorMode('aci')
              }}
              onSelectMode={(mode) => setColorMode(mode)}
              onClose={() => {
                setColorModalOpen(false)
                setActiveCategory(null)
              }}
              onConfirm={() => {
                notify(
                  colorMode === 'byLayer'
                    ? 'Renk ByLayer olarak ayarlandı.'
                    : colorMode === 'byBlock'
                      ? 'Renk ByBlock olarak ayarlandı.'
                      : 'Renk güncellendi.',
                )
                setColorModalOpen(false)
              }}
            />
          )}

          {colorPanelOpen && (
            <ColorPalettePanel
              color={activeMarkupColor}
              onSelect={(color) => {
                setActiveMarkupColor(color)
                notify('Renk paleti güncellendi.')
              }}
              onClose={() => setColorPanelOpen(false)}
            />
          )}
        </div>

        {activeMeasureMode && !resultsExpanded && (
          <SnapPanel settings={appSettings.snap} activeKind={snapPreview?.kind ?? null} onChange={updateSnapSettings} />
        )}

        <FastViewBottomStack
          activeCategory={activeCategory}
          activeActionId={fastViewActiveActionId}
          onCategorySelect={handleCategorySelect}
          onSubAction={handleFastViewSubAction}
        />

        {notice && <div className="app-notice" role="status">{notice}</div>}

        {!online && <p className="offline-banner">Çevrimdışı: açılan dosyalar ve önbellek çalışır.</p>}
      </section>
      )}

      {upgradeOpen && (
        <UpgradeSheet
          busy={upgradeBusy}
          priceLabel={priceLabel}
          error={upgradeError}
          onClose={() => setUpgradeOpen(false)}
          onPurchase={() => {
            void buyPro()
          }}
          onRestore={() => {
            void handleRestorePro()
          }}
        />
      )}

      {exportOpen && (
        <div className="upgrade-sheet" role="dialog" aria-label="Dışa aktar">
          <div className="upgrade-card">
            <h2>Dışa aktar</h2>
            <p className="upgrade-note">{pro ? 'Filigransız PDF veya görsel.' : 'Ücretsiz planda küçük bir filigran eklenir.'}</p>
            <div className="upgrade-actions">
              <button type="button" onClick={() => { setExportOpen(false); void shareDrawing('pdf') }}>PDF</button>
              <button type="button" onClick={() => { setExportOpen(false); void shareDrawing('png') }}>Görsel</button>
              <button type="button" className="upgrade-dismiss" onClick={() => setExportOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {privacyOpen && (
        <div className="upgrade-sheet" role="dialog" aria-label="Gizlilik">
          <div className="upgrade-card">
            <h2>Gizlilik</h2>
            <p className="upgrade-note">
              Çizimler cihazınızda açılır. Son dosyalar yalnızca bu uygulamada saklanır. Bulut hesapları ancak siz bağlarsanız kullanılır.
              Satın alma kaydı Google Play tarafından tutulur. Konum, rehber veya reklam kimliği toplanmaz.
            </p>
            <div className="upgrade-actions">
              <button type="button" onClick={() => setPrivacyOpen(false)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {mediaPreview && (
        <div className="upgrade-sheet" role="dialog" aria-label="İşaret">
          <div className="upgrade-card">
            <h2>{mediaPreview.label}</h2>
            {mediaPreview.imageUrl && <img src={mediaPreview.imageUrl} alt="" className="media-preview" />}
            {mediaPreview.audioUrl && <audio controls src={mediaPreview.audioUrl} />}
            {mediaPreview.videoUrl && <video controls src={mediaPreview.videoUrl} className="media-preview" />}
            {!mediaPreview.imageUrl && !mediaPreview.audioUrl && !mediaPreview.videoUrl && (
              <p className="upgrade-note">Bu işaretin medya dosyası yok.</p>
            )}
            <div className="upgrade-actions">
              <button type="button" onClick={() => setMediaPreview(null)}>Kapat</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'viewer' && openPanelOpen && (
        <OpenFilesPanel
          busy={fileBusy}
          statusMessage={openStatus || undefined}
          onClose={() => {
            setOpenPanelOpen(false)
            setFileBusy(false)
            setOpenStatus('')
          }}
          onPickDevice={handlePickDevice}
          onPickCloud={handlePickCloud}
          onOpenRecent={handleOpenRecent}
        />
      )}
    </main>
  )
}
