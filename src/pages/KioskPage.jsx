import { useEffect, useRef, useState } from 'react'
import { supabasePublic } from '../supabase'

const COUNTDOWN_SECONDS = 10
const APPOINTMENT_TYPES = ['Scheduled Advising Appointment', 'Office Hours: Drop-In']
const DROP_IN_TYPE = 'Office Hours: Drop-In'
const NEXT_AVAILABLE = 'next-available'

const inputClass =
  'w-full border rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#73000a] focus:border-transparent transition-colors'
const inputNormal = `${inputClass} border-gray-300`
const inputError  = `${inputClass} border-red-400 bg-red-50`

function FieldError({ msg }) {
  if (!msg) return null
  return (
    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
      <span aria-hidden>⚠</span> {msg}
    </p>
  )
}

export default function KioskPage() {
  const [step, setStep] = useState('form') // 'form' | 'success'
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [countdown, setCountdown]     = useState(COUNTDOWN_SECONDS)
  const countdownRef = useRef(null)

  // Reference data
  const [colleges, setColleges]                 = useState([])
  const [allAdvisors, setAllAdvisors]           = useState([])
  const [allMajors, setAllMajors]               = useState([])
  const [allAdvisorMajors, setAllAdvisorMajors] = useState([])
  const [loadingOptions, setLoadingOptions]     = useState(true)
  const [loadError, setLoadError]               = useState('')

  // Form values
  const [name, setName]                       = useState('')
  const [email, setEmail]                     = useState('')
  const [appointmentType, setAppointmentType] = useState('')
  const [collegeId, setCollegeId]             = useState('')
  const [majorId, setMajorId]                 = useState('')
  const [advisorId, setAdvisorId]             = useState('')
  const [notes, setNotes]                     = useState('')

  // Field errors
  const [nameError, setNameError]               = useState('')
  const [emailError, setEmailError]             = useState('')
  const [appointmentError, setAppointmentError] = useState('')
  const [collegeError, setCollegeError]         = useState('')
  const [majorError, setMajorError]             = useState('')
  const [advisorError, setAdvisorError]         = useState('')

  const [checkedInName, setCheckedInName] = useState('')

  const selectedCollege = colleges.find((c) => c.id === collegeId) ?? null
  const showMajorDropdown = !!selectedCollege?.show_major_dropdown

  const filteredMajors = collegeId
    ? allMajors.filter((m) => m.college_id === collegeId)
    : []

  const filteredAdvisors = (() => {
    if (!collegeId) return []
    let byCollege = allAdvisors.filter((a) => a.college_id === collegeId)
    // For drop-in, only show advisors available for office hours
    if (appointmentType === DROP_IN_TYPE) {
      byCollege = byCollege.filter((a) => a.office_hours_available)
    }
    if (!showMajorDropdown || !majorId) return byCollege
    const majorsByAdvisor = new Map()
    for (const { advisor_id, major_id } of allAdvisorMajors) {
      if (!majorsByAdvisor.has(advisor_id)) majorsByAdvisor.set(advisor_id, new Set())
      majorsByAdvisor.get(advisor_id).add(major_id)
    }
    return byCollege.filter((a) => {
      const assigned = majorsByAdvisor.get(a.id)
      return !assigned || assigned.size === 0 || assigned.has(majorId)
    })
  })()

  useEffect(() => {
    async function loadOptions() {
      try {
        const [
          { data: collegeData,       error: collegeErr       },
          { data: advisorData,       error: advisorErr       },
          { data: majorData,         error: majorErr         },
          { data: advisorMajorData,  error: advisorMajorErr  },
        ] = await Promise.all([
          supabasePublic
            .from('colleges')
            .select('id, name, show_major_dropdown')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabasePublic
            .from('advisors')
            .select('id, name, college_id, office_hours_available')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabasePublic
            .from('majors')
            .select('id, name, college_id')
            .eq('is_active', true)
            .order('name', { ascending: true }),
          supabasePublic
            .from('advisor_majors')
            .select('advisor_id, major_id'),
        ])
        if (collegeErr)      throw new Error(`Colleges: ${collegeErr.message}`)
        if (advisorErr)      throw new Error(`Advisors: ${advisorErr.message}`)
        if (majorErr)        throw new Error(`Majors: ${majorErr.message}`)
        if (advisorMajorErr) throw new Error(`Advisor majors: ${advisorMajorErr.message}`)
        setColleges(collegeData         || [])
        setAllAdvisors(advisorData      || [])
        setAllMajors(majorData          || [])
        setAllAdvisorMajors(advisorMajorData || [])
      } catch (err) {
        setLoadError(`Failed to load form options: ${err.message}`)
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  const handleAppointmentTypeChange = (e) => {
    const val = e.target.value
    setAppointmentType(val)
    if (appointmentError) setAppointmentError('')
    // Clear advisor selection since filtered list may change
    setAdvisorId('')
    setAdvisorError('')
  }

  const handleCollegeChange = (e) => {
    setCollegeId(e.target.value)
    setMajorId('')
    setMajorError('')
    setAdvisorId('')
    setAdvisorError('')
    if (collegeError) setCollegeError('')
  }

  const handleMajorChange = (e) => {
    setMajorId(e.target.value)
    setAdvisorId('')
    setAdvisorError('')
    if (majorError) setMajorError('')
  }

  useEffect(() => {
    if (step !== 'success') return
    setCountdown(COUNTDOWN_SECONDS)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current)
          handleReset()
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [step])

  const handleReset = () => {
    clearInterval(countdownRef.current)
    setStep('form')
    setName('')
    setEmail('')
    setAppointmentType('')
    setCollegeId('')
    setMajorId('')
    setAdvisorId('')
    setNotes('')
    setNameError('')
    setEmailError('')
    setAppointmentError('')
    setCollegeError('')
    setMajorError('')
    setAdvisorError('')
    setSubmitError('')
  }

  const validateEmail = (val) => {
    if (!val) return 'Email is required.'
    if (!val.toLowerCase().endsWith('sc.edu')) return 'Email must end in sc.edu.'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')

    const nErr  = name.trim()       ? '' : 'Full name is required.'
    const eErr  = validateEmail(email)
    const apErr = appointmentType   ? '' : 'Please select an appointment type.'
    const cErr  = collegeId         ? '' : 'Please select your college.'
    const mErr  = showMajorDropdown && !majorId ? 'Please select your major.' : ''
    const aErr  = advisorId         ? '' : 'Please select an advisor.'

    setNameError(nErr)
    setEmailError(eErr)
    setAppointmentError(apErr)
    setCollegeError(cErr)
    setMajorError(mErr)
    setAdvisorError(aErr)

    if (nErr || eErr || apErr || cErr || mErr || aErr) return

    setSubmitting(true)
    try {
      const selectedMajor = allMajors.find((m) => m.id === majorId)

      const { error: dbError } = await supabasePublic.from('queue').insert([{
        student_name:     name.trim(),
        student_email:    email.trim().toLowerCase(),
        advisor_id:       advisorId === NEXT_AVAILABLE ? null : advisorId,
        college_id:       collegeId,
        major:            selectedMajor?.name ?? null,
        appointment_type: appointmentType,
        notes:            notes.trim() || null,
        status:           'waiting',
        checked_in_at:    new Date().toISOString(),
      }])
      if (dbError) throw dbError
      setCheckedInName(name.trim())
      setStep('success')
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'success') {
    const pct = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100
    return (
      <div className="min-h-screen bg-[#73000a] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-10 text-center">
          <div className="w-24 h-24 rounded-full bg-[#CED318] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-3xl font-bold text-[#73000a] mb-3">You're checked in!</h2>
          <p className="text-gray-700 text-lg mb-2">
            Welcome, <span className="font-semibold">{checkedInName}</span>.
          </p>
          <p className="text-gray-500 mb-8">
            Your advisor will be with you shortly. Please have a seat.
          </p>

          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none" stroke="#73000a" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[#73000a]">
                {countdown}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Returning to check-in in {countdown} second{countdown !== 1 ? 's' : ''}…
            </p>
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-[#73000a] text-white py-3 rounded-lg font-semibold hover:bg-[#570008] transition-colors"
          >
            Check In Another Student
          </button>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#73000a] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">

        {/* Header */}
        <div className="bg-[#73000a] px-8 py-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-px bg-white" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">
              University of South Carolina
            </span>
            <div className="w-8 h-px bg-white" />
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Welcome to Academic Advising
          </h1>
          <p className="text-white mt-2 text-base">Please check in below.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-8 py-7 space-y-5">

          {/* 1. Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Student Full Name <span className="text-[#CC2E40]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError('') }}
              onBlur={() => setNameError(name.trim() ? '' : 'Full name is required.')}
              placeholder="Your full name"
              className={nameError ? inputError : inputNormal}
              autoComplete="off"
            />
            <FieldError msg={nameError} />
          </div>

          {/* 2. USC Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              USC Email <span className="text-[#CC2E40]">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(validateEmail(e.target.value)) }}
              onBlur={() => setEmailError(validateEmail(email))}
              placeholder="yourname@sc.edu"
              className={emailError ? inputError : inputNormal}
              autoComplete="off"
              inputMode="email"
            />
            <FieldError msg={emailError} />
          </div>

          {/* 3. Appointment Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Appointment Type <span className="text-[#CC2E40]">*</span>
            </label>
            <select
              value={appointmentType}
              onChange={handleAppointmentTypeChange}
              onBlur={() => setAppointmentError(appointmentType ? '' : 'Please select an appointment type.')}
              className={`${appointmentError ? inputError : inputNormal} bg-white`}
            >
              <option value="">Select an appointment type...</option>
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <FieldError msg={appointmentError} />
          </div>

          {/* 4. College */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              College <span className="text-[#CC2E40]">*</span>
            </label>
            <select
              value={collegeId}
              onChange={handleCollegeChange}
              onBlur={() => setCollegeError(collegeId ? '' : 'Please select your college.')}
              disabled={loadingOptions}
              className={`${collegeError ? inputError : inputNormal} bg-white disabled:opacity-60`}
            >
              <option value="">
                {loadingOptions ? 'Loading…' : 'Select your college...'}
              </option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError msg={collegeError} />
          </div>

          {/* 5. Major (conditional) */}
          {showMajorDropdown && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Major <span className="text-[#CC2E40]">*</span>
              </label>
              <select
                value={majorId}
                onChange={handleMajorChange}
                onBlur={() => setMajorError(majorId ? '' : 'Please select your major.')}
                disabled={loadingOptions || !collegeId}
                className={`${majorError ? inputError : inputNormal} bg-white disabled:opacity-60`}
              >
                <option value="">
                  {filteredMajors.length === 0 ? 'No majors available' : 'Select your major...'}
                </option>
                {filteredMajors.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <FieldError msg={majorError} />
            </div>
          )}

          {/* 6. Advisor */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Select Your Advisor <span className="text-[#CC2E40]">*</span>
            </label>
            <select
              value={advisorId}
              onChange={(e) => { setAdvisorId(e.target.value); if (advisorError) setAdvisorError('') }}
              onBlur={() => setAdvisorError(advisorId ? '' : 'Please select an advisor.')}
              disabled={loadingOptions || !collegeId || (showMajorDropdown && !majorId)}
              className={`${advisorError ? inputError : inputNormal} bg-white disabled:opacity-60`}
            >
              <option value="">
                {!collegeId
                  ? 'Select a college first'
                  : showMajorDropdown && !majorId
                  ? 'Select a major first'
                  : filteredAdvisors.length === 0 && appointmentType === DROP_IN_TYPE
                  ? 'No advisors currently available for drop-in'
                  : filteredAdvisors.length === 0
                  ? 'No advisors available'
                  : 'Select your advisor...'}
              </option>
              {appointmentType === DROP_IN_TYPE && collegeId && filteredAdvisors.length > 0 && (
                <option value={NEXT_AVAILABLE}>Next Available</option>
              )}
              {filteredAdvisors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <FieldError msg={advisorError} />
          </div>

          {/* 7. Notes for advisor (optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notes for Advisor <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you'd like your advisor to know before your appointment…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-[#73000a] focus:border-transparent transition-colors resize-none"
            />
          </div>

          {/* Load error */}
          {loadError && (
            <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{loadError}</span>
            </div>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{submitError}</span>
            </div>
          )}

          {/* 8. Submit */}
          <button
            type="submit"
            disabled={submitting || loadingOptions}
            className="w-full bg-[#73000a] text-white font-bold py-3.5 rounded-lg hover:bg-[#570008] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-2 shadow-md mt-2"
          >
            {submitting ? (
              <>
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Checking In…
              </>
            ) : (
              'Check In'
            )}
          </button>
        </form>
      </div>

      <p className="text-red-200 text-xs mt-5">
        Need help? Ask the front desk staff for assistance.
      </p>
    </div>
  )
}
