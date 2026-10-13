package expo.modules.tablelenscapture

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class OverlayController(
  private val context: Context,
  private val onPause: () -> Unit,
  private val onResume: () -> Unit,
  private val onReview: () -> Unit,
  private val onStop: () -> Unit,
) {
  private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private var root: LinearLayout? = null
  private var messageView: TextView? = null
  private var recommendationView: TextView? = null
  private var pauseButton: Button? = null
  private var layoutParams: WindowManager.LayoutParams? = null
  private var currentStatus = "active"

  fun show(initialMessage: String = "Starting…") {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { show(initialMessage) }
      return
    }
    if (!Settings.canDrawOverlays(context) || root != null) return
    val panel = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(10), dp(7), dp(10), dp(7))
      setBackgroundColor(Color.argb(238, 7, 26, 36))
      elevation = dp(5).toFloat()
    }
    val title = TextView(context).apply {
      text = "TableLens"
      setTextColor(Color.rgb(53, 208, 186))
      textSize = 13f
    }
    messageView = TextView(context).apply {
      text = initialMessage
      setTextColor(Color.LTGRAY)
      textSize = 11f
    }
    recommendationView = TextView(context).apply {
      setTextColor(Color.rgb(53, 208, 186))
      textSize = 12f
      visibility = View.GONE
    }
    val actions = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    pauseButton = Button(context).apply {
      text = "Pause"
      textSize = 10f
      setTextColor(Color.rgb(53, 208, 186))
      setOnClickListener { if (currentStatus == "paused") onResume() else onPause() }
    }
    val review = Button(context).apply {
      text = "Review"
      textSize = 10f
      setTextColor(Color.rgb(53, 208, 186))
      setOnClickListener { onReview() }
    }
    val stop = Button(context).apply {
      text = "Stop"
      textSize = 10f
      setTextColor(Color.rgb(53, 208, 186))
      setOnClickListener { onStop() }
    }
    actions.addView(pauseButton!!, LinearLayout.LayoutParams(0, dp(36), 1f))
    actions.addView(review, LinearLayout.LayoutParams(0, dp(36), 1f))
    actions.addView(stop, LinearLayout.LayoutParams(0, dp(36), 1f))
    panel.addView(title)
    panel.addView(messageView)
    panel.addView(recommendationView)
    panel.addView(actions)
    var downRawX = 0f
    var downRawY = 0f
    var downX = 0
    var downY = 0
    panel.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downRawX = event.rawX
          downRawY = event.rawY
          downX = paramsX()
          downY = paramsY()
          true
        }
        MotionEvent.ACTION_MOVE -> {
          layoutParams?.let { params ->
            params.x = downX + (event.rawX - downRawX).toInt()
            params.y = downY + (event.rawY - downRawY).toInt()
            try { windowManager.updateViewLayout(panel, params) } catch (_: RuntimeException) { }
          }
          true
        }
        else -> false
      }
    }
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else WindowManager.LayoutParams.TYPE_PHONE
    val params = WindowManager.LayoutParams(
      dp(260), WindowManager.LayoutParams.WRAP_CONTENT, type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(8)
      y = dp(48)
    }
    try {
      windowManager.addView(panel, params)
      root = panel
      layoutParams = params
    } catch (_: RuntimeException) {
      root = null
    }
  }

  fun update(state: Map<String, Any?>) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { update(state) }
      return
    }
    val panel = root ?: return
    val status = state["captureStatus"]?.toString() ?: "unknown"
    val message = state["message"]?.toString() ?: ""
    val recommendation = state["recommendation"]?.toString()
    currentStatus = status
    pauseButton?.text = if (status == "paused") "Resume" else "Pause"
    val source = state["source"]?.toString()
    messageView?.text = when {
      status == "paused" -> "Paused"
      source == "manual" -> "Manual review: $message"
      else -> message
    }
    recommendationView?.text = recommendation.orEmpty()
    recommendationView?.setTextColor(Color.rgb(53, 208, 186))
    recommendationView?.visibility = if (recommendation.isNullOrBlank()) View.GONE else View.VISIBLE
    panel.postInvalidate()
  }

  fun remove() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      mainHandler.post { remove() }
      return
    }
    root?.let { view ->
      try { windowManager.removeView(view) } catch (_: RuntimeException) { }
    }
    root = null
    layoutParams = null
    messageView = null
    recommendationView = null
    pauseButton = null
  }

  private fun dp(value: Int) = (value * context.resources.displayMetrics.density).toInt()
  private fun paramsX() = layoutParams?.x ?: dp(8)
  private fun paramsY() = layoutParams?.y ?: dp(48)
}
