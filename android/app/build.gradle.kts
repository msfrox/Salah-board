import org.gradle.api.tasks.Copy

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "lk.salahboard"
    compileSdk = 34

    defaultConfig {
        applicationId = "lk.salahboard"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    // Release signing comes from CI secrets (see .github/workflows/release.yml).
    // Local debug builds fall back to the default debug keystore untouched.
    val keystorePath = System.getenv("SALAH_KEYSTORE_PATH")
    if (keystorePath != null) {
        signingConfigs {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("SALAH_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SALAH_KEY_ALIAS")
                keyPassword = System.getenv("SALAH_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // Embedded admin/API HTTP server (D4/D8) — deliberately the only
    // non-trivial third-party dependency in the shell besides QR.
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    // QR rendering for the admin-URL / hotspot-credentials overlay.
    implementation("com.google.zxing:core:3.5.3")
}

// Golden rule #1: display/ and admin/ are the single source of truth.
// The shell never forks a copy of the web layer — it just packages the
// same files as assets at build time.
val copyWebAssets = tasks.register<Copy>("copyWebAssets") {
    from(rootProject.projectDir.resolve("../display")) {
        into("display")
    }
    from(rootProject.projectDir.resolve("../admin")) {
        into("admin")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(copyWebAssets)
}
