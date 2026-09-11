import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

const STEPS = [
  'Open your phone camera and scan the code above.',
  'Fill out the check-in form: your name, USC email, college, and advisor.',
  'Have a seat — your advisor will be notified the moment you check in.',
]

export default function SignPage() {
  const [qrSvg, setQrSvg] = useState('')

  useEffect(() => {
    const kioskUrl = `${window.location.origin}/kiosk`
    QRCode.toString(kioskUrl, {
      type: 'svg',
      margin: 0,
      color: { dark: '#73000a', light: '#ffffff' },
    }).then(setQrSvg)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white flex flex-col items-center py-8 px-4 print:p-0">
      <button
        onClick={() => window.print()}
        className="mb-6 bg-[var(--nav-fill)] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[var(--hover-color)] transition-colors print:hidden"
      >
        Print Sign
      </button>

      {/* Printable sign — sized to fill a letter page */}
      <div className="bg-white rounded-2xl shadow-2xl print:shadow-none print:rounded-none w-full max-w-3xl print:max-w-none border-8 border-[var(--link-color)] print:border-[12px] p-10 print:p-16 print:w-[8.5in] print:h-[11in] flex flex-col items-center text-center">

        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-px bg-white" />
          <span className="text-white text-sm font-bold uppercase tracking-widest">
            University of South Carolina
          </span>
          <div className="w-10 h-px bg-white" />
        </div>

        <h1 className="text-4xl print:text-5xl font-bold text-[var(--primary)] leading-tight mb-2">
          Advising Check-In
        </h1>
        <p className="text-gray-600 text-lg print:text-xl mb-8">
          Scan the QR code below with your phone to check in.
        </p>

        <div
          className="w-64 h-64 print:w-80 print:h-80 mb-8 [&_svg]:w-full [&_svg]:h-full"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />

        <ol className="text-left space-y-3 max-w-md w-full mb-8">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-none w-7 h-7 rounded-full bg-[var(--nav-fill)] text-white text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-gray-800 text-base print:text-lg pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <p className="text-sm print:text-base text-gray-400 mt-auto">
          No phone or no signal? Ask the front desk for help checking in.
        </p>
      </div>
    </div>
  )
}
