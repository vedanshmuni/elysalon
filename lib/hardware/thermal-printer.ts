/**
 * Thermal Printer Support via Web USB API
 * Compatible with ESC/POS printers (Epson, Star Micronics, Citizen, etc.)
 * No commission fees - direct USB connection
 */

export interface ReceiptData {
  businessName: string;
  address?: string;
  phone?: string;
  gst?: string;
  invoiceNumber: string;
  date: string;
  time: string;
  clientName?: string;
  clientPhone?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
  staffName?: string;
  footer?: string;
}

export class ThermalPrinter {
  private device: USBDevice | null = null;
  private endpointOut: number = 1;
  
  // Common thermal printer vendor IDs
  private static VENDOR_IDS = [
    { vendorId: 0x04b8, name: 'Epson' },       // Epson TM series
    { vendorId: 0x0519, name: 'Star Micronics' }, // Star TSP series
    { vendorId: 0x0416, name: 'Citizen' },     // Citizen CT-S series
    { vendorId: 0x1504, name: 'Xprinter' },    // Xprinter XP series
    { vendorId: 0x154f, name: 'Bixolon' },     // Bixolon SRP series
  ];

  /**
   * Check if Web USB is supported in browser
   */
  static isSupported(): boolean {
    return 'usb' in navigator;
  }

  /**
   * Request user to select and connect to USB printer
   */
  async connect(): Promise<boolean> {
    if (!ThermalPrinter.isSupported()) {
      throw new Error('Web USB is not supported in this browser. Please use Chrome, Edge, or Opera.');
    }

    try {
      // Request device access
      this.device = await navigator.usb.requestDevice({
        filters: ThermalPrinter.VENDOR_IDS
      });

      if (!this.device) {
        throw new Error('No device selected');
      }

      // Open device
      await this.device.open();
      
      // Select configuration
      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      // Claim interface
      await this.device.claimInterface(0);

      console.log('Printer connected:', this.device.productName);
      return true;
    } catch (error: any) {
      console.error('Failed to connect to printer:', error);
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.device && this.device.opened) {
      try {
        await this.device.releaseInterface(0);
        await this.device.close();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
      this.device = null;
    }
  }

  /**
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.device !== null && this.device.opened;
  }

  /**
   * Print receipt
   */
  async printReceipt(data: ReceiptData): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer not connected');
    }

