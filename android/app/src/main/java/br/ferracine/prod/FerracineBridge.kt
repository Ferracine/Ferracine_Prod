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

/** content:// do FileProvider (autoridade do AndroidManifest, pastas em res/xml/file_paths.xml) para outro app ler. */
fun Activity.shareableUri(file: File): Uri = FileProvider.getUriForFile(this, "$packageName.files", file)

/**
 * Ponte com o JavaScript (src/platform.ts). Na WebView não dá para baixar um blob nem chamar o compartilhamento
 * web, então o app manda o arquivo (PDF ou planilha) em base64 e o Android salva, abre ou compartilha.
 * Cada método devolve "" em caso de sucesso ou a mensagem de erro para o app mostrar.
 */
class FerracineBridge(private val activity: Activity, private val updater: Updater) {

    /**
     * Salva o arquivo (PDF ou planilha, conforme `mime`) na pasta Downloads do celular. Android 10+ usa o MediaStore
     * (sem permissão); Android 7 a 9 precisa da permissão de armazenamento, pedida no primeiro "Baixar".
     */
    @JavascriptInterface
    fun saveFile(base64: String, fileName: String, mime: String): String {
        var salvo = ""
        val erro = attempt("salvar") { salvo = writeToDownloads(base64, fileName, extOf(mime)) }
        // Sucesso: "salvo:<nome>" (o Android pode ter acrescentado " (1)" ao nome); erro: a mensagem.
        return if (erro.isEmpty()) "$SAVED$salvo" else erro
    }

    /** Grava em Downloads e devolve o nome com que o arquivo ficou lá. */
    private fun writeToDownloads(base64: String, fileName: String, ext: String): String {
        val mime = TIPOS.getValue(ext)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED
        ) {
            activity.runOnUiThread {
                ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 1)
            }
            error("permita o acesso ao armazenamento e toque em \"Baixar\" de novo (ou use \"Compartilhar\")")
        }
        val bytes = decode(base64)
        val name = safeName(fileName, ext)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = activity.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("sem acesso a Downloads")
            resolver.openOutputStream(uri)?.use { it.write(bytes) } ?: error("sem acesso a Downloads")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            // Com um arquivo de mesmo nome, o MediaStore salva como "nome (1).pdf": lê o nome que ficou.
            return resolver.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            } ?: name
        }
        @Suppress("DEPRECATION")
        val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).apply { mkdirs() }
        return uniqueFile(dir, name).apply { writeBytes(bytes) }.name
    }

    @JavascriptInterface
    fun openFile(base64: String, fileName: String, mime: String): String = attempt("abrir") {
        val ext = extOf(mime)
        val uri = cachedFile(base64, safeName(fileName, ext))
        val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, TIPOS.getValue(ext)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            start(intent)
        } catch (e: ActivityNotFoundException) {
            error("nenhum app para abrir este arquivo. Use \"Compartilhar\" ou abra pelo app de arquivos (pasta Downloads)")
        }
    }

    @JavascriptInterface
    fun shareFile(base64: String, fileName: String, mime: String): String = attempt("compartilhar") {
        val ext = extOf(mime)
        val name = safeName(fileName, ext)
        val send = Intent(Intent.ACTION_SEND).setType(TIPOS.getValue(ext)).putExtra(Intent.EXTRA_STREAM, cachedFile(base64, name)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
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

    /** Baixa e instala a versão nova do APK (src/update.ts); o andamento volta pelo evento "ferracine-update". */
    @JavascriptInterface
    fun installUpdate(url: String, size: Double): String = updater.start(url, size.toLong())

    /** Grava em cache/pdf e devolve um content:// do FileProvider (res/xml/file_paths.xml). */
    private fun cachedFile(base64: String, name: String): Uri {
        val dir = File(activity.cacheDir, "pdf").apply { mkdirs() }
        val file = File(dir, name).apply { writeBytes(decode(base64)) }
        return activity.shareableUri(file)
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
            "Não foi possível $acao o arquivo: ${e.message ?: e.javaClass.simpleName}"
        }

    private companion object {
        /** Prefixo da resposta de sucesso de saveFile (src/platform.ts). */
        const val SAVED = "salvo:"

        fun decode(base64: String): ByteArray = Base64.decode(base64, Base64.DEFAULT)

        /** "nome.pdf" livre na pasta; se já existe, "nome (1).pdf", "nome (2).pdf"... (nunca sobrescreve outro dia). */
        fun uniqueFile(dir: File, name: String): File {
            val ext = name.substringAfterLast('.', "")
            val base = if (ext.isEmpty()) name else name.removeSuffix(".$ext")
            val sufixo = if (ext.isEmpty()) "" else ".$ext"
            return generateSequence(0) { it + 1 }
                .map { n -> File(dir, if (n == 0) name else "$base ($n)$sufixo") }
                .first { !it.exists() }
        }

        /** Só os tipos que o app gera: extensão → tipo do arquivo. */
        val TIPOS = mapOf("pdf" to "application/pdf", "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        /** Extensão do tipo pedido pelo app; outro tipo é recusado (a ponte não salva nem abre qualquer arquivo). */
        fun extOf(mime: String): String = TIPOS.entries.firstOrNull { it.value == mime }?.key ?: error("tipo de arquivo não suportado")

        /** Só letras, números, "_", "-" e "." (o nome vem do app, mas nunca vira caminho), terminando em `.ext`. */
        fun safeName(fileName: String, ext: String): String {
            val base = fileName.substringAfterLast('/').replace(Regex("[^A-Za-z0-9_.-]"), "_").trim('.').ifBlank { "folha" }
            return if (base.endsWith(".$ext", ignoreCase = true)) base else "$base.$ext"
        }
    }
}
