'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThermalPrinter, getPrinterInstance } from '@/lib/hardware/thermal-printer';
import { Printer, Zap, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';

export function PrinterSetup() {
  const [printer, setPrinter] = useState<ThermalPrinter>(getPrinterInstance());
  const [isConnected, setIsConnected] = useState(false);
  const [printerInfo, setPrinterInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (!ThermalPrinter.isSupported()) {
        throw new Error('Web USB not supported. Please use Chrome, Edge, or Opera browser.');
      }

      await printer.connect();
      setIsConnected(true);
      setPrinterInfo(printer.getInfo());
    } catch (err: any) {
      setError(err.message);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await printer.disconnect();
      setIsConnected(false);
      setPrinterInfo(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestPrint = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await printer.testPrint();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      await printer.openCashDrawer();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              USB Thermal Printer
            </CardTitle>
            <CardDescription>
              Connect your USB thermal printer - No commission fees!
            </CardDescription>
          </div>
          {isConnected && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Printer Info */}
        {printerInfo && (
          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Printer Name:</span>
              <span className="text-sm font-medium">{printerInfo.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Manufacturer:</span>
              <span className="text-sm font-medium">{printerInfo.manufacturer}</span>
            </div>
          </div>
        )}

        {/* Compatible Printers Info */}
        {!isConnected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Compatible Printers:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  <li>Epson TM-T82, TM-T88 series (₹5,000-8,000)</li>
                  <li>Xprinter XP-58, XP-80 series (₹2,500-4,000)</li>
                  <li>Star TSP143, TSP654 (₹6,000-10,000)</li>
                  <li>Citizen CT-S310, CT-S651 (₹5,000-8,000)</li>
                </ul>
                <p className="text-sm mt-2 flex items-center gap-1 text-green-600">
                  <DollarSign className="h-4 w-4" />
                  One-time cost only • No monthly fees • No commissions
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isConnected ? (
            <Button 
              onClick={handleConnect} 
              disabled={isLoading}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isLoading ? 'Connecting...' : 'Connect Printer'}
            </Button>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={handleTestPrint}
                disabled={isLoading}
              >
                <Printer className="h-4 w-4 mr-2" />
                Test Print
              </Button>
              <Button 
                variant="outline"
                onClick={handleOpenDrawer}
                disabled={isLoading}
              >
                <Zap className="h-4 w-4 mr-2" />
                Open Drawer
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>

        {/* Browser Compatibility Notice */}
        {!ThermalPrinter.isSupported() && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your browser doesn't support Web USB. Please use Chrome, Edge, or Opera.
            </AlertDescription>
          </Alert>
        )}

        {/* Setup Instructions */}
        {!isConnected && (
          <div className="text-sm text-muted-foreground space-y-1 border-t pt-4">
            <p className="font-medium">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Connect USB thermal printer to computer</li>
              <li>Install printer drivers if needed</li>
              <li>Click "Connect Printer" button above</li>
              <li>Select your printer from the list</li>
              <li>Grant USB access permission</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
