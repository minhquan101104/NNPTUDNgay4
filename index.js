const http = require('http')
const { dataRole, dataUser } = require('./data')

let roles = JSON.parse(JSON.stringify(dataRole))
let users = JSON.parse(JSON.stringify(dataUser))

const port = 3000

function sendJSON(res, status, obj) {
  const s = JSON.stringify(obj)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(s)
  })
  res.end(s)
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => data += chunk)
    req.on('end', () => {
      if (!data) return resolve(null)
      try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function notFound(res) {
  sendJSON(res, 404, { error: 'Not found' })
}

function methodNotAllowed(res) {
  sendJSON(res, 405, { error: 'Method not allowed' })
}

function nowISO() { return new Date().toISOString() }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const parts = url.pathname.split('/').filter(Boolean)

  // ROUTES
  // /roles
  if (parts.length === 1 && parts[0] === 'roles') {
    if (req.method === 'GET') return sendJSON(res, 200, roles)
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req)
        if (!body || !body.name) return sendJSON(res, 400, { error: 'name required' })
        const id = 'r' + (Date.now()).toString(36)
        const newRole = {
          id,
          name: body.name,
          description: body.description || '',
          creationAt: nowISO(),
          updatedAt: nowISO()
        }
        roles.push(newRole)
        return sendJSON(res, 201, newRole)
      } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }) }
    }
    return methodNotAllowed(res)
  }

  // /roles/:id or /roles/:id/users
  if (parts.length >= 2 && parts[0] === 'roles') {
    const id = parts[1]
    const role = roles.find(r => r.id === id)
    if (!role) return notFound(res)
    if (parts.length === 2) {
      if (req.method === 'GET') return sendJSON(res, 200, role)
      if (req.method === 'PUT') {
        try {
          const body = await parseBody(req)
          role.name = body.name || role.name
          role.description = body.description || role.description
          role.updatedAt = nowISO()
          return sendJSON(res, 200, role)
        } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }) }
      }
      if (req.method === 'DELETE') {
        roles = roles.filter(r => r.id !== id)
        // also optionally remove role from users (keep original role objects)
        users = users.map(u => u.role && u.role.id === id ? { ...u, role: null } : u)
        return sendJSON(res, 200, { success: true })
      }
      return methodNotAllowed(res)
    }

    // /roles/:id/users
    if (parts.length === 3 && parts[2] === 'users') {
      if (req.method === 'GET') {
        const matched = users.filter(u => u.role && u.role.id === id)
        return sendJSON(res, 200, matched)
      }
      return methodNotAllowed(res)
    }
  }

  // /users
  if (parts.length === 1 && parts[0] === 'users') {
    if (req.method === 'GET') return sendJSON(res, 200, users)
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req)
        if (!body || !body.username) return sendJSON(res, 400, { error: 'username required' })
        if (users.find(u => u.username === body.username)) return sendJSON(res, 409, { error: 'username exists' })
        const roleObj = body.role ? roles.find(r => r.id === body.role.id) || body.role : null
        const newUser = {
          username: body.username,
          password: body.password || '',
          email: body.email || '',
          fullName: body.fullName || '',
          avatarUrl: body.avatarUrl || '',
          status: typeof body.status === 'boolean' ? body.status : true,
          loginCount: typeof body.loginCount === 'number' ? body.loginCount : 0,
          role: roleObj ? { id: roleObj.id, name: roleObj.name, description: roleObj.description } : null,
          creationAt: nowISO(),
          updatedAt: nowISO()
        }
        users.push(newUser)
        return sendJSON(res, 201, newUser)
      } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }) }
    }
    return methodNotAllowed(res)
  }

  // /users/:username
  if (parts.length === 2 && parts[0] === 'users') {
    const username = parts[1]
    const user = users.find(u => u.username === username)
    if (!user) return notFound(res)
    if (req.method === 'GET') return sendJSON(res, 200, user)
    if (req.method === 'PUT') {
      try {
        const body = await parseBody(req)
        user.email = body.email || user.email
        user.fullName = body.fullName || user.fullName
        user.avatarUrl = body.avatarUrl || user.avatarUrl
        if (body.role) {
          const roleObj = roles.find(r => r.id === body.role.id)
          user.role = roleObj ? { id: roleObj.id, name: roleObj.name, description: roleObj.description } : body.role
        }
        user.status = typeof body.status === 'boolean' ? body.status : user.status
        user.loginCount = typeof body.loginCount === 'number' ? body.loginCount : user.loginCount
        user.updatedAt = nowISO()
        return sendJSON(res, 200, user)
      } catch (e) { return sendJSON(res, 400, { error: 'Invalid JSON' }) }
    }
    if (req.method === 'DELETE') {
      users = users.filter(u => u.username !== username)
      return sendJSON(res, 200, { success: true })
    }
    return methodNotAllowed(res)
  }

  notFound(res)
})

server.listen(port, () => console.log(`CRUD server running on http://localhost:${port}`))