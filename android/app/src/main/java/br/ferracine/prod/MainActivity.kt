package br.ferracine.prod

import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.WebView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * O app web (build do Vite, copiado para assets/www pelo scripts/apk.mjs) roda numa WebView, 100% offline.
 * O WebViewAssetLoader serve os arquivos do APK em https://appassets.androidplatform.net: contexto seguro,
 * então localStorage, crypto.randomUUID e o restante funcionam como no navegador.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Borda a borda em todas as versões (o Android 15 obriga com targetSdk 35): o mesmo caminho do 7 ao 15+,
        // e o espaço das barras é reservado abaixo, no contêiner.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)

                // Só o próprio app abre na WebView; qualquer outro link vai para o navegador do celular.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == WebViewAssetLoader.DEFAULT_DOMAIN) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                    return true
                }
            }
            addJavascriptInterface(FerracineBridge(this@MainActivity), "FerracineAndroid")
        }
        // O padding vai num contêiner, não na WebView: a WebView ignora o próprio padding ao desenhar a página,
        // e o app ficava por baixo da barra de notificação e da barra de navegação.
        val root = FrameLayout(this).apply { addView(webView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT)) }
        setContentView(root)

        // Conteúdo entre as barras do sistema (e fora do recorte da câmera); o fundo delas é o da janela
        // (FerracineBridge.setSystemBars pinta com a cor do tema).
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            // Borda a borda o sistema não encolhe a janela para o teclado: a parte de baixo reserva o maior dos dois,
            // senão o teclado cobre o campo em que o eletricista está digitando.
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        updateBarIcons()

        if (savedInstanceState == null) webView.loadUrl(START_URL) else webView.restoreState(savedInstanceState)

        // Voltar do Android = voltar do histórico do app (o app trata assistente, edição e janelas abertas).
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    /**
     * Só até a página carregar: depois quem manda é o tema do app (src/theme.ts → FerracineBridge.setSystemBars),
     * que segue o celular ou a escolha feita no botão de tema.
     */
    private fun updateBarIcons() {
        val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !night
            isAppearanceLightNavigationBars = !night
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    private companion object {
        const val START_URL = "https://${WebViewAssetLoader.DEFAULT_DOMAIN}/www/index.html"
    }
}
