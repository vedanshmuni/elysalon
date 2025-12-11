# POS Hardware Integration Guide

## Overview
This document outlines options for integrating physical POS hardware (card readers, thermal printers, cash drawers) with your salon management system.

## Hardware Integration Options

### Option 1: Browser-Based Hardware API (Easiest - Quick Start)

#### For Thermal Printers
Use **Web Bluetooth API** or **USB WebPrinter API**:

```typescript
// lib/hardware/thermal-printer.ts
export class ThermalPrinter {
  private device: USBDevice | null = null;
  
  async connect() {
    try {
      // Request USB printer access
      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x0416 }, // Citizen
          { vendorId: 0x04b8 }, // Epson
          { vendorId: 0x0519 }, // Star Micronics
        ]
      });
      
      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);
      
      return true;
    } catch (error) {
      console.error('Printer connection failed:', error);
      return false;
    }
  }
  
  async printReceipt(data: ReceiptData) {
    if (!this.device) throw new Error('Printer not connected');
    
    // ESC/POS commands
    const commands = this.buildESCPOS(data);
    
    await this.device.transferOut(1, commands);
  }
  
  private buildESCPOS(data: ReceiptData): Uint8Array {
    const encoder = new TextEncoder();
    const ESC = 0x1B;
    const GS = 0x1D;
    
    const commands: number[] = [
      ESC, 0x40, // Initialize
      ESC, 0x61, 0x01, // Center align
      ...encoder.encode(data.businessName + '\n\n'),
      ESC, 0x61, 0x00, // Left align
      ...encoder.encode('Invoice: ' + data.invoiceNumber + '\n'),
      ...encoder.encode('Date: ' + data.date + '\n'),
      ...encoder.encode('--------------------------------\n'),
      ...this.buildItemsESCPOS(data.items),
      ...encoder.encode('--------------------------------\n'),
      ...encoder.encode('Total: ' + data.total + '\n'),
      ...encoder.encode('Payment: ' + data.paymentMethod + '\n\n\n'),
      GS, 0x56, 0x00, // Cut paper
    ];
    
    return new Uint8Array(commands);
  }
}
```

#### For Cash Drawer
Cash drawers connect to printers via RJ11/RJ12:

```typescript
// lib/hardware/cash-drawer.ts
export class CashDrawer {
  async open(printer: ThermalPrinter) {
    // ESC/POS command to open cash drawer
    const openCommand = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    await printer.sendRawCommand(openCommand);
  }
}
```

#### For Card Readers
Use **Razorpay Payment Links** or **UPI QR** (no hardware needed):

