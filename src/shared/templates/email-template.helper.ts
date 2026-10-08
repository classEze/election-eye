export interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  greeting?: string;
  paragraphs: string[];
  actionButton?: {
    text: string;
    url: string;
  };
  highlightBox?: {
    label: string;
    value: string;
    subtext?: string;
  };
  notes?: string[];
  footerNote?: string;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class EmailTemplateHelper {
  /**
   * Generates a bulletproof, responsive HTML email matching Election Eye branding.
   * Palette: Primary Green (#008751), Dark Slate/Black (#111827), Light Gray (#F9FAFB), White (#FFFFFF).
   */
  static render(options: EmailTemplateOptions): string {
    const appName = process.env.APP_NAME || 'Election Eye';
    const appAddress = process.env.APP_ADDRESS || 'Lagos State, Nigeria';
    const appPhone = process.env.APP_PHONE || '+234 000 000 0000';
    const primaryColor = '#008751';
    const darkGreen = '#065F46';
    const charcoal = '#111827';
    const bodyText = '#374151';
    const lightBg = '#F3F4F6';
    const cardBg = '#FFFFFF';
    const borderColor = '#E5E7EB';

    const greetingHtml = options.greeting
      ? `<p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: ${charcoal}; font-weight: 600;">${options.greeting}</p>`
      : '';

    const paragraphsHtml = options.paragraphs
      .map(
        (p) =>
          `<p style="margin: 0 0 16px; font-size: 15px; line-height: 24px; color: ${bodyText};">${p}</p>`,
      )
      .join('');

    const actionButtonHtml = options.actionButton
      ? `
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0;">
        <tr>
          <td align="center" style="border-radius: 6px; background-color: ${primaryColor};">
            <a href="${options.actionButton.url}" target="_blank" style="font-size: 15px; font-family: Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 6px; padding: 12px 28px; border: 1px solid ${primaryColor}; display: inline-block; font-weight: 600; letter-spacing: 0.3px;">
              ${escapeHtml(options.actionButton.text)}
            </a>
          </td>
        </tr>
      </table>
      `
      : '';

    const highlightBoxHtml = options.highlightBox
      ? `
      <div style="background-color: #ECFDF5; border-left: 4px solid ${primaryColor}; padding: 16px 20px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: ${darkGreen}; letter-spacing: 0.5px;">${escapeHtml(options.highlightBox.label)}</p>
        <p style="margin: 0; font-size: 18px; font-family: 'Courier New', Courier, monospace; font-weight: 700; color: ${charcoal}; word-break: break-all;">${escapeHtml(options.highlightBox.value)}</p>
        ${
          options.highlightBox.subtext
            ? `<p style="margin: 6px 0 0; font-size: 12px; color: #047857;">${escapeHtml(options.highlightBox.subtext)}</p>`
            : ''
        }
      </div>
      `
      : '';

    const notesHtml =
      options.notes && options.notes.length > 0
        ? `
      <div style="border-top: 1px solid ${borderColor}; margin-top: 24px; padding-top: 16px;">
        ${options.notes
          .map(
            (note) =>
              `<p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #6B7280; font-style: italic;">* ${note}</p>`,
          )
          .join('')}
      </div>
      `
        : '';

    return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${options.title}</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <style>
    td,th,div,p,a,h1,h2,h3,h4,h5,h6 {font-family: "Segoe UI", sans-serif; mso-line-height-rule: exactly;}
  </style>
  <![endif]-->
  <style>
    @media (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100%; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: ${lightBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${
    options.preheader
      ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">${options.preheader}</div>`
      : ''
  }

  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background-color: ${lightBg};">
    <tr>
      <td align="center" style="padding: 36px 12px;">
        <table class="container" border="0" cellpadding="0" cellspacing="0" role="presentation" width="580" style="width: 580px; max-width: 580px; background-color: ${cardBg}; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid ${borderColor};">
          
          <!-- Green Header Top Bar -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 24px 32px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.5px;">
                      ${appName.toUpperCase()}
                    </h1>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #D1FAE5; font-weight: 500;">
                      Official Election Intelligence & Audit Platform
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="content" style="padding: 36px 32px;">
              <h2 style="margin: 0 0 20px; font-size: 18px; font-weight: 700; color: ${charcoal};">
                ${options.title}
              </h2>
              
              ${greetingHtml}
              ${paragraphsHtml}
              ${highlightBoxHtml}
              ${actionButtonHtml}
              ${notesHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAFAFA; border-top: 1px solid ${borderColor}; padding: 24px 32px; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: ${charcoal};">
                ${appName}
              </p>
              <p style="margin: 0 0 6px; font-size: 11px; color: #6B7280;">
                ${appAddress} &bull; ${appPhone}
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #9CA3AF;">
                This is an automated operational notification. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}
