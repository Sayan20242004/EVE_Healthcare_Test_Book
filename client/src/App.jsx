import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarDays, Check, Clock3, FlaskConical, Heart, LocateFixed, LoaderCircle, LogOut, MapPin, Menu, Search, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { api } from './api.js';
import { buildBookingPayload } from './bookingPayload.js';
import { buildCentreSearchParams, getCurrentCoordinates } from './locationSearch.js';
import { filterCentresByTest } from './testFilter.js';

const money = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); };

export default function App() {
  const [user, setUser] = useState(null), [token, setToken] = useState(localStorage.getItem('eve-token'));
  const [authOpen, setAuthOpen] = useState(false), [authMode, setAuthMode] = useState('login');
  const [search, setSearch] = useState(''), [centres, setCentres] = useState([]), [searched, setSearched] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [locationMode, setLocationMode] = useState('manual'), [resolvedLocation, setResolvedLocation] = useState(''), [locating, setLocating] = useState(false), [pendingGeoSearch, setPendingGeoSearch] = useState(false);
  const [tab, setTab] = useState('discover'), [selected, setSelected] = useState(null), [booking, setBooking] = useState(null), [bookings, setBookings] = useState([]), [mobileOpen, setMobileOpen] = useState(false), [toast, setToast] = useState('');

  useEffect(() => { if (token) api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => logout()); }, []);
  useEffect(() => { if (user && tab === 'tests') loadBookings(); }, [user, tab]);
  function logout() { localStorage.removeItem('eve-token'); setToken(null); setUser(null); setBookings([]); setTab('discover'); }
  async function loadBookings() { try { const { data } = await api.get('/bookings/my'); setBookings(data.bookings); } catch (e) { setError(e.message); } }
  async function runSearch(query, coordinates) {
    if (!coordinates && query.trim().length < 2) { setError('Enter a city, area, or centre name to search.'); return; }
    setLocationMode(coordinates ? 'current' : 'manual'); setResolvedLocation(''); setTestSearch('');
    setLoading(true); setError(''); setSearched(true);
    try {
      const { data } = await api.get('/centres/search', { params: buildCentreSearchParams(query, coordinates) });
      setCentres(data.centres);
      if (coordinates) setResolvedLocation(data.centres.find((centre) => centre.city)?.city || 'your current location');
    }
    catch (e) { setError(e.message); setCentres([]); }
    finally { setLoading(false); }
  }
  async function doSearch(event) {
    event?.preventDefault();
    if (!user) { setAuthMode('login'); setAuthOpen(true); return; }
    return runSearch(search);
  }
  async function useCurrentLocation(authenticated = Boolean(user)) {
    if (!authenticated) { setPendingGeoSearch(true); setAuthMode('login'); setAuthOpen(true); return; }
    setLocating(true); setError('');
    try { const coordinates = await getCurrentCoordinates(globalThis.navigator?.geolocation); await runSearch('', coordinates); }
    catch (e) { setError(e.message); }
    finally { setLocating(false); }
  }
  function notify(message) { setToast(message); setTimeout(() => setToast(''), 3500); }
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '';
  const filteredCentres = filterCentresByTest(centres, testSearch);

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => { setTab('discover'); setMobileOpen(false); }}><span className="brand-mark"><Heart size={18} fill="currentColor" /></span><span>EVE<span className="brand-light">health</span></span></a>
      <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
        <button className={tab === 'discover' ? 'nav-link active' : 'nav-link'} onClick={() => { setTab('discover'); setMobileOpen(false); }}>Find a test</button>
        {user && <button className={tab === 'tests' ? 'nav-link active' : 'nav-link'} onClick={() => { setTab('tests'); setMobileOpen(false); }}>My tests</button>}
      </nav>
      <div className="account-actions">
        {user ? <div className="account-menu"><div className="avatar">{initials}</div><span className="user-name">{user.name.split(' ')[0]}</span><button className="icon-button logout-button" title="Log out" onClick={logout}><LogOut size={17} /></button></div> : <button className="button button-dark button-small" onClick={() => setAuthOpen(true)}>Log in <ArrowRight size={15} /></button>}
      </div>
      <button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
    </header>

    <main>
      {tab === 'discover' ? <>
        <section className="hero" id="home">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> YOUR HEALTH, IN GOOD HANDS</div><h1>Care that comes<br />closer to <em>you.</em></h1><p>Find trusted diagnostic centres near you and book the tests you need, all in one simple place.</p>
            <form className="search-box" onSubmit={doSearch}><MapPin size={19} /><input value={search} onChange={(e) => { setSearch(e.target.value); setLocationMode('manual'); setResolvedLocation(''); }} placeholder="Enter a city or area" aria-label="Search location" /><button className="button button-green" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <><Search size={17} /> Search centres</>}</button></form>
            <button className="current-location-button" type="button" onClick={() => useCurrentLocation()} disabled={loading || locating}>{locating ? <LoaderCircle className="spin" size={16} /> : <LocateFixed size={16} />} {locating ? 'Finding your location…' : 'Use my current location'}</button>
            {locationMode === 'current' && <div className="location-context"><MapPin size={14} /> Searching near {resolvedLocation || 'your current location'} <span>Your precise location is used for this search only.</span></div>}
            {!user && <div className="search-note"><ShieldCheck size={15} /> Sign in to search and book diagnostic tests</div>}
          </div>
          <div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-circle"><div className="art-heart"><Heart size={68} strokeWidth={1.3} /></div><div className="art-plus plus-one">+</div><div className="art-plus plus-two">+</div><div className="art-stat"><span className="stat-icon"><Activity size={16} /></span><span><strong>Care, made easy</strong><small>Better health starts here</small></span><Check size={17} className="stat-check" /></div></div><div className="art-badge badge-top"><span>✦</span> Care you can trust</div><div className="art-badge badge-bottom"><span>♡</span> Your health matters</div></div>
        </section>
        <section className="trust-strip"><div><span className="trust-icon"><ShieldCheck size={18} /></span><span><strong>Trusted centres</strong><small>Quality care, close by</small></span></div><span className="strip-separator"/><div><span className="trust-icon"><CalendarDays size={18} /></span><span><strong>Easy scheduling</strong><small>Choose a time that works</small></span></div><span className="strip-separator"/><div><span className="trust-icon"><Heart size={18} /></span><span><strong>Care-first always</strong><small>Here for your wellbeing</small></span></div></section>
        <section className="content-section" id="centres"><div className="section-heading"><div><div className="eyebrow">DISCOVER NEAR YOU</div><h2>{searched ? `Centres near ${locationMode === 'current' ? (resolvedLocation || 'your current location') : search}` : 'Your next step starts here'}</h2><p>{searched ? 'Choose a centre to explore available tests and booking times.' : 'Search for diagnostic services and find the care that feels right.'}</p></div>{searched && <span className="result-count">{testSearch ? filteredCentres.length : centres.length} {(testSearch ? filteredCentres.length : centres.length) === 1 ? 'centre' : 'centres'} found</span>}</div>
          {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
          {!searched ? <div className="welcome-card"><div className="welcome-icon"><Stethoscope size={24} /></div><h3>Start with a search</h3><p>Enter a city or neighbourhood above to discover diagnostic centres and the tests they offer.</p><button className="text-button" onClick={() => document.querySelector('.search-box input')?.focus()}>Search your area <ArrowRight size={16} /></button></div>
          : loading ? <div className="loading-state"><LoaderCircle className="spin" size={28} /><span>Finding centres near you…</span></div>
          : centres.length ? <><label className="test-filter"><Search size={17} aria-hidden="true" /><input value={testSearch} onChange={(event) => setTestSearch(event.target.value)} placeholder="Search for a test..." aria-label="Search diagnostic tests" />{testSearch && <button type="button" onClick={() => setTestSearch('')} aria-label="Clear test search"><X size={16} /></button>}</label>{filteredCentres.length ? <div className="centre-grid">{filteredCentres.map((centre) => <CentreCard key={centre._id || centre.providerId || centre.name} centre={centre} onBook={async () => {
            if (!centre._id) { setError('This listing cannot be booked right now. Please try another centre.'); return; }
            try { const { data } = await api.get(`/centres/${centre._id}`); setSelected(data.centre); } catch (e) { setError(e.message); }
          }} />)}</div> : <div className="empty-state test-filter-empty"><div className="empty-icon"><Search size={21} /></div><h3>No centres found for this test</h3><p>Try another test name or clear your search to see all centres in this location.</p></div>}</>
          : <div className="empty-state"><div className="empty-icon"><Search size={21} /></div><h3>No centres found yet</h3><p>Try another area or nearby city. We’ll look again for you.</p><button className="button button-outline" onClick={() => { setSearched(false); setCentres([]); }}>Try another search</button></div>}
        </section>
      </> : <section className="content-section tests-page"><div className="section-heading"><div><div className="eyebrow">YOUR HEALTH JOURNEY</div><h2>My tests</h2><p>Keep track of your upcoming appointments and bookings.</p></div><button className="button button-outline" onClick={() => setTab('discover')}><Search size={16} /> Find a test</button></div>
        {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}
        {!bookings.length ? <div className="empty-state"><div className="empty-icon"><FlaskConical size={21} /></div><h3>No tests booked yet</h3><p>When you book a diagnostic test, it will appear here.</p><button className="button button-green" onClick={() => setTab('discover')}>Explore centres <ArrowRight size={16} /></button></div> : <div className="booking-list">{bookings.map((item) => <div className="booking-row" key={item._id}><div className="booking-icon"><FlaskConical size={20} /></div><div className="booking-info"><h3>{item.testName}</h3><p>{item.centreName} · {new Date(item.appointmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {item.appointmentTime}</p><span>{item.persons} {item.persons === 1 ? 'person' : 'people'}</span></div><div className="booking-right"><strong>{money(item.amount)}</strong><span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span></div>{item.status === 'PENDING' && <button className="button button-green pay-button" onClick={() => payBooking(item, loadBookings, notify, setError)}>Pay now</button>}</div>)}</div>}
      </section>}
    </main>

    <footer><a className="brand footer-brand" href="#home"><span className="brand-mark"><Heart size={15} fill="currentColor" /></span><span>EVE<span className="brand-light">health</span></span></a><p>Thoughtful care, made a little simpler.</p><span className="footer-copy">© 2026 EVE Healthcare</span></footer>
    {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => { setAuthOpen(false); setPendingGeoSearch(false); }} onSuccess={(data) => { localStorage.setItem('eve-token', data.token); setToken(data.token); setUser(data.user); setAuthOpen(false); if (pendingGeoSearch) { setPendingGeoSearch(false); useCurrentLocation(true); } else if (search.trim().length >= 2) runSearch(search); }} />}
    {selected && <BookingModal centre={selected} onClose={() => setSelected(null)} onCreated={(newBooking) => { setSelected(null); notify('Appointment reserved. Choose a simulated payment result to continue.'); setBooking(newBooking); }} />}
    {booking && <PaymentModal booking={booking} onClose={() => setBooking(null)} onDone={(message) => { setBooking(null); notify(message); loadBookings(); }} />}
    {toast && <div className="toast"><Check size={17} /> {toast}</div>}
  </div>;
}

