package expo.modules.tablelenscapture

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.Collections
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.roundToInt

class OcrAnalyzer(private val callbackExecutor: Executor) {
  private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

  private data class CropSpec(val left: Float, val top: Float, val right: Float, val bottom: Float, val scale: Float) {
    val width get() = right - left
    val height get() = bottom - top
  }
  private data class PreparedCrop(val spec: CropSpec, val bitmap: Bitmap)

  fun analyze(
    source: Bitmap,
    version: Long,
    frameCapturedAt: Long,
    callback: (Long, Long, OcrObservation?, String?) -> Unit,
  ) {
    val registration = try {
      LayoutDetector.register(source)
    } catch (error: Throwable) {
      try { source.recycle() } catch (_: Throwable) { }
      callbackExecutor.execute { callback(version, frameCapturedAt, null, "Could not inspect capture layout") }
      return
    }
    if (!registration.known) {
      callbackExecutor.execute {
        try { callback(version, frameCapturedAt, null, "Unfamiliar aspect or green-table layout") }
        finally { source.recycle() }
      }
      return
    }

    // The table crop catches small rule text; focused crops upscale the tiny rank glyphs.
    val specs = listOf(
      CropSpec(.18f, .14f, .84f, .90f, 1.25f), // table/rules
      CropSpec(.34f, .43f, .70f, .82f, 3.0f),  // player ranks/total/wager
      CropSpec(.34f, .10f, .70f, .43f, 3.0f),  // dealer rank/hole card
      CropSpec(.12f, .00f, .48f, .18f, 3.0f),  // balance
      CropSpec(.05f, .62f, .97f, .99f, 2.0f),  // controls and rule footer
    )
    val prepared = mutableListOf<PreparedCrop>()
    try {
      specs.forEach { spec -> prepared += PreparedCrop(spec, cropAndScale(source, spec)) }
    } catch (error: Throwable) {
      prepared.forEach { it.bitmap.recycle() }
      source.recycle()
      callbackExecutor.execute { callback(version, frameCapturedAt, null, "Could not prepare OCR regions: ${error.message ?: "crop failed"}") }
      return
    }
    source.recycle()

    val allRegions = Collections.synchronizedList(mutableListOf<RegionText>())
    val remaining = AtomicInteger(prepared.size)
    val errorCount = AtomicInteger(0)
    prepared.forEach { crop ->
      try {
        recognizer.process(InputImage.fromBitmap(crop.bitmap, 0))
          .addOnSuccessListener(callbackExecutor) { text ->
            val cropWidth = crop.bitmap.width.toFloat()
            val cropHeight = crop.bitmap.height.toFloat()
            try { allRegions.addAll(flatten(text, crop.spec, cropWidth, cropHeight)) }
            catch (_: Throwable) { errorCount.incrementAndGet() }
            finally {
              crop.bitmap.recycle()
              finishCrop(remaining, allRegions, errorCount, registration, version, frameCapturedAt, callback)
            }
          }
          .addOnFailureListener(callbackExecutor) {
            errorCount.incrementAndGet()
            crop.bitmap.recycle()
            finishCrop(remaining, allRegions, errorCount, registration, version, frameCapturedAt, callback)
          }
      } catch (_: Throwable) {
        errorCount.incrementAndGet()
        crop.bitmap.recycle()
        finishCrop(remaining, allRegions, errorCount, registration, version, frameCapturedAt, callback)
      }
    }
  }

  fun close() { recognizer.close() }

  private fun finishCrop(
    remaining: AtomicInteger,
    allRegions: MutableList<RegionText>,
    errorCount: AtomicInteger,
    registration: LayoutDetector.Registration,
    version: Long,
    frameCapturedAt: Long,
    callback: (Long, Long, OcrObservation?, String?) -> Unit,
  ) {
    if (remaining.decrementAndGet() != 0) return
    val deduped = synchronized(allRegions) { dedupe(allRegions.toList()) }
    if (deduped.isEmpty()) {
      callback(version, frameCapturedAt, null, "OCR returned no text")
      return
    }
    val observation = ObservationParser.parse(deduped, true, registration.hiddenDealerCardLikely)
    val error = if (errorCount.get() == 0) null else "Some OCR regions were unavailable"
    callback(version, frameCapturedAt, observation, error)
  }

  private fun cropAndScale(source: Bitmap, spec: CropSpec): Bitmap {
    val left = (source.width * spec.left).toInt().coerceIn(0, source.width - 1)
    val top = (source.height * spec.top).toInt().coerceIn(0, source.height - 1)
    val right = (source.width * spec.right).toInt().coerceIn(left + 1, source.width)
    val bottom = (source.height * spec.bottom).toInt().coerceIn(top + 1, source.height)
    val crop = Bitmap.createBitmap(source, left, top, right - left, bottom - top)
    val scaled = Bitmap.createScaledBitmap(crop, ((right - left) * spec.scale).roundToInt(), ((bottom - top) * spec.scale).roundToInt(), true)
    if (scaled !== crop) crop.recycle()
    return scaled
  }

  private fun flatten(text: Text, spec: CropSpec, cropWidth: Float, cropHeight: Float): List<RegionText> {
    val out = mutableListOf<RegionText>()
    text.textBlocks.forEach { block ->
      block.lines.forEach { line ->
        if (line.elements.isEmpty()) {
          line.boundingBox?.let { out += mapRegion(line.text, it.left, it.top, it.right, it.bottom, spec, cropWidth, cropHeight) }
        } else {
          line.elements.forEach { element ->
            element.boundingBox?.let { out += mapRegion(element.text, it.left, it.top, it.right, it.bottom, spec, cropWidth, cropHeight) }
          }
        }
      }
    }
    return out
  }

  private fun mapRegion(text: String, left: Int, top: Int, right: Int, bottom: Int, spec: CropSpec, cropWidth: Float, cropHeight: Float): RegionText {
    return RegionText(
      text = text,
      left = (spec.left + (left / cropWidth.coerceAtLeast(1f)) * spec.width).coerceIn(0f, 1f),
      top = (spec.top + (top / cropHeight.coerceAtLeast(1f)) * spec.height).coerceIn(0f, 1f),
      right = (spec.left + (right / cropWidth.coerceAtLeast(1f)) * spec.width).coerceIn(0f, 1f),
      bottom = (spec.top + (bottom / cropHeight.coerceAtLeast(1f)) * spec.height).coerceIn(0f, 1f),
    )
  }

  private fun overlapRatio(a: RegionText, b: RegionText): Float {
    val width = (minOf(a.right, b.right) - maxOf(a.left, b.left)).coerceAtLeast(0f)
    val height = (minOf(a.bottom, b.bottom) - maxOf(a.top, b.top)).coerceAtLeast(0f)
    val intersection = width * height
    val areaA = ((a.right - a.left) * (a.bottom - a.top)).coerceAtLeast(.0001f)
    val areaB = ((b.right - b.left) * (b.bottom - b.top)).coerceAtLeast(.0001f)
    return intersection / minOf(areaA, areaB)
  }

  private fun dedupe(regions: List<RegionText>): List<RegionText> {
    val result = mutableListOf<RegionText>()
    regions.forEach { region ->
      val text = region.text.trim().uppercase()
      if (result.none { existing ->
          existing.text.trim().uppercase() == text && overlapRatio(existing, region) >= .35f
        }) result += region
    }
    return result
  }
}
