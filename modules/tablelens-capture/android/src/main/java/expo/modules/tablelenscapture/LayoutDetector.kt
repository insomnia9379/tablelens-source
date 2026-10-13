package expo.modules.tablelenscapture

import android.graphics.Bitmap
import android.graphics.Color
import kotlin.math.max
import kotlin.math.min

/**
 * Layout registration is bounded and content-based. It does not encode card results from a reference image.
 * Coordinates are normalized so a resized/rotated virtual display uses the same guarded regions.
 */
object LayoutDetector {
  data class Registration(
    val known: Boolean,
    val hiddenDealerCardLikely: Boolean,
  )

  fun register(bitmap: Bitmap): Registration {
    val width = bitmap.width
    val height = bitmap.height
    if (width < 480 || height < 240) return Registration(false, false)
    val aspect = width.toFloat() / height.toFloat()
    if (aspect !in 1.45f..3.25f) return Registration(false, false)

    val left = (width * .18f).toInt()
    val right = (width * .84f).toInt()
    val top = (height * .14f).toInt()
    val bottom = (height * .90f).toInt()
    var green = 0
    var sampled = 0
    val stepX = max(1, (right - left) / 36)
    val stepY = max(1, (bottom - top) / 24)
    for (y in top until bottom step stepY) {
      for (x in left until right step stepX) {
        val c = bitmap.getPixel(x.coerceIn(0, width - 1), y.coerceIn(0, height - 1))
        val hsv = FloatArray(3)
        Color.colorToHSV(c, hsv)
        if (hsv[1] > .16f && hsv[0] in 70f..175f && hsv[2] > .12f) green++
        sampled++
      }
    }
    val greenRatio = if (sampled == 0) 0f else green.toFloat() / sampled
    if (greenRatio < .14f) return Registration(false, false)

    // A dealer hole-card guard: a dark card-shaped region next to the readable dealer rank.
    val hx0 = (width * .50f).toInt()
    val hx1 = (width * .65f).toInt()
    val hy0 = (height * .15f).toInt()
    val hy1 = (height * .40f).toInt()
    var dark = 0
    var holeSamples = 0
    val hsx = max(1, (hx1 - hx0) / 18)
    val hsy = max(1, (hy1 - hy0) / 12)
    for (y in hy0 until hy1 step hsy) {
      for (x in hx0 until hx1 step hsx) {
        val c = bitmap.getPixel(x.coerceIn(0, width - 1), y.coerceIn(0, height - 1))
        val hsv = FloatArray(3)
        Color.colorToHSV(c, hsv)
        if (hsv[2] < .20f && hsv[1] < .65f) dark++
        holeSamples++
      }
    }
    return Registration(true, holeSamples > 0 && dark.toFloat() / holeSamples > .12f)
  }
}
