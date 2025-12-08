/**
 * WhatsApp Phone Number Utilities
 * 
 * WhatsApp requires phone numbers in international format without '+' or spaces
 * Example: 919876543210 (India), 14155551234 (USA)
 */

/**
 * Format phone number for WhatsApp API
 * Removes spaces, dashes, parentheses, and plus signs
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If number starts with 0, might be missing country code
  // This is a simplified version - you might want to add country code logic
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  return cleaned;
}

/**
 * Validate WhatsApp phone number format
 * Should be 10-15 digits
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const formatted = formatPhoneForWhatsApp(phone);
  return /^\d{10,15}$/.test(formatted);
}

/**
 * Display phone number in readable format
 * Example: 919876543210 -> +91 98765 43210
 */
export function displayPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  const cleaned = formatPhoneForWhatsApp(phone);
  
  // Add formatting based on length
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    // Indian format: +91 XXXXX XXXXX
    return `+91 ${cleaned.substring(2, 7)} ${cleaned.substring(7)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // US format: +1 (XXX) XXX-XXXX
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
  }
  
  // Generic format: +XX XXXX XXXX
  return `+${cleaned}`;
}

/**
 * Country codes reference
 * Add more as needed
 */
export const COUNTRY_CODES = {
  IN: '91',   // India
  US: '1',    // USA
  GB: '44',   // UK
  AE: '971',  // UAE
  CA: '1',    // Canada
  AU: '61',   // Australia
  SG: '65',   // Singapore
  MY: '60',   // Malaysia
  // Add more countries as needed
};

/**
 * Add country code if missing
 */
export function addCountryCode(phone: string, countryCode: string = '91'): string {
  const cleaned = formatPhoneForWhatsApp(phone);
  
  // If already has country code, return as is
  if (cleaned.length > 10) {
    return cleaned;
  }
  
  // Add country code
  return `${countryCode}${cleaned}`;
}

/**
 * Example usage:
 * 
 * const userInput = "+91 98765-43210";
 * const formatted = formatPhoneForWhatsApp(userInput);
 * // Result: "919876543210"
 * 
 * const isValid = isValidWhatsAppNumber(formatted);
 * // Result: true
 * 
 * const display = displayPhoneNumber(formatted);
 * // Result: "+91 98765 43210"
 */
