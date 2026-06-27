export const smsTemplates: Record<string, string> = {
  booking_confirmed:
    'Hi {name}, booking {bookingId} confirmed. Bus {busNo}, Seat(s) {seats}, Date {date}, {from}→{to} at {time}. - BusMalik',
  booking_cancelled:
    'Hi {name}, booking {bookingId} cancelled. Refund ₹{refundAmount} will be processed. - BusMalik',
  trip_cancelled:
    'Hi {name}, your trip on {date} ({from}→{to}) has been cancelled. Reason: {reason}. Contact us for refund. - BusMalik',
  payment_reminder:
    'Hi {name}, balance due ₹{amount} for booking {bookingId}. Please pay before departure. - BusMalik',
};

export const fillTemplate = (templateKey: string, vars: Record<string, string>): string => {
  let msg = smsTemplates[templateKey] || '';
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  return msg;
};
