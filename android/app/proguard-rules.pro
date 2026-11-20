# Métodos chamados pelo JavaScript (window.FerracineAndroid): o R8 não pode renomear nem remover.
-keepclassmembers class br.ferracine.prod.FerracineBridge {
    @android.webkit.JavascriptInterface <methods>;
}
