plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.21"
    id("org.jetbrains.intellij.platform") version "2.1.0"
}

group = "app.reviewsx"
version = "0.1.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        // Target the IntelliJ Platform — covers IntelliJ IDEA, WebStorm, PyCharm, etc.
        // WebStorm (web/JS prototypes) is the primary target; IDEA Community is the
        // cheapest sandbox to develop against.
        intellijIdeaCommunity("2024.2")

        pluginVerifier()
        zipSigner()
        instrumentationTools()
    }
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "242"   // 2024.2+
            untilBuild = provider { null }
        }
    }
}

kotlin {
    jvmToolchain(17)
}
