# Installation

1. Extract the ZIP file.
2. Go to `brave://extensions` (or `chrome://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the `link-guard` folder.
4. Click the extension icon to open its settings and enter one domain per line.

Friends can follow the same steps using the same ZIP file. When Chrome restarts, it will display a warning about extensions running in Developer mode.

# How It Works

- The content script is activated only when the tab's hostname matches a domain in the list or one of its subdomains.
- Clicks are intercepted during the capture phase on `window`, so the extension also works with dynamically generated links (SPAs, Gmail, and similar applications). It handles regular clicks, Ctrl/Cmd+click, middle-click, and pressing Enter on a link.
- If the destination host does not belong to the active domains, the click is cancelled and an alert is displayed inside a Shadow DOM, preventing the page from modifying it. The alert displays the URL as plain text, which cannot be selected or clicked. The only available actions are **Copy link** and **Close** (also accessible by pressing Esc).
- `mailto:`, `tel:`, `javascript:`, and `#` anchor links are left untouched because they do not navigate to another domain.

# Important Notes

- `gmail.com` redirects to `mail.google.com`, so you must add **`mail.google.com`** to the list. Otherwise, the extension will not activate. The same applies to any website that redirects to a different domain.
- A domain in the list also covers all its subdomains. For example, adding `google.com` means that `mail.google.com` and `accounts.google.com` are also considered internal. If you want stricter control, add the full hostname instead.
- Links inside iframes are not covered because the script runs only in the main frame. JavaScript-triggered navigation through `window.open` or `location.href` is also not covered, nor are forms with an external `action` attribute. These cases can be added if needed.