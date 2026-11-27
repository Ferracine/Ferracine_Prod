import groovy.json.JsonSlurper
import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * Chave de assinatura vem de C:\dev\.env (fora do repositório) ou de variáveis de ambiente.
 * Nada sensível é gravado aqui: só os nomes das variáveis.
 */
val env: Properties = Properties().apply {
    val f = rootDir.resolve(System.getenv("FERRACINE_ENV_FILE") ?: "../../.env")
    if (f.isFile) f.reader(Charsets.UTF_8).use { load(it) }
}

fun secret(name: String): String? =
    System.getenv(name)?.takeIf { it.isNotBlank() } ?: env.getProperty(name)?.trim()?.removeSurrounding("\"")?.takeIf { it.isNotBlank() }

// A versão do APK é a do app web (package.json): uma fonte só.
@Suppress("UNCHECKED_CAST")
val webVersion = (JsonSlurper().parse(rootDir.resolve("../package.json")) as Map<String, Any>)["version"] as String
val (vMajor, vMinor, vPatch) = webVersion.split(".").map { it.toInt() }

android {
    namespace = "br.ferracine.prod"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.ferracine.prod"
        minSdk = 24
        targetSdk = 35
        versionCode = vMajor * 10000 + vMinor * 100 + vPatch
        versionName = webVersion
    }

    signingConfigs {
        val store = secret("FERRACINE_PROD_KEYSTORE_FILE")
        if (store != null && file(store).isFile) {
            create("release") {
                storeFile = file(store)
                storePassword = secret("FERRACINE_PROD_KEYSTORE_PASSWORD")
                keyAlias = secret("FERRACINE_PROD_KEY_ALIAS")
                keyPassword = secret("FERRACINE_PROD_KEY_PASSWORD")
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    testImplementation("junit:junit:4.13.2")
}
