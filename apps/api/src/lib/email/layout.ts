// Shared HTML shell — plain inline-styled table layout (no external CSS,
// since most email clients strip <style> tags or ignore classes). Mirrors
// the app's rose/purple flat-design accent from apps/web/app/app.css.
export function emailLayout(title: string, bodyHtml: string, ctaUrl?: string, ctaLabel?: string) {
  return `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0 32px;">
                <div style="font-size:22px;font-weight:700;background:linear-gradient(90deg,#f43f5e,#a855f7);-webkit-background-clip:text;background-clip:text;color:#f43f5e;">Rencontre</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;">
                <h1 style="font-size:18px;margin:0 0 16px 0;color:#171717;">${title}</h1>
                <div style="font-size:14px;line-height:1.6;color:#404040;">${bodyHtml}</div>
              </td>
            </tr>
            ${
              ctaUrl && ctaLabel
                ? `<tr>
              <td style="padding:8px 32px 32px 32px;">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;border-radius:12px;background:linear-gradient(90deg,#f43f5e,#a855f7);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${ctaLabel}</a>
              </td>
            </tr>`
                : `<tr><td style="padding-bottom:32px;"></td></tr>`
            }
          </table>
          <p style="font-size:12px;color:#a3a3a3;margin-top:16px;">Rencontre — communauté muslimenfrance</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
