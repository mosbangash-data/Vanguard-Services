const ticketPrintMessages = {
  fr: { title: 'Billet', options: 'Options d’impression', format: 'Format :', print: 'Imprimer', printerHelp: 'Les imprimantes Bluetooth ou intégrées utilisent le service d’impression du terminal.', ariaTicket: 'Billet de voyage Vanguard Coach', transportTicket: 'BILLET DE TRANSPORT', route: 'Trajet', tripDetails: 'Détails du voyage', date: 'Date', departure: 'Départ', seat: 'Siège', bus: 'Bus', travelClass: 'Classe', passenger: 'Passager', price: 'PRIX', scan: "SCANNEZ À L'EMBARQUEMENT", qr: 'QR code sécurisé du billet', present: 'Présentez ce billet au contrôleur.', restrictions: 'Non remboursable · Non échangeable', luggage: 'Bagages sous la responsabilité du voyageur', thanks: 'Merci de voyager avec', issued: 'Émis le' },
  en: { title: 'Ticket', options: 'Print options', format: 'Format:', print: 'Print', printerHelp: 'Bluetooth and built-in printers use the device print service.', ariaTicket: 'Vanguard Coach travel ticket', transportTicket: 'TRAVEL TICKET', route: 'Route', tripDetails: 'Trip details', date: 'Date', departure: 'Departure', seat: 'Seat', bus: 'Bus', travelClass: 'Class', passenger: 'Passenger', price: 'PRICE', scan: 'SCAN AT BOARDING', qr: 'Secure ticket QR code', present: 'Present this ticket to the inspector.', restrictions: 'Non-refundable · Non-exchangeable', luggage: 'Luggage remains the passenger’s responsibility', thanks: 'Thank you for travelling with', issued: 'Issued on' },
  sw: { title: 'Tiketi', options: 'Chaguo za kuchapisha', format: 'Muundo:', print: 'Chapisha', printerHelp: 'Printa za Bluetooth au zilizojengewa ndani hutumia huduma ya uchapishaji ya kifaa.', ariaTicket: 'Tiketi ya safari ya Vanguard Coach', transportTicket: 'TIKETI YA USAFIRI', route: 'Njia', tripDetails: 'Maelezo ya safari', date: 'Tarehe', departure: 'Kuondoka', seat: 'Kiti', bus: 'Basi', travelClass: 'Daraja', passenger: 'Abiria', price: 'BEI', scan: 'CHANGANUA WAKATI WA KUPANDA', qr: 'Msimbo salama wa QR wa tiketi', present: 'Onyesha tiketi hii kwa mkaguzi.', restrictions: 'Hairudishwi pesa · Haibadilishwi', luggage: 'Abiria anawajibika kwa mizigo yake', thanks: 'Asante kwa kusafiri na', issued: 'Imetolewa tarehe' },
}

function getTicketPrintMessages(locale) {
  const lang = locale === 'en' || locale === 'sw' ? locale : 'fr'
  return { lang, ...ticketPrintMessages[lang] }
}

module.exports = { getTicketPrintMessages }