```typescript
// lib/hardware/payment-terminal.ts
export class PaymentTerminal {
  async processCardPayment(amount: number, orderId: string) {
    // Razorpay Payment Link API
    const response = await fetch('/api/payments/create-link', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        description: `Invoice ${orderId}`,
        callback_url: `${window.location.origin}/api/payments/callback`,
        callback_method: 'get'
      })
    });
    
    const { short_url } = await response.json();
    
    // Display QR code or payment link
    return short_url;
  }
  
  async processUPIPayment(amount: number, orderId: string) {
    // Generate UPI QR code
    const upiString = `upi://pay?pa=yourvpa@bank&pn=YourSalon&am=${amount}&tr=${orderId}&cu=INR`;
    return upiString; // Display as QR code
  }
}
```

### Option 2: Razorpay POS Integration (Best for India)

#### Setup Steps:
1. **Get Razorpay POS device** (₹5,000-15,000):
   - All-in-One POS (Android tablet + printer + card reader)
   - Smart POS with dock
   - Mini Android POS

2. **Razorpay API Integration**:

```typescript
// lib/razorpay/pos-terminal.ts
export class RazorpayPOSTerminal {
  private apiKey: string;
  private apiSecret: string;
  
  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }
  
  async createTerminalOrder(amount: number, receiptId: string) {
    const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: 'INR',
        receipt: receiptId,
        payment_capture: 1
      })
    });
    
    return await response.json();
  }
  
  async printReceipt(orderId: string) {
    // Razorpay POS has built-in printer
    // Trigger via API or their SDK
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      body: JSON.stringify({
        order_id: orderId,
        type: 'link',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`
      })
    });
    
    return await response.json();
  }
}
```

3. **Webhook Handler**:

```typescript
// app/api/razorpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  
  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
    
  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  const event = JSON.parse(body);
  
  if (event.event === 'payment.captured') {
    const supabase = await createClient();
    
    // Update invoice payment status
    await supabase
      .from('invoices')
      .update({
        payment_status: 'PAID',
        payment_method: 'CARD',
        razorpay_payment_id: event.payload.payment.entity.id
      })
      .eq('id', event.payload.payment.entity.notes.invoice_id);
  }
  
  return NextResponse.json({ received: true });
}
```

### Option 3: SUNMI Android POS (Most Flexible)

#### Build Native Android App

**Why SUNMI:**
- Built-in thermal printer (58mm/80mm)
- Card reader integration
- Cash drawer support via USB/Bluetooth
- Developer SDK: https://developer.sunmi.com/
- Price: ₹15,000-40,000

**Implementation:**

```kotlin
// Android app for SUNMI device
class POSActivity : AppCompatActivity() {
    private var sunmiPrinter: SunmiPrinterService? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize SUNMI printer
        InnerPrinterManager.getInstance().bindService(this,
            object : InnerPrinterCallback() {
                override fun onConnected(service: SunmiPrinterService?) {
                    sunmiPrinter = service
                }
                
                override fun onDisconnected() {
                    sunmiPrinter = null
                }
            }
        )
    }
    
    fun printReceipt(invoice: Invoice) {
        sunmiPrinter?.let { printer ->
            printer.setAlignment(1, null) // Center
            printer.printText("Your Salon Name\n", null)
            printer.printText("------------------------\n", null)
            printer.setAlignment(0, null) // Left
            printer.printText("Invoice: ${invoice.id}\n", null)
            printer.printText("Date: ${invoice.date}\n", null)
            printer.printText("------------------------\n", null)
            
            invoice.items.forEach { item ->
                printer.printText("${item.name} x${item.qty}\n", null)
                printer.printText("  Rs ${item.total}\n", null)
            }
            
            printer.printText("------------------------\n", null)
            printer.printText("Total: Rs ${invoice.total}\n", null)
            printer.printText("\n\n\n", null)
            printer.cutPaper(null)
        }
    }
    
    fun openCashDrawer() {
        // SUNMI cash drawer opens via printer port
        val openCommand = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        sunmiPrinter?.sendRAWData(openCommand, null)
    }
}
```

**Web Integration via WebView:**
Load your Next.js POS app in WebView and expose native functions via JavaScript interface.

### Option 4: Progressive Web App + Cloud Print (No Hardware)

#### Use Cloud-based solutions:
1. **Google Cloud Print** (deprecated) alternatives:
   - PrintNode (https://www.printnode.com/)
   - ezeep (https://www.ezeep.com/)

2. **Implementation**:

```typescript
// lib/cloud-print/printnode.ts
export class CloudPrinter {
  private apiKey: string;
  
  async listPrinters() {
    const response = await fetch('https://api.printnode.com/printers', {
      headers: {
        'Authorization': `Basic ${btoa(this.apiKey)}`
      }
    });
    return await response.json();
  }
  
  async printReceipt(printerId: number, receiptHTML: string) {
    const printJob = {
      printerId: printerId,
      title: 'Receipt',
      contentType: 'pdf_uri',
      content: `https://yourdomain.com/api/receipts/${receiptHTML}`,
      source: 'Salon POS'
    };
    
    const response = await fetch('https://api.printnode.com/printjobs', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(this.apiKey)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printJob)
    });
    
    return await response.json();
  }
}
```

## Recommended Implementation for Your Salon

### Phase 1: Immediate (No Hardware)
1. **QR Code Payments** (UPI/Razorpay Payment Links)
2. **Email/WhatsApp Receipts** (Already have WhatsApp integration)
3. **Browser Print** for receipts

### Phase 2: Basic Hardware (₹5,000-10,000)
1. **USB Thermal Printer** (Epson TM-T82/Star TSP143)
2. **Cash Drawer** connected to printer
3. Implement Web USB API for printing

### Phase 3: Full POS Hardware (₹20,000-40,000)
1. **SUNMI P2/T2** Android POS device OR
2. **Razorpay All-in-One POS**
3. Build Android app or use WebView

## Implementation Files Needed

Create these files in your project:

```
lib/hardware/
  ├── thermal-printer.ts      # Web USB thermal printer
  ├── cash-drawer.ts          # Cash drawer control
  ├── payment-terminal.ts     # Card payment integration
  └── receipt-builder.ts      # ESC/POS command builder

app/api/payments/
  ├── razorpay/
  │   ├── create-order/route.ts
  │   └── webhook/route.ts
  └── receipts/
      └── [id]/route.ts        # Generate receipt PDF

components/pos/
  ├── PaymentModal.tsx         # Payment method selector
  ├── PrinterSetup.tsx         # Printer configuration
  └── ReceiptPreview.tsx       # Preview before print
```

## Testing Without Hardware

Use **Escpos-printer-simulator**:
```bash
npm install escpos-printer-simulator
```

## Cost Breakdown (India)

| Option | Hardware Cost | Setup Time | Best For |
|--------|--------------|------------|----------|
| QR/Payment Links | ₹0 | 1 day | Small salons |
| USB Printer + Drawer | ₹5,000-10,000 | 3-5 days | Medium salons |
| Razorpay POS | ₹10,000-15,000 | 5-7 days | Multi-location |
| SUNMI POS | ₹15,000-40,000 | 2-3 weeks | Enterprise |

## Next Steps

1. **Immediate**: Update POS page to generate payment QR codes
2. **Week 1**: Add thermal printer support via Web USB
3. **Week 2**: Integrate Razorpay POS API
4. **Month 1**: Test with actual hardware

Would you like me to implement any specific option?
