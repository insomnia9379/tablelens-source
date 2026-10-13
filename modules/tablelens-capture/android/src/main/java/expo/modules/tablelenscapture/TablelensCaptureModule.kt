package expo.modules.tablelenscapture

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TablelensCaptureModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React context is unavailable")

  override fun definition() = ModuleDefinition {
    Name("TablelensCapture")
    Events("onStateChange")

    OnCreate { CaptureService.installEventSink { state -> sendEvent("onStateChange", state) } }
    OnDestroy { CaptureService.clearEventSink() }

    AsyncFunction("getStatus") { CaptureService.status(context) }

    AsyncFunction("requestOverlayPermission") {
      val granted = Settings.canDrawOverlays(context)
      if (!granted) {
        context.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
      }
      mapOf("granted" to granted, "captureStatus" to CaptureService.captureStatus(context))
    }

    AsyncFunction("startCapture") {
      val granted = Settings.canDrawOverlays(context)
      if (!granted) return@AsyncFunction CaptureService.overlayRequired(context)
      if (CaptureService.isActive()) return@AsyncFunction CaptureService.status(context)
      CaptureService.requestingPermission(context)
      val activity = appContext.currentActivity
      if (activity != null) CapturePermissionActivity.open(activity) else CapturePermissionActivity.open(context)
      CaptureService.status(context)
    }

    AsyncFunction("pause") { CaptureService.pause(context); CaptureService.status(context) }
    AsyncFunction("resume") { CaptureService.resume(context); CaptureService.status(context) }
    AsyncFunction("stop") { CaptureService.stop(context); CaptureService.status(context) }

    AsyncFunction("openReview") {
      CaptureService.hideOverlay(context)
      context.startActivity(CaptureService.reviewIntent(context).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
      mapOf("opened" to true, "message" to "Manual review (not automatic OCR)")
    }

    AsyncFunction("pickAndAnalyze") {
      ImportImageActivity.open(context)
      mapOf("opened" to true, "message" to "Choose an image for native review")
    }

    AsyncFunction("analyzeImage") { uri: String -> CaptureService.analyzeImage(context, Uri.parse(uri)) }

    AsyncFunction("applyCorrection") { player: String, dealer: String, total: String, wager: String, phase: String ->
      CaptureService.applyCorrection(context, player, dealer, total, wager, phase, CaptureService.currentFingerprint())
      CaptureService.status(context)
    }
  }
}