function CentreCard({ centre, onBook }) {
  const tests = centre.tests || [];
  return <article className="centre-card"><div className="centre-card-top"><div className="centre-avatar"><Stethoscope size={20} /></div><span className="verified"><ShieldCheck size={14} /> Listed centre</span></div><h3>{centre.name}</h3><p className="centre-address"><MapPin size={15} /> {centre.address}{centre.city ? `, ${centre.city}` : ''}</p><div className="centre-meta"><span><Clock3 size={14} /> {centre.openingTime || 'Hours vary'} – {centre.closingTime || 'please check'}</span>{centre.phone && <a href={`tel:${centre.phone}`}>{centre.phone}</a>}</div><div className="test-preview">{tests.length ? <><span className="test-preview-label">AVAILABLE TESTS</span>{tests.slice(0, 2).map((test) => <div className="test-line" key={test.testId}><span>{test.name}</span><strong>{money(test.price)}</strong></div>)}</> : <div className="no-test-yet">Contact centre to confirm available tests and pricing</div>}</div><button className="button button-dark card-button" onClick={onBook}>View & book <ArrowRight size={16} /></button></article>;
}

function AuthModal({ mode, setMode, onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const { data } = await api.post(`/auth/${mode === 'signup' ? 'signup' : 'login'}`, form); onSuccess(data); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <Modal onClose={onClose} narrow><div className="auth-modal"><div className="modal-symbol"><Heart size={21} /></div><div className="eyebrow">WELCOME TO EVE</div><h2>{mode === 'signup' ? 'Create your account' : 'Good to see you'}</h2><p>{mode === 'signup' ? 'A little care goes a long way. Let’s get started.' : 'Sign in to find centres and manage your tests.'}</p><form onSubmit={submit} className="form-stack">{mode === 'signup' && <Field label="Your name" icon={<UserRound size={16} />}><input autoComplete="name" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength="2" /></Field>}<Field label="Email address" icon={<span>@</span>}><input type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field><Field label="Password" icon={<ShieldCheck size={16} />}><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={mode === 'signup' ? 8 : 1} /></Field>{error && <div className="inline-error">{error}</div>}<button className="button button-green full-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button></form><div className="switch-auth">{mode === 'signup' ? 'Already have an account?' : 'New to EVE?'} <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></div></div></Modal>;
}

function BookingModal({ centre, onClose, onCreated }) {
  const [details, setDetails] = useState({ testId: centre.tests?.[0]?.testId || '', appointmentDate: tomorrow(), appointmentTime: '', persons: 1 });
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const test = centre.tests?.find((item) => item.testId === details.testId);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const payload = buildBookingPayload(centre, details); const { data } = await api.post('/bookings', payload); onCreated(data.booking); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <Modal onClose={onClose}><div className="booking-modal"><div className="eyebrow">RESERVE YOUR VISIT</div><h2>Book a test</h2><p className="modal-centre"><MapPin size={15} /> {centre.name}</p>{centre.tests?.length ? <form className="form-stack" onSubmit={submit}><label className="field"><span>Diagnostic test</span><select required value={details.testId} onChange={(e) => setDetails({ ...details, testId: e.target.value })}>{centre.tests.map((item) => <option value={item.testId} key={item.testId}>{item.name} — {money(item.price)}</option>)}</select></label><div className="two-fields"><label className="field"><span>Date</span><input type="date" min={tomorrow()} value={details.appointmentDate} onChange={(e) => setDetails({ ...details, appointmentDate: e.target.value })} required /></label><label className="field"><span>Preferred time</span><input type="time" value={details.appointmentTime} onChange={(e) => setDetails({ ...details, appointmentTime: e.target.value })} required /></label></div><label className="field"><span>Number of people</span><select value={details.persons} onChange={(e) => setDetails({ ...details, persons: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>)}</select></label><div className="amount-row"><span>Total amount</span><strong>{money((test?.price || 0) * Number(details.persons))}</strong></div>{error && <div className="inline-error">{error}</div>}<button className="button button-green full-button" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <>Reserve appointment <ArrowRight size={16} /></>}</button></form> : <div className="empty-inline"><p>This listing doesn’t include test availability or prices yet, so booking is unavailable. Please contact the centre directly for current services.</p><button className="button button-outline" onClick={onClose}>Got it</button></div>}</div></Modal>;
}

function PaymentModal({ booking, onClose, onDone }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function pay(result) { setBusy(true); setError(''); try { await api.post('/payments', { bookingId: booking._id, result, idempotencyKey: crypto.randomUUID() }); onDone(result === 'SUCCESS' ? 'Payment successful. Your appointment is confirmed.' : 'Payment failed. This booking is marked failed.'); } catch (e) { setError(e.message); setBusy(false); } }
  return <Modal onClose={onClose} narrow><div className="payment-modal"><div className="modal-symbol pay-symbol"><FlaskConical size={21} /></div><div className="eyebrow">SIMULATED CHECKOUT</div><h2>Complete your booking</h2><p>{booking.testName} at {booking.centreName}</p><div className="payment-total"><span>Booking total</span><strong>{money(booking.amount)}</strong></div><div className="sim-note"><ShieldCheck size={16} /> No real payment is taken. Choose an outcome to simulate.</div>{error && <div className="inline-error">{error}</div>}<button className="button button-green full-button" disabled={busy} onClick={() => pay('SUCCESS')}>{busy ? <LoaderCircle className="spin" size={17} /> : <><Check size={17} /> Simulate successful payment</>}</button><button className="button button-outline full-button" disabled={busy} onClick={() => pay('FAILED')}>Simulate failed payment</button></div></Modal>;
}

async function payBooking(item, loadBookings, notify, setError) {
  try { await api.post('/payments', { bookingId: item._id, result: 'SUCCESS', idempotencyKey: crypto.randomUUID() }); notify('Payment successful. Your appointment is confirmed.'); loadBookings(); }
  catch (e) { setError(e.message); }
}
function Field({ label, icon, children }) { return <label className="field"><span>{label}</span><span className="input-wrap"><span className="input-icon">{icon}</span>{children}</span></label>; }
function Modal({ children, onClose, narrow }) { useEffect(() => { const fn = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', fn); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; }; }, [onClose]); return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><div className={narrow ? 'modal-panel modal-narrow' : 'modal-panel'}><button className="modal-close" onClick={onClose} aria-label="Close"><X size={19} /></button>{children}</div></div>; }
