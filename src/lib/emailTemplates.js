// backend/src/lib/emailTemplates.js

export const passwordResetEmailTemplate = (userName, resetUrl) => {
  return {
    subject: "Reset Your Password - HireLoop",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              background: #f4f4f5;
              padding: 20px;
              margin: 0;
              -webkit-font-smoothing: antialiased;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
            }
            .header {
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              padding: 32px 40px;
              text-align: center;
            }
            .header h1 {
              color: #ffffff;
              font-size: 28px;
              font-weight: 700;
              letter-spacing: -0.5px;
            }
            .header span {
              color: #3b82f6;
            }
            .content {
              padding: 40px 40px 32px;
            }
            .greeting {
              font-size: 18px;
              color: #1a1a2e;
              font-weight: 600;
              margin-bottom: 12px;
            }
            .message {
              color: #3f3f46;
              line-height: 1.6;
              margin-bottom: 24px;
              font-size: 16px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              background: #3b82f6;
              color: #ffffff !important;
              text-decoration: none;
              padding: 14px 40px;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              transition: background 0.2s ease;
              box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            }
            .button:hover {
              background: #2563eb;
            }
            .link-box {
              background: #f4f4f5;
              border-radius: 8px;
              padding: 16px;
              margin: 20px 0;
              word-break: break-all;
              border: 1px solid #e4e4e7;
            }
            .link-box a {
              color: #3b82f6;
              text-decoration: none;
              font-size: 14px;
            }
            .link-box a:hover {
              text-decoration: underline;
            }
            .info-text {
              color: #71717a;
              font-size: 14px;
              line-height: 1.5;
              margin: 16px 0;
            }
            .divider {
              border: none;
              border-top: 1px solid #e4e4e7;
              margin: 24px 0;
            }
            .footer {
              background: #fafafa;
              padding: 24px 40px;
              text-align: center;
              border-top: 1px solid #e4e4e7;
            }
            .footer p {
              color: #71717a;
              font-size: 13px;
              margin: 4px 0;
            }
            .footer .company {
              color: #1a1a2e;
              font-weight: 600;
            }
            .footer .company span {
              color: #3b82f6;
            }
            .badge {
              display: inline-block;
              background: #3b82f6;
              color: white;
              font-size: 10px;
              padding: 2px 8px;
              border-radius: 4px;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1>Hire<span>Loop</span></h1>
              <div style="margin-top: 8px;">
                <span class="badge">Password Reset</span>
              </div>
            </div>

            <!-- Content -->
            <div class="content">
              <p class="greeting">Hello${userName ? ` ${userName}` : ''} 👋</p>
              
              <p class="message">
                We received a request to reset your password for your HireLoop account. 
                Click the button below to create a new password.
              </p>

              <div class="button-container">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>

              <p class="info-text">
                Or copy and paste this link into your browser:
              </p>
              <div class="link-box">
                <a href="${resetUrl}">${resetUrl}</a>
              </div>

              <p class="info-text" style="color: #a1a1aa; font-size: 13px;">
                ⏰ This link will expire in <strong>1 hour</strong> for security reasons.
              </p>

              <hr class="divider">

              <p class="info-text" style="font-size: 13px;">
                If you didn't request this password reset, you can safely ignore this email. 
                Your account security is important to us.
              </p>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p class="company">Hire<span>Loop</span></p>
              <p>© ${new Date().getFullYear()} HireLoop. All rights reserved.</p>
              <p style="font-size: 12px; color: #a1a1aa; margin-top: 8px;">
                This is an automated message, please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
      Reset Your Password - HireLoop

      Hello${userName ? ` ${userName}` : ''},

      We received a request to reset your password for your HireLoop account.
      Click the link below to create a new password:

      ${resetUrl}

      This link will expire in 1 hour for security reasons.

      If you didn't request this password reset, you can safely ignore this email.
      Your account security is important to us.

      ---
      HireLoop
      © ${new Date().getFullYear()} HireLoop. All rights reserved.
    `
  };
};