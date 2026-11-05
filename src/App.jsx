import { useEffect, useState } from 'react'

export default function App() {
  const [artworks, setArtworks] = useState([])
  const [token, setToken] = useState(() => sessionStorage.getItem('token'))
  const [showLogin, setShowLogin] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [visitorView, setVisitorView] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editError, setEditError] = useState('')
  const isArtist = token && !visitorView

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

  function logout() {
    fetch('/api/logout', { method: 'POST', headers: auth }).catch(() => {})
    sessionStorage.removeItem('token')
    setToken(null)
    setVisitorView(false)
    setEditing(null)
    setError('')
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

  async function saveEdit(e) {
    e.preventDefault()
    setEditError('')
    const f = new FormData(e.target)
    try {
      const res = await fetch(`/api/artworks/${editing}`, {
        method: 'PATCH',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: f.get('title'), description: f.get('description'), madeOn: f.get('madeOn') }),
      })
      if (!res.ok) {
        handleAuthError(res)
        if (res.status === 401) return setEditError('Your login expired. Please log in again.')
        if (res.status === 404) return setEditError('Server not updated or entry missing. Restart the server and refresh.')
        return setEditError('Could not save changes')
      }
      setEditing(null)
      await refresh()
    } catch {
      setEditError('Could not reach the server')
    }
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
        <div className="brand">
          <h1>Crasants</h1>
          <p>Digital Art Portfolio</p>
        </div>
        {token ? (
          <div className="actions header-actions">
            <button onClick={() => { setVisitorView((v) => !v); setEditing(null) }}>
              {visitorView ? 'Back to artist view' : 'View as visitor'}
            </button>
            <button onClick={logout}>Log out</button>
          </div>
        ) : (
          <button className="header-actions" onClick={() => setShowLogin(true)}>Artist login</button>
        )}
      </header>
      <main>
        {isArtist && (
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
              {isArtist && editing === a.id ? (
                <form className="edit" onSubmit={saveEdit}>
                  <input name="title" defaultValue={a.title} maxLength={100} placeholder="Title" />
                  <input name="description" defaultValue={a.description} maxLength={500} placeholder="Description" />
                  <input name="madeOn" type="date" defaultValue={a.madeOn || ''} aria-label="Date created" />
                  {editError && <p className="error">{editError}</p>}
                  <div className="actions">
                    <button>Save</button>
                    <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <figcaption>
                  <strong>{a.title}</strong>
                  {a.description && <span>{a.description}</span>}
                  {a.madeOn && <span className="date">{new Date(a.madeOn + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>}
                  {isArtist && (
                    <div className="actions">
                      <button className="secondary" onClick={() => { setEditError(''); setEditing(a.id) }}>Edit</button>
                      <button onClick={() => remove(a.id)}>Delete</button>
                    </div>
                  )}
                </figcaption>
              )}
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
