import { Resend } from "resend"

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

export interface ReportEmailOptions {
  recipients: string[]
  reportData: Record<string, unknown>
  format: "pdf" | "excel" | "csv"
  reportType: string
  schoolName?: string
}

/**
 * Send a basic email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured. Email sending disabled.")
      return false
    }

    const { to, subject, html, text, from = "noreply@medstint.com", attachments } = options

    const emailData: any = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
    }

    if (html) {
      emailData.html = html
    }
    if (text) {
      emailData.text = text
    }
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments
    }

    const result = await resend.emails.send(emailData)

    if (result.error) {
      console.error("Resend API error:", result.error)
      return false
    }

    console.log("Email sent successfully:", result.data?.id)
    return true
  } catch (error) {
    console.error("Error sending email:", error)
    return false
  }
}

/**
 * Send a report email with formatted content
 */
export async function sendReportEmail(options: ReportEmailOptions): Promise<boolean> {
  try {
    const { recipients, reportData, format, reportType, schoolName = "Your School" } = options

    // Generate email content based on report type and format
    const subject = `${reportType} Report - ${new Date().toLocaleDateString()}`

    const html = generateReportEmailHTML({
      reportType,
      format,
      schoolName,
      reportData,
      generatedAt: new Date().toISOString(),
    })

    const text = generateReportEmailText({
      reportType,
      format,
      schoolName,
      generatedAt: new Date().toISOString(),
    })

    return await sendEmail({
      to: recipients,
      subject,
      html,
      text,
    })
  } catch (error) {
    console.error("Error sending report email:", error)
    return false
  }
}

/**
 * Generate HTML content for report emails
 */
function generateReportEmailHTML(data: {
  reportType: string
  format: string
  schoolName: string
  reportData: Record<string, unknown>
  generatedAt: string
}): string {
  const { reportType, format, schoolName, generatedAt } = data

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportType} Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .content { padding: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 ${reportType} Report</h1>
          <p><strong>${schoolName}</strong></p>
        </div>
        
        <div class="content">
          <p>Hello,</p>
          <p>Your ${reportType.toLowerCase()} report has been generated successfully and is ready for review.</p>
          
          <p><strong>Report Details:</strong></p>
          <ul>
            <li><strong>Report Type:</strong> ${reportType}</li>
            <li><strong>Format:</strong> ${format.toUpperCase()}</li>
            <li><strong>Generated:</strong> ${new Date(generatedAt).toLocaleString()}</li>
            <li><strong>School:</strong> ${schoolName}</li>
          </ul>
          
          <p>You can access your reports through the MedStint dashboard.</p>
          
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports" class="button">
            View Reports Dashboard
          </a>
        </div>
        
        <div class="footer">
          <p>This is an automated message from MedStint. Please do not reply to this email.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text content for report emails
 */
function generateReportEmailText(data: {
  reportType: string
  format: string
  schoolName: string
  generatedAt: string
}): string {
  const { reportType, format, schoolName, generatedAt } = data

  return `
${reportType} Report - ${schoolName}

Hello,

Your ${reportType.toLowerCase()} report has been generated successfully and is ready for review.

Report Details:
- Report Type: ${reportType}
- Format: ${format.toUpperCase()}
- Generated: ${new Date(generatedAt).toLocaleString()}
- School: ${schoolName}

You can access your reports through the MedStint dashboard at:
${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports

This is an automated message from MedStint. Please do not reply to this email.
If you have any questions, please contact your system administrator.
  `.trim()
}

/**
 * Send notification email for system events
 */
export async function sendNotificationEmail({
  to,
  subject,
  message,
  actionUrl,
  actionText = "View Details",
}: {
  to: string | string[]
  subject: string
  message: string
  actionUrl?: string
  actionText?: string
}): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${actionUrl ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ""}
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
${subject}

${message}

${actionUrl ? `${actionText}: ${actionUrl}` : ""}
  `.trim()

  return await sendEmail({
    to,
    subject,
    html,
    text,
  })
}
