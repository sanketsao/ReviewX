package app.reviewsx.jetbrains

import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import javax.swing.JPanel
import javax.swing.BoxLayout
import javax.swing.JButton
import javax.swing.JLabel

/**
 * The ReviewSX tool window — mirrors the VS Code sidebar.
 *
 * v1 scope:
 *  - Start / Stop the prototype server
 *  - Share button (tunnel)
 *  - Feedback list grouped by open/resolved (polls the inbox or watches
 *    .protofeedback/feedback.json)
 *
 * TODO(jetbrains): replace this placeholder panel with a proper feedback tree
 * (com.intellij.ui.treeStructure.Tree) and wire the buttons to ReviewSXService
 * and the action classes.
 */
class ReviewSXToolWindowFactory : ToolWindowFactory {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            add(JLabel("ReviewSX"))
            add(JButton("Start with overlay"))
            add(JButton("Share via tunnel"))
            add(JButton("Publish to GitHub Pages"))
            add(JLabel("Feedback will appear here."))
        }
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
