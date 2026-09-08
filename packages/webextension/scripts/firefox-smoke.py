"""Smoke-test the packaged Firefox extension against a local fixture.

Requires a Firefox 154+ binary, geckodriver, and Selenium (`python3 -m pip install selenium`).
Use only disposable browser profiles; Selenium creates one for this test.
"""

import http.server
import json
import os
import socketserver
import tempfile
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / ".output/firefox-mv3"
FIREFOX = os.environ["FIREFOX_BINARY"]
GECKODRIVER = os.environ["GECKODRIVER"]
WIDGET_ID = "cardcutter_thatxliner-browser-action"


def execute_in_popup(driver, script):
    """Run JavaScript in the live extension popup browsing context.

    Firefox exposes the toolbar popup as a native XUL browser, rather than a
    WebDriver window or frame. Resolve that browser on every call because the
    popup's browsing context can be replaced while it navigates.
    """
    driver.set_context("chrome")
    result = driver.execute_async_script(
        """
        const js = arguments[0];
        const done = arguments[arguments.length - 1];
        const b = [...document.querySelectorAll('browser.webextension-popup-browser[webextension-view-type="popup"]')].find((candidate) => {
            const spec = candidate.currentURI?.spec || "";
            return spec.includes("/editor.html") && new URL(spec).searchParams.get("popup") === "1";
        });
        if (!b) {
            done({error: "The native Card Cutter popup editor is unavailable."});
            return;
        }
        const windowGlobal = b.browsingContext?.currentWindowGlobal;
        if (!windowGlobal) {
            done({error: "The native Card Cutter popup editor has no current window global."});
            return;
        }
        windowGlobal.getActor("MarionetteCommands").executeScript(js, [], {})
            .then((value) => done({value}), (error) => done({error: String(error)}));
        """,
        script,
    )
    if not isinstance(result, dict):
        raise RuntimeError(f"Unexpected popup actor response: {result!r}")
    if result.get("error"):
        raise RuntimeError(result["error"])
    return result.get("value")


