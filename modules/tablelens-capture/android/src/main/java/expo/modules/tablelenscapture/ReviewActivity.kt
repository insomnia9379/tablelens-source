package expo.modules.tablelenscapture

import android.app.Activity
import android.os.Bundle
import android.graphics.Color
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class ReviewActivity : Activity() {
  private lateinit var player: EditText
  private lateinit var dealer: EditText
  private lateinit var total: EditText
  private lateinit var wager: EditText
  private lateinit var phase: EditText

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    CaptureService.hideOverlay(this)
    title = "Manual review"
    val pad = (16 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad, pad, pad)
      setBackgroundColor(Color.WHITE)
    }
    val note = TextView(this).apply {
      text = "Manual review (not automatic OCR). Verify every field before applying."
      setTextColor(Color.DKGRAY)
    }
    player = field("Player ranks, comma separated", intent.getStringExtra(EXTRA_PLAYER).orEmpty())
    dealer = field("Dealer rank", intent.getStringExtra(EXTRA_DEALER).orEmpty())
    total = field("Player total", intent.getStringExtra(EXTRA_TOTAL).orEmpty())
    wager = field("Wager", intent.getStringExtra(EXTRA_WAGER).orEmpty())
    phase = field("Phase (betting or decision)", intent.getStringExtra(EXTRA_PHASE).orEmpty())
    val apply = Button(this).apply {
      text = "Apply correction"
      setOnClickListener {
        CaptureService.applyCorrection(
          this@ReviewActivity,
          player.text.toString(), dealer.text.toString(), total.text.toString(), wager.text.toString(), phase.text.toString(),
          intent.getStringExtra(EXTRA_FINGERPRINT),
        )
        finish()
      }
    }
    root.addView(note)
    listOf(player, dealer, total, wager, phase).forEach { root.addView(it) }
    root.addView(apply)
    setContentView(root)
  }

  override fun onDestroy() {
    CaptureService.showOverlay(this)
    super.onDestroy()
  }

  private fun field(hint: String, value: String) = EditText(this).apply {
    this.hint = hint
    setText(value)
    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
  }

  companion object {
    const val EXTRA_PLAYER = "player"
    const val EXTRA_DEALER = "dealer"
    const val EXTRA_TOTAL = "total"
    const val EXTRA_WAGER = "wager"
    const val EXTRA_PHASE = "phase"
    const val EXTRA_FINGERPRINT = "fingerprint"
  }
}
