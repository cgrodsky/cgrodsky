import UIKit
import WebKit
import LocalAuthentication

/// Shows Windows 12 full screen and gives the page a direct line to the iPad's
/// real Touch ID / Face ID (LocalAuthentication) — no passkey involved.
///
/// The page talks to it with:
///   await window.webkit.messageHandlers.win12bio.postMessage({ action: "status" })
///     → { available: Bool, type: "touchID" | "faceID" | "opticID" | "none", error: String }
///   await window.webkit.messageHandlers.win12bio.postMessage({ action: "verify", reason: "…" })
///     → { ok: true }   or rejects with "cancelled" / "pin" / an error message
///
/// It loads the live site (always up to date). With no internet it falls back to the
/// copy of the site bundled inside the app (the "Web" folder).
final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
    private static let liveURL = URL(string: "https://cgrodsky.github.io/cgrodsky/")!
    private var webView: WKWebView!
    private var usingBundledCopy = false

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()                 // keeps your desktop, files and settings
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        let content = WKUserContentController()
        content.addScriptMessageHandler(self, contentWorld: .page, name: "win12bio")
        // Lets the page know it is running inside the app.
        let marker = "window.WIN12_NATIVE = { platform: 'ios', biometrics: true, version: '1.0' };"
        content.addUserScript(WKUserScript(source: marker, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        config.userContentController = content

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        self.webView = webView
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: Self.liveURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
    }

    // MARK: - Offline fallback

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadBundledCopy()
    }

    private func loadBundledCopy() {
        guard !usingBundledCopy, let dir = Bundle.main.url(forResource: "Web", withExtension: nil) else { return }
        usingBundledCopy = true
        webView.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
    }

    // Links that open a new window (target=_blank / window.open) go to Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
        return nil
    }

    // MARK: - alert() / confirm() / prompt()

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }

    // MARK: - Touch ID / Face ID bridge (LocalAuthentication)

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let body = message.body as? [String: Any] ?? [:]
        let action = body["action"] as? String ?? ""
        let context = LAContext()
        var policyError: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &policyError)

        let type: String
        switch context.biometryType {
        case .touchID: type = "touchID"
        case .faceID: type = "faceID"
        case .none: type = "none"
        default: type = "opticID"
        }

        switch action {
        case "status":
            replyHandler(["available": available, "type": type, "error": policyError?.localizedDescription ?? ""], nil)

        case "verify":
            guard available else {
                replyHandler(nil, policyError?.localizedDescription ?? "Touch ID isn't available on this iPad.")
                return
            }
            let reason = (body["reason"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Unlock Windows 12"
            context.localizedFallbackTitle = "Use PIN"
            context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
                DispatchQueue.main.async {
                    if success {
                        replyHandler(["ok": true], nil)
                        return
                    }
                    let code = (error as? LAError)?.code
                    switch code {
                    case .some(.userCancel), .some(.systemCancel), .some(.appCancel):
                        replyHandler(nil, "cancelled")
                    case .some(.userFallback):
                        replyHandler(nil, "pin")
                    default:
                        replyHandler(nil, error?.localizedDescription ?? "Not recognized")
                    }
                }
            }

        default:
            replyHandler(nil, "Unknown action")
        }
    }
}
