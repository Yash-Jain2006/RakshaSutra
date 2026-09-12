import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function readPlatformKey(keysVariable: string, legacyVariable: string) {
  try {
    const keys = Deno.env.get(keysVariable)
    if (keys) {
      const parsed = JSON.parse(keys)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].value as string
      if (parsed.default) return parsed.default as string
    }
  } catch (e) {
    console.error(`Failed to parse ${keysVariable}`, e)
  }
  return Deno.env.get(legacyVariable) ?? ''
}

const ADMIN_EMAIL = 'rakshaasutra@gmail.com'

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Missing authorization' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = readPlatformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const secretKey = readPlatformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: 'Server is not configured' }, 500)
  }

  // 1. Verify the caller is authenticated
  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthenticated' }, 401)

  // 2. Enforce admin-only access
  if (user.email !== ADMIN_EMAIL) {
    return json({ error: 'Forbidden: Admin access required' }, 403)
  }

  const payload = await request.json().catch(() => null)
  const { applicationId, userId } = payload || {}

  if (!applicationId) return json({ error: 'Missing applicationId' }, 400)

  // 3. Use service-role client to bypass RLS
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 4. Fetch document records from rakshak_documents
  const { data: docRecords, error: docError } = await admin
    .from('rakshak_documents')
    .select('id, side, storage_path, mime_type')
    .eq('application_id', applicationId)

  if (docError) {
    console.error('[admin-get-docs] DB error:', docError.message)
    return json({ error: 'Failed to fetch document records' }, 500)
  }

  let docs = docRecords || []

  // 5. Fallback: list files in storage folder directly if DB has no records
  if (docs.length === 0 && userId) {
    const { data: folderFiles } = await admin
      .storage.from('identity-documents')
      .list(userId)

    if (folderFiles && folderFiles.length > 0) {
      docs = folderFiles.map((f: any) => ({
        id: f.id || f.name,
        side: f.name.startsWith('back') ? 'back' : 'front',
        storage_path: `${userId}/${f.name}`,
        mime_type: f.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      }))
    }
  }

  if (docs.length === 0) {
    return json({ docs: [] })
  }

  // 6. Generate signed URLs (valid 10 minutes)
  const docsWithUrls = await Promise.all(
    docs.map(async (doc: any) => {
      const { data: urlData } = await admin
        .storage.from('identity-documents')
        .createSignedUrl(doc.storage_path, 600)
      return {
        id: doc.id,
        side: doc.side,
        storage_path: doc.storage_path,
        mime_type: doc.mime_type,
        signedUrl: urlData?.signedUrl ?? null,
      }
    })
  )

  return json({ docs: docsWithUrls })
})
