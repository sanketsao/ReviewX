package app.reviewsx.jetbrains

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import java.io.File

/**
 * Project-scoped service that owns the lifecycle of the ReviewSX Node server.
 *
 * The JetBrains plugin reuses the exact same Node server as the VS Code
 * extension (packages/server). Rather than reimplement the overlay/proxy/inbox
 * in Kotlin, we spawn `node cli.js` and manage the process here.
 *
 * TODO(jetbrains): bundle the built server (packages/server/dist) inside the
 * plugin distribution, resolve the node binary, and parse the server's stdout
 * for the local URL. For now this is a skeleton with the shape of the work.
 */
@Service(Service.Level.PROJECT)
class ReviewSXService(private val project: Project) {

    private var serverProcess: Process? = null
    var localUrl: String? = null
        private set

    val isRunning: Boolean
        get() = serverProcess?.isAlive == true

    fun start(mode: ServeMode): String {
        if (isRunning) return localUrl ?: ""
        val root = project.basePath ?: error("No project root")

        // TODO: resolve a bundled node + the server entry (cli.js) shipped with
        // the plugin. Placeholder command shape:
        val args = buildList {
            add("node")
            add(resolveServerEntry())
            when (mode) {
                is ServeMode.Static -> add(root)
                is ServeMode.Proxy -> { add("--proxy"); add(mode.target) }
            }
        }

        thisLogger().info("Starting ReviewSX server: ${args.joinToString(" ")}")
        val proc = ProcessBuilder(args)
            .directory(File(root))
            .redirectErrorStream(true)
            .start()
        serverProcess = proc

        // TODO: read proc.inputStream to capture the printed local URL.
        localUrl = "http://localhost:4200"
        return localUrl!!
    }

    fun stop() {
        serverProcess?.destroy()
        serverProcess = null
        localUrl = null
    }

    private fun resolveServerEntry(): String {
        // TODO: ship packages/server/dist/cli.js inside the plugin jar/resources
        // and extract to a temp dir, or require a globally installed CLI.
        return "reviewsx-server"
    }
}

sealed interface ServeMode {
    data object Static : ServeMode
    data class Proxy(val target: String) : ServeMode
}
