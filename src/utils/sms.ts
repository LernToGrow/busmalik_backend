import https from 'https';
import { env } from '../config/env';
import SmsLog from '../models/SmsLog';
import { fillTemplate } from './smsTemplates';
import mongoose from 'mongoose';

export const sendSMS = async (phone: string, message: string): Promise<{ success: boolean; messageId?: string }> => {
  return new Promise((resolve) => {
    if (!env.MSG91_AUTH_KEY || env.MSG91_AUTH_KEY === 'your_msg91_auth_key_here') {
      console.log(`[SMS MOCK] To: ${phone} | Message: ${message}`);
      resolve({ success: true, messageId: 'mock_' + Date.now() });
      return;
    }
    const data = JSON.stringify({
      sender: 'ROUTEHQ',
      route: '4',
      country: '91',
      sms: [{ message, to: [phone] }],
    });
    const options = {
      hostname: 'api.msg91.com',
      path: '/api/v2/sendsms',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: env.MSG91_AUTH_KEY },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ success: parsed.type === 'success', messageId: parsed.message });
        } catch {
          resolve({ success: false });
        }
      });
    });
    req.on('error', () => resolve({ success: false }));
    req.write(data);
    req.end();
  });
};

export const sendTemplatedSMS = async (
  phone: string,
  templateKey: string,
  variables: Record<string, string>,
  bookingId?: mongoose.Types.ObjectId
) => {
  const message = fillTemplate(templateKey, variables);
  const result = await sendSMS(phone, message);
  await SmsLog.create({
    bookingId,
    phone,
    templateKey,
    message,
    status: result.success ? 'sent' : 'failed',
    msgId: result.messageId,
  });
  return result;
};
