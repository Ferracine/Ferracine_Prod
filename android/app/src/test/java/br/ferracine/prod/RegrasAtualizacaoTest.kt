package br.ferracine.prod

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RegrasAtualizacaoTest {
    private val base = RegrasAtualizacao.DOWNLOAD_PREFIX

    @Test
    fun `so aceita APK das Releases do proprio repositorio`() {
        assertTrue(RegrasAtualizacao.enderecoValido("${base}v1.4.19/FerracineProd-1.4.19.apk"))
        assertFalse(RegrasAtualizacao.enderecoValido("https://github.com/Outro/Repo/releases/download/v1/x.apk"))
        assertFalse(RegrasAtualizacao.enderecoValido("http://github.com/Ferracine/Ferracine_Prod/releases/download/v1/x.apk"))
        assertFalse(RegrasAtualizacao.enderecoValido("${base}v1.4.19/FerracineProd-1.4.19.zip"))
        assertFalse(RegrasAtualizacao.enderecoValido("${base}../../evil/x.apk"))
        assertFalse(RegrasAtualizacao.enderecoValido("https://exemplo.com/?u=${base}x.apk"))
    }

    @Test
    fun `reaproveita o APK ja baixado so se existe e o tamanho bate`() {
        assertTrue(RegrasAtualizacao.reaproveita(existe = true, tamanho = 754_372, esperado = 754_372))
        assertTrue(RegrasAtualizacao.reaproveita(existe = true, tamanho = 10, esperado = 0)) // tamanho desconhecido
        assertFalse(RegrasAtualizacao.reaproveita(existe = true, tamanho = 500, esperado = 754_372)) // download pela metade
        assertFalse(RegrasAtualizacao.reaproveita(existe = false, tamanho = 0, esperado = 0))
    }

    @Test
    fun `instala so APK deste app e de versao mais nova`() {
        val app = "br.ferracine.prod"
        assertNull(RegrasAtualizacao.recusaApk(app, 10419, app, 10418))
        assertEquals("a versão baixada não é mais nova que a instalada", RegrasAtualizacao.recusaApk(app, 10418, app, 10418))
        assertEquals("a versão baixada não é mais nova que a instalada", RegrasAtualizacao.recusaApk(app, 10417, app, 10418))
        assertEquals("o arquivo baixado não é da Folha de Produção", RegrasAtualizacao.recusaApk("com.outro", 99999, app, 10418))
        assertEquals("o arquivo baixado não é um APK válido", RegrasAtualizacao.recusaApk(null, 0, app, 10418))
    }

    @Test
    fun `motivo do erro em portugues`() {
        assertEquals("sem internet ou sinal fraco", RegrasAtualizacao.motivo(IOException("Unable to resolve host")))
        assertEquals("o GitHub respondeu 404", RegrasAtualizacao.motivo(IllegalStateException("o GitHub respondeu 404")))
        assertEquals("NumberFormatException", RegrasAtualizacao.motivo(NumberFormatException()))
    }
}
