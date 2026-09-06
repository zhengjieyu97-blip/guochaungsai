import { describe, expect, it, vi } from 'vitest'
import { api } from '@/services/api'

describe('api client', () => {
  it('sends demo login with credentials and returns the server payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: { id: 'u1' }, permissions: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.login('COMMUNITY_WORKER')

    expect(result.user.id).toBe('u1')
    expect(fetchMock).toHaveBeenCalledWith('/api/demo-login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
  })

  it('surfaces the backend error code for command conflicts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'EVENT_STATE_CONFLICT', message: '事件已关闭' }), { status: 409 })))
    await expect(api.accept('EVENT-001')).rejects.toMatchObject({ code: 'EVENT_STATE_CONFLICT', status: 409 })
  })
})
