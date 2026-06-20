package app.reviewsx.jetbrains.actions

import app.reviewsx.jetbrains.ReviewSXService
import app.reviewsx.jetbrains.ServeMode
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.Messages

/** Start the prototype server with the overlay injected, then open the browser. */
class StartAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val url = project.service<ReviewSXService>().start(ServeMode.Static)
        com.intellij.ide.BrowserUtil.browse(url)
    }
}

/** Open a public tunnel URL to the running prototype. */
class ShareAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // TODO(jetbrains): call the server's tunnel (Tailscale Funnel → cloudflared
        // fallback) and show the URL with a copy button.
        Messages.showInfoMessage(project, "Tunnel sharing — not yet implemented.", "ReviewSX")
    }
}

/** Static-export the prototype and publish to GitHub Pages. */
class PublishAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // TODO(jetbrains): invoke the server's staticExport + deployGitHubPages,
        // mirroring the VS Code publishCmd flow (with the public-repo notice).
        Messages.showInfoMessage(project, "GitHub Pages publish — not yet implemented.", "ReviewSX")
    }
}
