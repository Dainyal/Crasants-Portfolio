import { useEffect, useState } from 'react'

export default function App() {
  const [artworks, setArtworks] = useState([])
  const [token, setToken] = useState(() => sessionStorage.getItem('token'))
  const [showLogin, setShowLogin] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const refresh = () =>
    fetch('/api/artworks').then((r) => r.json()).then(setArtworks).catch(() => setError('Could not load artwork'))
  useEffect(() => { refresh() }, [])

  const auth = { Authorization: `Bearer ${token}` }
  const handleAuthError = (res) => {
    if (res.status === 401) { sessionStorage.removeItem('token'); setToken(null) }
  }

  async function login(e) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: new FormData(e.target).get('password') }),
    })
    if (!res.ok) return setError('Wrong password')
    const { token } = await res.json()
    sessionStorage.setItem('token', token)
    setToken(token)
    setShowLogin(false)
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', headers: auth })
    sessionStorage.removeItem('token')
    setToken(null)
  }

  async function upload(e) {
    e.preventDefault()
    setError('')
    const form = e.target
    const res = await fetch('/api/artworks', { method: 'POST', headers: auth, body: new FormData(form) })
    if (!res.ok) {
      handleAuthError(res)
      return setError((await res.json()).error || 'Upload failed')
    }
    form.reset()
    refresh()
  }

  async function remove(id) {
    if (!confirm('Delete this artwork?')) return
    const res = await fetch(`/api/artworks/${id}`, { method: 'DELETE', headers: auth })
    handleAuthError(res)
    refresh()
  }

  if (showLogin && !token) {
    return (
      <div className="login-screen">
        <form onSubmit={login} className="login-box">
          <h1>Artist login</h1>
          <input name="password" type="password" placeholder="Password" required autoFocus />
          <button>Log in</button>
          {error && <p className="error">{error}</p>}
          <button type="button" className="link" onClick={() => { setShowLogin(false); setError('') }}>
            Back to portfolio
          </button>
        </form>
      </div>
    )
  }

  return (
    <>
      <header>
        <h1>Crasants Portfolio</h1>
        {token ? (
          <button onClick={logout}>Log out</button>
        ) : (
          <button onClick={() => setShowLogin(true)}>Artist login</button>
        )}
      </header>
      <main>
        {token && (
          <form onSubmit={upload} className="panel">
            <input name="title" placeholder="Title" maxLength={100} />
            <input name="description" placeholder="Description" maxLength={500} />
            <input name="madeOn" type="date" title="Date created (optional)" aria-label="Date created" />
            <input name="image" type="file" accept="image/png,image/jpeg,image/gif,image/webp" required />
            <button>Upload</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        {artworks.length === 0 && <p>No artwork yet.</p>}
        <div className="grid">
          {artworks.map((a) => (
            <figure key={a.id}>
              <img src={`/uploads/${a.file}`} alt={a.title} onClick={() => setSelected(a)} />
              <figcaption>
                <strong>{a.title}</strong>
                {a.description && <span>{a.description}</span>}
                {a.madeOn && <span className="date">{new Date(a.madeOn + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
                {token && <button onClick={() => remove(a.id)}>Delete</button>}
              </figcaption>
            </figure>
          ))}
        </div>
      </main>
      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <img src={`/uploads/${selected.file}`} alt={selected.title} />
        </div>
      )}
    </>
  )
}
