package expo.modules.tablelenscapture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class ImportImageActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    CaptureService.hideOverlay(this)
    val pick = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "image/*"
    }
    startActivityForResult(pick, REQUEST_PICK)
  }

  @Deprecated("Activity result API retained for Expo 57 compatibility")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_PICK) return
    if (resultCode == RESULT_OK) {
      data?.data?.let { uri ->
        try { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (_: SecurityException) { }
        CaptureService.analyzeImage(applicationContext, uri)
      }
    }
    CaptureService.showOverlay(this)
    finish()
  }

  companion object {
    private const val REQUEST_PICK = 7304
    fun open(context: Context) {
      context.startActivity(Intent(context, ImportImageActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })
    }
  }
}
