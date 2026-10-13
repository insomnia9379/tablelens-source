package expo.modules.tablelenscapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle

class CapturePermissionActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    CaptureService.hideOverlay(this)
    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CAPTURE)
  }

  @Deprecated("Activity result API retained for Expo 57 compatibility")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_CAPTURE) return
    if (resultCode == RESULT_OK && data != null) {
      CaptureService.start(this, resultCode, data)
    } else {
      CaptureService.permissionDenied(this)
    }
    finish()
  }

  override fun onDestroy() {
    CaptureService.showOverlay(this)
    super.onDestroy()
  }

  companion object {
    private const val REQUEST_CAPTURE = 7301
    fun open(context: Context) {
      context.startActivity(Intent(context, CapturePermissionActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })
    }
  }
}