    const commands = this.buildReceiptCommands(data);
    await this.sendData(commands);
  }

  /**
   * Open cash drawer (connected to printer)
   */
  async openCashDrawer(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer not connected');
    }

    // ESC p m t1 t2 - Standard cash drawer command
    const command = new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]);
    await this.sendData(command);
  }

  /**
   * Test print
   */
  async testPrint(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Printer not connected');
    }

    const encoder = new TextEncoder();
    const ESC = 0x1B;
    const GS = 0x1D;

    const commands = new Uint8Array([
      ESC, 0x40, // Initialize printer
      ESC, 0x61, 0x01, // Center align
      ...encoder.encode('TEST PRINT\n'),
      ...encoder.encode('Printer Working!\n'),
      ...encoder.encode(new Date().toLocaleString('en-IN') + '\n\n\n'),
      GS, 0x56, 0x00, // Cut paper
    ]);

    await this.sendData(commands);
  }

  /**
   * Build ESC/POS commands for receipt
   */
  private buildReceiptCommands(data: ReceiptData): Uint8Array {
    const encoder = new TextEncoder();
    const commands: number[] = [];
    
    const ESC = 0x1B;
    const GS = 0x1D;
    
    // Initialize
    commands.push(ESC, 0x40);
    
    // Header - Center aligned
    commands.push(ESC, 0x61, 0x01); // Center
    commands.push(ESC, 0x21, 0x30); // Double width & height
    commands.push(...encoder.encode(data.businessName + '\n'));
    
    // Normal size
    commands.push(ESC, 0x21, 0x00);
    
    if (data.address) {
      commands.push(...encoder.encode(data.address + '\n'));
    }
    if (data.phone) {
      commands.push(...encoder.encode('Ph: ' + data.phone + '\n'));
    }
    if (data.gst) {
      commands.push(...encoder.encode('GST: ' + data.gst + '\n'));
    }
    
    commands.push(...encoder.encode('\n'));
    
    // Invoice details - Left aligned
    commands.push(ESC, 0x61, 0x00); // Left align
    commands.push(...encoder.encode('--------------------------------\n'));
    commands.push(...encoder.encode(`Invoice: ${data.invoiceNumber}\n`));
    commands.push(...encoder.encode(`Date: ${data.date} ${data.time}\n`));
    
    if (data.clientName) {
      commands.push(...encoder.encode(`Client: ${data.clientName}\n`));
    }
    if (data.clientPhone) {
      commands.push(...encoder.encode(`Phone: ${data.clientPhone}\n`));
    }
    if (data.staffName) {
      commands.push(...encoder.encode(`Staff: ${data.staffName}\n`));
    }
    
    commands.push(...encoder.encode('--------------------------------\n'));
    
    // Items
    data.items.forEach(item => {
      const itemLine = `${item.name}\n`;
      const priceLine = `  ${item.quantity} x Rs ${item.price.toFixed(2)} = Rs ${item.total.toFixed(2)}\n`;
      commands.push(...encoder.encode(itemLine));
      commands.push(...encoder.encode(priceLine));
    });
    
    commands.push(...encoder.encode('--------------------------------\n'));
    
    // Totals
    commands.push(...encoder.encode(`Subtotal:${' '.repeat(15)}Rs ${data.subtotal.toFixed(2)}\n`));
    
    if (data.discount > 0) {
      commands.push(...encoder.encode(`Discount:${' '.repeat(15)}Rs ${data.discount.toFixed(2)}\n`));
    }
    
    if (data.tax > 0) {
      commands.push(...encoder.encode(`Tax (GST):${' '.repeat(14)}Rs ${data.tax.toFixed(2)}\n`));
    }
    
    commands.push(...encoder.encode('--------------------------------\n'));
    
    // Total - Bold
    commands.push(ESC, 0x21, 0x08); // Bold
    commands.push(...encoder.encode(`TOTAL:${' '.repeat(17)}Rs ${data.total.toFixed(2)}\n`));
    commands.push(ESC, 0x21, 0x00); // Normal
    
    commands.push(...encoder.encode('--------------------------------\n'));
    
    // Payment details
    commands.push(...encoder.encode(`Payment: ${data.paymentMethod}\n`));
    commands.push(...encoder.encode(`Paid:${' '.repeat(20)}Rs ${data.paid.toFixed(2)}\n`));
    
    if (data.change > 0) {
      commands.push(...encoder.encode(`Change:${' '.repeat(18)}Rs ${data.change.toFixed(2)}\n`));
    }
    
    commands.push(...encoder.encode('\n'));
    
    // Footer - Center aligned
    commands.push(ESC, 0x61, 0x01); // Center
    
    if (data.footer) {
      commands.push(...encoder.encode(data.footer + '\n'));
    }
    
    commands.push(...encoder.encode('Thank You! Visit Again\n'));
    commands.push(...encoder.encode('\n\n\n'));
    
    // Cut paper
    commands.push(GS, 0x56, 0x00);
    
    return new Uint8Array(commands);
  }

  /**
   * Send raw data to printer
   */
  private async sendData(data: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error('Device not connected');
    }

    try {
      await this.device.transferOut(this.endpointOut, data);
    } catch (error: any) {
      console.error('Print error:', error);
      throw new Error(`Print failed: ${error.message}`);
    }
  }

  /**
   * Get printer info
   */
  getInfo(): { name: string; manufacturer: string; connected: boolean } | null {
    if (!this.device) return null;
    
    return {
      name: this.device.productName || 'Unknown',
      manufacturer: this.device.manufacturerName || 'Unknown',
      connected: this.device.opened
    };
  }
}

// Singleton instance
let printerInstance: ThermalPrinter | null = null;

export function getPrinterInstance(): ThermalPrinter {
  if (!printerInstance) {
    printerInstance = new ThermalPrinter();
  }
  return printerInstance;
}