class Fixture(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/paste":
            body = b"<!doctype html><body><div id='paste-target' contenteditable='true'></div></body>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = b"""<!doctype html><head>
<meta name='citation_title' content='Firefox evidence'>
<meta name='citation_author' content='Doe, Jane'>
<meta name='citation_publication_date' content='2024-02-03'>
</head><body><article><p id='evidence'>Firefox toolbar clicks capture selected evidence.</p></article></body>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


with socketserver.TCPServer(("127.0.0.1", 0), Fixture) as server:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    profile = tempfile.TemporaryDirectory(prefix="cardcutter-firefox-profile-")
    options = Options()
    options.binary_location = FIREFOX
    options.profile = profile.name
    service = Service(executable_path=GECKODRIVER, service_args=["--allow-system-access"])
    driver = webdriver.Firefox(options=options, service=service)
    try:
        driver.install_addon(str(EXTENSION), temporary=True)
        driver.get(f"http://127.0.0.1:{server.server_address[1]}/article")
        driver.execute_script("""
            const text = document.querySelector('#evidence').firstChild;
            const range = document.createRange();
            range.setStart(text, 0);
            range.setEnd(text, text.length);
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        """)
        original_handles = set(driver.window_handles)
        driver.set_context("chrome")
        driver.execute_script("""
            const widget = CustomizableUI.getWidget(arguments[0]);
            if (!widget) throw new Error(`Missing action widget ${arguments[0]}`);
            CustomizableUI.addWidgetToArea(arguments[0], CustomizableUI.AREA_NAVBAR);
            const node = widget.forWindow(window).node;
            const button = node.querySelector('.unified-extensions-item-action-button') || node;
            if (!button) throw new Error('Missing action button');
            button.click();
        """, WIDGET_ID)

        popup_state_script = """
            const value = (selector) => document.querySelector(selector)?.value ?? null;
            const state = {
                url: location.href,
                evidence: value('[data-intro="evidence-text"]'),
                firstName: value('#author-first-0'),
                lastName: value('#author-last-0'),
                title: value('#article-title'),
                date: value('#date'),
            };
            if (Object.values(state).some((entry) => entry === null)) return null;
            return state;
        """

        def popup_capture_ready(_):
            try:
                state = execute_in_popup(driver, popup_state_script)
            except RuntimeError:
                return False
            if not state:
                return False
            return (
                state["evidence"] == "Firefox toolbar clicks capture selected evidence."
                and state["firstName"] == "Jane"
                and state["lastName"] == "Doe"
                and state["title"] == "Firefox evidence"
                and "2024" in state["date"]
                and state
            )

        popup_state = WebDriverWait(driver, 20).until(popup_capture_ready)
        popup_url = urlparse(popup_state["url"])
        popup_query = parse_qs(popup_url.query)
        capture_id = popup_query.get("id", [None])[0]
        assert popup_url.path.endswith("/editor.html"), popup_state["url"]
        assert popup_query.get("popup") == ["1"], popup_state["url"]
        assert capture_id, popup_state["url"]
        driver.set_context("content")
        assert set(driver.window_handles) == original_handles, (
            f"Toolbar popup opened an unexpected window handle: {driver.window_handles}"
        )

        popup_tag = "Firefox popup smoke draft"
        popup_tag_literal = json.dumps(popup_tag)
        changed_tag = execute_in_popup(driver, f"""
            const tag = document.querySelector('#card-tag');
            if (!tag) throw new Error('Popup tag field is missing.');
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (!setter) throw new Error('Popup tag field has no native value setter.');
            setter.call(tag, {popup_tag_literal});
            tag.dispatchEvent(new Event('input', {{bubbles: true}}));
            tag.dispatchEvent(new Event('change', {{bubbles: true}}));
            return tag.value;
        """)
        assert changed_tag == popup_tag, changed_tag

        def popup_saved(_):
            try:
                state = execute_in_popup(driver, """
                    const tag = document.querySelector('#card-tag');
                    const status = document.querySelector('[role="status"]');
                    return {tag: tag?.value ?? null, status: status?.textContent ?? ''};
                """)
            except RuntimeError:
                return False
            return state and state["tag"] == popup_tag and "Saved on this device" in state["status"]

        WebDriverWait(driver, 20).until(popup_saved)
        execute_in_popup(driver, """
            const button = [...document.querySelectorAll('button')]
                .find((candidate) => candidate.textContent?.trim() === 'Open in new tab');
            if (!button) throw new Error('Popup Open in new tab button is missing.');
            button.click();
            return true;
        """)

        driver.set_context("content")
        def full_editor_ready(d):
            new_handles = set(d.window_handles) - original_handles
            if len(new_handles) != 1:
                return False
            d.switch_to.window(next(iter(new_handles)))
            parsed = urlparse(d.current_url)
            query = parse_qs(parsed.query)
            return (
                parsed.scheme == "moz-extension"
                and parsed.path.endswith("/editor.html")
                and query.get("id", [None])[0] == capture_id
                and "popup" not in query
                and d.current_url
            )

        WebDriverWait(driver, 20).until(full_editor_ready)
        WebDriverWait(driver, 20).until(
            lambda d: d.find_element("css selector", "#author-first-0").get_attribute("value") == "Jane"
        )
        assert driver.find_element("css selector", "#author-last-0").get_attribute("value") == "Doe"
        assert driver.find_element("css selector", "#article-title").get_attribute("value") == "Firefox evidence"
        assert "2024" in driver.find_element("css selector", "#date").get_attribute("value")
        evidence = driver.find_element("css selector", "[data-intro=evidence-text]").get_attribute("value")
        assert evidence == "Firefox toolbar clicks capture selected evidence.", evidence
        tag = driver.find_element("css selector", "#card-tag")
        assert tag.get_attribute("value") == popup_tag
        driver.refresh()
        WebDriverWait(driver, 20).until(
            lambda d: d.find_element("css selector", "#card-tag").get_attribute("value") == popup_tag
        )
        copy = driver.find_element("xpath", "//button[normalize-space()='Copy to Clipboard']")
        copy.click()
        WebDriverWait(driver, 20).until(lambda d: d.find_element("xpath", "//button[normalize-space()='Copied!']"))
        driver.switch_to.new_window("tab")
        driver.get(f"http://127.0.0.1:{server.server_address[1]}/paste")
        paste_target = driver.find_element("css selector", "#paste-target")
        paste_target.click()
        paste_target.send_keys(Keys.COMMAND, "v")
        WebDriverWait(driver, 20).until(lambda d: popup_tag in paste_target.text)
        assert "<strong" in paste_target.get_attribute("innerHTML")
        print("Firefox smoke passed: action click, capture, sandbox metadata extraction, draft reload, and rich-text native paste.")
    finally:
        driver.quit()
        profile.cleanup()
