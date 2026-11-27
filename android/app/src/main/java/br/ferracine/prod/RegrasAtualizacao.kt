package br.ferracine.prod

import java.io.IOException

/**
 * Regras do atualizador sem nada do Android (testadas em src/test): o que o [Updater] aceita baixar e instalar.
 * Quem procura a versão nova é o src/update.ts; aqui só as conferências do lado nativo.
 */
object RegrasAtualizacao {
    /** Mesmo prefixo de src/domain/update.ts: o app só baixa APK das Releases do próprio repositório. */
    const val DOWNLOAD_PREFIX = "https://github.com/Ferracine/Ferracine_Prod/releases/download/"

    /** Só APK das Releases do repositório (outro site, outro repositório ou outro tipo de arquivo: recusa). */
    fun enderecoValido(url: String): Boolean =
        url.startsWith(DOWNLOAD_PREFIX) && url.endsWith(".apk") && !url.removePrefix(DOWNLOAD_PREFIX).contains("..")

    /**
     * APK já baixado (mesmo nome de versão) pode ser reaproveitado: existe e, se a Release informou o tamanho, bate.
     * `esperado` = 0 quando o tamanho não é conhecido.
     */
    fun reaproveita(existe: Boolean, tamanho: Long, esperado: Long): Boolean = existe && (esperado <= 0 || tamanho == esperado)

    /**
     * Antes de abrir o instalador: o APK baixado tem de ser deste app e de versão mais nova. Devolve o motivo da
     * recusa (em português) ou null quando pode instalar.
     */
    fun recusaApk(pacoteBaixado: String?, versaoBaixada: Long, pacoteInstalado: String, versaoInstalada: Long): String? = when {
        pacoteBaixado == null -> "o arquivo baixado não é um APK válido"
        pacoteBaixado != pacoteInstalado -> "o arquivo baixado não é da Folha de Produção"
        versaoBaixada <= versaoInstalada -> "a versão baixada não é mais nova que a instalada"
        else -> null
    }

    /** Motivo em português: as exceções de rede do Java vêm em inglês ("Unable to resolve host..."). */
    fun motivo(e: Exception): String = when (e) {
        is IllegalStateException -> e.message ?: "erro desconhecido" // os error(...) do Updater, já em português
        is IOException -> "sem internet ou sinal fraco"
        else -> e.javaClass.simpleName
    }
}
