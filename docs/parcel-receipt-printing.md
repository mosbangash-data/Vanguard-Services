# Parcel receipt printing

The parcel receipt is rendered by the browser from the existing receipt endpoint. The selected format is sent as `GET /api/parcels/:id/receipt?format=a4|58mm|80mm|110mm`; the endpoint validates the value and returns the same parcel and signed QR payload for reprints.

Available layouts are A4, 58 mm, 80 mm, and 110 mm. The thermal layouts set a roll-width page size and remove page margins; the browser's print dialog should use the matching paper width, no extra margins, and 100% scale where the printer driver exposes those options. The 110 mm option is only useful with a printer and driver that support that width.

This is browser printing, not direct ESC/POS or operating-system printer control. Browser, terminal print service, operating-system driver, paper configuration, and printer firmware can override page size, margins, scaling, or page length. A browser preview can confirm layout CSS, but physical feed, cutting, darkness, QR readability, and built-in/Bluetooth printer integration require testing on the target device. No physical printer was available in this code task.
