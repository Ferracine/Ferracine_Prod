package br.ferracine.prod

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import java.io.File

/**
 * Ponte com o JavaScript (src/platform.ts). Na WebView não dá para baixar um blob nem chamar o compartilhamento
 * web, então o app manda o PDF em base64 e o Android salva, abre ou compartilha.
 * Cada método devolve "" em caso de sucesso ou a mensagem de erro para o app mostrar.
 */
class FerracineBridge(private val activity: Activity) {

    /**
     * Salva na pasta Downloads do celular. Android 10+ usa o MediaStore (sem permissão); Android 7 a 9 precisa da
     * permissão de armazenamento, pedida no primeiro "Baixar PDF".
     */
    @JavascriptInterface
    fun savePdf(base64: String, fileName: String): String = attempt("salvar") {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.runOnUiThread {
                ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
            }
            error("permita o acesso ao armazenamento e toque em \"Baixar PDF\" de novo (ou use \"Compartilhar\")")
        }
        val bytes = decode(base64)
        val name = safeName(fileName)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = activity.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, PDF)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("sem acesso a Downloads")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("sem acesso a Downloads")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } else {
            @Suppress("DEPRECATION")
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).apply { mkdirs() }
            File(dir, name).writeBytes(bytes)
        }
    }

    @JavascriptInterface
    fun openPdf(base64: String, fileName: String): String = attempt("abrir") {
        val uri = cachedPdf(base64, fileName)
        val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, PDF).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            start(intent)
        } catch (e: ActivityNotFoundException) {
            error("nenhum leitor de PDF instalado. Use \"Compartilhar\" ou abra pelo app de arquivos (pasta Downloads)")
        }
    }

    @JavascriptInterface
    fun sharePdf(base64: String, fileName: String): String = attempt("compartilhar") {
        val name = safeName(fileName)
        val send = Intent(Intent.ACTION_SEND).setType(PDF).putExtra(Intent.EXTRA_STREAM, cachedPdf(base64, name)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        start(Intent.createChooser(send, name))
    }

    /** Barras de status e de navegação com a cor e o modo do tema escolhido no app (dono do tema: src/theme.ts). */
    @JavascriptInterface
    fun setSystemBars(color: String, dark: Boolean) {
        val c = runCatching { Color.parseColor(color) }.getOrNull() ?: return
        activity.runOnUiThread {
            val window = activity.window
            window.decorView.setBackgroundColor(c) // Android 15: as barras ficam por cima do fundo da janela
            @Suppress("DEPRECATION")
            window.statusBarColor = c
            @Suppress("DEPRECATION")
            window.navigationBarColor = c
            WindowCompat.getInsetsController(window, window.decorView).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }

    /** Grava em cache/pdf e devolve um content:// do FileProvider (res/xml/file_paths.xml). */
    private fun cachedPdf(base64: String, fileName: String): Uri {
        val dir = File(activity.cacheDir, "pdf").apply { mkdirs() }
        val file = File(dir, safeName(fileName)).apply { writeBytes(decode(base64)) }
        return FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
    }

    private fun start(intent: Intent) {
        // Métodos @JavascriptInterface rodam fora da thread principal; a verificação de app disponível é feita aqui.
        if (intent.resolveActivity(activity.packageManager) == null && intent.action != Intent.ACTION_CHOOSER) {
            throw ActivityNotFoundException()
        }
        activity.runOnUiThread { activity.startActivity(intent) }
    }

    private inline fun attempt(acao: String, block: () -> Unit): String =
        try {
            block()
            ""
        } catch (e: Exception) {
            "Não foi possível $acao o PDF: ${e.message ?: e.javaClass.simpleName}"
        }

    private companion object {
        const val PDF = "application/pdf"

        fun decode(base64: String): ByteArray = Base64.decode(base64, Base64.DEFAULT)

        /** Só letras, números, "_", "-" e ".", terminando em .pdf (o nome vem do app, mas nunca vira caminho). */
        fun safeName(fileName: String): String {
            val base = fileName.substringAfterLast('/').replace(Regex("[^A-Za-z0-9_.-]"), "_").ifBlank { "folha" }
            return if (base.endsWith(".pdf", ignoreCase = true)) base else "$base.pdf"
        }
    }
}
