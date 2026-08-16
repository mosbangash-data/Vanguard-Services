import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { useLanguage } from '../../../i18n/useLanguage'
import { api } from '../../../services/api'

export function TicketScanner({ onClose }) {
  const { t } = useLanguage()
  const scannerRef = useRef(null)
  const isProcessingRef = useRef(false)
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [manualCode, setManualCode] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const scanMessage = (key, fallback) => {
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const getCameraErrorMessage = (cameraError) => {
    const name = cameraError?.name || ''
    const message = String(cameraError?.message || cameraError || '').toLowerCase()
    if (!navigator.mediaDevices?.getUserMedia) return scanMessage('scan.cameraUnsupported', 'Votre navigateur ne prend pas en charge l acces a la camera.')
    if (name === 'NotAllowedError' || message.includes('permission') || message.includes('notallowed')) return scanMessage('scan.cameraPermissionDenied', 'L acces a la camera a ete refuse. Autorisez la camera puis reessayez.')
    if (name === 'NotFoundError' || message.includes('notfound')) return scanMessage('scan.cameraUnavailable', 'Aucune camera utilisable n a ete detectee sur cet appareil.')
    if (name === 'NotReadableError' || message.includes('notreadable') || message.includes('trackstart')) return scanMessage('scan.cameraBusy', 'La camera est deja utilisee par une autre application. Fermez-la puis reessayez.')
    return t('scan.cameraError')
  }

  const startScanner = async () => {
    if (scannerRef.current || isProcessingRef.current) return
    setError(null)
    setResult(null)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t('scan.cameraUnsupported'))
        return
      }
      setIsScanning(true)
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (scannerRef.current) return
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScan(decodedText)
        },
        () => {}
      )
    } catch (cameraError) {
      setIsScanning(false)
      setError(getCameraErrorMessage(cameraError))
      scannerRef.current = null
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {
        // Ignore stop errors
      }
      scannerRef.current = null
    }
    setIsScanning(false)
  }

  const handleScan = async (code) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setIsProcessing(true)
    try {
      const res = await api.post('/api/tickets/scan', { qrCode: code })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.message || t('scan.invalid'))
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
      await stopScanner()
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (manualCode.trim()) {
      handleScan(manualCode.trim())
    }
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear()
        scannerRef.current = null
      }
    }
  }, [])

  const resultClass = result?.valid
    ? 'scan-result scan-result--success'
    : result
      ? 'scan-result scan-result--error'
      : ''

  const resultMessage = result?.valid
    ? t('scan.valid')
    : result?.status === 'USED'
      ? t('scan.alreadyUsed')
      : result?.status === 'NOT_FOUND'
        ? t('scan.notFound')
        : result?.status === 'CANCELLED'
          ? t('scan.cancelled')
          : result
            ? t('scan.invalid')
            : ''

  return (
    <div className="scanner-modal">
      <div className="scanner-modal__header">
        <h2>{t('scan.title')}</h2>
        <button type="button" className="scanner-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="scanner-modal__body">
        {!isScanning && !result && (
          <div className="scanner-start">
            <p>{t('scan.subtitle')}</p>
            <button type="button" className="button" onClick={startScanner}>
              {t('scan.startCamera')}
            </button>
          </div>
        )}

        {isScanning && (
          <div className="scanner-active">
            <div id="qr-reader" className="qr-reader" />
            <p className="scanner-status">{t('scan.scanning')}</p>
            <button type="button" className="button secondary" onClick={stopScanner}>
              {t('scan.stopCamera')}
            </button>
          </div>
        )}

        {error && <div className="alert alert-danger">{error}</div>}

        {result && (
          <div className={resultClass}>
            <div className="scan-result__icon">{result?.valid ? '✓' : '✗'}</div>
            <h3>{resultMessage}</h3>
            {result?.passengerName && <p><strong>{t('ticket.passenger')}:</strong> {result.passengerName}</p>}
            {result?.route && <p><strong>{t('ticket.route')}:</strong> {result.route}</p>}
            {result?.departureDate && <p><strong>{t('ticket.date')}:</strong> {result.departureDate}</p>}
            {result?.departureTime && <p><strong>{t('ticket.time')}:</strong> {result.departureTime}</p>}
            {result?.seatNumber && <p><strong>{t('ticket.seat')}:</strong> {result.seatNumber}</p>}
            {result?.ticketCode && <p><strong>{t('ticket.title')}:</strong> {result.ticketCode}</p>}
            <button type="button" className="button" onClick={() => { setResult(null); setError(null); startScanner() }}>
              {t('scan.startCamera')}
            </button>
          </div>
        )}

        <div className="scanner-manual">
          <h3>{t('scan.manualEntry')}</h3>
          <form onSubmit={handleManualSubmit}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={t('scan.manualPlaceholder')}
              className="form-control"
            />
            <button type="submit" className="button" disabled={isProcessing}>
              {t('scan.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
