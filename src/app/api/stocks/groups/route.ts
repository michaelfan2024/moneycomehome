import { NextResponse } from 'next/server'
import { createStockGroup, ensureTables, getStockGroups, updateStockGroup } from '../../../../lib/db'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const groups = await getStockGroups(includeInactive)
    return NextResponse.json({ success: true, data: groups || [] })
  } catch (error) {
    console.error('Get groups error:', error)
    return NextResponse.json({ success: false, error: '获取分组失败' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await ensureTables()
    const { name } = await request.json()
    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, error: '缺少分组名称' }, { status: 400 })
    }

    const group = await createStockGroup(String(name))
    if (!group) {
      return NextResponse.json({ success: false, error: '创建分组失败' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: group })
  } catch (error) {
    console.error('Create group error:', error)
    return NextResponse.json({ success: false, error: '创建分组失败' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    await ensureTables()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: '缺少分组ID' }, { status: 400 })
    }

    const body = await request.json()
    const group = await updateStockGroup(id, {
      name: body.name,
      is_active: typeof body.is_active === 'boolean' ? body.is_active : undefined
    })
    if (!group) {
      return NextResponse.json({ success: false, error: '更新分组失败' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: group })
  } catch (error) {
    console.error('Update group error:', error)
    return NextResponse.json({ success: false, error: '更新分组失败' }, { status: 500 })
  }
}
