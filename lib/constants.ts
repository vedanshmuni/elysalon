/**
 * Configuration constants for the application
 */

export const APP_NAME = "SalonOS";
export const APP_DESCRIPTION = "Complete Salon & Spa Management Solution";
export const APP_VERSION = "1.0.0";

/**
 * Date and time formats
 */
export const DATE_FORMAT = "MMM dd, yyyy";
export const TIME_FORMAT = "hh:mm a";
export const DATETIME_FORMAT = "MMM dd, yyyy hh:mm a";
export const DATE_FORMAT_ISO = "yyyy-MM-dd";

/**
 * Currency settings
 */
export const DEFAULT_CURRENCY = "INR";
export const CURRENCY_SYMBOL = "₹";
export const TAX_RATE = 18; // 18% GST

/**
 * Pagination
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * User roles
 */
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  CASHIER = "CASHIER",
  STAFF = "STAFF",
  READ_ONLY = "READ_ONLY",
}

export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.OWNER]: 80,
  [UserRole.MANAGER]: 60,
  [UserRole.CASHIER]: 40,
  [UserRole.STAFF]: 20,
  [UserRole.READ_ONLY]: 10,
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.OWNER]: "Owner",
  [UserRole.MANAGER]: "Manager",
  [UserRole.CASHIER]: "Cashier",
  [UserRole.STAFF]: "Staff",
  [UserRole.READ_ONLY]: "Read Only",
};

/**
 * Booking statuses
 */
export enum BookingStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: "Pending",
  [BookingStatus.CONFIRMED]: "Confirmed",
  [BookingStatus.IN_PROGRESS]: "In Progress",
  [BookingStatus.COMPLETED]: "Completed",
  [BookingStatus.CANCELLED]: "Cancelled",
  [BookingStatus.NO_SHOW]: "No Show",
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: "text-yellow-600 bg-yellow-50",
  [BookingStatus.CONFIRMED]: "text-blue-600 bg-blue-50",
  [BookingStatus.IN_PROGRESS]: "text-purple-600 bg-purple-50",
  [BookingStatus.COMPLETED]: "text-green-600 bg-green-50",
  [BookingStatus.CANCELLED]: "text-red-600 bg-red-50",
  [BookingStatus.NO_SHOW]: "text-gray-600 bg-gray-50",
};

/**
 * Invoice statuses
 */
export enum InvoiceStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  PAID = "PAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: "Draft",
  [InvoiceStatus.PENDING]: "Pending",
  [InvoiceStatus.PAID]: "Paid",
  [InvoiceStatus.PARTIALLY_PAID]: "Partially Paid",
  [InvoiceStatus.CANCELLED]: "Cancelled",
  [InvoiceStatus.REFUNDED]: "Refunded",
};

/**
 * Payment methods
 */
export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  UPI = "UPI",
  WALLET = "WALLET",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.CARD]: "Card",
  [PaymentMethod.UPI]: "UPI",
  [PaymentMethod.WALLET]: "Wallet",
  [PaymentMethod.BANK_TRANSFER]: "Bank Transfer",
};

/**
 * Discount types
 */
export enum DiscountType {
  PERCENTAGE = "PERCENTAGE",
  FIXED = "FIXED",
}

/**
 * Campaign statuses
 */
export enum CampaignStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  ACTIVE = "ACTIVE",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/**
 * Notification channels
 */
export enum NotificationChannel {
  SMS = "SMS",
  EMAIL = "EMAIL",
  PUSH = "PUSH",
  WHATSAPP = "WHATSAPP",
}

/**
 * Subscription statuses
 */
export enum SubscriptionStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

/**
 * Gender options
 */
export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

export const GENDER_LABELS: Record<Gender, string> = {
  [Gender.MALE]: "Male",
  [Gender.FEMALE]: "Female",
  [Gender.OTHER]: "Other",
};

/**
 * Days of week
 */
export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Time slots (for scheduling)
 */
export const TIME_SLOT_DURATION = 30; // minutes
export const BUSINESS_HOURS_START = 9; // 9 AM
export const BUSINESS_HOURS_END = 21; // 9 PM

/**
 * File upload limits
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validation patterns
 */
export const PHONE_REGEX = /^[\d\s\+\-\(\)]+$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;

/**
 * API endpoints (if needed)
 */
export const API_ROUTES = {
  AUTH: "/api/auth",
  CLIENTS: "/api/clients",
  BOOKINGS: "/api/bookings",
  SERVICES: "/api/services",
  STAFF: "/api/staff",
  INVOICES: "/api/invoices",
  INVENTORY: "/api/inventory",
  ANALYTICS: "/api/analytics",
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  THEME: "salon-os-theme",
  SIDEBAR_COLLAPSED: "salon-os-sidebar-collapsed",
  SELECTED_BRANCH: "salon-os-selected-branch",
} as const;

/**
 * Query keys for React Query
 */
export const QUERY_KEYS = {
  CLIENTS: "clients",
  CLIENT: "client",
  BOOKINGS: "bookings",
  BOOKING: "booking",
  SERVICES: "services",
  SERVICE: "service",
  STAFF: "staff",
  STAFF_MEMBER: "staff-member",
  INVOICES: "invoices",
  INVOICE: "invoice",
  PRODUCTS: "products",
  PRODUCT: "product",
  ANALYTICS: "analytics",
  CAMPAIGNS: "campaigns",
  TENANT: "tenant",
  BRANCHES: "branches",
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  GENERIC: "An error occurred. Please try again.",
  NETWORK: "Network error. Please check your connection.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  VALIDATION: "Please check your input and try again.",
  SERVER: "Server error. Please try again later.",
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  CREATED: "Created successfully!",
  UPDATED: "Updated successfully!",
  DELETED: "Deleted successfully!",
  SAVED: "Saved successfully!",
} as const;
