package expo.modules.tablelenscapture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.nio.ByteBuffer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class CaptureService : Service() {
  @Volatile private var projection: MediaProjection? = null
  @Volatile private var virtualDisplay: VirtualDisplay? = null
  @Volatile private var imageReader: ImageReader? = null
  @Volatile private var frameThread: HandlerThread? = null
  @Volatile private var frameHandler: Handler? = null
  @Volatile private var analysisExecutor: ExecutorService? = null
  @Volatile private var analyzer: OcrAnalyzer? = null
  @Volatile private var overlay: OverlayController? = null
  @Volatile private var mainHandler: Handler? = null
  @Volatile private var paused = false
  @Volatile private var stopping = false
  @Volatile private var projectionCallbackStopped = false
  @Volatile private var inferenceVersion = 0L
  @Volatile private var lastSubmittedAt = 0L
  private val analysisBusy = AtomicBoolean(false)
  private val stabilityLock = Any()
  private var stableFingerprint: String? = null
  private var stableCount = 0
  @Volatile private var lastRotation = -1
  @Volatile private var displayWidth = 0
  @Volatile private var displayHeight = 0
  @Volatile private var displayDensity = 0
  @Volatile private var projectionCallback: MediaProjection.Callback? = null

  private val watchdog = object : Runnable {
    override fun run() {
      if (stopping) return
      expireStaleDisplayedState()
      mainHandler?.postDelayed(this, WATCHDOG_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    mainHandler = Handler(Looper.getMainLooper())
    synchronized(lock) { instance = this }
    frameThread = HandlerThread("tablelens-capture-frames").also { it.start() }
    frameHandler = Handler(frameThread!!.looper)
    analysisExecutor = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "tablelens-ocr") }
    analyzer = OcrAnalyzer(analysisExecutor!!)
    overlay = OverlayController(
      applicationContext,
      { pauseCapture() },
      { resumeCapture() },
      { openReviewFromOverlay() },
      { stopCapture(false) },
    )
    ensureNotificationChannel()
    mainHandler?.post(watchdog)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> { stopCapture(false); return START_NOT_STICKY }
      ACTION_PAUSE -> { pauseCapture(); return START_NOT_STICKY }
      ACTION_RESUME -> { resumeCapture(); return START_STICKY }
    }
    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Int.MIN_VALUE) ?: Int.MIN_VALUE
    val data = if (Build.VERSION.SDK_INT >= 33) {
      intent?.getParcelableExtra(EXTRA_DATA, Intent::class.java)
    } else {
      @Suppress("DEPRECATION") intent?.getParcelableExtra(EXTRA_DATA)
    }
    if (resultCode != Int.MIN_VALUE && data != null && projection == null) {
      beginProjection(resultCode, data)
    } else if (projection == null && !stopping) {
      failAndStop("MediaProjection consent is required")
    }
    return START_NOT_STICKY
  }

  private fun beginProjection(resultCode: Int, data: Intent) {
    if (!Settings.canDrawOverlays(applicationContext)) {
      failAndStop("Overlay permission is required before capture")
      return
    }
    emitLiveState(NativeState.unknown("starting", message = "Starting capture; waiting for first frame"))
    try {
      // Keep foreground-start failures visible as the terminal state instead of replacing them with stopped.
      startForegroundCompat(false)
      val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
      projection = manager.getMediaProjection(resultCode, data)
      val activeProjection = projection ?: throw IllegalStateException("MediaProjection unavailable")
      projectionCallbackStopped = false
      projectionCallback = object : MediaProjection.Callback() {
        override fun onStop() {
          if (!stopping && !projectionCallbackStopped) stopCapture(true)
        }
      }.also { activeProjection.registerCallback(it, frameHandler) }
      createVirtualDisplay()
      showOverlayOnMain("Waiting for first frame")
      emitLiveState(NativeState.unknown("active", message = "Waiting for a validated table frame"))
    } catch (error: Throwable) {
      failAndStop("Could not start capture: ${error.message ?: "permission unavailable"}")
    }
  }

  private fun failAndStop(message: String) {
    val errorState = NativeState.error(message)
    stopCapture(false, errorState)
  }

  private fun createVirtualDisplay() {
    val metrics = resources.displayMetrics
    val window = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val real = android.util.DisplayMetrics()
    @Suppress("DEPRECATION") window.defaultDisplay.getRealMetrics(real)
    displayWidth = (real.widthPixels.takeIf { it > 0 } ?: metrics.widthPixels)
    displayHeight = (real.heightPixels.takeIf { it > 0 } ?: metrics.heightPixels)
    displayDensity = (real.densityDpi.takeIf { it > 0 } ?: metrics.densityDpi)
    @Suppress("DEPRECATION") lastRotation = window.defaultDisplay.rotation
    imageReader = ImageReader.newInstance(displayWidth, displayHeight, PixelFormat.RGBA_8888, 2)
    installReaderListener(imageReader!!)
    virtualDisplay = projection?.createVirtualDisplay(
      "TableLensCapture", displayWidth, displayHeight, displayDensity,
      DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
      imageReader!!.surface, null, frameHandler,
    )
  }

  private fun installReaderListener(reader: ImageReader) {
    reader.setOnImageAvailableListener({ available -> onImageAvailable(available) }, frameHandler)
  }

  private fun onImageAvailable(reader: ImageReader) {
    // ImageReader can deliver faster than ML Kit completes. Keep exactly one bitmap/OCR job retained.
    if (!analysisBusy.compareAndSet(false, true)) {
      try { reader.acquireLatestImage()?.close() } catch (_: Throwable) { }
      return
    }
    var image: Image? = null
    var bitmap: Bitmap? = null
    var submitted = false
    try {
      image = try { reader.acquireLatestImage() } catch (_: Throwable) { null }
      if (image == null || stopping || paused) return
      val now = System.currentTimeMillis()
      if (now - lastSubmittedAt < FRAME_INTERVAL_MS) return
      val frameAge = if (image.timestamp > 0L) {
        SystemClock.elapsedRealtime() - image.timestamp / 1_000_000L
      } else 0L
      if (frameAge > MAX_STATE_AGE_MS) return
      lastSubmittedAt = now
      val capturedAt = now - frameAge.coerceAtLeast(0L)
      bitmap = imageToBitmap(image) ?: return
      val version = inferenceVersion
      val activeAnalyzer = analyzer ?: return
      activeAnalyzer.analyze(bitmap, version, capturedAt) { callbackVersion, frameCapturedAt, observation, error ->
        try {
          handleAnalysis(callbackVersion, frameCapturedAt, observation, error)
        } finally {
          // This is the sole completion release for an accepted OCR submission.
          analysisBusy.set(false)
        }
      }
      submitted = true
    } catch (_: Throwable) {
      // Image processing is best effort; the next latest frame is authoritative.
    } finally {
      try { image?.close() } catch (_: Throwable) { }
      if (!submitted) {
        try { bitmap?.recycle() } catch (_: Throwable) { }
        analysisBusy.set(false)
      }
    }
    refreshDisplayIfRotated()
  }

  private fun imageToBitmap(image: Image): Bitmap? {
    val plane = image.planes.firstOrNull() ?: return null
    val pixelStride = plane.pixelStride
    val rowStride = plane.rowStride
    if (pixelStride < 4 || image.width <= 0 || image.height <= 0) return null
    val rowBytes = image.width * pixelStride
    val packed = ByteBuffer.allocate(image.width * image.height * 4)
    val source = plane.buffer.duplicate()
    for (row in 0 until image.height) {
      val start = row * rowStride
      if (start >= source.limit()) break
      source.position(start)
      val bytes = ByteArray(minOf(rowBytes, source.remaining()))
      source.get(bytes)
      if (pixelStride == 4) packed.put(bytes) else {
        var index = 0
        while (index + 3 < bytes.size && packed.remaining() >= 4) {
          packed.put(bytes[index])
          packed.put(bytes[index + 1])
          packed.put(bytes[index + 2])
          packed.put(bytes[index + 3])
          index += pixelStride
        }
      }
    }
    packed.flip()
    return try {
      Bitmap.createBitmap(image.width, image.height, Bitmap.Config.ARGB_8888).also { it.copyPixelsFromBuffer(packed) }
    } catch (_: Throwable) { null }
  }

  private fun refreshDisplayIfRotated() {
    if (stopping) return
    val window = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    @Suppress("DEPRECATION") val rotation = window.defaultDisplay.rotation
    if (rotation == lastRotation) return
    lastRotation = rotation
    val metrics = android.util.DisplayMetrics()
    @Suppress("DEPRECATION") window.defaultDisplay.getRealMetrics(metrics)
    val newWidth = metrics.widthPixels
    val newHeight = metrics.heightPixels
    if (newWidth <= 0 || newHeight <= 0 || virtualDisplay == null) return
    val newReader = ImageReader.newInstance(newWidth, newHeight, PixelFormat.RGBA_8888, 2)
    installReaderListener(newReader)
    val oldReader = imageReader
    imageReader = newReader
    displayWidth = newWidth
    displayHeight = newHeight
    displayDensity = metrics.densityDpi
    virtualDisplay?.resize(newWidth, newHeight, displayDensity)
    virtualDisplay?.setSurface(newReader.surface)
    oldReader?.setOnImageAvailableListener(null, null)
    oldReader?.close()
    clearStability()
  }

  private fun handleAnalysis(version: Long, capturedAt: Long, observation: OcrObservation?, error: String?) {
    if (stopping || paused || version != inferenceVersion) return
    val now = System.currentTimeMillis()
    val latency = (now - capturedAt).coerceAtLeast(0L)
    if (latency > MAX_STATE_AGE_MS) {
      clearStability()
      emitLiveState(NativeState.unknown("active", message = "Frame expired before validation", capturedAt = capturedAt, latencyMs = latency))
      return
    }
    if (observation == null) {
      clearStability()
      emitLiveState(NativeState.unknown("active", message = error ?: "Waiting for a validated frame", capturedAt = capturedAt, latencyMs = latency))
      return
    }
    val candidate = ObservationInterpreter.interpret(observation, "capture", "active", latency, capturedAt)
    if (candidate == null) {
      clearStability()
      emitLiveState(NativeState.unknown("active", message = "Incomplete or uncertain table state", capturedAt = capturedAt, latencyMs = latency))
      return
    }
    if (currentFingerprint() != null && currentFingerprint() != candidate.fingerprint) {
      clearStability()
    }
    val stable = synchronized(stabilityLock) {
      if (stableFingerprint == candidate.fingerprint) stableCount++ else {
        stableFingerprint = candidate.fingerprint
        stableCount = 1
      }
      stableCount >= 2
    }
    if (!stable) {
      emitLiveState(NativeState.unknown("active", message = "Stabilizing OCR; waiting for a matching frame", capturedAt = capturedAt, latencyMs = latency))
      return
    }
    synchronized(lock) {
      lastFingerprint = candidate.fingerprint
      liveAcceptedState = candidate.state
    }
    emitLiveState(candidate.state)
  }

  private fun expireStaleDisplayedState() {
    val snapshot = synchronized(lock) { lastState.toMap() }
    val status = snapshot["captureStatus"]?.toString()
    val source = snapshot["source"]?.toString()
    val accepted = snapshot["accepted"] == true
    val recommendation = snapshot["recommendation"]?.toString()
    val capturedAt = (snapshot["capturedAt"] as? Number)?.toLong() ?: return
    val age = System.currentTimeMillis() - capturedAt
    val shouldExpire = status == "active" && accepted && age > MAX_STATE_AGE_MS &&
      (!recommendation.isNullOrBlank() || source == "manual")
    if (!shouldExpire) return
    clearStability()
    emitLiveState(NativeState.unknown("active", source = "watchdog", message = "Recommendation expired; waiting for a fresh validated frame"))
  }

  private fun pauseCapture() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler?.post { pauseCapture() }
      return
    }
    if (stopping || projection == null) return
    paused = true
    inferenceVersion++
    lastSubmittedAt = 0L
    clearStability()
    emitLiveState(NativeState.unknown("paused", message = "Paused; buffers and advice discarded"))
    try { startForegroundCompat(true) } catch (_: Throwable) { }
  }

  private fun resumeCapture() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler?.post { resumeCapture() }
      return
    }
    if (stopping || projection == null) return
    paused = false
    inferenceVersion++
    lastSubmittedAt = 0L
    clearStability()
    emitLiveState(NativeState.unknown("active", message = "Resumed; waiting for a new frame"))
    try { startForegroundCompat(false) } catch (_: Throwable) { }
  }

  private fun clearStability() {
    synchronized(stabilityLock) {
      stableFingerprint = null
      stableCount = 0
    }
    synchronized(lock) {
      lastFingerprint = null
      liveAcceptedState = null
    }
  }

  private fun stopCapture(fromProjectionCallback: Boolean, terminalState: Map<String, Any?>? = null) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler?.post { stopCapture(fromProjectionCallback, terminalState) }
      return
    }
    if (stopping) return
    stopping = true
    inferenceVersion++
    paused = true
    clearStability()
    mainHandler?.removeCallbacks(watchdog)

    // Stop delivery before releasing the display, then unregister before stopping our projection.
    imageReader?.setOnImageAvailableListener(null, null)
    imageReader?.close()
    imageReader = null
    val activeProjection = projection
    val callback = projectionCallback
    projectionCallbackStopped = true
    if (activeProjection != null && !fromProjectionCallback) {
      try { callback?.let { activeProjection.unregisterCallback(it) } } catch (_: Throwable) { }
    }
    virtualDisplay?.release()
    virtualDisplay = null
    if (activeProjection != null && !fromProjectionCallback) {
      try { activeProjection.stop() } catch (_: Throwable) { }
    }
    projectionCallback = null
    projection = null

    removeOverlayOnMain()
    val activeAnalyzer = analyzer
    val activeExecutor = analysisExecutor
    analyzer = null
    analysisExecutor = null
    awaitAnalysisCleanup(activeAnalyzer, activeExecutor)
    frameThread?.quitSafely()
    frameThread = null
    frameHandler = null
    emitState(terminalState ?: NativeState.unknown("stopped", message = "Capture stopped"))
    stopForeground(STOP_FOREGROUND_REMOVE)
    synchronized(lock) { if (instance === this) instance = null }
    stopSelf()
  }

  private fun awaitAnalysisCleanup(activeAnalyzer: OcrAnalyzer?, activeExecutor: ExecutorService?) {
    if (activeAnalyzer == null && activeExecutor == null) return
    if (analysisBusy.get()) {
      mainHandler?.postDelayed({ awaitAnalysisCleanup(activeAnalyzer, activeExecutor) }, ANALYSIS_CLEANUP_POLL_MS)
      return
    }
    try { activeAnalyzer?.close() } catch (_: Throwable) { }
    activeExecutor?.shutdown()
  }

  override fun onDestroy() {
    if (!stopping) stopCapture(false)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun runOnMain(block: () -> Unit) {
    val handler = mainHandler
    if (handler == null || Looper.myLooper() == Looper.getMainLooper()) block() else handler.post(block)
  }

  private fun showOverlayOnMain(initialMessage: String = "Waiting for first frame") {
    runOnMain {
      if (!stopping) overlay?.show(initialMessage)
    }
  }

  private fun removeOverlayOnMain() {
    runOnMain { overlay?.remove() }
  }

  private fun updateOverlayOnMain(state: Map<String, Any?>) {
    runOnMain {
      if (!stopping) overlay?.update(state)
    }
  }

  private fun emitLiveState(state: Map<String, Any?>) {
    if (stopping) return
    emit(state)
    updateOverlayOnMain(state)
  }

  private fun restoreOverlayOnMain() {
    runOnMain {
      if (stopping || projection == null) return@runOnMain
      overlay?.show("Waiting for first frame")
      val state = synchronized(lock) { lastState.toMap() }
      overlay?.update(state)
    }
  }

  private fun openReviewFromOverlay() {
    runOnMain {
      overlay?.remove()
      try {
        startActivity(reviewIntent(applicationContext).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
      } catch (_: Throwable) { }
    }
  }

  private fun startForegroundCompat(pausedState: Boolean) {
    val stopIntent = PendingIntent.getService(
      this, 7302, Intent(this, CaptureService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0,
    )
    val toggleAction = if (pausedState) ACTION_RESUME else ACTION_PAUSE
    val toggleIntent = PendingIntent.getService(
      this, 7305, Intent(this, CaptureService::class.java).setAction(toggleAction),
      PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0,
    )
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_view)
      .setContentTitle(if (pausedState) "TableLens capture paused" else "TableLens capture active")
      .setContentText(if (pausedState) "Capture is paused; resume when ready" else "Advisory capture is running; tap Stop to close it")
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .addAction(android.R.drawable.ic_media_play, if (pausedState) "Resume" else "Pause", toggleIntent)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
      .build()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    } else startForeground(NOTIFICATION_ID, notification)
  }

  private fun ensureNotificationChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val channel = NotificationChannel(CHANNEL_ID, "TableLens capture", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shows while screen capture is active"
    }
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
  }

  private fun emit(state: Map<String, Any?>) = emitState(state)

  companion object {
    private const val CHANNEL_ID = "tablelens_capture"
    private const val NOTIFICATION_ID = 7303
    private const val FRAME_INTERVAL_MS = 250L
    private const val MAX_STATE_AGE_MS = 1500L
    private const val WATCHDOG_INTERVAL_MS = 500L
    private const val ANALYSIS_CLEANUP_POLL_MS = 25L
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_DATA = "projectionData"
    const val ACTION_STOP = "com.tablelens.capture.STOP"
    const val ACTION_PAUSE = "com.tablelens.capture.PAUSE"
    const val ACTION_RESUME = "com.tablelens.capture.RESUME"

    private val lock = Any()
    private var instance: CaptureService? = null
    private var eventSink: ((Map<String, Any?>) -> Unit)? = null
    private var lastState: Map<String, Any?> = NativeState.unknown("idle", message = "Capture is idle")
    private var lastFingerprint: String? = null
    private var liveAcceptedState: Map<String, Any?>? = null
    private var reviewLastState: Map<String, Any?>? = null
    private val importExecutor = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "tablelens-import") }

    fun installEventSink(sink: (Map<String, Any?>) -> Unit) { synchronized(lock) { eventSink = sink } }
    fun clearEventSink() { synchronized(lock) { eventSink = null } }
    fun isActive() = synchronized(lock) { instance?.projection != null }
    fun currentFingerprint() = synchronized(lock) { lastFingerprint }
    fun captureStatus(context: Context) = synchronized(lock) { lastState["captureStatus"]?.toString() ?: "idle" }

    fun status(context: Context): Map<String, Any?> = synchronized(lock) {
      val live = lastState.toMap()
      val standaloneImport = instance?.projection == null && live["captureStatus"] == "idle" && reviewLastState != null
      if (standaloneImport) reviewLastState!!.toMap() else live
    }

    fun reviewIntent(context: Context): Intent {
      val state = synchronized(lock) { lastState.toMap() }
      val player = (state["player"] as? List<*>)?.filterIsInstance<String>()?.joinToString(",").orEmpty()
      return Intent(context, ReviewActivity::class.java).apply {
        putExtra(ReviewActivity.EXTRA_PLAYER, player)
        putExtra(ReviewActivity.EXTRA_DEALER, state["dealer"]?.toString().orEmpty())
        putExtra(ReviewActivity.EXTRA_TOTAL, state["total"]?.toString().orEmpty())
        putExtra(ReviewActivity.EXTRA_WAGER, state["wager"]?.toString().orEmpty())
        putExtra(ReviewActivity.EXTRA_PHASE, state["phase"]?.toString().orEmpty())
        putExtra(ReviewActivity.EXTRA_FINGERPRINT, currentFingerprint())
      }
    }

    private fun emitState(state: Map<String, Any?>) {
      val sink: ((Map<String, Any?>) -> Unit)?
      synchronized(lock) { lastState = state; sink = eventSink }
      try { sink?.invoke(state) } catch (_: Throwable) { }
    }

    private fun emitReviewState(state: Map<String, Any?>) {
      val sink: ((Map<String, Any?>) -> Unit)?
      synchronized(lock) { reviewLastState = state; sink = eventSink }
      try { sink?.invoke(state) } catch (_: Throwable) { }
    }

    fun requestingPermission(context: Context) = emitState(NativeState.unknown("starting", message = "Waiting for screen-capture consent"))
    fun overlayRequired(context: Context): Map<String, Any?> {
      val state = NativeState.error("Overlay permission is required before capture")
      emitState(state)
      return state
    }
    fun permissionDenied(context: Context) = emitState(NativeState.error("Screen-capture consent was not granted"))

    fun start(context: Context, resultCode: Int, data: Intent) {
      val intent = Intent(context, CaptureService::class.java).apply {
        putExtra(EXTRA_RESULT_CODE, resultCode)
        putExtra(EXTRA_DATA, data)
      }
      try {
        if (Build.VERSION.SDK_INT >= 26) ContextCompat.startForegroundService(context, intent) else context.startService(intent)
      } catch (error: Throwable) {
        emitState(NativeState.error("Could not start foreground capture: ${error.message ?: "unknown error"}"))
      }
    }

    fun pause(context: Context) { synchronized(lock) { instance }?.pauseCapture() }
    fun resume(context: Context) { synchronized(lock) { instance }?.resumeCapture() }
    fun stop(context: Context) {
      val service = synchronized(lock) { instance }
      if (service != null) service.stopCapture(false) else emitState(NativeState.unknown("stopped", message = "Capture stopped"))
    }

    fun hideOverlay(context: Context) { synchronized(lock) { instance }?.removeOverlayOnMain() }
    fun showOverlay(context: Context) { synchronized(lock) { instance }?.restoreOverlayOnMain() }

    fun analyzeImage(context: Context, uri: Uri): Map<String, Any?> {
      val liveStatus = captureStatus(context)
      emitReviewState(NativeState.unknown(liveStatus, "import", "Analyzing imported image"))
      importExecutor.execute {
        val bitmap = try { context.contentResolver.openInputStream(uri)?.use(BitmapFactory::decodeStream) } catch (_: Throwable) { null }
        if (bitmap == null) {
          emitReviewState(NativeState.unknown(liveStatus, "import", "Could not read image URI"))
          return@execute
        }
        val importAnalyzer = OcrAnalyzer(importExecutor)
        try {
          importAnalyzer.analyze(bitmap, System.nanoTime(), System.currentTimeMillis()) { _, capturedAt, observation, error ->
            try {
              val latency = (System.currentTimeMillis() - capturedAt).coerceAtLeast(0L)
              if (observation == null) {
                emitReviewState(NativeState.unknown(liveStatus, "import", error ?: "Imported image was not recognized", capturedAt, latency))
              } else {
                val candidate = ObservationInterpreter.interpret(observation, "import", liveStatus, latency, capturedAt)
                if (candidate == null) emitReviewState(NativeState.unknown(liveStatus, "import", "Incomplete or uncertain imported image", capturedAt, latency))
                else emitReviewState(candidate.state)
              }
            } finally { importAnalyzer.close() }
          }
        } catch (error: Throwable) {
          try { bitmap.recycle() } catch (_: Throwable) { }
          try { importAnalyzer.close() } catch (_: Throwable) { }
          emitReviewState(NativeState.unknown(liveStatus, "import", "Could not analyze imported image: ${error.message ?: "OCR failed"}"))
        }
      }
      return status(context)
    }

    fun applyCorrection(
      context: Context,
      playerRaw: String,
      dealerRaw: String,
      totalRaw: String,
      wagerRaw: String,
      phaseRaw: String,
      expectedFingerprint: String?,
    ) {
      val now = System.currentTimeMillis()
      val snapshot = synchronized(lock) {
        Triple(lastFingerprint, liveAcceptedState, lastState["captureStatus"]?.toString() ?: "idle")
      }
      val bound = snapshot.first
      val acceptedLive = snapshot.second
      val capturedAt = (acceptedLive?.get("capturedAt") as? Number)?.toLong()
      val age = if (capturedAt == null) Long.MAX_VALUE else now - capturedAt
      val validBinding = !expectedFingerprint.isNullOrBlank() && expectedFingerprint == bound &&
        acceptedLive?.get("accepted") == true && acceptedLive?.get("source") == "capture" &&
        snapshot.third == "active" && age in 0L..MAX_STATE_AGE_MS
      if (!validBinding) {
        rejectCorrection(context, "Manual review expired; a fresh accepted visual state is required")
        return
      }

      val phase = phaseRaw.trim().lowercase()
      val playerTokens = if (playerRaw.isBlank()) emptyList() else playerRaw.split(Regex("[,\\s]+"))
      val player = RankParser.fromTokens(playerTokens)
      if (player.size != playerTokens.size) {
        rejectCorrection(context, "Manual review has an unsupported rank")
        return
      }
      val dealer = RankParser.normalize(dealerRaw.trim())
      val wager = NativeState.parseNumber(wagerRaw)
      val balance = acceptedLive?.get("balance") as? Number
      val state: Map<String, Any?>? = when (phase) {
        "betting" -> if (player.isEmpty() && dealer == null && wager != null && wager >= 0.0) mapOf(
          "phase" to "betting", "player" to emptyList<String>(), "dealer" to null, "total" to null,
          "balance" to balance?.toDouble(), "wager" to wager, "actions" to listOf("Play"),
          "capturedAt" to now, "source" to "manual", "accepted" to true,
          "message" to "Manual review applied", "recommendation" to null,
          "captureStatus" to "active", "latencyMs" to null,
        ) else null
        "decision" -> {
          val total = NativeState.integerTotal(totalRaw)
          val calculated = HandTotals.calculate(player)
          if (player.size in 2..5 && dealer != null && wager != null && wager > 0.0 && total != null && calculated?.value == total) {
            mapOf(
              "phase" to "decision", "player" to player, "dealer" to dealer, "total" to total,
              "balance" to balance?.toDouble(), "wager" to wager, "actions" to listOf("Hit", "Stand"),
              "capturedAt" to now, "source" to "manual", "accepted" to true,
              "message" to (if (ConservativeStrategy.recommendation(player, dealer) == null) ConservativeStrategy.MANUAL else "Manual review applied"),
              "recommendation" to ConservativeStrategy.recommendation(player, dealer),
              "captureStatus" to "active", "latencyMs" to null,
            )
          } else null
        }
        else -> null
      }
      if (state == null) rejectCorrection(context, "Manual review is incomplete or inconsistent")
      else {
        // Keep the visual fingerprint/live accepted state. A later matching OCR frame replaces this display;
        // a different frame, pause/resume, or the watchdog expires it without carrying it to a new hand.
        emitState(state)
        synchronized(lock) { instance }?.updateOverlayOnMain(state)
      }
    }

    private fun rejectCorrection(context: Context, message: String) {
      val service = synchronized(lock) { instance }
      service?.clearStability()
      val state = NativeState.unknown(captureStatus(context), "manual", message)
      emitState(state)
      service?.updateOverlayOnMain(state)
    }
  }
}
