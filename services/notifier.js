const nodemailer = require('nodemailer');

// Setup Nodemailer transporter
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;

  if (!user || !pass) {
    console.warn('Warning: GMAIL_USER or GMAIL_PASS not set in environment variables. Email notifications will be printed to console instead.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass
    }
  });

  return transporter;
};

/**
 * Sends a price drop alert email to the tracking user
 * @param {string} toEmail 
 * @param {object} item 
 * @param {number} currentPrice 
 */
const sendEmail = async (toEmail, item, currentPrice) => {
  const symbol = item.currency === 'USD' ? '$' : '₹';
  const subject = `🎉 Price Drop Alert! ${item.productName} is now ${symbol}${currentPrice}`;
  
  // Format HTML Template
  const imageHtml = item.imageUrl 
    ? `<div style="text-align: center; margin: 20px 0;">
         <img src="${item.imageUrl}" alt="${item.productName}" style="max-width: 200px; max-height: 200px; border-radius: 8px; border: 1px solid #1E1E2E;" />
       </div>`
    : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Price Drop Alert</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0A0A0F; color: #F8F8FF;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0A0A0F; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #12121A; border: 1px solid #1E1E2E; border-radius: 16px; overflow: hidden; max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background-color: #0A0A0F; padding: 20px; text-align: center; border-bottom: 2px solid #7C3AED;">
                  <h1 style="margin: 0; color: #A855F7; font-size: 24px; font-weight: bold;">
                    <span style="font-size: 28px;">⬇</span> Antigravity
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px 20px; text-align: center;">
                  <h2 style="margin-top: 0; color: #F8F8FF; font-size: 20px;">Great News! A price drop has occurred.</h2>
                  
                  ${imageHtml}
                  
                  <p style="font-size: 16px; font-weight: bold; color: #F8F8FF; margin: 15px 0;">
                    ${item.productName}
                  </p>
                  
                  <div style="margin: 25px 0; padding: 15px; background-color: #0A0A0F; border-radius: 12px; border: 1px solid #1E1E2E;">
                    <p style="margin: 0; font-size: 14px; color: #6B7280;">Current Price</p>
                    <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold; color: #10B981;">
                      ${symbol}${currentPrice}
                    </p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #F59E0B;">
                      Your target was: ${symbol}${item.targetPrice}
                    </p>
                  </div>
                  
                  <a href="${item.url}" target="_blank" style="display: inline-block; background-color: #7C3AED; color: #ffffff; text-decoration: none; padding: 12px 30px; font-weight: bold; border-radius: 12px; margin: 20px 0; transition: background-color 0.2s;">
                    Buy Now →
                  </a>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding: 0 20px;">
                  <hr style="border: 0; border-top: 1px solid #1E1E2E; margin: 0;" />
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px; text-align: center; font-size: 12px; color: #6B7280; line-height: 1.5;">
                  You're receiving this because you track this item on Antigravity.<br />
                  To stop alerts, delete this item from your dashboard.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.log('================ EMAIL SIMULATION ================');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body excerpt: ${item.productName} is now ${symbol}${currentPrice} (Target: ${symbol}${item.targetPrice})`);
    console.log('==================================================');
    return;
  }

  const mailOptions = {
    from: `"Antigravity Alerts" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlBody
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Email alert sent successfully: ${info.messageId}`);
  } catch (error) {
    console.error('Failed to send email alert:', error.message);
  }
};

module.exports = {
  sendEmail
};
