package br.ferracine.prod

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Baixa o APK de uma Release do GitHub e abre o instalador do Android (quem procura a versão nova é o
 * src/update.ts). O Android só instala por cima um APK do mesmo pacote assinado com a mesma chave, e os dados do
 * app continuam. O andamento vai para a página por [emit]: "permission", "installing" ou "error".
 */
class Updater(private val activity: Activity, private val emit: (status: String, message: String) -> Unit) {

    /** Começa o download em segundo plano; devolve "" ou o motivo da recusa. `size` = bytes da Release (0 = ?). */
    fun start(url: String, size: Long): String {
        if (!url.startsWith(DOWNLOAD_PREFIX) || !url.endsWith(".apk")) return "Endereço de atualização inválido."
        if (busy) return ""
        busy = true
        thread(name = "ferracine-update") {
            try {
                val apk = download(url, size)
                try {
                    verify(apk)
                } catch (e: Exception) {
                    apk.delete() // arquivo ruim não é reaproveitado no próximo toque
                    throw e
                }
                pending = apk
                activity.runOnUiThread { install() }
            } catch (e: Exception) {
                emit("error", "Não foi possível baixar a atualização: ${motivo(e)}.")
            } finally {
                busy = false
            }
        }
        return ""
    }

    /** Volta das configurações (MainActivity.onResume): com a permissão dada, segue para o instalador. */
    fun resume() {
        if (pending != null && canInstall()) install()
    }

    /**
     * Arquivo com o nome da versão (FerracineProd-X.Y.Z.apk): se o eletricista cancelou o instalador ou foi liberar a
     * permissão e tocou em "Atualizar" de novo, o APK já baixado (do tamanho certo) é reaproveitado sem gastar dados.
     */
    private fun download(url: String, size: Long): File {
        val dir = File(activity.cacheDir, "update").apply { mkdirs() }
        val file = File(dir, url.substringAfterLast('/'))
        if (file.isFile && (size <= 0 || file.length() == size)) return file
        dir.listFiles()?.forEach { it.delete() } // só o APK mais recente fica no aparelho
        val part = File(dir, "${file.name}.part") // download interrompido nunca vira "APK baixado"
        // github.com responde com redirecionamento para o armazenamento do GitHub (também https).
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
            instanceFollowRedirects = true
        }
        try {
            if (conn.responseCode != HttpURLConnection.HTTP_OK) error("o GitHub respondeu ${conn.responseCode}")
            // Sinal que pinga poucos bytes nunca estoura o readTimeout: o download inteiro também tem prazo.
            val prazo = SystemClock.elapsedRealtime() + DOWNLOAD_MAX_MS
            conn.inputStream.use { input ->
                part.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        output.write(buffer, 0, n)
                        if (SystemClock.elapsedRealtime() > prazo) error("sinal fraco demais, o download não terminou")
                    }
                }
            }
        } finally {
            conn.disconnect()
        }
        if (size > 0 && part.length() != size) error("o download veio incompleto")
        if (!part.renameTo(file)) error("falha ao gravar o arquivo")
        return file
    }

    /** Recusa antes de abrir o instalador: outro app, arquivo corrompido ou versão que não é mais nova. */
    private fun verify(apk: File) {
        val pm = activity.packageManager
        val baixado = pm.getPackageArchiveInfo(apk.path, 0) ?: error("o arquivo baixado não é um APK válido")
        if (baixado.packageName != activity.packageName) error("o arquivo baixado não é da Folha de Produção")
        val instalado = pm.getPackageInfo(activity.packageName, 0)
        if (versionCode(baixado) <= versionCode(instalado)) error("a versão baixada não é mais nova que a instalada")
    }

    private fun canInstall(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || activity.packageManager.canRequestPackageInstalls()

    private fun install() {
        val apk = pending ?: return
        if (!canInstall()) {
            // Android 8+: o usuário libera uma vez "Instalar apps desconhecidos" para este app.
            emit("permission", "")
            val settings = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            runCatching { activity.startActivity(settings) }
                .onFailure { emit("error", "Libere \"Instalar apps desconhecidos\" para a Folha de Produção nas configurações do Android.") }
            return
        }
        pending = null
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(activity.shareableUri(apk), "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { activity.startActivity(intent) }
            .onSuccess { emit("installing", "") }
            .onFailure { emit("error", "Não foi possível abrir o instalador do Android.") }
    }

    private companion object {
        /** Mesmo prefixo de src/domain/update.ts: o app só baixa APK das Releases do próprio repositório. */
        const val DOWNLOAD_PREFIX = "https://github.com/Ferracine/Ferracine_Prod/releases/download/"
        const val DOWNLOAD_MAX_MS = 5 * 60_000L

        // Estado do processo, não da tela: se o Android recriar a MainActivity enquanto o eletricista está nas
        // configurações, o novo Updater (onResume) ainda acha o APK. Processo encerrado: tocar em "Atualizar" de
        // novo reaproveita o arquivo já baixado.
        @Volatile var busy = false

        /** APK baixado e conferido, esperando a permissão "Instalar apps desconhecidos" (Android 8+). */
        @Volatile var pending: File? = null

        @Suppress("DEPRECATION")
        fun versionCode(info: PackageInfo): Long =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

        /** Motivo em português: as exceções de rede do Java vêm em inglês ("Unable to resolve host..."). */
        fun motivo(e: Exception): String = when (e) {
            is IllegalStateException -> e.message ?: "erro desconhecido" // nossos error(...), já em português
            is IOException -> "sem internet ou sinal fraco"
            else -> e.javaClass.simpleName
        }
    }
}
