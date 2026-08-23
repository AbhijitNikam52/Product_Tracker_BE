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
    ? `<div style="text-align: center; margin: 25px 0;">
         <img src="${item.imageUrl}" alt="${item.productName}" style="max-width: 180px; max-height: 180px; border-radius: 12px; border: 1px solid #1E293B;" />
       </div>`
    : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Price Drop Alert</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080C14; color: #F9FAFB;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080C14; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="background-color: #0F1626; border: 1px solid #1E293B; border-radius: 20px; overflow: hidden; max-width: 560px;">
              <!-- Header -->
              <tr>
                <td style="background-color: #080C14; padding: 25px; text-align: center; border-bottom: 2px solid #4F46E5;">
                  <h1 style="margin: 0; color: #F9FAFB; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: inline-flex; align-items: center; justify-content: center; font-family: inherit;">
                    <span style="font-size: 26px; margin-right: 8px;">🏷️</span> PriceDekho
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 35px 25px; text-align: center;">
                  <h2 style="margin-top: 0; color: #F9FAFB; font-size: 20px; font-weight: 700; tracking: tight;">Good News! A price drop has occurred.</h2>
                  <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 20px; line-height: 1.5;">We noticed that an item you are tracking has dropped below your target price.</p>
                  
                  ${imageHtml}
                  
                  <p style="font-size: 15px; font-weight: 700; color: #F9FAFB; margin: 15px 0; line-height: 1.4;">
                    ${item.productName}
                  </p>
                  
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0; background-color: #080C14; border-radius: 16px; border: 1px solid #1E293B; padding: 20px;">
                    <tr>
                      <td align="center" style="width: 50%; border-right: 1px solid #1E293B;">
                        <p style="margin: 0; font-size: 12px; color: #9CA3AF; font-weight: 600; text-transform: uppercase;">Current Price</p>
                        <p style="margin: 5px 0 0 0; font-size: 28px; font-weight: 900; color: #10B981;">
                          ${symbol}${currentPrice}
                        </p>
                      </td>
                      <td align="center" style="width: 50%;">
                        <p style="margin: 0; font-size: 12px; color: #9CA3AF; font-weight: 600; text-transform: uppercase;">Your Target</p>
                        <p style="margin: 5px 0 0 0; font-size: 22px; font-weight: 800; color: #3B82F6;">
                          ${symbol}${item.targetPrice}
                        </p>
                      </td>
                    </tr>
                  </table>
                  
                  <a href="${item.url}" target="_blank" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 700; font-size: 14px; border-radius: 12px; margin-top: 10px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); transition: background-color 0.2s;">
                    Buy Now at Store →
                  </a>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding: 0 25px;">
                  <hr style="border: 0; border-top: 1px solid #1E293B; margin: 0;" />
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 25px; text-align: center; font-size: 11px; color: #9CA3AF; line-height: 1.6;">
                  You're receiving this because you track this item on PriceDekho.<br />
                  To stop alerts, delete this item from your dashboard or edit your profile preferences.
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
    console.log('================ EMAIL SIMULATION (PRICE DROPPED) ================');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body excerpt: ${item.productName} is now ${symbol}${currentPrice} (Target: ${symbol}${item.targetPrice})`);
    console.log('==================================================================');
    return;
  }

  const mailOptions = {
    from: `"PriceDekho Alerts" <${process.env.GMAIL_USER}>`,
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

/**
 * Sends a welcome signup email to a new user
 * @param {string} toEmail 
 */
const sendWelcomeEmail = async (toEmail) => {
  const subject = `👋 Welcome to PriceDekho - Start Tracking and Saving!`;
  const clientUrl = process.env.VITE_FRONTEND_API_URL;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to PriceDekho</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080C14; color: #F9FAFB;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #080C14; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="background-color: #0F1626; border: 1px solid #1E293B; border-radius: 20px; overflow: hidden; max-width: 560px;">
              <!-- Header -->
              <tr>
                <td style="background-color: #080C14; padding: 25px; text-align: center; border-bottom: 2px solid #4F46E5;">
                  <h1 style="margin: 0; color: #F9FAFB; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; display: inline-flex; align-items: center; justify-content: center; font-family: inherit;">
                    <span style="font-size: 26px; margin-right: 8px;">🏷️</span> PriceDekho
                  </h1>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 35px 25px; text-align: center;">
                  <h2 style="margin-top: 0; color: #F9FAFB; font-size: 20px; font-weight: 700; tracking: tight;">Welcome to PriceDekho! 👋</h2>
                  <p style="font-size: 14px; color: #9CA3AF; margin-bottom: 25px; line-height: 1.5; text-align: left;">
                    Thank you for signing up! PriceDekho is your ultimate companion to beat high e-commerce prices. We track products across Amazon, Flipkart, Myntra, Ajio, Meesho and more to find you the best deals.
                  </p>
                  
                  <div style="text-align: left; background-color: #080C14; border-radius: 16px; border: 1px solid #1E293B; padding: 20px; margin-bottom: 25px;">
                    <h3 style="margin-top: 0; font-size: 14px; color: #3B82F6; font-weight: 700;">Here's how to start saving:</h3>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #9CA3AF; line-height: 1.6;">
                      <li style="margin-bottom: 8px;"><strong style="color: #F9FAFB;">Search:</strong> Find any product by keyword or URL on our Search page.</li>
                      <li style="margin-bottom: 8px;"><strong style="color: #F9FAFB;">Set Target Alert:</strong> Add it to your tracker and set your desired target price.</li>
                      <li style="margin-bottom: 8px;"><strong style="color: #F9FAFB;">Compare:</strong> Compare prices between multiple stores to find the absolute lowest.</li>
                      <li style="margin-bottom: 0;"><strong style="color: #F9FAFB;">Get Notified:</strong> We'll scan prices in the background and email you the second your target is hit!</li>
                    </ul>
                  </div>
                  
                  <a href="${clientUrl}" target="_blank" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 700; font-size: 14px; border-radius: 12px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); transition: background-color 0.2s;">
                    Go to Your Dashboard →
                  </a>
                </td>
              </tr>
              <!-- Divider -->
              <tr>
                <td style="padding: 0 25px;">
                  <hr style="border: 0; border-top: 1px solid #1E293B; margin: 0;" />
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 25px; text-align: center; font-size: 11px; color: #9CA3AF; line-height: 1.6;">
                  © 2026 PriceDekho · Smart Price Tracker<br />
                  You're receiving this because you created a PriceDekho account.
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
    console.log('================ EMAIL SIMULATION (WELCOME SIGNUP) ================');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: Welcome to PriceDekho! Get ready to start tracking and saving.`);
    console.log('===================================================================');
    return;
  }

  const mailOptions = {
    from: `"PriceDekho Welcome" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: htmlBody
  };

  try {
    const info = await mailTransporter.sendMail(mailOptions);
    console.log(`Welcome email sent successfully: ${info.messageId}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error.message);
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail
};
